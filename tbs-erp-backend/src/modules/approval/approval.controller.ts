import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ApprovalService } from './approval.service';
import { ApprovalAnalyticsService } from './analytics/approval-analytics.service';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { ProcessApprovalDto } from './dto/process-approval.dto';
import { ApprovalQueryDto } from './dto/approval-query.dto';
import { DelegateApprovalDto } from './dto/delegate-approval.dto';
import { AddApproverDto } from './dto/add-approver.dto';
import { CreateApprovalCommentDto } from './dto/approval-comment.dto';
import { BatchApproveDto, BatchRejectDto } from './dto/batch-approval.dto';

@ApiTags('System - Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approvals')
export class ApprovalController {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly analyticsService: ApprovalAnalyticsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Submit a new approval request' })
  async create(@Body() dto: CreateApprovalDto, @CurrentUser() user: ICurrentUser) {
    const approval = await this.approvalService.createApprovalRequest(
      dto.type,
      dto.referenceId,
      user.id,
      {
        referenceCode: dto.referenceCode,
        requestData: dto.requestData,
        isUrgent: dto.isUrgent,
      },
    );
    return BaseResponse.ok(approval, 'Approval request submitted');
  }

  @Get('counts')
  @ApiOperation({ summary: 'Get approval counts for badges' })
  async getCounts(@CurrentUser() user: ICurrentUser) {
    const counts = await this.approvalService.getApprovalCounts(user.id, user.role);
    return BaseResponse.ok(counts);
  }

  @Get('submitted')
  @ApiOperation({ summary: 'Get approvals I submitted' })
  async getSubmitted(@CurrentUser('id') userId: string, @Query() query: ApprovalQueryDto) {
    const result = await this.approvalService.getMySubmitted(userId, query);
    return BaseResponse.ok(result);
  }

  @Get('processed')
  @ApiOperation({ summary: 'Get approvals I have processed' })
  async getProcessed(@CurrentUser('id') userId: string, @Query() query: ApprovalQueryDto) {
    const result = await this.approvalService.getMyProcessed(userId, query);
    return BaseResponse.ok(result);
  }

  @Get('cc')
  @ApiOperation({ summary: 'Get approvals I am CC on' })
  async getCCApprovals(@CurrentUser('id') userId: string, @Query() query: ApprovalQueryDto) {
    const result = await this.approvalService.getMyCCApprovals(userId, query);
    return BaseResponse.ok(result);
  }

  // --- Analytics ---

  @Get('analytics/overview')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.HR_MANAGER, UserRole.CHIEF_ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Get approval analytics overview' })
  @ApiQuery({ name: 'dateFrom', required: true, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'dateTo', required: true, type: String, description: 'ISO date string' })
  async getAnalyticsOverview(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const overview = await this.analyticsService.getOverview(
      new Date(dateFrom),
      new Date(dateTo),
    );
    return BaseResponse.ok(overview);
  }

  @Get('analytics/bottlenecks')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.HR_MANAGER, UserRole.CHIEF_ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Get approval bottleneck analysis' })
  @ApiQuery({ name: 'dateFrom', required: true, type: String })
  @ApiQuery({ name: 'dateTo', required: true, type: String })
  async getBottlenecks(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const bottlenecks = await this.analyticsService.getBottlenecks(
      new Date(dateFrom),
      new Date(dateTo),
    );
    return BaseResponse.ok(bottlenecks);
  }

  @Get('analytics/type-breakdown')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.HR_MANAGER, UserRole.CHIEF_ACCOUNTANT,
  )
  @ApiOperation({ summary: 'Get approval type breakdown' })
  @ApiQuery({ name: 'dateFrom', required: true, type: String })
  @ApiQuery({ name: 'dateTo', required: true, type: String })
  async getTypeBreakdown(
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    const breakdown = await this.analyticsService.getTypeBreakdown(
      new Date(dateFrom),
      new Date(dateTo),
    );
    return BaseResponse.ok(breakdown);
  }

  // --- Main CRUD ---

  @Get()
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.HR_MANAGER, UserRole.CHIEF_ACCOUNTANT,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.WAREHOUSE_MANAGER,
    UserRole.WAREHOUSE_VN_MANAGER,
  )
  @ApiOperation({ summary: 'List all approvals with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: ApprovalQueryDto) {
    return this.approvalService.findAll(query);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Get my pending approvals (based on role)' })
  async getPending(
    @CurrentUser() user: ICurrentUser,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const result = await this.approvalService.getMyPendingApprovals(
      user.role,
      limit ?? 20,
      offset ?? 0,
    );
    return BaseResponse.ok(result);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get approval history for current user' })
  async getHistory(
    @CurrentUser('id') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const result = await this.approvalService.getHistory(userId, limit ?? 20, offset ?? 0);
    return BaseResponse.ok(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get approval details by ID' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  async findOne(@Param('id') id: string) {
    const approval = await this.approvalService.findById(id);
    return BaseResponse.ok(approval);
  }

  // --- Actions ---

  @Post('batch-approve')
  @ApiOperation({ summary: 'Batch approve multiple approvals' })
  async batchApprove(
    @Body() dto: BatchApproveDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.approvalService.batchApprove(
      dto.approvalIds,
      user.id,
      user.role,
      dto.comment,
    );
    return BaseResponse.ok(result, `Đã duyệt ${result.successCount}/${dto.approvalIds.length}`);
  }

  @Post('batch-reject')
  @ApiOperation({ summary: 'Batch reject multiple approvals' })
  async batchReject(
    @Body() dto: BatchRejectDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.approvalService.batchReject(
      dto.approvalIds,
      user.id,
      user.role,
      dto.comment,
    );
    return BaseResponse.ok(result, `Đã từ chối ${result.successCount}/${dto.approvalIds.length}`);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve the current step' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ProcessApprovalDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const approval = await this.approvalService.processStep(
      id,
      'APPROVE',
      user.id,
      user.role,
      dto.comment,
    );
    return BaseResponse.ok(approval, 'Step approved successfully');
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject the approval request' })
  @ApiParam({ name: 'id', description: 'Approval ID' })
  async reject(
    @Param('id') id: string,
    @Body() dto: ProcessApprovalDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const approval = await this.approvalService.processStep(
      id,
      'REJECT',
      user.id,
      user.role,
      dto.comment,
    );
    return BaseResponse.ok(approval, 'Approval rejected');
  }

  @Post(':id/delegate')
  @ApiOperation({ summary: 'Delegate a step to another user' })
  @ApiParam({ name: 'id' })
  async delegate(
    @Param('id') id: string,
    @Body() dto: DelegateApprovalDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.approvalService.delegateStep(
      id,
      dto.stepId,
      user.id,
      dto.toUserId,
      dto.comment,
    );
    return BaseResponse.ok(result, 'Step delegated');
  }

  @Post(':id/add-approver')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO, UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR, UserRole.HR_MANAGER, UserRole.CHIEF_ACCOUNTANT,
    UserRole.LOGISTICS_MANAGER, UserRole.XNK_MANAGER, UserRole.WAREHOUSE_MANAGER,
    UserRole.WAREHOUSE_VN_MANAGER,
  )
  @ApiOperation({ summary: 'Add an approver to the flow' })
  @ApiParam({ name: 'id' })
  async addApprover(
    @Param('id') id: string,
    @Body() dto: AddApproverDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.approvalService.addApproverStep(
      id,
      dto.afterStepNumber,
      dto.role,
      user.id,
      dto.userId,
    );
    return BaseResponse.ok(result, 'Approver added');
  }

  @Post(':id/withdraw')
  @ApiOperation({ summary: 'Withdraw an approval request' })
  @ApiParam({ name: 'id' })
  async withdraw(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const result = await this.approvalService.withdrawApproval(id, userId);
    return BaseResponse.ok(result, 'Approval withdrawn');
  }

  @Post(':id/return')
  @ApiOperation({ summary: 'Return an approval for revision' })
  @ApiParam({ name: 'id' })
  async returnForRevision(
    @Param('id') id: string,
    @Body() body: { comment: string },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.approvalService.returnApproval(id, userId, body.comment);
    return BaseResponse.ok(result, 'Approval returned for revision');
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to an approval' })
  @ApiParam({ name: 'id' })
  async addComment(
    @Param('id') id: string,
    @Body() dto: CreateApprovalCommentDto,
    @CurrentUser('id') userId: string,
  ) {
    const comment = await this.approvalService.addComment(id, userId, dto.content, dto.stepId);
    return BaseResponse.ok(comment, 'Comment added');
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'Get comments for an approval' })
  @ApiParam({ name: 'id' })
  async getComments(@Param('id') id: string) {
    const comments = await this.approvalService.getComments(id);
    return BaseResponse.ok(comments);
  }

  @Get(':id/action-log')
  @ApiOperation({ summary: 'Get action log for an approval' })
  @ApiParam({ name: 'id' })
  async getActionLog(@Param('id') id: string) {
    const logs = await this.approvalService.getActionLog(id);
    return BaseResponse.ok(logs);
  }
}
