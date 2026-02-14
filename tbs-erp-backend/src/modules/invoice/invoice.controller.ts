import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ApiPaginated } from '@common/decorators/api-paginated.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { InvoiceService } from './invoice.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceQueryDto } from './dto/invoice-query.dto';

@ApiTags('Finance - Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new invoice' })
  async create(
    @Body() dto: CreateInvoiceDto,
    @CurrentUser('id') userId: string,
  ) {
    const invoice = await this.invoiceService.createInvoice(dto, userId);
    return BaseResponse.ok(invoice, 'Invoice created successfully');
  }

  @Get()
  @ApiOperation({ summary: 'List invoices with pagination and filters' })
  @ApiPaginated()
  async findAll(@Query() query: InvoiceQueryDto) {
    return this.invoiceService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async findOne(@Param('id') id: string) {
    const invoice = await this.invoiceService.findById(id);
    return BaseResponse.ok(invoice);
  }

  @Patch(':id/issue')
  @ApiOperation({ summary: 'Issue an invoice (DRAFT -> ISSUED)' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async issue(@Param('id') id: string) {
    const invoice = await this.invoiceService.issueInvoice(id);
    return BaseResponse.ok(invoice, 'Invoice issued successfully');
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an invoice (not sent to tax authority)' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  async cancel(
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const invoice = await this.invoiceService.cancelInvoice(id, body.reason);
    return BaseResponse.ok(invoice, 'Invoice cancelled');
  }

  @Post(':id/adjust')
  @ApiOperation({
    summary: 'Create adjustment invoice (for invoices sent to tax authority)',
  })
  @ApiParam({ name: 'id', description: 'Original invoice ID' })
  async adjust(
    @Param('id') id: string,
    @Body() body: { newAmount: number },
    @CurrentUser('id') userId: string,
  ) {
    const result = await this.invoiceService.adjustInvoice(
      id,
      body.newAmount,
      userId,
    );
    return BaseResponse.ok(result, 'Adjustment invoice created');
  }
}
