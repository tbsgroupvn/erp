'use client';

import Image from 'next/image';
import { useState, useRef, useCallback, useEffect, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Camera, MapPin, Loader2, X, Check } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api/client';
import type { BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// GPS Hook
// ---------------------------------------------------------------------------

function useGeoLocation() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ định vị GPS');
      return;
    }
    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(`Không thể lấy vị trí: ${err.message}`);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  return { location, error, loading, detect };
}

// ---------------------------------------------------------------------------
// Camera Capture Component
// ---------------------------------------------------------------------------

function CameraCapture({
  onCapture,
  capturedImage,
  onClear,
}: {
  onCapture: (dataUrl: string) => void;
  capturedImage: string | null;
  onClear: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      setIsStreaming(true);
    } catch (err) {
      setCameraError('Không thể truy cập camera. Vui lòng cấp quyền.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsStreaming(false);
  }, [stream]);

  const capture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    onCapture(dataUrl);
    stopCamera();
  }, [onCapture, stopCamera]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  if (capturedImage) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium leading-none">Ảnh selfie</p>
        <div className="relative inline-block">
          <Image
            src={capturedImage}
            alt="Selfie"
            width={320}
            height={240}
            className="rounded-md border object-cover"
            unoptimized
          />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => {
              onClear();
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium leading-none">Chụp ảnh selfie *</p>
      {cameraError && (
        <p className="text-xs text-destructive">{cameraError}</p>
      )}
      {isStreaming ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="rounded-md border max-w-[320px] max-h-[240px] bg-black"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex gap-2">
            <Button type="button" onClick={capture}>
              <Camera className="mr-2 h-4 w-4" />
              Chụp
            </Button>
            <Button type="button" variant="outline" onClick={stopCamera}>
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button type="button" variant="outline" onClick={startCamera}>
            <Camera className="mr-2 h-4 w-4" />
            Mở camera
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Manual Check-in Mutation
// ---------------------------------------------------------------------------

function useManualCheckIn() {
  return useMutation({
    mutationFn: (data: {
      selfieBase64: string;
      latitude: number;
      longitude: number;
      reason: string;
    }) =>
      apiClient
        .post<BaseResponse<{ id: string }>>('/attendance/manual-check-in', data)
        .then((r) => r.data.data),
    onSuccess: () => {
      toast.success('Chấm công thủ công thành công. Chờ HR duyệt.');
    },
    onError: () => {
      toast.error('Không thể gửi yêu cầu chấm công');
    },
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ManualAttendancePage() {
  const [reason, setReason] = useState('');
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const geo = useGeoLocation();
  const checkInMutation = useManualCheckIn();

  // Auto-detect GPS on mount
  useEffect(() => {
    geo.detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!selfieImage) {
      toast.error('Vui lòng chụp ảnh selfie');
      return;
    }
    if (!geo.location) {
      toast.error('Vui lòng chờ định vị GPS');
      return;
    }
    if (!reason.trim()) {
      toast.error('Vui lòng nhập lý do');
      return;
    }

    checkInMutation.mutate(
      {
        selfieBase64: selfieImage,
        latitude: geo.location.latitude,
        longitude: geo.location.longitude,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          setSelfieImage(null);
          setReason('');
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chấm công thủ công"
        description="Gửi yêu cầu chấm công khi không thể sử dụng máy chấm công"
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Gửi yêu cầu chấm công</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Camera Capture */}
            <CameraCapture
              onCapture={setSelfieImage}
              capturedImage={selfieImage}
              onClear={() => setSelfieImage(null)}
            />

            {/* GPS Status */}
            <div className="space-y-2">
              <p className="text-sm font-medium leading-none">Vị trí GPS</p>
              <div className="flex items-center gap-3">
                {geo.loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang lấy vị trí...
                  </div>
                ) : geo.location ? (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 font-medium">
                      {Number(geo.location.latitude).toFixed(6)}, {Number(geo.location.longitude).toFixed(6)}
                    </span>
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Chưa có vị trí</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={geo.detect}
                    >
                      Lấy vị trí
                    </Button>
                  </div>
                )}
              </div>
              {geo.error && (
                <p className="text-xs text-destructive">{geo.error}</p>
              )}
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="manual-reason">Lý do *</Label>
              <Input
                id="manual-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="VD: Quên thẻ, máy chấm công hỏng..."
              />
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={checkInMutation.isPending || !selfieImage || !geo.location || !reason.trim()}
              className="w-full"
            >
              {checkInMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang gửi...
                </>
              ) : (
                'Gửi yêu cầu chấm công'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
