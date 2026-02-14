import {
  Controller,
  Get,
  Post,
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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import {
  BaseResponse,
  PaginatedResponse,
} from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { QCService } from './qc.service';
import { CreateQCInspectionDto } from './dto/create-qc-inspection.dto';
import { SubmitInspectionDto } from './dto/submit-inspection.dto';
import { CustomerDecisionDto } from './dto/customer-decision.dto';
import { AddPhotosDto } from './dto/add-photos.dto';
import { QCQueryDto } from './dto/qc-query.dto';

@ApiTags('QC Inspections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('qc/inspections')
export class QCController {
  constructor(private readonly qcService: QCService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Create a new QC inspection',
    description:
      'Creates a QC inspection record for an order with PENDING status. ' +
      'Optionally links to a specific package.',
  })
  @ApiResponse({ status: 201, description: 'QC inspection created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Order or package not found' })
  async createInspection(
    @Body() dto: CreateQCInspectionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.qcService.createInspection(dto, user.id);
    return BaseResponse.ok(result, 'QC inspection created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List QC inspections',
    description:
      'Returns paginated QC inspections with optional filters for status, ' +
      'order, package, search term, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'QC inspections retrieved successfully' })
  async findAll(@Query() query: QCQueryDto) {
    const result = await this.qcService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get QC inspection detail',
    description:
      'Returns full QC inspection details including order, package, ' +
      'photos, checklist results, and customer review information.',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'QC inspection retrieved successfully' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async findById(@Param('id') id: string) {
    const result = await this.qcService.findById(id);
    return BaseResponse.ok(result);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Start a QC inspection',
    description:
      'Moves the inspection from PENDING to INSPECTING status. ' +
      'Records the inspector and start time.',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'QC inspection started' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async startInspection(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.qcService.startInspection(id, user.id);
    return BaseResponse.ok(result, 'QC inspection started');
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Submit QC inspection results',
    description:
      'Records inspection quantities, photos, rating, and checklist results. ' +
      'Status is automatically determined: PASSED (no failures), ' +
      'FAILED (all failures), or PARTIAL (mixed results).',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'QC inspection results submitted' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid status transition' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async submitInspection(
    @Param('id') id: string,
    @Body() dto: SubmitInspectionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.qcService.submitInspection(id, dto, user.id);
    return BaseResponse.ok(result, 'QC inspection results submitted');
  }

  @Post(':id/send-to-customer')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Send QC results to customer',
    description:
      'Sends inspection photos and results to the customer for review. ' +
      'Moves status to CUSTOMER_REVIEW. Valid from PASSED, FAILED, or PARTIAL.',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'QC results sent to customer' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async sendToCustomer(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.qcService.sendToCustomer(id, user.id);
    return BaseResponse.ok(result, 'QC inspection sent to customer for review');
  }

  @Post(':id/customer-decision')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record customer approval or rejection',
    description:
      'Records whether the customer approved or rejected the QC results. ' +
      'Moves status to CUSTOMER_APPROVED or CUSTOMER_REJECTED. ' +
      'If rejected, the inspection can be re-started for re-inspection.',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'Customer decision recorded' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async recordCustomerDecision(
    @Param('id') id: string,
    @Body() dto: CustomerDecisionDto,
  ) {
    const result = await this.qcService.recordCustomerDecision(
      id,
      dto.approved,
      dto.customerNote,
    );
    const action = dto.approved ? 'approved' : 'rejected';
    return BaseResponse.ok(result, `Customer ${action} the QC inspection`);
  }

  @Post(':id/photos')
  @HttpCode(HttpStatus.OK)
  @Roles(
    UserRole.WAREHOUSE_CN_AGENT,
    UserRole.XNK_MANAGER,
    UserRole.XNK_STAFF,
  )
  @ApiOperation({
    summary: 'Add photos to a QC inspection',
    description:
      'Appends photos to the inspection. Photos are categorized as ' +
      'general (overview), detail (product close-ups), or defect (defect evidence).',
  })
  @ApiParam({ name: 'id', description: 'QC Inspection ID' })
  @ApiResponse({ status: 200, description: 'Photos added successfully' })
  @ApiResponse({ status: 404, description: 'QC inspection not found' })
  async addPhotos(
    @Param('id') id: string,
    @Body() dto: AddPhotosDto,
  ) {
    const result = await this.qcService.addPhotos(id, dto.photoUrls, dto.type);
    return BaseResponse.ok(result, 'Photos added to QC inspection');
  }
}
