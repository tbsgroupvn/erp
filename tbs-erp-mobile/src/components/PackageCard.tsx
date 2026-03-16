/**
 * PackageCard — hien thi thong tin mot kien hang
 * Dung chung cho ca warehouse CN va VN screens
 */
import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';

// Badge mau sac tuong ung voi trang thai
const STATUS_CONFIG: Record<
  string,
  {label: string; background: string; text: string}
> = {
  RECEIVED: {label: 'Đã nhận', background: '#E3F2FD', text: '#1565C0'},
  INSPECTED: {label: 'Đã kiểm', background: '#E8F5E9', text: '#2E7D32'},
  PACKED: {label: 'Đã đóng gói', background: '#FFF3E0', text: '#E65100'},
  SHIPPED: {label: 'Đã xuất kho', background: '#F3E5F5', text: '#6A1B9A'},
  SORTED: {label: 'Đã phân loại', background: '#E0F7FA', text: '#00695C'},
  READY: {label: 'Sẵn sàng', background: '#E8F5E9', text: '#1B5E20'},
  DELIVERED: {label: 'Đã giao', background: '#EEEEEE', text: '#424242'},
};

export interface PackageCardData {
  id: string;
  code: string;
  trackingNumber?: string;
  orderCode?: string;
  customerName?: string;
  status: string;
  actualWeightKg?: number;
  chargeableWeightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

interface PackageCardProps {
  data: PackageCardData;
  onPress?: () => void;
  showWeight?: boolean;
}

export default function PackageCard({
  data,
  onPress,
  showWeight = true,
}: PackageCardProps): React.JSX.Element {
  const statusCfg = STATUS_CONFIG[data.status] ?? {
    label: data.status,
    background: '#F5F5F5',
    text: '#616161',
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityLabel={`Kiện hàng ${data.code}`}>
      {/* Header: ma kien + badge trang thai */}
      <View style={styles.header}>
        <Text style={styles.code} numberOfLines={1}>
          {data.code}
        </Text>
        <View style={[styles.badge, {backgroundColor: statusCfg.background}]}>
          <Text style={[styles.badgeText, {color: statusCfg.text}]}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Ma don hang */}
      {data.orderCode ? (
        <Text style={styles.meta}>
          Đơn: <Text style={styles.metaValue}>{data.orderCode}</Text>
        </Text>
      ) : null}

      {/* Ma tracking */}
      {data.trackingNumber ? (
        <Text style={styles.meta}>
          Tracking: <Text style={styles.metaValue}>{data.trackingNumber}</Text>
        </Text>
      ) : null}

      {/* Ten khach hang */}
      {data.customerName ? (
        <Text style={styles.meta}>
          Khách: <Text style={styles.metaValue}>{data.customerName}</Text>
        </Text>
      ) : null}

      {/* Thong so trong luong + kich thuoc */}
      {showWeight && (data.actualWeightKg != null || data.chargeableWeightKg != null) ? (
        <View style={styles.weightRow}>
          {data.actualWeightKg != null ? (
            <Text style={styles.weightItem}>
              TL thực: <Text style={styles.weightValue}>{data.actualWeightKg.toFixed(2)} kg</Text>
            </Text>
          ) : null}
          {data.chargeableWeightKg != null ? (
            <Text style={styles.weightItem}>
              TL tính cước: <Text style={styles.weightValue}>{data.chargeableWeightKg.toFixed(2)} kg</Text>
            </Text>
          ) : null}
          {data.lengthCm != null && data.widthCm != null && data.heightCm != null ? (
            <Text style={styles.weightItem}>
              K/T: <Text style={styles.weightValue}>{data.lengthCm}x{data.widthCm}x{data.heightCm} cm</Text>
            </Text>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginVertical: 6,
    // Shadow iOS
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    // Shadow Android
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  code: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#757575',
    marginTop: 3,
  },
  metaValue: {
    color: '#424242',
    fontWeight: '500',
  },
  weightRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weightItem: {
    fontSize: 12,
    color: '#757575',
  },
  weightValue: {
    color: '#1565C0',
    fontWeight: '600',
  },
});
