import {
  Controller,
  Post,
  Body,
  Param,
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
import { BaseResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { EmailComposeService } from './email-compose.service';
import { SendEmailDto, SendQuotationEmailDto, SendInvoiceEmailDto } from './dto/send-email.dto';

@ApiTags('Emails')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emails')
export class EmailComposeController {
  constructor(private readonly emailComposeService: EmailComposeService) {}

  @Post('send')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi email tùy chỉnh',
    description: 'Gửi email với nội dung tùy ý. Chỉ dành cho Manager trở lên.',
  })
  @ApiResponse({ status: 200, description: 'Email đã được gửi thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
  async sendEmail(@Body() dto: SendEmailDto) {
    await this.emailComposeService.sendCustomEmail(dto);
    return BaseResponse.ok(null, 'Email đã được gửi thành công');
  }

  @Post('quotation/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.SALES_DIRECTOR,
    UserRole.SALES_LEADER,
    UserRole.SALE,
    UserRole.CSKH,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi email báo giá cho khách hàng',
    description: 'Gửi email kèm thông tin báo giá tới địa chỉ email chỉ định.',
  })
  @ApiParam({ name: 'id', description: 'Quotation ID' })
  @ApiResponse({ status: 200, description: 'Email báo giá đã được gửi' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy báo giá' })
  async sendQuotationEmail(@Param('id') id: string, @Body() dto: SendQuotationEmailDto) {
    await this.emailComposeService.sendQuotationEmail(id, dto);
    return BaseResponse.ok(null, 'Email báo giá đã được gửi thành công');
  }

  @Post('invoice/:id')
  @Roles(
    UserRole.CEO,
    UserRole.COO,
    UserRole.CFO,
    UserRole.CHIEF_ACCOUNTANT,
    UserRole.ACCOUNTANT,
    UserRole.ACCOUNTANT_AR,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi email hóa đơn cho khách hàng',
    description: 'Gửi email kèm thông tin hóa đơn tới địa chỉ email chỉ định.',
  })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiResponse({ status: 200, description: 'Email hóa đơn đã được gửi' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy hóa đơn' })
  async sendInvoiceEmail(@Param('id') id: string, @Body() dto: SendInvoiceEmailDto) {
    await this.emailComposeService.sendInvoiceEmail(id, dto);
    return BaseResponse.ok(null, 'Email hóa đơn đã được gửi thành công');
  }
}
