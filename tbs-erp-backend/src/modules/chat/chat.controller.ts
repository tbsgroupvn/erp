import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { ALL_ROLES } from '@core/rbac/roles.enum';
import { ChatService } from './chat.service';
import { CreateDMDto, CreateGroupDto, UpdateConversationDto } from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { ConversationQueryDto, MessageQueryDto } from './dto/chat-query.dto';
import { AddParticipantsDto } from './dto/participant.dto';
import { WsGateway } from '@core/websocket/ws.gateway';

@Roles(...ALL_ROLES)
@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly wsGateway: WsGateway,
  ) {}

  // ─── Conversations ───

  @Get('conversations')
  @ApiOperation({ summary: 'Danh sách conversations + unreadCount' })
  async listConversations(@Request() req: any, @Query() query: ConversationQueryDto) {
    const data = await this.chatService.getConversations(req.user.id, query.search);
    return { success: true, data };
  }

  @Post('conversations/dm')
  @ApiOperation({ summary: 'Tạo/lấy DM (idempotent)' })
  async createDM(@Request() req: any, @Body() dto: CreateDMDto) {
    const data = await this.chatService.createOrGetDM(req.user.id, dto);
    return { success: true, data };
  }

  @Post('conversations/group')
  @ApiOperation({ summary: 'Tạo nhóm chat' })
  async createGroup(@Request() req: any, @Body() dto: CreateGroupDto) {
    const data = await this.chatService.createGroup(req.user.id, dto);
    return { success: true, data };
  }

  @Patch('conversations/:id')
  @ApiOperation({ summary: 'Đổi tên nhóm (OWNER only)' })
  async updateConversation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    const data = await this.chatService.updateConversation(req.user.id, id, dto);
    return { success: true, data };
  }

  @Patch('conversations/:id/pin')
  @ApiOperation({ summary: 'Ghim/bỏ ghim tin nhắn (OWNER only)' })
  async pinMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body('messageId') messageId: string | null,
  ) {
    const data = await this.chatService.pinMessage(req.user.id, id, messageId ?? null);
    return { success: true, data };
  }

  // ─── Messages ───

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Lấy messages (cursor pagination, DESC)' })
  async getMessages(
    @Request() req: any,
    @Param('id') id: string,
    @Query() query: MessageQueryDto,
  ) {
    const data = await this.chatService.getMessages(req.user.id, id, query.cursor, query.limit);
    return { success: true, data };
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Gửi tin nhắn' })
  async sendMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const data = await this.chatService.sendMessage(req.user.id, id, dto);
    return { success: true, data };
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đánh dấu đã đọc' })
  async markAsRead(@Request() req: any, @Param('id') id: string) {
    await this.chatService.markAsRead(id, req.user.id);
  }

  // ─── Messages by ID ───

  @Patch('messages/:id')
  @ApiOperation({ summary: 'Chỉnh sửa tin nhắn (trong 5 phút)' })
  async editMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: EditMessageDto,
  ) {
    const data = await this.chatService.editMessage(req.user.id, id, dto);
    return { success: true, data };
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Thu hồi tin nhắn (soft delete)' })
  async deleteMessage(@Request() req: any, @Param('id') id: string) {
    const data = await this.chatService.deleteMessage(req.user.id, id);
    return { success: true, data };
  }

  @Post('messages/:id/react')
  @ApiOperation({ summary: 'Toggle emoji reaction trên tin nhắn' })
  async reactToMessage(
    @Request() req: any,
    @Param('id') id: string,
    @Body('emoji') emoji: string,
  ) {
    const data = await this.chatService.toggleReaction(req.user.id, id, emoji);
    return { success: true, data };
  }

  // ─── Participants ───

  @Post('conversations/:id/participants')
  @ApiOperation({ summary: 'Thêm thành viên (OWNER only)' })
  async addParticipants(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AddParticipantsDto,
  ) {
    const data = await this.chatService.addParticipants(req.user.id, id, dto);
    return { success: true, data };
  }

  @Delete('conversations/:id/participants/:userId')
  @ApiOperation({ summary: 'Kick thành viên (OWNER only)' })
  async removeParticipant(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    await this.chatService.removeParticipant(req.user.id, id, userId);
    return { success: true };
  }

  @Post('conversations/:id/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tự rời nhóm' })
  async leaveConversation(@Request() req: any, @Param('id') id: string) {
    await this.chatService.leaveConversation(req.user.id, id);
  }

  // ─── Users ───

  @Get('users/search')
  @ApiOperation({ summary: 'Tìm user để DM/thêm nhóm' })
  async searchUsers(
    @Request() req: any,
    @Query('q') q: string = '',
    @Query('limit') limit: string = '10',
  ) {
    const data = await this.chatService.searchUsers(q, parseInt(limit, 10), req.user.id);
    return { success: true, data };
  }

  @Get('users/online')
  @ApiOperation({ summary: 'Danh sách userId đang online' })
  getOnlineUsers() {
    const data = this.wsGateway.getOnlineUserIds();
    return { success: true, data };
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Tổng unread cho sidebar badge' })
  async getTotalUnread(@Request() req: any) {
    const total = await this.chatService.getTotalUnreadCount(req.user.id);
    return { success: true, data: { total } };
  }
}
