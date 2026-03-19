import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/rbac/guards/roles.guard';
import { Roles } from '@core/rbac/decorators/roles.decorator';
import { ALL_ROLES } from '@core/rbac/roles.enum';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { CalendarService } from './calendar.service';
import {
  CreateEventDto,
  UpdateEventDto,
  RespondEventDto,
  EventQueryDto,
} from './dto/create-event.dto';
import { CreateRoomDto } from './dto/create-room.dto';

@Roles(...ALL_ROLES)
@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  // ─── Events ───────────────────────────────────────────────────────────────

  @Get('events')
  @ApiOperation({ summary: 'Lay danh sach su kien trong khoang thoi gian' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO 8601 start date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO 8601 end date' })
  @ApiResponse({ status: 200, description: 'Danh sach su kien' })
  async getEvents(
    @Query() query: EventQueryDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const events = await this.calendarService.getEvents(user.id, query);
    return BaseResponse.ok(events);
  }

  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao su kien moi' })
  @ApiResponse({ status: 201, description: 'Su kien da duoc tao' })
  @ApiResponse({ status: 400, description: 'Du lieu khong hop le hoac phong hop bi trung' })
  async createEvent(
    @Body() dto: CreateEventDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const event = await this.calendarService.createEvent(user.id, dto);
    return BaseResponse.ok(event, 'Tao su kien thanh cong');
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Lay chi tiet su kien' })
  @ApiParam({ name: 'id', description: 'CalendarEvent ID' })
  @ApiResponse({ status: 200, description: 'Chi tiet su kien' })
  @ApiResponse({ status: 403, description: 'Khong co quyen xem' })
  @ApiResponse({ status: 404, description: 'Khong tim thay su kien' })
  async getEvent(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const event = await this.calendarService.getEvent(user.id, id);
    return BaseResponse.ok(event);
  }

  @Patch('events/:id')
  @ApiOperation({ summary: 'Cap nhat su kien (chi nguoi to chuc)' })
  @ApiParam({ name: 'id', description: 'CalendarEvent ID' })
  @ApiResponse({ status: 200, description: 'Su kien da cap nhat' })
  @ApiResponse({ status: 403, description: 'Chi nguoi to chuc moi duoc sua' })
  @ApiResponse({ status: 404, description: 'Khong tim thay su kien' })
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const event = await this.calendarService.updateEvent(user.id, id, dto);
    return BaseResponse.ok(event, 'Cap nhat su kien thanh cong');
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xoa su kien (xoa mem, chi nguoi to chuc)' })
  @ApiParam({ name: 'id', description: 'CalendarEvent ID' })
  @ApiResponse({ status: 200, description: 'Da xoa su kien' })
  @ApiResponse({ status: 403, description: 'Chi nguoi to chuc moi duoc xoa' })
  @ApiResponse({ status: 404, description: 'Khong tim thay su kien' })
  async deleteEvent(
    @Param('id') id: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.calendarService.deleteEvent(user.id, id);
    return BaseResponse.ok(result, 'Da xoa su kien');
  }

  @Post('events/:id/respond')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Phan hoi loi moi su kien (Tham du / Tu choi / Co the)' })
  @ApiParam({ name: 'id', description: 'CalendarEvent ID' })
  @ApiResponse({ status: 200, description: 'Da cap nhat trang thai' })
  @ApiResponse({ status: 403, description: 'Khong duoc moi tham gia' })
  @ApiResponse({ status: 404, description: 'Khong tim thay su kien' })
  async respondToEvent(
    @Param('id') id: string,
    @Body() dto: RespondEventDto,
    @CurrentUser() user: ICurrentUser,
  ) {
    const result = await this.calendarService.respondToEvent(user.id, id, dto);
    return BaseResponse.ok(result, 'Da cap nhat trang thai tham gia');
  }

  // ─── Free/Busy ────────────────────────────────────────────────────────────

  @Get('free-busy')
  @ApiOperation({ summary: 'Xem lich ban ron cua mot user' })
  @ApiQuery({ name: 'userId', required: true, description: 'ID user can xem lich' })
  @ApiQuery({ name: 'from', required: true, description: 'ISO 8601 start' })
  @ApiQuery({ name: 'to', required: true, description: 'ISO 8601 end' })
  @ApiResponse({ status: 200, description: 'Danh sach khoang thoi gian ban' })
  async getFreeBusy(
    @Query('userId') userId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() user: ICurrentUser,
  ) {
    const slots = await this.calendarService.getFreeBusy(user.id, userId, from, to);
    return BaseResponse.ok(slots);
  }

  // ─── Meeting Rooms ────────────────────────────────────────────────────────

  @Get('rooms')
  @ApiOperation({ summary: 'Lay danh sach phong hop kha dung' })
  @ApiResponse({ status: 200, description: 'Danh sach phong hop' })
  async getRooms() {
    const rooms = await this.calendarService.getRooms();
    return BaseResponse.ok(rooms);
  }

  @Post('rooms')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao phong hop moi' })
  @ApiResponse({ status: 201, description: 'Phong hop da duoc tao' })
  @ApiResponse({ status: 400, description: 'Du lieu khong hop le' })
  async createRoom(@Body() dto: CreateRoomDto) {
    const room = await this.calendarService.createRoom(dto);
    return BaseResponse.ok(room, 'Tao phong hop thanh cong');
  }

  @Get('rooms/:id/availability')
  @ApiOperation({ summary: 'Kiem tra phong hop co trong trong khoang thoi gian' })
  @ApiParam({ name: 'id', description: 'MeetingRoom ID' })
  @ApiQuery({ name: 'startAt', required: true, description: 'ISO 8601' })
  @ApiQuery({ name: 'endAt', required: true, description: 'ISO 8601' })
  @ApiResponse({ status: 200, description: '{ available: boolean, conflict?: ... }' })
  async checkRoomAvailability(
    @Param('id') id: string,
    @Query('startAt') startAt: string,
    @Query('endAt') endAt: string,
  ) {
    const result = await this.calendarService.checkRoomAvailability(id, startAt, endAt);
    return BaseResponse.ok(result);
  }
}
