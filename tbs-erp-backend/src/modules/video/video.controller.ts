import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { BaseResponse } from '@common/dto/base-response.dto';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { VideoService } from './video.service';
import { CreateRoomDto } from './dto';

@ApiTags('Video')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * GET /video/rooms
   * Trả về các phòng họp đang active/scheduled của user hiện tại
   */
  @Get('rooms')
  @ApiOperation({
    summary: 'Danh sách phòng họp của tôi',
    description: 'Trả về các phòng họp ACTIVE và SCHEDULED mà user là host hoặc participant.',
  })
  @ApiResponse({ status: 200, description: 'Danh sách phòng họp' })
  async getMyRooms(@CurrentUser() user: ICurrentUser) {
    const rooms = await this.videoService.getMyRooms(user.id);
    return BaseResponse.ok(rooms);
  }

  /**
   * POST /video/rooms
   * Tạo phòng họp mới
   */
  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo phòng họp mới',
    description: 'Tạo phòng Jitsi Meet mới với tên phòng tự động. Có thể đặt lịch hoặc bắt đầu ngay.',
  })
  @ApiResponse({ status: 201, description: 'Phòng họp đã được tạo' })
  async createRoom(
    @Body() dto: CreateRoomDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const room = await this.videoService.createRoom(user.id, dto);
    return BaseResponse.ok(room, 'Phòng họp đã được tạo');
  }

  /**
   * GET /video/rooms/:id
   * Chi tiết phòng họp
   */
  @Get('rooms/:id')
  @ApiOperation({ summary: 'Chi tiết phòng họp' })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Chi tiết phòng họp' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng họp' })
  async getRoom(@Param('id') id: string) {
    const room = await this.videoService.getRoom(id);
    return BaseResponse.ok(room);
  }

  /**
   * GET /video/rooms/:id/token
   * Lấy JWT token để join phòng họp (và ghi nhận join time)
   */
  @Get('rooms/:id/token')
  @ApiOperation({
    summary: 'Lấy token tham gia phòng họp',
    description: 'Trả về roomName, domain, JWT token (nếu Jitsi có cấu hình secret) và displayName. Ghi nhận thời điểm user join.',
  })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Token tham gia' })
  @ApiResponse({ status: 403, description: 'Không được mời vào phòng này' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng họp' })
  async getRoomToken(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const tokenData = await this.videoService.getRoomToken(user.id, id);
    return BaseResponse.ok(tokenData);
  }

  /**
   * POST /video/rooms/:id/end
   * Kết thúc phòng họp (chỉ host)
   */
  @Post('rooms/:id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Kết thúc phòng họp',
    description: 'Chỉ host mới có thể kết thúc phòng. Đánh dấu status = ENDED và ghi nhận endedAt.',
  })
  @ApiParam({ name: 'id', description: 'Room ID' })
  @ApiResponse({ status: 200, description: 'Phòng họp đã kết thúc' })
  @ApiResponse({ status: 403, description: 'Chỉ host mới có quyền kết thúc' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy phòng họp' })
  async endRoom(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const room = await this.videoService.endRoom(user.id, id);
    return BaseResponse.ok(room, 'Phòng họp đã kết thúc');
  }

  /**
   * POST /video/start-dm/:conversationId
   * Bắt đầu video call từ một cuộc trò chuyện (DM hoặc Group)
   */
  @Post('start-dm/:conversationId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Bắt đầu video call từ chat',
    description: 'Tạo phòng họp nhanh liên kết với conversation. Tự động thêm tất cả participant của conversation.',
  })
  @ApiParam({ name: 'conversationId', description: 'Chat Conversation ID' })
  @ApiResponse({ status: 201, description: 'Phòng họp đã được tạo' })
  @ApiResponse({ status: 404, description: 'Conversation không tồn tại' })
  async startDMCall(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const room = await this.videoService.startDMCall(user.id, conversationId);
    return BaseResponse.ok(room, 'Cuộc gọi video đã được khởi tạo');
  }
}
