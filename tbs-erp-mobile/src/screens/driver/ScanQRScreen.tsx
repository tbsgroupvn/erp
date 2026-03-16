/**
 * ScanQRScreen — quet QR code de tra cuu don hang (danh cho tai xe)
 *
 * Flow:
 * 1. Quet ma QR tren kien hang
 * 2. Goi GET /warehouse-vn/packages/:code de lay thong tin
 * 3. Hien thi thong tin kien hang va trang thai
 * 4. Nut "Xem chi tiet" de di toi man hinh giao hang tuong ung
 */
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import BarcodeScannerView from '../../components/BarcodeScannerView';
import {apiGet} from '../../services/api';

interface ScannedPackage {
  id: string;
  code: string;
  trackingNumber: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  status: string;
  chargeableWeightKg?: number;
}

type ScanState = 'scanning' | 'loading' | 'result' | 'error';

export default function ScanQRScreen(): React.JSX.Element {
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [packageInfo, setPackageInfo] = useState<ScannedPackage | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // FIX: Mounted ref de tranh setState sau khi component da unmount
  // (user co the quet roi bam back trong khi dang goi API)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Xu ly khi quet duoc ma vach
  const handleScan = useCallback(async (code: string) => {
    if (!mountedRef.current) {
      return;
    }
    setScanState('loading');
    setScannedCode(code);
    setErrorMsg(null);

    try {
      // Tim kien hang theo code hoac tracking number
      const result = await apiGet<{data: ScannedPackage}>(
        `/warehouse-vn/packages/by-code/${encodeURIComponent(code)}`,
      );
      if (!mountedRef.current) {
        return;
      }
      setPackageInfo(result.data);
      setScanState('result');
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Khong tim thay kien hang';
      setErrorMsg(`Ma "${code}": ${msg}`);
      setScanState('error');
    }
  }, []);

  // Reset ve trang thai quet de quet lai
  const handleReset = useCallback(() => {
    setScanState('scanning');
    setScannedCode(null);
    setPackageInfo(null);
    setErrorMsg(null);
  }, []);

  return (
    <View style={styles.container}>
      {/* Camera scanner — chi hien khi dang scan */}
      {(scanState === 'scanning' || scanState === 'loading') ? (
        <View style={styles.scannerWrapper}>
          <BarcodeScannerView
            onScan={handleScan}
            isActive={scanState === 'scanning'}
            hint="Quét mã QR trên kiện hàng"
          />
          {scanState === 'loading' ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingText}>Đang tra cứu {scannedCode}...</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Ket qua scan thanh cong */}
      {scanState === 'result' && packageInfo ? (
        <ScrollView style={styles.resultContainer} contentContainerStyle={styles.resultContent}>
          <View style={styles.successBanner}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>Tìm thấy kiện hàng</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Thông tin kiện hàng</Text>

            <ResultRow label="Mã kiện" value={packageInfo.code} bold />
            <ResultRow label="Tracking" value={packageInfo.trackingNumber} />
            <ResultRow label="Đơn hàng" value={packageInfo.orderCode} />
            <ResultRow label="Khách hàng" value={packageInfo.customerName} />
            <ResultRow label="Điện thoại" value={packageInfo.customerPhone} />
            <ResultRow label="Địa chỉ giao" value={packageInfo.deliveryAddress} multiline />
            {packageInfo.chargeableWeightKg != null ? (
              <ResultRow
                label="TL tính cước"
                value={`${packageInfo.chargeableWeightKg.toFixed(2)} kg`}
              />
            ) : null}
            <ResultRow label="Trạng thái" value={packageInfo.status} />
          </View>

          <TouchableOpacity style={styles.scanAgainButton} onPress={handleReset}>
            <Text style={styles.scanAgainText}>Quét kiện khác</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : null}

      {/* Loi scan */}
      {scanState === 'error' ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>✕</Text>
          <Text style={styles.errorTitle}>Không tìm thấy</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleReset}>
            <Text style={styles.retryText}>Quét lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function ResultRow({
  label,
  value,
  bold,
  multiline,
}: {
  label: string;
  value: string;
  bold?: boolean;
  multiline?: boolean;
}): React.JSX.Element {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text
        style={[rowStyles.value, bold && rowStyles.valueBold]}
        numberOfLines={multiline ? 3 : 1}>
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  label: {
    width: 100,
    fontSize: 13,
    color: '#9E9E9E',
    flexShrink: 0,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
  },
  valueBold: {
    fontWeight: '700',
    color: '#1565C0',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerWrapper: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 14,
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  resultContent: {
    padding: 16,
    paddingBottom: 32,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  successIcon: {
    fontSize: 20,
    color: '#2E7D32',
    marginRight: 10,
    fontWeight: '700',
  },
  successText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  scanAgainButton: {
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  scanAgainText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#F8FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 48,
    color: '#C62828',
    marginBottom: 16,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C62828',
    marginBottom: 8,
  },
  errorMsg: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
