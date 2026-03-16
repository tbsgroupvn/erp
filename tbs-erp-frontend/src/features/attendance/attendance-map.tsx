'use client';

import { useState } from 'react';
import { MapPin, RefreshCw, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { attendanceGpsApi, type MapData } from '@/lib/api/attendance.api';
import { formatDate } from '@/lib/utils/format';

interface AttendanceMapProps {
  date?: string; // ISO date string, defaults to today
}

function MapWithPins({ mapData, selectedDate }: { mapData: MapData; selectedDate: string }) {
  // Calculate bounding box from all locations + offices
  const allLats: number[] = [];
  const allLngs: number[] = [];

  mapData.offices.forEach((o) => {
    allLats.push(o.lat);
    allLngs.push(o.lng);
  });
  mapData.locations.forEach((l) => {
    if (l.checkInLat) allLats.push(l.checkInLat);
    if (l.checkInLng) allLngs.push(l.checkInLng);
  });

  // Default to HCM if no data
  const centerLat = allLats.length > 0 ? allLats.reduce((a, b) => a + b, 0) / allLats.length : 10.7769;
  const centerLng = allLngs.length > 0 ? allLngs.reduce((a, b) => a + b, 0) / allLngs.length : 106.7009;

  // Build OpenStreetMap URL with marker for first check-in
  const firstCheckIn = mapData.locations.find((l) => l.checkInLat && l.checkInLng);
  const markerParam =
    firstCheckIn?.checkInLat && firstCheckIn?.checkInLng
      ? `&marker=${firstCheckIn.checkInLat}%2C${firstCheckIn.checkInLng}`
      : '';

  const bbox = `${centerLng - 0.01}%2C${centerLat - 0.007}%2C${centerLng + 0.01}%2C${centerLat + 0.007}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${markerParam}`;

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <iframe
          title={`Ban do cham cong ${selectedDate}`}
          width="100%"
          height="350"
          src={mapUrl}
          style={{ border: 0 }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Ban do chi hien thi marker cho check-in dau tien.{' '}
        <a
          href={`https://www.openstreetmap.org/#map=15/${centerLat}/${centerLng}`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Mo ban do day du
        </a>
      </p>
    </div>
  );
}

function CheckInLocationList({ mapData }: { mapData: MapData }) {
  if (mapData.locations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Chua co du lieu check-in GPS trong ngay nay
      </p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {mapData.locations.map((loc) => (
        <div
          key={loc.id}
          className="flex items-start gap-3 rounded-lg border px-3 py-2 text-sm"
        >
          <div className="mt-0.5">
            {loc.checkInLat ? (
              <Circle className="h-3 w-3 fill-green-500 text-green-500" />
            ) : (
              <Circle className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono text-xs text-muted-foreground">
              {loc.attendanceId.slice(0, 8)}...
            </p>
            {loc.checkInLat && loc.checkInLng && (
              <p className="text-xs">
                Vao: {loc.checkInLat.toFixed(5)}, {loc.checkInLng.toFixed(5)}
                {' '}
                <span className="text-muted-foreground">({loc.checkInMethod})</span>
              </p>
            )}
            {loc.checkOutLat && loc.checkOutLng && (
              <p className="text-xs text-muted-foreground">
                Ra: {loc.checkOutLat.toFixed(5)}, {loc.checkOutLng.toFixed(5)}
              </p>
            )}
            {loc.checkInAddress && (
              <p className="text-xs text-muted-foreground truncate">{loc.checkInAddress}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OfficeLegend({ offices }: { offices: MapData['offices'] }) {
  if (offices.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Van phong:</p>
      {offices.map((o) => (
        <div key={o.id} className="flex items-center gap-2 text-xs">
          <MapPin className="h-3 w-3 text-blue-500" />
          <span className="font-medium">{o.name}</span>
          <span className="text-muted-foreground">({o.radiusMeters}m)</span>
        </div>
      ))}
    </div>
  );
}

export function AttendanceMap({ date }: AttendanceMapProps) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(date ?? today);

  const { data: mapData, isLoading, refetch } = useQuery({
    queryKey: ['attendance', 'map', selectedDate],
    queryFn: () => attendanceGpsApi.getMapData(selectedDate),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-primary" />
            Ban do cham cong GPS
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : mapData ? (
          <>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                Ngay:{' '}
                <span className="font-medium text-foreground">
                  {formatDate(selectedDate)}
                </span>
              </span>
              <span className="text-muted-foreground">
                Check-in GPS:{' '}
                <span className="font-medium text-foreground">{mapData.locations.length}</span>
              </span>
            </div>
            <MapWithPins mapData={mapData} selectedDate={selectedDate} />
            <OfficeLegend offices={mapData.offices} />
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Chi tiet vi tri ({mapData.locations.length}):
              </p>
              <CheckInLocationList mapData={mapData} />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Khong co du lieu ban do
          </p>
        )}
      </CardContent>
    </Card>
  );
}
