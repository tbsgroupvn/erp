/**
 * MeasureScreen — do luong kien hang tai kho TQ
 *
 * Chuc nang:
 * - Nhap dai / rong / cao (cm) va trong luong thuc te (kg)
 * - Tu dong tinh the tich va trong luong tinh cuoc (chargeable weight)
 * - Submit: POST /warehouse-cn/packages/:id/measure
 *
 * Cong thuc:
 * - Trong luong the tich (volumetric) = (D x R x C) / 6000 kg
 * - Trong luong tinh cuoc = max(trong luong thuc, trong luong the tich)
 */
import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {apiPost} from '../../services/api';
import type {WarehouseStackParamList} from '../../navigation/AppNavigator';

type MeasureNav = NativeStackNavigationProp<WarehouseStackParamList, 'Measure'>;
type MeasureRoute = RouteProp<WarehouseStackParamList, 'Measure'>;

interface Props {
  navigation: MeasureNav;
  route: MeasureRoute;
}

// He so divisor theo tuyen hang — default quoc te la 6000
const VOLUMETRIC_DIVISOR = 6000;

interface FormValues {
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  weightKg: string;
  note: string;
}

const INITIAL_FORM: FormValues = {
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  weightKg: '',
  note: '',
};

export default function MeasureScreen({navigation, route}: Props): React.JSX.Element {
  // packageId co the duoc truyen tu PackageListScreen
  const packageId: string | undefined = route.params?.packageId;
  const packageCode: string | undefined = route.params?.packageCode;

  const [form, setForm] = useState<FormValues>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);

  // Helper set field
  const setField = useCallback((field: keyof FormValues, value: string) => {
    setForm(prev => ({...prev, [field]: value}));
  }, []);

  // Tinh toan live trong luong
  const calculations = useMemo(() => {
    const l = parseFloat(form.lengthCm);
    const w = parseFloat(form.widthCm);
    const h = parseFloat(form.heightCm);
    const wt = parseFloat(form.weightKg);

    if (!l || !w || !h) {
      return null;
    }

    const volumeCm3 = l * w * h;
    const volumetricWeightKg = volumeCm3 / VOLUMETRIC_DIVISOR;
    const actualWeightKg = wt || 0;
    const chargeableWeightKg = Math.max(actualWeightKg, volumetricWeightKg);

    return {
      volumeCm3: Math.round(volumeCm3),
      volumetricWeightKg: +volumetricWeightKg.toFixed(3),
      chargeableWeightKg: +chargeableWeightKg.toFixed(3),
      usesVolumetric: volumetricWeightKg > actualWeightKg,
    };
  }, [form.lengthCm, form.widthCm, form.heightCm, form.weightKg]);

  // Validate form
  const isValid = useMemo(() => {
    const l = parseFloat(form.lengthCm);
    const w = parseFloat(form.widthCm);
    const h = parseFloat(form.heightCm);
    const wt = parseFloat(form.weightKg);
    return l > 0 && w > 0 && h > 0 && wt > 0;
  }, [form]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || !packageId) {
      if (!packageId) {
        Alert.alert('Lỗi', 'Không xác định được mã kiện hàng. Vui lòng quay lại và chọn kiện.');
      }
      return;
    }

    if (!calculations) {
      return;
    }

    Alert.alert(
      'Xác nhận đo lường',
      `Trọng lượng tính cước: ${calculations.chargeableWeightKg} kg\n` +
        `(${calculations.usesVolumetric ? 'tính theo thể tích' : 'tính theo thực tế'})`,
      [
        {text: 'Hủy', style: 'cancel'},
        {
          text: 'Lưu',
          onPress: async () => {
            setLoading(true);
            try {
              await apiPost(`/warehouse-cn/packages/${packageId}/measure`, {
                lengthCm: parseFloat(form.lengthCm),
                widthCm: parseFloat(form.widthCm),
                heightCm: parseFloat(form.heightCm),
                actualWeightKg: parseFloat(form.weightKg),
                note: form.note.trim() || undefined,
              });

              Alert.alert(
                'Lưu thành công',
                `Kiện ${packageCode ?? packageId} đã được đo lường.\nTL tính cước: ${calculations.chargeableWeightKg} kg`,
                [{text: 'OK', onPress: () => navigation.goBack()}],
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Lỗi lưu đo lường';
              Alert.alert('Lỗi', msg);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  }, [isValid, packageId, packageCode, form, calculations, navigation]);

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">

        {/* Package context */}
        {packageCode ? (
          <View style={styles.packageBanner}>
            <Text style={styles.packageLabel}>Kiện hàng:</Text>
            <Text style={styles.packageCode}>{packageCode}</Text>
          </View>
        ) : null}

        {/* Nhap kich thuoc */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kích thước (cm)</Text>
          <View style={styles.dimensionRow}>
            <DimInput
              label="Dài"
              value={form.lengthCm}
              onChangeText={v => setField('lengthCm', v)}
            />
            <DimInput
              label="Rộng"
              value={form.widthCm}
              onChangeText={v => setField('widthCm', v)}
            />
            <DimInput
              label="Cao"
              value={form.heightCm}
              onChangeText={v => setField('heightCm', v)}
            />
          </View>
        </View>

        {/* Nhap trong luong */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trọng lượng thực tế (kg)</Text>
          <TextInput
            style={styles.weightInput}
            value={form.weightKg}
            onChangeText={v => setField('weightKg', v)}
            placeholder="0.000"
            placeholderTextColor="#BDBDBD"
            keyboardType="decimal-pad"
            returnKeyType="next"
            accessibilityLabel="Nhập trọng lượng"
          />
        </View>

        {/* Ghi chu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ghi chú (tùy chọn)</Text>
          <TextInput
            style={styles.noteInput}
            value={form.note}
            onChangeText={v => setField('note', v)}
            placeholder="Tình trạng bao bì, ghi chú đặc biệt..."
            placeholderTextColor="#BDBDBD"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Ket qua tinh toan live */}
        {calculations ? (
          <View style={styles.calcSection}>
            <Text style={styles.calcTitle}>Kết quả tính toán</Text>
            <CalcRow label="Thể tích" value={`${calculations.volumeCm3.toLocaleString()} cm³`} />
            <CalcRow
              label="TL thể tích"
              value={`${calculations.volumetricWeightKg} kg`}
            />
            <CalcRow
              label="TL tính cước"
              value={`${calculations.chargeableWeightKg} kg`}
              highlight
              sublabel={calculations.usesVolumetric ? '(theo thể tích)' : '(theo thực tế)'}
            />
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
            <Text style={styles.resetBtnText}>Nhập lại</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveBtn,
              (!isValid || loading || !packageId) && styles.saveBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isValid || loading || !packageId}
            accessibilityRole="button"
            accessibilityLabel="Lưu đo lường">
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Lưu đo lường</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Sub components
function DimInput({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}): React.JSX.Element {
  return (
    <View style={dimSt.wrapper}>
      <Text style={dimSt.label}>{label}</Text>
      <TextInput
        style={dimSt.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="0"
        placeholderTextColor="#BDBDBD"
        keyboardType="decimal-pad"
        returnKeyType="next"
        accessibilityLabel={`Nhập ${label}`}
      />
    </View>
  );
}

const dimSt = StyleSheet.create({
  wrapper: {flex: 1},
  label: {fontSize: 12, color: '#9E9E9E', marginBottom: 4, textAlign: 'center'},
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A2E',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
  },
});

function CalcRow({label, value, highlight, sublabel}: {
  label: string;
  value: string;
  highlight?: boolean;
  sublabel?: string;
}): React.JSX.Element {
  return (
    <View style={calcSt.row}>
      <View style={calcSt.labelGroup}>
        <Text style={calcSt.label}>{label}</Text>
        {sublabel ? <Text style={calcSt.sublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={[calcSt.value, highlight && calcSt.highlight]}>{value}</Text>
    </View>
  );
}

const calcSt = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  labelGroup: {flexDirection: 'row', alignItems: 'center', gap: 6},
  label: {fontSize: 14, color: '#424242'},
  sublabel: {fontSize: 11, color: '#9E9E9E'},
  value: {fontSize: 14, fontWeight: '600', color: '#424242'},
  highlight: {color: '#1565C0', fontSize: 17, fontWeight: '700'},
});

const styles = StyleSheet.create({
  flex: {flex: 1},
  container: {flex: 1, backgroundColor: '#F8FAFB'},
  content: {paddingBottom: 32},
  packageBanner: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packageLabel: {fontSize: 13, color: '#1565C0'},
  packageCode: {fontSize: 15, fontWeight: '700', color: '#1565C0'},
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9E9E9E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  dimensionRow: {flexDirection: 'row', gap: 10},
  weightInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    backgroundColor: '#FAFAFA',
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1A1A2E',
    backgroundColor: '#FAFAFA',
    minHeight: 80,
  },
  calcSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E3F2FD',
  },
  calcTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1565C0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    gap: 12,
  },
  resetBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  resetBtnText: {color: '#616161', fontWeight: '600', fontSize: 14},
  saveBtn: {
    flex: 2,
    backgroundColor: '#1565C0',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#1565C0',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {backgroundColor: '#90CAF9', shadowOpacity: 0, elevation: 0},
  saveBtnText: {color: '#FFF', fontWeight: '700', fontSize: 15},
  bottomSpacer: {height: 40},
});
