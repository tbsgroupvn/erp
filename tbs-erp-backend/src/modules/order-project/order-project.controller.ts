import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
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
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { OrderProjectService } from './order-project.service';
import { ReassignOrderDto } from './dto/reassign-order.dto';

/**
 * OrderProjectController exposes the order-project management endpoints.
 *
 * All routes use the '/order-project' prefix to avoid collision with
 * the existing OrderController which owns '/orders'.
 */
@ApiTags('Order Project')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('order-project')
export class OrderProjectController {
  constructor(private readonly orderProjectService: OrderProjectService) {}

  // ─── Project Overview ─────────────────────────────────────────────────────

  @Get(':id/overview')
  @ApiOperation({
    summary: 'Get order project overview',
    description:
      'Returns the full project view for an order: active assignment, handoff log, ' +
      'auto-created stage tasks, and SLA status (overdue flag, percent elapsed, remaining ms).',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Project view retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getProjectView(@Param('id') orderId: string) {
    const view = await this.orderProjectService.getProjectView(orderId);
    return BaseResponse.ok(view);
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  @Get(':id/assignments')
  @ApiOperation({
    summary: 'List all assignments for an order',
    description:
      'Returns all assignment records for the given order (all statuses), newest first. ' +
      'Includes the assignee name for each assignment.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Assignments retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getAssignments(@Param('id') orderId: string) {
    const assignments = await this.orderProjectService.getAssignmentsByOrder(orderId);
    return BaseResponse.ok(assignments);
  }

  @Patch(':id/assignments/:assignmentId/reassign')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.CFO,
  )
  @ApiOperation({
    summary: 'Reassign an order stage to a different user',
    description:
      'Reassigns the specified ACTIVE assignment to a new user. ' +
      'A REASSIGNMENT handoff is recorded for audit. ' +
      'If a linked auto-task exists, its assignee is updated too. ' +
      'Restricted to managers and above.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiParam({ name: 'assignmentId', description: 'Assignment ID to reassign' })
  @ApiResponse({ status: 200, description: 'Assignment reassigned successfully' })
  @ApiResponse({ status: 400, description: 'Assignment is not ACTIVE or belongs to different order' })
  @ApiResponse({ status: 403, description: 'Insufficient role' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async reassign(
    @Param('id') orderId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReassignOrderDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const updated = await this.orderProjectService.reassignOrder(
      orderId,
      assignmentId,
      dto.newAssigneeId,
      user.id,
    );
    return BaseResponse.ok(updated, 'Assignment reassigned successfully');
  }

  // ─── Handoffs ─────────────────────────────────────────────────────────────

  @Get(':id/handoffs')
  @ApiOperation({
    summary: 'List handoff history for an order',
    description:
      'Returns all handoff records for the given order, newest first. ' +
      'Each record shows which department/user handed off to which, and for how long they held it.',
  })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Handoffs retrieved' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getHandoffs(@Param('id') orderId: string) {
    const handoffs = await this.orderProjectService.getHandoffsByOrder(orderId);
    return BaseResponse.ok(handoffs);
  }

  // ─── Personal & Department Views ──────────────────────────────────────────

  @Get('my-assignments')
  @ApiOperation({
    summary: 'Get my active assignments',
    description:
      'Returns all ACTIVE assignments explicitly assigned to the requesting user, ' +
      'plus unassigned assignments in the user\'s role queue. Sorted by SLA deadline ascending.',
  })
  @ApiResponse({ status: 200, description: 'My assignments retrieved' })
  async getMyAssignments(@CurrentUser() user: ICurrentUser) {
    const assignments = await this.orderProjectService.getMyAssignments(user.id, user.role);
    return BaseResponse.ok(assignments);
  }

  @Get('department-board')
  @ApiOperation({
    summary: 'Get department board',
    description:
      'Returns all ACTIVE assignments for the user\'s department, sorted by overdue first then SLA deadline. ' +
      'Executives see all departments. Roles without a department mapping also see all.',
  })
  @ApiResponse({ status: 200, description: 'Department board retrieved' })
  async getDepartmentBoard(@CurrentUser() user: ICurrentUser) {
    const board = await this.orderProjectService.getDepartmentBoard(user.id, user.role);
    return BaseResponse.ok(board);
  }
}
