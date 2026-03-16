'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, X, Loader2, SwitchCamera, Layers, CheckCircle2, XCircle, Package as PackageIcon } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/lib/api/client';
import { toast } from 'sonner';
import { ScanResultCard } from './scan-result-card';
import type { Package as PackageType, BaseResponse } from '@/lib/types';

// ---------------------------------------------------------------------------
// Helpers: beep + vibration
// ---------------------------------------------------------------------------

function playBeep(success: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = success ? 880 : 440;
    const duration = success ? 0.15 : 0.3;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    // Close the AudioContext after the sound finishes to avoid resource leaks
    osc.onended = () => { ctx.close().catch(() => undefined); };
  } catch {
    // AudioContext not available (SSR or older browsers) — skip silently
  }
}

function vibrate(ms = 80) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BatchScanItem {
  trackingNumber: string;
  scannedAt: string;
  result: 'found' | 'not_found';
  pkg?: PackageType;
}

interface BarcodeScannerProps {
  onScanResult?: (pkg: PackageType) => void;
  onBatchReceive?: (items: BatchScanItem[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BarcodeScanner({ onScanResult, onBatchReceive }: BarcodeScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scanResult, setScanResult] = useState<PackageType | null>(null);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraIdx, setActiveCameraIdx] = useState(0);

  // Batch mode
  const [batchMode, setBatchMode] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchScanItem[]>([]);
  const [isBatchReceiving, setIsBatchReceiving] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const regionRef = useRef<string>(`barcode-scanner-${Date.now()}`);
  // Prevent duplicate scans in batch mode
  const lastScannedRef = useRef<string>('');
  const scanCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch {
        // ignore stop errors
      }
      try {
        scannerRef.current.clear();
      } catch {
        // ignore clear errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const lookupTracking = useCallback(
    async (trackingNumber: string) => {
      const trimmed = trackingNumber.trim();
      if (!trimmed || isLookingUp) return;
      // Cooldown guard (2 s) to avoid repeated scans of same barcode
      if (lastScannedRef.current === trimmed) return;
      lastScannedRef.current = trimmed;
      scanCooldownRef.current = setTimeout(() => { lastScannedRef.current = ''; }, 2000);

      setIsLookingUp(true);
      try {
        const response = await apiClient.get<BaseResponse<PackageType>>(
          `/warehouse-cn/scan/${encodeURIComponent(trimmed)}`,
        );
        const pkg = response.data.data;

        if (batchMode) {
          const item: BatchScanItem = {
            trackingNumber: trimmed,
            scannedAt: new Date().toISOString(),
            result: pkg ? 'found' : 'not_found',
            pkg: pkg ?? undefined,
          };
          setBatchItems((prev) => [item, ...prev]);
          if (pkg) {
            playBeep(true);
            vibrate(80);
            toast.success(`Đã quét: ${pkg.code}`, { duration: 1500 });
          } else {
            playBeep(false);
            vibrate(200);
            toast.error(`Không tìm thấy: ${trimmed}`, { duration: 1500 });
          }
          // Resume scanning in batch mode
        } else {
          if (pkg) {
            setScanResult(pkg);
            onScanResult?.(pkg);
            playBeep(true);
            vibrate(80);
            toast.success(`Tìm thấy kiện hàng: ${pkg.code}`);
            await stopScanner();
          } else {
            playBeep(false);
            vibrate(200);
            toast.error('Không tìm thấy kiện hàng', { description: `Mã vận đơn: ${trimmed}` });
          }
        }
      } catch {
        if (batchMode) {
          setBatchItems((prev) => [
            { trackingNumber: trimmed, scannedAt: new Date().toISOString(), result: 'not_found' },
            ...prev,
          ]);
        }
        playBeep(false);
        vibrate(200);
        toast.error('Không tìm thấy kiện hàng', { description: `Mã vận đơn: ${trimmed}` });
      } finally {
        setIsLookingUp(false);
      }
    },
    [isLookingUp, batchMode, onScanResult, stopScanner],
  );

  const startScanner = useCallback(
    async (cameraId?: string) => {
      if (!cameraId && cameras.length === 0) {
        try {
          const deviceList = await Html5Qrcode.getCameras();
          if (deviceList.length === 0) {
            toast.error('Không tìm thấy camera');
            return;
          }
          setCameras(deviceList);
          cameraId = deviceList[0].id;
        } catch {
          toast.error('Không thể truy cập camera', {
            description: 'Vui lòng cấp quyền camera trong trình duyệt.',
          });
          return;
        }
      }

      const targetCamera = cameraId || cameras[0]?.id;
      if (!targetCamera) return;

      await stopScanner();
      await new Promise((r) => setTimeout(r, 100));

      const el = document.getElementById(regionRef.current);
      if (!el) return;

      const scanner = new Html5Qrcode(regionRef.current);
      scannerRef.current = scanner;

      try {
        await scanner.start(
          targetCamera,
          { fps: 10, qrbox: { width: 280, height: 150 }, aspectRatio: 1.5 },
          (decodedText) => { lookupTracking(decodedText); },
          () => { /* ignore no-decode frames */ },
        );
        setIsScanning(true);
      } catch (err) {
        toast.error('Không thể bật camera', {
          description: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      }
    },
    [cameras, stopScanner, lookupTracking],
  );

  const handleOpen = useCallback(async () => {
    setIsOpen(true);
    setScanResult(null);
    setTimeout(() => startScanner(), 200);
  }, [startScanner]);

  const handleClose = useCallback(async () => {
    if (scanCooldownRef.current) clearTimeout(scanCooldownRef.current);
    await stopScanner();
    setIsOpen(false);
    setScanResult(null);
    setBatchItems([]);
  }, [stopScanner]);

  const handleSwitchCamera = useCallback(async () => {
    if (cameras.length <= 1) return;
    const nextIdx = (activeCameraIdx + 1) % cameras.length;
    setActiveCameraIdx(nextIdx);
    await startScanner(cameras[nextIdx].id);
  }, [cameras, activeCameraIdx, startScanner]);

  const handleBatchReceive = useCallback(async () => {
    const foundItems = batchItems.filter((i) => i.result === 'found' && i.pkg);
    if (foundItems.length === 0) return;
    setIsBatchReceiving(true);
    try {
      onBatchReceive?.(foundItems);
      toast.success(`Đã nhận ${foundItems.length} kiện hàng`);
      setBatchItems([]);
    } finally {
      setIsBatchReceiving(false);
    }
  }, [batchItems, onBatchReceive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanCooldownRef.current) clearTimeout(scanCooldownRef.current);
      stopScanner();
    };
  }, [stopScanner]);

  if (!isOpen) {
    return (
      <Button variant="outline" onClick={handleOpen} className="gap-2">
        <Camera className="h-4 w-4" />
        Quét mã vạch
      </Button>
    );
  }

  const foundCount = batchItems.filter((i) => i.result === 'found').length;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Quét mã vạch bằng camera
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Batch mode toggle */}
            <div className="flex items-center gap-2 rounded-lg border px-2 py-1">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <Label htmlFor="batch-toggle" className="text-xs cursor-pointer select-none">
                Chế độ hàng loạt
              </Label>
              <Switch
                id="batch-toggle"
                checked={batchMode}
                onCheckedChange={(v) => {
                  setBatchMode(v);
                  if (!v) setBatchItems([]);
                }}
              />
            </div>
            {cameras.length > 1 && (
              <Button variant="ghost" size="icon" onClick={handleSwitchCamera} title="Đổi camera">
                <SwitchCamera className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLookingUp && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang tra cứu...
          </div>
        )}

        {/* Camera view (always show in batch mode, hide after single scan) */}
        {(!scanResult || batchMode) && (
          <>
            <div
              id={regionRef.current}
              className="w-full max-w-md mx-auto overflow-hidden rounded-lg border"
              style={{ minHeight: 250 }}
            />
            {!isScanning && !isLookingUp && (
              <div className="text-center">
                <Button onClick={() => startScanner()} variant="outline" size="sm">
                  <Camera className="mr-2 h-4 w-4" />
                  Bật camera
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              Hướng camera vào mã vạch trên kiện hàng (SF, YTO, ZTO, JD...)
            </p>
          </>
        )}

        {/* Single mode result */}
        {scanResult && !batchMode && (
          <ScanResultCard
            pkg={scanResult}
            onRescan={() => {
              setScanResult(null);
              setTimeout(() => startScanner(), 200);
            }}
          />
        )}

        {/* Batch mode scanned list */}
        {batchMode && batchItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Đã quét: {batchItems.length} mã
                {foundCount > 0 && (
                  <Badge variant="secondary" className="ml-2 bg-emerald-100 text-emerald-700">
                    {foundCount} tìm thấy
                  </Badge>
                )}
              </h4>
              <Button
                size="sm"
                onClick={handleBatchReceive}
                disabled={foundCount === 0 || isBatchReceiving}
                className="gap-1.5"
              >
                {isBatchReceiving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PackageIcon className="h-3.5 w-3.5" />
                )}
                Nhận tất cả ({foundCount})
              </Button>
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border divide-y text-sm">
              {batchItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2">
                  {item.result === 'found' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs flex-1 truncate">{item.trackingNumber}</span>
                  {item.pkg && (
                    <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                      {item.pkg.code}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(item.scannedAt).toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
