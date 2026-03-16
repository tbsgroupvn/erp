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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { ICurrentUser } from '@common/interfaces/current-user.interface';
import { BaseResponse } from '@common/dto/base-response.dto';
import { AttendanceService } from './attendance.service';
import { AttendanceGpsService } from './attendance-gps.service';
import {
  GpsCheckInDto,
  GpsCheckOutDto,
  CreateOfficeLocationDto,
  UpdateOfficeLocationDto,
} from './dto/gps-checkin.dto';
import { CheckInDto, CheckOutDto } from './dto/check-in.dto';
import { AttendanceType } from '@prisma/client';

@ApiTags('Attendance GPS')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceGpsController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly gpsService: AttendanceGpsService,
  ) {}

  @Post('check-in-gps')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-in voi GPS coords' })
  @ApiResponse({ status: 200, description: 'GPS check-in recorded' })
  async checkInGps(@Body() dto: GpsCheckInDto, @CurrentUser() user: ICurrentUser) {
    // Validate GPS position vs office locations
    const validation = await this.gpsService.validateGpsCheckIn(dto.latitude, dto.longitude);

    const checkInDto: CheckInDto = {
      timestamp: new Date().toISOString(),
      lat: dto.latitude,
      lng: dto.longitude,
      type: dto.type ?? (validation.isValid ? AttendanceType.OFFICE : AttendanceType.REMOTE),
    };

    const attendance = await this.attendanceService.checkIn(user.id, checkInDto);

    // Save GPS location record
    await this.gpsService.saveLocation(attendance.id, {
      checkInLat: dto.latitude,
      checkInLng: dto.longitude,
      checkInMethod: dto.method ?? 'GPS',
    });

    return BaseResponse.ok(
      {
        attendance,
        gpsValidation: validation,
      },
      validation.isValid
        ? `Check-in GPS thanh cong tai ${validation.officeName} (${validation.distance}m)`
        : `Check-in GPS tu xa (${validation.distance ?? 'N/A'}m tinh tu van phong gan nhat)`,
    );
  }

  @Post('check-out-gps')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check-out voi GPS coords' })
  @ApiResponse({ status: 200, description: 'GPS check-out recorded' })
  async checkOutGps(@Body() dto: GpsCheckOutDto, @CurrentUser() user: ICurrentUser) {
    const checkOutDto: CheckOutDto = {
      timestamp: new Date().toISOString(),
      lat: dto.latitude,
      lng: dto.longitude,
    };

    const attendance = await this.attendanceService.checkOut(user.id, checkOutDto);

    // Save GPS check-out location
    await this.gpsService.saveLocation(attendance.id, {
      checkOutLat: dto.latitude,
      checkOutLng: dto.longitude,
      checkOutMethod: dto.method ?? 'GPS',
    });

    return BaseResponse.ok(attendance, 'Check-out GPS thanh cong');
  }

  @Get('offices')
  @ApiOperation({ summary: 'Lay danh sach van phong / vi tri check-in' })
  @ApiResponse({ status: 200, description: 'List of office locations' })
  async getOfficeLocations() {
    const result = await this.gpsService.getOfficeLocations();
    return BaseResponse.ok(result);
  }

  @Post('offices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tao vi tri van phong moi (admin only)' })
  @ApiResponse({ status: 201, description: 'Office location created' })
  async createOfficeLocation(@Body() dto: CreateOfficeLocationDto) {
    const result = await this.gpsService.createOfficeLocation(dto);
    return BaseResponse.ok(result, 'Da tao vi tri van phong');
  }

  @Patch('offices/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cap nhat vi tri van phong' })
  @ApiParam({ name: 'id', description: 'Office location ID' })
  async updateOfficeLocation(
    @Param('id') id: string,
    @Body() dto: UpdateOfficeLocationDto,
  ) {
    const result = await this.gpsService.updateOfficeLocation(id, dto);
    return BaseResponse.ok(result, 'Da cap nhat vi tri van phong');
  }

  @Get('map')
  @ApiOperation({ summary: 'Du lieu ban do check-in GPS cua ngay' })
  @ApiQuery({ name: 'date', required: false, example: '2026-03-08' })
  async getMapData(@Query('date') date?: string) {
    const targetDate = date ? new Date(date) : undefined;
    const [locations, offices] = await Promise.all([
      this.gpsService.getMapData(targetDate),
      this.gpsService.getOfficeLocations(),
    ]);
    return BaseResponse.ok({ locations, offices });
  }

  @Get('validate-gps')
  @ApiOperation({ summary: 'Kiem tra GPS co trong pham vi van phong khong' })
  @ApiQuery({ name: 'lat', required: true })
  @ApiQuery({ name: 'lng', required: true })
  async validateGps(@Query('lat') lat: string, @Query('lng') lng: string) {
    const result = await this.gpsService.validateGpsCheckIn(parseFloat(lat), parseFloat(lng));
    return BaseResponse.ok(result);
  }
}
