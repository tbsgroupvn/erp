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
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { Throttle } from '@nestjs/throttler';
import { ResolutionType, UserRole } from '@prisma/client';
import { ComplaintService } from './complaint.service';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintDto } from './dto/update-complaint.dto';
import { ComplaintQueryDto } from './dto/complaint-query.dto';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Roles(UserRole.CSKH, UserRole.SALE, UserRole.SALES_LEADER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new complaint',
    description:
      'Creates a new complaint for an order. CRITICAL severity auto-notifies management.',
  })
  @ApiResponse({ status: 201, description: 'Complaint created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order or customer not found' })
  async create(@Body() dto: CreateComplaintDto, @CurrentUser() user: ICurrentUser) {
    const complaint = await this.complaintService.createComplaint(user.id, dto);
    return BaseResponse.ok(complaint, 'Complaint created successfully');
  }

  @Get()
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.DIRECTOR_OPERATIONS, UserRole.SALE, UserRole.SALES_LEADER)
  @ApiOperation({
    summary: 'List complaints',
    description:
      'Returns paginated complaints with filtering by status, type, severity, customer, and date range. Data scope is applied based on user role.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Complaints retrieved successfully' })
  async findAll(@Query() query: ComplaintQueryDto, @CurrentUser() user: ICurrentUser) {
    const result = await this.complaintService.findAll(query, user);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('statistics')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.DIRECTOR_OPERATIONS)
  @ApiOperation({
    summary: 'Get complaint statistics',
    description:
      'Returns complaint stats by type, severity, resolution time, and compensation totals.',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date (ISO 8601)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date (ISO 8601)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStatistics(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
    const stats = await this.complaintService.getStatistics({
      startDate,
      endDate,
    });
    return BaseResponse.ok(stats);
  }

  @Get(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.DIRECTOR_OPERATIONS, UserRole.SALE, UserRole.SALES_LEADER)
  @ApiOperation({
    summary: 'Get complaint detail',
    description: 'Returns full complaint details including order and customer info. Data scope is enforced based on user role.',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({ status: 200, description: 'Complaint retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Complaint not found' })
  async findById(@Param('id') id: string, @CurrentUser() user: ICurrentUser) {
    const complaint = await this.complaintService.findById(id, user);
    return BaseResponse.ok(complaint);
  }

  @Patch(':id')
  @Roles(UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.CEO, UserRole.COO)
  @ApiOperation({
    summary: 'Update a complaint',
    description:
      'Updates complaint details and investigation notes. Cannot update closed complaints.',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({ status: 200, description: 'Complaint updated successfully' })
  @ApiResponse({ status: 400, description: 'Complaint cannot be updated' })
  @ApiResponse({ status: 404, description: 'Complaint not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateComplaintDto) {
    const complaint = await this.complaintService.updateComplaint(id, dto);
    return BaseResponse.ok(complaint, 'Complaint updated successfully');
  }

  @Post(':id/assign')
  @Roles(UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign complaint handler',
    description: 'Assigns a complaint to a specific employee for handling.',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({ status: 200, description: 'Handler assigned successfully' })
  @ApiResponse({ status: 400, description: 'Cannot assign to resolved/closed complaint' })
  @ApiResponse({ status: 404, description: 'Complaint not found' })
  async assignHandler(@Param('id') id: string, @Body('handlerId') handlerId: string) {
    const complaint = await this.complaintService.assignHandler(id, handlerId);
    return BaseResponse.ok(complaint, 'Handler assigned successfully');
  }

  @Post(':id/resolve')
  @Roles(UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve a complaint',
    description:
      'Marks a complaint as resolved with resolution details. High compensation requires approval.',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({ status: 200, description: 'Complaint resolved or pending approval' })
  @ApiResponse({ status: 400, description: 'Complaint cannot be resolved' })
  @ApiResponse({ status: 404, description: 'Complaint not found' })
  async resolve(
    @Param('id') id: string,
    @Body()
    resolution: {
      type: ResolutionType;
      amount?: number;
      notes?: string;
    },
  ) {
    const result = await this.complaintService.resolveComplaint(id, resolution);
    return BaseResponse.ok(result);
  }

  @Post(':id/escalate')
  @Roles(UserRole.CSKH, UserRole.SALES_DIRECTOR, UserRole.CEO, UserRole.COO)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Escalate a complaint',
    description:
      'Escalates a complaint to higher management level (SALES_LEADER, SALES_DIRECTOR, CEO).',
  })
  @ApiParam({ name: 'id', description: 'Complaint ID' })
  @ApiResponse({ status: 200, description: 'Complaint escalated' })
  @ApiResponse({ status: 400, description: 'Cannot escalate resolved/closed complaint' })
  @ApiResponse({ status: 404, description: 'Complaint not found' })
  async escalate(@Param('id') id: string, @Body('level') level: string) {
    const complaint = await this.complaintService.escalateComplaint(id, level);
    return BaseResponse.ok(complaint, `Complaint escalated to ${level}`);
  }
}
