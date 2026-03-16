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
import { CodService } from './cod.service';
import { RecordCODCollectionDto } from './dto/record-cod-collection.dto';
import { CodQueryDto } from './dto/cod-query.dto';

@ApiTags('COD')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cod')
export class CodController {
  constructor(private readonly codService: CodService) {}

  @Post('collect')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record COD collection',
    description: 'Driver records a COD payment for a delivery.',
  })
  @ApiResponse({ status: 201, description: 'COD collection recorded' })
  async recordCODCollection(
    @Body() dto: RecordCODCollectionDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.codService.recordCODCollection(dto, user.id);
    return BaseResponse.ok(result, 'COD collection recorded');
  }

  @Get('driver/:driverId')
  @ApiOperation({
    summary: 'Get driver collections',
    description: 'Returns all COD collections for a driver on a specific date.',
  })
  @ApiParam({ name: 'driverId', description: 'Driver ID' })
  @ApiQuery({ name: 'date', required: true, example: '2025-06-15' })
  @ApiResponse({ status: 200, description: 'Driver collections retrieved' })
  async getDriverCollections(@Param('driverId') driverId: string, @Query('date') date: string) {
    const result = await this.codService.getDriverCollections(driverId, date);
    return BaseResponse.ok(result);
  }

  @Post('remittance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm COD remittance',
    description: 'Warehouse confirms driver handed over COD cash.',
  })
  @ApiResponse({ status: 200, description: 'Remittance confirmed' })
  async confirmRemittance(
    @Body('driverId') driverId: string,
    @Body('date') date: string,
    @Body('amount') amount: number,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.codService.confirmRemittance(driverId, date, amount, user.id);
    return BaseResponse.ok(result, 'COD remittance confirmed');
  }

  @Get()
  @ApiOperation({
    summary: 'List COD records',
    description: 'Returns paginated COD records with filters.',
  })
  @ApiResponse({ status: 200, description: 'COD records retrieved' })
  async findAll(@Query() query: CodQueryDto) {
    const result = await this.codService.findAll(query);
    return PaginatedResponse.paginate(result.data, result.total, result.page, result.limit);
  }

  @Get('reconciliation')
  @ApiOperation({
    summary: 'Get COD reconciliation',
    description: 'Compares collections vs remittances within a date range.',
  })
  @ApiQuery({ name: 'startDate', required: true, example: '2025-06-01' })
  @ApiQuery({ name: 'endDate', required: true, example: '2025-06-30' })
  @ApiResponse({ status: 200, description: 'Reconciliation report retrieved' })
  async getReconciliation(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const result = await this.codService.getReconciliation(startDate, endDate);
    return BaseResponse.ok(result);
  }

  @Post(':id/shortage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Flag COD shortage',
    description: 'Flags a COD record for a shortage or discrepancy.',
  })
  @ApiParam({ name: 'id', description: 'COD record ID' })
  @ApiResponse({ status: 200, description: 'Shortage flagged' })
  async flagShortage(
    @Param('id') id: string,
    @Body('shortageAmount') shortageAmount: number,
    @Body('reason') reason: string,
  ) {
    const result = await this.codService.flagShortage(id, shortageAmount, reason);
    return BaseResponse.ok(result, 'COD shortage flagged');
  }
}
