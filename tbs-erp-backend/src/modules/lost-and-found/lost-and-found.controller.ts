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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse, PaginatedResponse } from '@common/dto/base-response.dto';
import { LostAndFoundService } from './lost-and-found.service';
import { CreateLostItemDto } from './dto/create-lost-item.dto';
import { LostAndFoundQueryDto } from './dto/lost-and-found-query.dto';

@ApiTags('Lost and Found')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lost-and-found')
export class LostAndFoundController {
  constructor(private readonly lnfService: LostAndFoundService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create lost item', description: 'Registers an unmatched/unidentified package.' })
  @ApiResponse({ status: 201, description: 'Lost item created' })
  async createLostItem(
    @Body() dto: CreateLostItemDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const item = await this.lnfService.createLostItem(dto, user.id);
    return BaseResponse.ok(item, 'Lost item registered');
  }

  @Get()
  @ApiOperation({ summary: 'List lost and found items', description: 'Returns paginated lost and found items with filters.' })
  @ApiResponse({ status: 200, description: 'Items retrieved' })
  async findAll(@Query() query: LostAndFoundQueryDto) {
    const result = await this.lnfService.findAll(query);
    return PaginatedResponse.paginate(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Post(':id/match')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attempt match', description: 'Re-attempts matching against pre-alerts and orders.' })
  @ApiParam({ name: 'id', description: 'Lost item ID' })
  @ApiResponse({ status: 200, description: 'Match results' })
  async attemptMatch(@Param('id') id: string) {
    const result = await this.lnfService.attemptMatch(id);
    return BaseResponse.ok(result);
  }

  @Post(':id/claim')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Claim item', description: 'Customer claims the lost item.' })
  @ApiParam({ name: 'id', description: 'Lost item ID' })
  @ApiResponse({ status: 200, description: 'Item claimed' })
  async claimItem(
    @Param('id') id: string,
    @Body('customerId') customerId: string,
    @Body('orderId') orderId?: string,
  ) {
    const result = await this.lnfService.claimItem(id, customerId, orderId);
    return BaseResponse.ok(result, 'Item claimed successfully');
  }

  @Post(':id/dispose')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark for disposal', description: 'Marks item for disposal after retention period (30 days).' })
  @ApiParam({ name: 'id', description: 'Lost item ID' })
  @ApiResponse({ status: 200, description: 'Item marked for disposal' })
  @ApiResponse({ status: 400, description: 'Retention period not met' })
  async markForDisposal(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    const result = await this.lnfService.markForDisposal(id, reason);
    return BaseResponse.ok(result, 'Item marked for disposal');
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get LNF statistics', description: 'Returns stats (received, claimed, disposed, pending).' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const stats = await this.lnfService.getStatistics(startDate, endDate);
    return BaseResponse.ok(stats);
  }
}
