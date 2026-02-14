import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { Roles } from '@common/decorators/roles.decorator';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { FlowDefinitionService } from './flow-definition.service';
import { CreateFlowDefinitionDto } from './dto/create-flow-definition.dto';
import { UpdateFlowDefinitionDto } from './dto/update-flow-definition.dto';

@ApiTags('System - Approval Flows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('approval-flows')
export class FlowDefinitionController {
  constructor(private readonly flowDefService: FlowDefinitionService) {}

  @Get()
  @ApiOperation({ summary: 'List all flow definitions' })
  @Roles('CEO', 'COO')
  async findAll() {
    const data = await this.flowDefService.findAll();
    return BaseResponse.ok(data);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get flow definition with nodes and edges' })
  @ApiParam({ name: 'id' })
  @Roles('CEO', 'COO')
  async findOne(@Param('id') id: string) {
    const data = await this.flowDefService.findById(id);
    return BaseResponse.ok(data);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new flow definition' })
  @Roles('CEO', 'COO')
  async create(
    @Body() dto: CreateFlowDefinitionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.flowDefService.create(dto, user.id);
    return BaseResponse.ok(data, 'Flow definition created');
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a flow definition' })
  @ApiParam({ name: 'id' })
  @Roles('CEO', 'COO')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateFlowDefinitionDto,
  ) {
    const data = await this.flowDefService.update(id, dto);
    return BaseResponse.ok(data, 'Flow definition updated');
  }

  @Post(':id/version')
  @ApiOperation({ summary: 'Create a new version of flow definition' })
  @ApiParam({ name: 'id' })
  @Roles('CEO', 'COO')
  async createVersion(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.flowDefService.createVersion(id, user.id);
    return BaseResponse.ok(data, 'New version created');
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate a flow definition' })
  @ApiParam({ name: 'id' })
  @Roles('CEO', 'COO')
  async deactivate(@Param('id') id: string) {
    const data = await this.flowDefService.deactivate(id);
    return BaseResponse.ok(data, 'Flow definition deactivated');
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test flow with sample data' })
  @ApiParam({ name: 'id' })
  @Roles('CEO', 'COO')
  async testFlow(
    @Param('id') id: string,
    @Body() body: { requestData: Record<string, unknown> },
    @CurrentUser() user: ICurrentUser,
  ) {
    const data = await this.flowDefService.testFlow(
      id,
      body.requestData,
      user.id,
    );
    return BaseResponse.ok(data);
  }
}
