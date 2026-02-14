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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { ContainerService } from './container.service';
import { CreateContainerDto } from './dto/create-container.dto';
import { UpdateContainerDto } from './dto/update-container.dto';
import { ContainerQueryDto } from './dto/container-query.dto';

@ApiTags('Containers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('containers')
export class ContainerController {
  constructor(private readonly containerService: ContainerService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new container',
    description:
      'Creates a new container in PLANNING status for consolidating packages.',
  })
  @ApiResponse({ status: 201, description: 'Container created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @Body() dto: CreateContainerDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const container = await this.containerService.createContainer(
      dto,
      user.id,
    );
    return BaseResponse.ok(container, 'Container created successfully');
  }

  @Get()
  @ApiOperation({
    summary: 'List containers',
    description:
      'Returns paginated containers with filtering by status, route, and date range.',
  })
  @ApiPaginated()
  @ApiResponse({ status: 200, description: 'Containers retrieved successfully' })
  async findAll(@Query() query: ContainerQueryDto) {
    const result = await this.containerService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('consolidation-plan')
  @ApiOperation({
    summary: 'Get consolidation plan suggestion',
    description:
      'Analyzes unassigned packages and suggests optimal container grouping by route.',
  })
  @ApiResponse({ status: 200, description: 'Consolidation plan retrieved' })
  async getConsolidationPlan() {
    const plan = await this.containerService.getConsolidationPlan();
    return BaseResponse.ok(plan);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get container detail',
    description:
      'Returns full container details including packages and related orders.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async findById(@Param('id') id: string) {
    const container = await this.containerService.findById(id);
    return BaseResponse.ok(container);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update container metadata',
    description:
      'Updates container information. Not available for COMPLETED containers.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Container updated successfully' })
  @ApiResponse({ status: 400, description: 'Container cannot be modified' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContainerDto,
  ) {
    const container = await this.containerService.updateContainer(id, dto);
    return BaseResponse.ok(container, 'Container updated successfully');
  }

  @Post(':id/add-packages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add packages to container',
    description:
      'Assigns packages to a container. Only PACKED packages can be added to PLANNING/LOADING containers.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Packages added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid packages or container status' })
  @ApiResponse({ status: 404, description: 'Container or packages not found' })
  async addPackages(
    @Param('id') id: string,
    @Body('packageIds') packageIds: string[],
  ) {
    const container = await this.containerService.addPackages(id, packageIds);
    return BaseResponse.ok(container, 'Packages added to container');
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Update container status',
    description:
      'Transitions container to the next status. Validates FSM transitions.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  @ApiResponse({ status: 404, description: 'Container not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const container = await this.containerService.updateStatus(
      id,
      status,
      user.id,
    );
    return BaseResponse.ok(container, `Container status updated to ${status}`);
  }

  @Get(':id/fill-rate')
  @ApiOperation({
    summary: 'Get container fill rate',
    description:
      'Calculates the current fill rate of a container based on assigned packages.',
  })
  @ApiParam({ name: 'id', description: 'Container ID' })
  @ApiResponse({ status: 200, description: 'Fill rate calculated' })
  async getFillRate(@Param('id') id: string) {
    const fillRate = await this.containerService.calculateFillRate(id);
    return BaseResponse.ok(fillRate);
  }
}
