'use client';

import { useState, useCallback } from 'react';
import { MapPin, Navigation, CheckCircle, XCircle, Loader2, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { attendanceGpsApi, type GpsValidationResult, type OfficeLocation } from '@/lib/api/attendance.api';
import { attendanceKeys } from '@/lib/hooks/use-attendance';

interface GpsCheckInProps {
  onSuccess?: () => void;
}

type GeoState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; lat: number; lng: number; accuracy: number }
  | { status: 'error'; message: string };

function DistanceIndicator({
  validation,
  offices,
}: {
  validation: GpsValidationResult | null;
  offices: OfficeLocation[];
}) {
  if (!validation) return null;

  if (validation.isValid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
        <div>
          <p className="text-sm font-medium text-green-800">Trong phạm vi văn phòng</p>
          {validation.officeName && (
            <p className="text-xs text-green-600">
              {validation.officeName}
              {validation.distance !== undefined ? ` — ${validation.distance}m` : ''}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
      <XCircle className="h-5 w-5 shrink-0 text-orange-600" />
      <div>
        <p className="text-sm font-medium text-orange-800">Ngoài phạm vi văn phòng</p>
        {validation.officeName && validation.distance !== undefined && (
          <p className="text-xs text-orange-600">
            Cach {validation.officeName}: {validation.distance}m
          </p>
        )}
        {offices.length === 0 && (
          <p className="text-xs text-orange-600">Chưa có văn phòng nào được cấu hình</p>
        )}
      </div>
    </div>
  );
}

export function GpsCheckIn({ onSuccess }: GpsCheckInProps) {
  const qc = useQueryClient();
  const [geoState, setGeoState] = useState<GeoState>({ status: 'idle' });
  const [validation, setValidation] = useState<GpsValidationResult | null>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ['attendance', 'offices'],
    queryFn: () => attendanceGpsApi.getOffices(),
    staleTime: 5 * 60 * 1000,
  });

  const validateMutation = useMutation({
    mutationFn: ({ lat, lng }: { lat: number; lng: number }) =>
      attendanceGpsApi.validateGps(lat, lng),
    onSuccess: (result) => setValidation(result),
  });

  const checkInMutation = useMutation({
    mutationFn: attendanceGpsApi.checkInGps,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success(data.gpsValidation.isValid ? 'Check-in GPS thành công' : 'Check-in từ xa thành công');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Không thể check-in');
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: attendanceGpsApi.checkOutGps,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: attendanceKeys.all });
      toast.success('Check-out GPS thành công');
      onSuccess?.();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Không thể check-out');
    },
  });

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoState({ status: 'error', message: 'Trình duyệt không hỗ trợ GPS' });
      return;
    }
    setGeoState({ status: 'loading' });
    setValidation(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGeoState({ status: 'ready', lat: latitude, lng: longitude, accuracy });
        validateMutation.mutate({ lat: latitude, lng: longitude });
      },
      (err) => {
        const messages: Record<number, string> = {
          1: 'Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt',
          2: 'Không thể lấy vị trí GPS. Hãy thử lại',
          3: 'Quá thời gian chờ GPS. Hãy thử lại',
        };
        setGeoState({ status: 'error', message: messages[err.code] || err.message });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, [validateMutation]);

  const handleCheckIn = () => {
    if (geoState.status !== 'ready') return;
    checkInMutation.mutate({
      latitude: geoState.lat,
      longitude: geoState.lng,
      method: 'GPS',
    });
  };

  const handleCheckOut = () => {
    if (geoState.status !== 'ready') return;
    checkOutMutation.mutate({
      latitude: geoState.lat,
      longitude: geoState.lng,
      method: 'GPS',
    });
  };

  const isProcessing =
    checkInMutation.isPending || checkOutMutation.isPending || validateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Chấm công GPS
        </CardTitle>
        <CardDescription>
          Bật GPS để xác nhận vị trí của bạn trước khi chấm công
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Get location button */}
        <Button
          className="w-full"
          variant="outline"
          onClick={getLocation}
          disabled={geoState.status === 'loading' || isProcessing}
        >
          {geoState.status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Đang lấy vị trí GPS...
            </>
          ) : (
            <>
              <Navigation className="mr-2 h-4 w-4" />
              {geoState.status === 'ready' ? 'Làm mới vị trí' : 'Lấy vị trí của tôi'}
            </>
          )}
        </Button>

        {/* GPS error */}
        {geoState.status === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{geoState.message}</p>
          </div>
        )}

        {/* GPS coords display */}
        {geoState.status === 'ready' && (
          <div className="rounded-lg bg-muted px-4 py-3 text-sm">
            <div className="grid grid-cols-2 gap-1 text-muted-foreground">
              <span>Lat:</span>
              <span className="font-mono text-foreground">{geoState.lat.toFixed(6)}</span>
              <span>Lng:</span>
              <span className="font-mono text-foreground">{geoState.lng.toFixed(6)}</span>
              <span>Độ chính xác:</span>
              <span className="text-foreground">&plusmn;{Math.round(geoState.accuracy)}m</span>
            </div>
          </div>
        )}

        {/* Distance / office indicator */}
        {geoState.status === 'ready' && (
          <>
            {validateMutation.isPending ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang kiểm tra vị trí...
              </div>
            ) : (
              <DistanceIndicator validation={validation} offices={offices} />
            )}
          </>
        )}

        {/* Map embed (OpenStreetMap) */}
        {geoState.status === 'ready' && (
          <div className="overflow-hidden rounded-lg border">
            <iframe
              title="Vị trí hiện tại"
              width="100%"
              height="200"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${geoState.lng - 0.003}%2C${geoState.lat - 0.002}%2C${geoState.lng + 0.003}%2C${geoState.lat + 0.002}&layer=mapnik&marker=${geoState.lat}%2C${geoState.lng}`}
              style={{ border: 0 }}
            />
          </div>
        )}

        {/* Action buttons */}
        {geoState.status === 'ready' && (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={handleCheckIn}
              disabled={isProcessing}
              size="lg"
            >
              {checkInMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="mr-2 h-4 w-4" />
              )}
              Chấm vào GPS
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleCheckOut}
              disabled={isProcessing}
              size="lg"
            >
              {checkOutMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Chấm ra GPS
            </Button>
          </div>
        )}

        {/* Office list */}
        {offices.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Văn phòng hiện có:</p>
            {offices.map((o) => (
              <div key={o.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>
                  {o.name} — bán kính {o.radiusMeters}m
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
