import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ApprovalTemplateService } from './approval-template.service';

/**
 * ApprovalTemplateController exposes the template catalogue and install actions.
 *
 * Read access (GET) is granted to DIRECTOR-level and above so they can browse
 * available templates before choosing one to install.
 *
 * Write access (POST install) is restricted to CEO/COO who are authorised to
 * change live approval workflows in production.
 */
@ApiTags('Approval Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approval-templates')
export class ApprovalTemplateController {
  constructor(private readonly templateService: ApprovalTemplateService) {}

  /**
   * GET /approval-templates
   * List all approval templates, optionally filtered by category string.
   * Response includes an `isInstalled` flag per template.
   */
  @Get()
  @ApiOperation({
    summary: 'List all approval flow templates',
    description:
      'Returns the full template catalogue with an isInstalled flag indicating whether ' +
      'an active FlowDefinition already exists for each template triggerType.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by category (e.g. SALES, FINANCE, HR, LOGISTICS)',
  })
  @Roles('CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS')
  async listTemplates(@Query('category') category?: string) {
    const data = await this.templateService.listTemplates(category);
    return BaseResponse.ok(data);
  }

  /**
   * GET /approval-templates/:slug
   * Get full detail for a single template including its nodesJson and edgesJson.
   */
  @Get(':slug')
  @ApiOperation({
    summary: 'Get a single approval flow template by slug',
    description:
      'Returns template detail including nodesJson, edgesJson, and an isInstalled flag.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly template identifier' })
  @Roles('CEO', 'COO', 'CFO', 'DIRECTOR_OPERATIONS')
  async getTemplate(@Param('slug') slug: string) {
    const data = await this.templateService.getTemplate(slug);
    return BaseResponse.ok(data);
  }

  /**
   * POST /approval-templates/:slug/install
   * Install a template: deactivates the prior active FlowDefinition for the
   * same triggerType and creates a new one from the template's node/edge definitions.
   */
  @Post(':slug/install')
  @ApiOperation({
    summary: 'Install an approval template as the active flow definition',
    description:
      'Deactivates the existing active FlowDefinition for the template triggerType ' +
      'and creates a new one from the template blueprint. Only CEO and COO may perform this action.',
  })
  @ApiParam({ name: 'slug', description: 'URL-friendly template identifier' })
  @Roles('CEO', 'COO')
  async installTemplate(
    @Param('slug') slug: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.templateService.installTemplate(slug, user.id);
    return BaseResponse.ok(data, `Template '${slug}' installed successfully`);
  }
}
