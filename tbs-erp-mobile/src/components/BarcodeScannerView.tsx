/**
 * BarcodeScannerView — wrapper cho react-native-camera-kit
 *
 * Props:
 * - onScan: callback nhan ma vach da quet
 * - isActive: bat/tat scan (false khi dang xu ly ket qua)
 * - style: custom style cho container
 *
 * Camera-kit ho tro QR Code, Code 128, Code 39, EAN-13, ITF, ...
 * De-bounce 1.5s sau moi scan thanh cong de tranh scan trung.
 *
 * PERMISSION NOTE:
 * Camera permission phai duoc cap truoc khi render component nay.
 * Component cha (ScanReceiveScreen, ScanQRScreen) co trach nhiem
 * kiem tra va xin quyen truoc khi hien thi BarcodeScannerView.
 *
 * TODO: Them permission check truc tiep vao component nay nhu mot fallback
 * de hien thi thong bao ro rang khi quyen bi tu choi, thay vi hien camera den.
 *
 * iOS:  Them NSCameraUsageDescription vao Info.plist
 * Android: Them <uses-permission android:name="android.permission.CAMERA"/>
 *          vao AndroidManifest.xml
 */
import React, {useRef, useCallback, useEffect, useState} from 'react';
import {StyleSheet, View, Text, ViewStyle, Platform} from 'react-native';
import {Camera, CameraType} from 'react-native-camera-kit';
import {PermissionsAndroid, Permission} from 'react-native';

interface BarcodeScannerViewProps {
  onScan: (code: string) => void;
  isActive: boolean;
  style?: ViewStyle;
  hint?: string;
}

const DEBOUNCE_MS = 1500;

// ============================================================
// FIX: Them camera permission check tren Android
// iOS tu dong xu ly qua Info.plist; Android can request runtime
// ============================================================

type CameraPermissionStatus = 'checking' | 'granted' | 'denied' | 'unavailable';

async function requestAndroidCameraPermission(): Promise<boolean> {
  try {
    const result = await PermissionsAndroid.request(
      'android.permission.CAMERA' as Permission,
      {
        title: 'Quyen truy cap camera',
        message: 'Ung dung can quyen camera de quet ma vach kien hang.',
        buttonPositive: 'Cap quyen',
        buttonNegative: 'Tu choi',
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

async function checkCameraPermission(): Promise<CameraPermissionStatus> {
  if (Platform.OS === 'android') {
    try {
      const hasPermission = await PermissionsAndroid.check(
        'android.permission.CAMERA' as Permission,
      );
      if (hasPermission) {
        return 'granted';
      }
      const granted = await requestAndroidCameraPermission();
      return granted ? 'granted' : 'denied';
    } catch {
      return 'unavailable';
    }
  }
  // iOS: camera-kit tu xu ly permission request lan dau
  return 'granted';
}

export default function BarcodeScannerView({
  onScan,
  isActive,
  style,
  hint = 'Dua ma vach vao khung quet',
}: BarcodeScannerViewProps): React.JSX.Element {
  // Timestamp cua lan scan cuoi — de de-bounce
  const lastScanAt = useRef<number>(0);

  // FIX: Them permission state de hien UI phu hop
  const [permStatus, setPermStatus] = useState<CameraPermissionStatus>('checking');

  useEffect(() => {
    let mounted = true;
    checkCameraPermission().then(status => {
      if (mounted) {
        setPermStatus(status);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleBarcode = useCallback(
    (event: {nativeEvent: {codeStringValue: string}}) => {
      if (!isActive) {
        return;
      }

      const now = Date.now();
      if (now - lastScanAt.current < DEBOUNCE_MS) {
        // Qua giau — bo qua
        return;
      }

      const code = event.nativeEvent.codeStringValue?.trim();
      if (!code) {
        return;
      }

      lastScanAt.current = now;
      onScan(code);
    },
    [isActive, onScan],
  );

  // FIX: Hien thong bao ro rang thay vi camera den khi khong co quyen
  if (permStatus === 'checking') {
    return (
      <View style={[styles.container, styles.permContainer, style]}>
        <Text style={styles.permText}>Dang kiem tra quyen camera...</Text>
      </View>
    );
  }

  if (permStatus === 'denied') {
    return (
      <View style={[styles.container, styles.permContainer, style]}>
        <Text style={styles.permDeniedIcon}>X</Text>
        <Text style={styles.permDeniedTitle}>Khong co quyen camera</Text>
        <Text style={styles.permText}>
          Vao Cai dat he thong de cap quyen camera cho ung dung TBS ERP.
        </Text>
      </View>
    );
  }

  if (permStatus === 'unavailable') {
    return (
      <View style={[styles.container, styles.permContainer, style]}>
        <Text style={styles.permDeniedTitle}>Camera khong kha dung</Text>
        <Text style={styles.permText}>
          Thiet bi nay khong ho tro camera hoac camera dang duoc su dung boi ung dung khac.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Camera
        style={styles.camera}
        cameraType={CameraType.Back}
        scanBarcode={isActive}
        onReadCode={handleBarcode}
        showFrame={true}
        laserColor="#2196F3"
        frameColor="#FFFFFF"
        focusMode="on"
      />
      {/* Overlay hint text */}
      <View style={styles.hintContainer} pointerEvents="none">
        <Text style={styles.hintText}>{hint}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  hintContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
  },
  hintText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  permContainer: {
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permDeniedIcon: {
    fontSize: 40,
    color: '#EF5350',
    marginBottom: 12,
    fontWeight: '700',
  },
  permDeniedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  permText: {
    fontSize: 13,
    color: '#BDBDBD',
    textAlign: 'center',
    lineHeight: 20,
  },
});
