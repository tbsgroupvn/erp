import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '@core/database/prisma.service';
import { WebhookRetryService } from './webhook-retry.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { validateWebhookUrl } from './webhook-url-validator';

/**
 * Webhook Management Controller — CRUD for webhook endpoint subscriptions.
 *
 * Endpoints:
 *   POST   /integrations/webhooks          — Register a new webhook endpoint
 *   GET    /integrations/webhooks          — List all endpoints for the org
 *   GET    /integrations/webhooks/:id      — Get endpoint details
 *   PUT    /integrations/webhooks/:id      — Update endpoint
 *   DELETE /integrations/webhooks/:id      — Delete endpoint
 *   GET    /integrations/webhooks/:id/deliveries — Delivery history
 *   POST   /integrations/webhooks/:id/test — Send test event
 *
 * Access: CEO, COO, DIRECTOR_OPERATIONS roles only.
 */
@Controller('integrations/webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CEO', 'COO', 'DIRECTOR_OPERATIONS')
export class WebhookController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookRetryService: WebhookRetryService,
  ) {}

  /**
   * Register a new webhook endpoint.
   *
   * Returns the generated signing secret in plaintext. This is the ONLY time
   * the secret is returned — it is stored as a hash and cannot be retrieved later.
   * The caller must save it to verify webhook signatures.
   */
  @Post()
  async createEndpoint(
    @Body() body: { url: string; events: string[]; description?: string },
    @CurrentUser() user: { id: string },
  ) {
    // Validate webhook URL to prevent SSRF attacks
    validateWebhookUrl(body.url);

    // Generate a secure random secret and hash it before storage
    const rawSecret = `whsec_${randomBytes(32).toString('hex')}`;
    const hashedSecret = await bcrypt.hash(rawSecret, 12);

    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        url: body.url,
        events: body.events,
        secret: hashedSecret, // Store HASHED version only
        description: body.description,
        createdBy: user.id,
      },
    });

    return {
      id: endpoint.id,
      url: endpoint.url,
      events: endpoint.events,
      description: endpoint.description,
      secret: rawSecret, // Only time the raw secret is shown
      isActive: endpoint.isActive,
      createdAt: endpoint.createdAt,
      message: 'Save this secret now. It cannot be retrieved again.',
    };
  }

  /**
   * List all webhook endpoints.
   */
  @Get()
  async listEndpoints(@Query('page') page = '1', @Query('limit') limit = '20') {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [endpoints, total] = await Promise.all([
      this.prisma.webhookEndpoint.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          url: true,
          events: true,
          description: true,
          isActive: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { deliveries: true } },
        },
      }),
      this.prisma.webhookEndpoint.count(),
    ]);

    return {
      data: endpoints,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Get a single webhook endpoint with recent delivery stats.
   */
  @Get(':id')
  async getEndpoint(@Param('id') id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        url: true,
        events: true,
        description: true,
        isActive: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            deliveries: {
              where: { status: 'success' },
            },
          },
        },
      },
    });

    // Get delivery stats for last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const stats = await this.prisma.webhookDelivery.groupBy({
      by: ['status'],
      where: { endpointId: id, createdAt: { gte: since } },
      _count: true,
    });

    return {
      ...endpoint,
      deliveryStats24h: stats.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Update a webhook endpoint.
   */
  @Put(':id')
  async updateEndpoint(
    @Param('id') id: string,
    @Body() body: { url?: string; events?: string[]; description?: string; isActive?: boolean },
  ) {
    // Validate new URL if provided to prevent SSRF attacks
    if (body.url !== undefined) {
      validateWebhookUrl(body.url);
    }

    const endpoint = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(body.url !== undefined && { url: body.url }),
        ...(body.events !== undefined && { events: body.events }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
      select: {
        id: true,
        url: true,
        events: true,
        description: true,
        isActive: true,
        updatedAt: true,
      },
    });

    return endpoint;
  }

  /**
   * Delete a webhook endpoint and all associated delivery records.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEndpoint(@Param('id') id: string): Promise<void> {
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  /**
   * Get delivery history for a specific endpoint.
   */
  @Get(':id/deliveries')
  async getDeliveries(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const where: any = { endpointId: id };
    if (status) {
      where.status = status;
    }

    const [deliveries, total] = await Promise.all([
      this.prisma.webhookDelivery.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          event: true,
          statusCode: true,
          status: true,
          attempts: true,
          errorMessage: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      this.prisma.webhookDelivery.count({ where }),
    ]);

    return {
      data: deliveries,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Send a test webhook event to verify endpoint connectivity.
   */
  @Post(':id/test')
  async testEndpoint(@Param('id') id: string) {
    const result = await this.webhookRetryService.sendTestEvent(id);
    return result;
  }
}
