import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';

export interface GpsValidationResult {
  isValid: boolean;
  officeName?: string;
  distance?: number;
}

export interface SaveLocationDto {
  checkInLat?: number;
  checkInLng?: number;
  checkInAddress?: string;
  checkInMethod?: string;
  checkOutLat?: number;
  checkOutLng?: number;
  checkOutAddress?: string;
  checkOutMethod?: string;
}

export interface CreateOfficeLocationDto {
  name: string;
  lat: number;
  lng: number;
  radiusMeters?: number;
  wifiSSID?: string;
}

@Injectable()
export class AttendanceGpsService {
  private readonly logger = new Logger(AttendanceGpsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validates whether GPS coordinates are within any active office radius.
   */
  async validateGpsCheckIn(lat: number, lng: number): Promise<GpsValidationResult> {
    const offices = await this.prisma.officeLocation.findMany({
      where: { isActive: true },
    });

    for (const office of offices) {
      const distance = this.calculateDistance(lat, lng, office.lat, office.lng);
      if (distance <= office.radiusMeters) {
        return { isValid: true, officeName: office.name, distance: Math.round(distance) };
      }
    }

    // Return closest distance even when invalid, for display on frontend
    if (offices.length > 0) {
      const closest = offices.reduce((prev, curr) => {
        const dPrev = this.calculateDistance(lat, lng, prev.lat, prev.lng);
        const dCurr = this.calculateDistance(lat, lng, curr.lat, curr.lng);
        return dCurr < dPrev ? curr : prev;
      });
      const distance = this.calculateDistance(lat, lng, closest.lat, closest.lng);
      return { isValid: false, officeName: closest.name, distance: Math.round(distance) };
    }

    return { isValid: false };
  }

  /**
   * Saves or updates GPS location data linked to an attendance record.
   */
  async saveLocation(attendanceId: string, data: SaveLocationDto) {
    const existing = await this.prisma.attendanceLocation.findUnique({
      where: { attendanceId },
    });

    if (existing) {
      return this.prisma.attendanceLocation.update({
        where: { attendanceId },
        data: {
          ...(data.checkInLat !== undefined && { checkInLat: data.checkInLat }),
          ...(data.checkInLng !== undefined && { checkInLng: data.checkInLng }),
          ...(data.checkInAddress !== undefined && { checkInAddress: data.checkInAddress }),
          ...(data.checkInMethod !== undefined && { checkInMethod: data.checkInMethod }),
          ...(data.checkOutLat !== undefined && { checkOutLat: data.checkOutLat }),
          ...(data.checkOutLng !== undefined && { checkOutLng: data.checkOutLng }),
          ...(data.checkOutAddress !== undefined && { checkOutAddress: data.checkOutAddress }),
          ...(data.checkOutMethod !== undefined && { checkOutMethod: data.checkOutMethod }),
        },
      });
    }

    return this.prisma.attendanceLocation.create({
      data: {
        attendanceId,
        checkInLat: data.checkInLat,
        checkInLng: data.checkInLng,
        checkInAddress: data.checkInAddress,
        checkInMethod: data.checkInMethod ?? 'GPS',
        checkOutLat: data.checkOutLat,
        checkOutLng: data.checkOutLng,
        checkOutAddress: data.checkOutAddress,
        checkOutMethod: data.checkOutMethod,
      },
    });
  }

  /**
   * Returns all active office locations for the frontend map.
   */
  async getOfficeLocations() {
    return this.prisma.officeLocation.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Creates a new office location (admin only).
   */
  async createOfficeLocation(dto: CreateOfficeLocationDto) {
    return this.prisma.officeLocation.create({
      data: {
        name: dto.name,
        lat: dto.lat,
        lng: dto.lng,
        radiusMeters: dto.radiusMeters ?? 100,
        wifiSSID: dto.wifiSSID,
      },
    });
  }

  /**
   * Updates an office location.
   */
  async updateOfficeLocation(
    id: string,
    dto: Partial<CreateOfficeLocationDto> & { isActive?: boolean },
  ) {
    const existing = await this.prisma.officeLocation.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Office location ${id} not found`);
    }
    return this.prisma.officeLocation.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Returns recent GPS check-in data for the map view (today's records).
   */
  async getMapData(date?: Date) {
    const targetDate = date ?? new Date();
    const startOfDay = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
    );
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const locations = await this.prisma.attendanceLocation.findMany({
      where: {
        createdAt: { gte: startOfDay, lt: endOfDay },
        checkInLat: { not: null },
        checkInLng: { not: null },
      },
    });

    return locations;
  }

  /**
   * Haversine formula — calculates distance in meters between two GPS coords.
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}
