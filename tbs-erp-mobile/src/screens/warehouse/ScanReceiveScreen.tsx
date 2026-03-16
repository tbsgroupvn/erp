/**
 * ScanReceiveScreen — quet va nhan hang tai kho Trung Quoc
 *
 * Flow:
 * 1. Quet ma barcode tren kien hang
 * 2. Goi GET /warehouse-cn/packages/scan/:tracking de tra cuu
 * 3. Hien thi thong tin kien: ma lenh, don hang, trong luong du kien
 * 4. Nhan "Nhan hang" → POST /warehouse-cn/receive
 * 5. Camera tu focus lai sau moi lan nhan thanh cong
 * 6. Neu mat mang → luu vao offline queue
 *
 * FIX: Cleanup resetTimer khi component unmount de tranh memory leak
 */
import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import BarcodeScannerView from '../../components/BarcodeScannerView';
import {apiGet, apiPost} from '../../services/api';
import {enqueue} from '../../services/offline-queue';

// Thong tin kien hang tra ve tu API scan
interface PackageScanResult {
  id?: string;             // null neu chua co trong he thong (pre-alert)
  trackingNumber: string;
  orderCode?: string;
  orderType?: string;      // MHH, NCC, KHAC
  customerName?: string;
  declaredWeightKg?: number;
  matchedPreAlert: boolean;
  status?: string;
  note?: string;
}

type ScreenState = 'scanning' | 'loading' | 'confirm' | 'receiving' | 'success' | 'error';

const AUTO_RESET_DELAY = 3000; // ms tu sau khi nhan hang thanh cong

export default function ScanReceiveScreen(): React.JSX.Element {
  const [state, setState] = useState<ScreenState>('scanning');
  const [trackingCode, setTrackingCode] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [scanResult, setScanResult] = useState<PackageScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receivedCount, setReceivedCount] = useState(0);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX: Mounted ref de tranh setState sau khi unmount
  const mountedRef = useRef(true);

  // FIX: Cleanup timer khi component unmount — tranh memory leak
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, []);

  // Reset ve trang thai quet ban dau
  // Khai bao truoc handleReceive vi handleReceive dung no
  const resetToScan = useCallback(() => {
    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
      resetTimer.current = null;
    }
    if (!mountedRef.current) {
      return;
    }
    setState('scanning');
    setScanResult(null);
    setTrackingCode('');
    setManualInput('');
    setErrorMsg(null);
  }, []);

  // Tra cuu kien hang theo tracking number
  const lookupTracking = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }
    setState('loading');
    setErrorMsg(null);

    try {
      const result = await apiGet<{data: PackageScanResult}>(
        `/warehouse-cn/packages/scan/${encodeURIComponent(trimmed)}`,
      );
      if (!mountedRef.current) {
        return;
      }
      setScanResult(result.data);
      setTrackingCode(trimmed);
      setState('confirm');
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Loi tra cuu';
      setErrorMsg(`${trimmed}: ${msg}`);
      setState('error');
    }
  }, []);

  // Nhan hang
  // FIX: Them resetToScan vao deps array cua useCallback
  const handleReceive = useCallback(async () => {
    if (!scanResult || !trackingCode) {
      return;
    }

    if (!mountedRef.current) {
      return;
    }
    setState('receiving');

    const payload = {
      trackingNumber: trackingCode,
      ...(scanResult.id ? {packageId: scanResult.id} : {}),
    };

    try {
      await apiPost('/warehouse-cn/receive', payload);

      if (!mountedRef.current) {
        return;
      }
      setReceivedCount(c => c + 1);
      setState('success');

      // Tu dong reset lai sau AUTO_RESET_DELAY ms
      resetTimer.current = setTimeout(() => {
        resetToScan();
      }, AUTO_RESET_DELAY);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Loi nhan hang';

      // Luu offline neu mat mang
      const msgLower = msg.toLowerCase();
      if (
        msgLower.includes('network') ||
        msgLower.includes('timeout') ||
        msgLower.includes('econnrefused')
      ) {
        await enqueue('POST', '/warehouse-cn/receive', payload);
        if (mountedRef.current) {
          Alert.alert(
            'Da luu offline',
            `Tracking ${trackingCode} se duoc gui khi co mang.`,
            [{text: 'OK', onPress: resetToScan}],
          );
        }
        return;
      }

      if (mountedRef.current) {
        setErrorMsg(msg);
        setState('error');
      }
    }
  }, [scanResult, trackingCode, resetToScan]);

  const handleManualSubmit = useCallback(() => {
    lookupTracking(manualInput);
  }, [lookupTracking, manualInput]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Counter den kien da nhan */}
        <View style={styles.counterBar}>
          <Text style={styles.counterText}>
            Da nhan: <Text style={styles.counterNumber}>{receivedCount}</Text> kien
          </Text>
        </View>

        {/* Camera scanner */}
        {(state === 'scanning' || state === 'loading') ? (
          <View style={styles.scannerSection}>
            <BarcodeScannerView
              onScan={lookupTracking}
              isActive={state === 'scanning'}
              hint="Quet ma vach tracking tren kien hang"
              style={styles.scanner}
            />
            {state === 'loading' ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Dang tra cuu...</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Nhap thu cong */}
        <View style={styles.manualSection}>
          <TextInput
            style={styles.manualInput}
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="Nhap tracking thu cong..."
            placeholderTextColor="#BDBDBD"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleManualSubmit}
            editable={state === 'scanning' || state === 'error'}
          />
          <TouchableOpacity
            style={[
              styles.manualButton,
              (!manualInput.trim() || state === 'loading') && styles.manualButtonDisabled,
            ]}
            onPress={handleManualSubmit}
            disabled={!manualInput.trim() || state === 'loading'}>
            <Text style={styles.manualButtonText}>Tra cuu</Text>
          </TouchableOpacity>
        </View>

        {/* Ket qua tra cuu — cho xac nhan */}
        {state === 'confirm' && scanResult ? (
          <ScrollView style={styles.resultSection} contentContainerStyle={styles.resultContent}>
            <View style={[styles.matchBanner, scanResult.matchedPreAlert ? styles.matchGreen : styles.matchYellow]}>
              <Text style={styles.matchText}>
                {scanResult.matchedPreAlert
                  ? 'Khop Pre-alert'
                  : 'Khong co Pre-alert — se tao Lost & Found'}
              </Text>
            </View>

            <View style={styles.infoCard}>
              <ScanInfoRow label="Tracking" value={trackingCode} bold />
              {scanResult.orderCode ? (
                <ScanInfoRow label="Don hang" value={scanResult.orderCode} />
              ) : null}
              {scanResult.orderType ? (
                <ScanInfoRow label="Loai don" value={scanResult.orderType} />
              ) : null}
              {scanResult.customerName ? (
                <ScanInfoRow label="Khach hang" value={scanResult.customerName} />
              ) : null}
              {scanResult.declaredWeightKg != null ? (
                <ScanInfoRow
                  label="TL khai bao"
                  value={`${scanResult.declaredWeightKg.toFixed(2)} kg`}
                />
              ) : null}
              {scanResult.note ? (
                <ScanInfoRow label="Ghi chu" value={scanResult.note} multiline />
              ) : null}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetToScan}>
                <Text style={styles.cancelBtnText}>Huy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.receiveBtn}
                onPress={handleReceive}
                accessibilityRole="button"
                accessibilityLabel="Nhan hang">
                <Text style={styles.receiveBtnText}>Nhan hang</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : null}

        {/* Dang nhan hang */}
        {state === 'receiving' ? (
          <View style={styles.centeredResult}>
            <ActivityIndicator size="large" color="#1565C0" />
            <Text style={styles.receivingText}>Dang luu...</Text>
          </View>
        ) : null}

        {/* Nhan hang thanh cong */}
        {state === 'success' ? (
          <View style={styles.centeredResult}>
            <View style={styles.successCircle}>
              <Text style={styles.successCheckmark}>V</Text>
            </View>
            <Text style={styles.successTitle}>Nhan hang thanh cong!</Text>
            <Text style={styles.successSub}>{trackingCode}</Text>
            <Text style={styles.autoResetHint}>Tu dong quet kien tiep theo...</Text>
            <TouchableOpacity style={styles.scanNextBtn} onPress={resetToScan}>
              <Text style={styles.scanNextBtnText}>Quet ngay</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Loi */}
        {state === 'error' ? (
          <View style={styles.centeredResult}>
            <Text style={styles.errorIcon}>X</Text>
            <Text style={styles.errorTitle}>Loi</Text>
            <Text style={styles.errorMsg}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={resetToScan}>
              <Text style={styles.retryBtnText}>Quet lai</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

// Helper component
function ScanInfoRow({label, value, bold, multiline}: {
  label: string;
  value: string;
  bold?: boolean;
  multiline?: boolean;
}): React.JSX.Element {
  return (
    <View style={rowSt.row}>
      <Text style={rowSt.label}>{label}</Text>
      <Text
        style={[rowSt.value, bold === true && rowSt.bold]}
        numberOfLines={multiline === true ? 3 : 1}>
        {value}
      </Text>
    </View>
  );
}

const rowSt = StyleSheet.create({
  row: {flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5'},
  label: {width: 100, fontSize: 13, color: '#9E9E9E'},
  value: {flex: 1, fontSize: 14, color: '#212121'},
  bold: {fontWeight: '700', color: '#1565C0'},
});

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flex: 1, backgroundColor: '#F8FAFB'},
  counterBar: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  counterText: {color: '#FFFFFF', fontSize: 14},
  counterNumber: {fontWeight: '700', fontSize: 18},
  scannerSection: {flex: 1, position: 'relative'},
  scanner: {flex: 1},
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {color: '#FFF', marginTop: 10, fontSize: 14},
  manualSection: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    fontSize: 14,
    color: '#212121',
  },
  manualButton: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  manualButtonDisabled: {backgroundColor: '#BDBDBD'},
  manualButtonText: {color: '#FFF', fontWeight: '700', fontSize: 14},
  resultSection: {flex: 1},
  resultContent: {padding: 16, paddingBottom: 32},
  matchBanner: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
    alignItems: 'center',
  },
  matchGreen: {backgroundColor: '#E8F5E9'},
  matchYellow: {backgroundColor: '#FFF8E1'},
  matchText: {fontSize: 13, fontWeight: '600', color: '#424242'},
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  actionRow: {flexDirection: 'row', gap: 12},
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: {color: '#616161', fontWeight: '600', fontSize: 15},
  receiveBtn: {
    flex: 2,
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  receiveBtnText: {color: '#FFF', fontWeight: '700', fontSize: 15},
  centeredResult: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  receivingText: {marginTop: 12, fontSize: 14, color: '#757575'},
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successCheckmark: {fontSize: 32, color: '#2E7D32', fontWeight: '700'},
  successTitle: {fontSize: 20, fontWeight: '700', color: '#2E7D32', marginBottom: 6},
  successSub: {fontSize: 14, color: '#424242', marginBottom: 10},
  autoResetHint: {fontSize: 12, color: '#9E9E9E', marginBottom: 20},
  scanNextBtn: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanNextBtnText: {color: '#FFF', fontWeight: '700', fontSize: 15},
  errorIcon: {fontSize: 40, color: '#C62828', marginBottom: 12, fontWeight: '700'},
  errorTitle: {fontSize: 20, fontWeight: '700', color: '#C62828', marginBottom: 8},
  errorMsg: {fontSize: 13, color: '#757575', textAlign: 'center', marginBottom: 24, lineHeight: 20},
  retryBtn: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  retryBtnText: {color: '#FFF', fontWeight: '700', fontSize: 15},
});
