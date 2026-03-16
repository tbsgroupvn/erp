import {
  Controller,
  Get,
  Post,
  Delete,
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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { UserRole } from '@prisma/client';
import { EmojiService } from './emoji.service';
import { CreateEmojiDto } from './dto/create-emoji.dto';

@ApiTags('Emoji')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('emoji')
export class EmojiController {
  constructor(private readonly emojiService: EmojiService) {}

  @Get()
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS, UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER,
    UserRole.SALE, UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST, UserRole.HR_MANAGER, UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.WAREHOUSE_MANAGER,
    UserRole.WAREHOUSE_CN_AGENT, UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF, UserRole.DRIVER,
  )
  @ApiOperation({
    summary: 'Lấy danh sách custom emoji công ty',
    description: 'Tất cả người dùng đã đăng nhập có thể xem danh sách emoji.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách emoji' })
  async findAll() {
    const emojis = await this.emojiService.findAll();
    return BaseResponse.ok(emojis);
  }

  @Post()
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.HR_MANAGER,
    UserRole.DIRECTOR_OPERATIONS, UserRole.MARKETING_STAFF,
  )
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload custom emoji mới',
    description: 'Thêm emoji công ty mới. Chỉ HR Manager và Manager trở lên.',
  })
  @ApiResponse({ status: 201, description: 'Emoji đã được tạo' })
  @ApiResponse({ status: 409, description: 'Tên emoji đã tồn tại' })
  async create(@Body() dto: CreateEmojiDto, @CurrentUser() user: ICurrentUser) {
    const emoji = await this.emojiService.create(dto, user.id);
    return BaseResponse.ok(emoji, 'Emoji đã được tạo thành công');
  }

  @Delete(':id')
  @Roles(UserRole.CEO, UserRole.COO, UserRole.HR_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Xóa custom emoji',
    description: 'Xóa emoji công ty. Chỉ Admin/HR Manager.',
  })
  @ApiParam({ name: 'id', description: 'Emoji ID' })
  @ApiResponse({ status: 200, description: 'Emoji đã bị xóa' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy emoji' })
  async remove(@Param('id') id: string) {
    await this.emojiService.remove(id);
    return BaseResponse.ok(null, 'Emoji đã được xóa');
  }

  @Post(':id/use')
  @Roles(
    UserRole.CEO, UserRole.COO, UserRole.CFO,
    UserRole.DIRECTOR_OPERATIONS, UserRole.SALES_DIRECTOR, UserRole.SALES_LEADER,
    UserRole.SALE, UserRole.MARKETING_STAFF, UserRole.CSKH,
    UserRole.CHIEF_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.ACCOUNTANT_AR,
    UserRole.ACCOUNTANT_COST, UserRole.HR_MANAGER, UserRole.LOGISTICS_MANAGER,
    UserRole.XNK_MANAGER, UserRole.XNK_STAFF, UserRole.WAREHOUSE_MANAGER,
    UserRole.WAREHOUSE_CN_AGENT, UserRole.WAREHOUSE_VN_MANAGER,
    UserRole.WAREHOUSE_VN_STAFF, UserRole.DRIVER,
  )
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Tăng usage count cho emoji',
    description: 'Ghi nhận lượt sử dụng emoji để sắp xếp theo độ phổ biến.',
  })
  @ApiParam({ name: 'id', description: 'Emoji ID' })
  @ApiResponse({ status: 200, description: 'Usage count đã tăng' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy emoji' })
  async incrementUsage(@Param('id') id: string) {
    const emoji = await this.emojiService.incrementUsage(id);
    return BaseResponse.ok(emoji);
  }
}
