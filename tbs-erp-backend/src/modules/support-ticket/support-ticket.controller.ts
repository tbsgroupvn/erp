import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { SupportTicketService } from './support-ticket.service';

@ApiTags('Support Tickets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CEO, UserRole.COO, UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.DIRECTOR_OPERATIONS)
@Controller('support-tickets')
export class SupportTicketController {
  constructor(private readonly supportTicketService: SupportTicketService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a support ticket',
    description: 'Creates a new support ticket for a customer with auto-generated code.',
  })
  @ApiResponse({ status: 201, description: 'Support ticket created successfully' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async create(
    @Body()
    dto: {
      customerId: string;
      category: string;
      subject: string;
      description: string;
      priority?: string;
      assignedTo?: string;
    },
    @CurrentUser() user: ICurrentUser,
  ) {
    const ticket = await this.supportTicketService.create(dto, user.id);
    return BaseResponse.ok(ticket, 'Support ticket created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List support tickets',
    description:
      'Returns paginated support tickets with filtering by status, customer, assignee, priority, and category.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({ name: 'priority', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Support tickets retrieved successfully' })
  async findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.supportTicketService.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      status,
      customerId,
      assignedTo,
      priority,
      category,
      search,
    });
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get support ticket detail',
    description: 'Returns full ticket details including responses.',
  })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({ status: 200, description: 'Support ticket retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Support ticket not found' })
  async findById(@Param('id') id: string) {
    const ticket = await this.supportTicketService.findById(id);
    return BaseResponse.ok(ticket);
  }

  @Post(':id/responses')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add a response to a ticket',
    description:
      'Adds a response to a support ticket. Auto-sets firstResponseAt and transitions status from OPEN to IN_PROGRESS.',
  })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({ status: 201, description: 'Response added successfully' })
  @ApiResponse({ status: 400, description: 'Cannot respond to closed ticket' })
  @ApiResponse({ status: 404, description: 'Support ticket not found' })
  async addResponse(
    @Param('id') id: string,
    @Body() body: { content: string; isInternal?: boolean },
    @CurrentUser() user: ICurrentUser,
  ) {
    const response = await this.supportTicketService.addResponse(
      id,
      body.content,
      body.isInternal ?? false,
      user.id,
    );
    return BaseResponse.ok(response, 'Response added successfully');
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update ticket status',
    description: 'Updates the status of a support ticket. Sets resolvedAt when status is RESOLVED.',
  })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status' })
  @ApiResponse({ status: 404, description: 'Support ticket not found' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    const ticket = await this.supportTicketService.updateStatus(id, status);
    return BaseResponse.ok(ticket, 'Ticket status updated successfully');
  }

  @Patch(':id/assign')
  @ApiOperation({
    summary: 'Assign ticket to user',
    description: 'Assigns a support ticket to a specific user for handling.',
  })
  @ApiParam({ name: 'id', description: 'Support ticket ID' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 400, description: 'Cannot assign resolved/closed ticket' })
  @ApiResponse({ status: 404, description: 'Support ticket not found' })
  async assign(@Param('id') id: string, @Body('userId') userId: string) {
    const ticket = await this.supportTicketService.assign(id, userId);
    return BaseResponse.ok(ticket, 'Ticket assigned successfully');
  }
}
