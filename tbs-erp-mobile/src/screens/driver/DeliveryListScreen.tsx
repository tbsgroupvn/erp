/**
 * DeliveryListScreen — danh sach don giao hang cua tai xe
 *
 * API: GET /warehouse-vn/deliveries/assigned
 * - Chi lay cac delivery duoc gan cho tai xe dang dang nhap
 * - Pull-to-refresh de cap nhat trang thai
 * - Tap vao de xem chi tiet va xac nhan giao hang
 *
 * FIX: Tranh double-fetch khi mount
 * useEffect lan dau va focus listener deu goi fetchDeliveries.
 * Giai phap: chi dang ky focus listener sau khi mount xong (dung flag isMounted).
 */
import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {apiGet} from '../../services/api';
import type {DriverStackParamList} from '../../navigation/AppNavigator';

type DeliveryListNav = NativeStackNavigationProp<DriverStackParamList, 'DeliveryList'>;

interface Props {
  navigation: DeliveryListNav;
}

// Kieu du lieu mot don giao hang
export interface DeliveryItem {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  status: DeliveryStatus;
  codAmount: number;
  currency: string;
  packageCount: number;
  scheduledAt?: string;
  note?: string;
}

type DeliveryStatus = 'PENDING' | 'DISPATCHED' | 'DELIVERING' | 'DELIVERED' | 'FAILED';

const STATUS_DISPLAY: Record<DeliveryStatus, {label: string; color: string; bg: string}> = {
  PENDING: {label: 'Cho lay hang', color: '#E65100', bg: '#FFF3E0'},
  DISPATCHED: {label: 'Da dieu phoi', color: '#1565C0', bg: '#E3F2FD'},
  DELIVERING: {label: 'Dang giao', color: '#2E7D32', bg: '#E8F5E9'},
  DELIVERED: {label: 'Da giao', color: '#616161', bg: '#EEEEEE'},
  FAILED: {label: 'Giao that bai', color: '#B71C1C', bg: '#FFEBEE'},
};

// Response wrapper tu backend
interface ApiResponse<T> {
  data: T;
  total?: number;
}

export default function DeliveryListScreen({navigation}: Props): React.JSX.Element {
  const [deliveries, setDeliveries] = useState<DeliveryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // FIX: Dung ref de biet lan mount dau hay focus event
  // Tranh double fetch: useEffect mount + focus listener deu goi cung luc
  const isInitialMount = useRef(true);

  // Lay danh sach don hang duoc phan cong
  const fetchDeliveries = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await apiGet<ApiResponse<DeliveryItem[]>>(
        '/warehouse-vn/deliveries/assigned',
      );
      setDeliveries(response.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Khong the tai danh sach giao hang');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Load lan dau
    fetchDeliveries();

    // FIX: Dang ky focus listener sau khi fetch lan dau
    // Khi man hinh duoc focus lan dau (mount), fetchDeliveries da chay roi
    // → chi chay lai khi focus tu man hinh khac quay ve
    const unsubscribe = navigation.addListener('focus', () => {
      if (isInitialMount.current) {
        // Bo qua lan focus dau tien (trung voi mount)
        isInitialMount.current = false;
        return;
      }
      fetchDeliveries();
    });

    return unsubscribe;
  }, [fetchDeliveries, navigation]);

  const renderItem = useCallback(
    ({item}: {item: DeliveryItem}) => {
      const statusCfg = STATUS_DISPLAY[item.status] ?? {
        label: item.status,
        color: '#757575',
        bg: '#F5F5F5',
      };

      const canDeliver = item.status === 'DISPATCHED' || item.status === 'DELIVERING';

      return (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('DeliveryDetail', {delivery: item})}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Don hang ${item.orderCode}`}>
          {/* Header row */}
          <View style={styles.cardHeader}>
            <Text style={styles.orderCode}>{item.orderCode}</Text>
            <View style={[styles.badge, {backgroundColor: statusCfg.bg}]}>
              <Text style={[styles.badgeText, {color: statusCfg.color}]}>
                {statusCfg.label}
              </Text>
            </View>
          </View>

          {/* Thong tin khach hang */}
          <Text style={styles.customerName}>{item.customerName}</Text>
          <Text style={styles.phone}>{item.customerPhone}</Text>
          <Text style={styles.address} numberOfLines={2}>
            {item.deliveryAddress}
          </Text>

          {/* Footer row */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              <Text style={styles.packageCount}>{item.packageCount} kien</Text>
              {item.codAmount > 0 ? (
                <Text style={styles.cod}>
                  COD:{' '}
                  <Text style={styles.codAmount}>
                    {item.codAmount.toLocaleString('vi-VN')} {item.currency}
                  </Text>
                </Text>
              ) : null}
            </View>
            {canDeliver ? (
              <View style={styles.arrowContainer}>
                <Text style={styles.arrow}>{'>'}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [navigation],
  );

  const keyExtractor = useCallback((item: DeliveryItem) => item.id, []);

  // Thong ke nhanh theo trang thai
  const stats = deliveries.reduce(
    (acc, d) => {
      if (d.status === 'DISPATCHED' || d.status === 'DELIVERING') {
        acc.pending++;
      } else if (d.status === 'DELIVERED') {
        acc.done++;
      }
      return acc;
    },
    {pending: 0, done: 0},
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1565C0" />
        <Text style={styles.loadingText}>Dang tai danh sach...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchDeliveries()}>
          <Text style={styles.retryText}>Thu lai</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFB" />

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{stats.pending}</Text>
          <Text style={styles.summaryLabel}>Can giao</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryNumber, {color: '#2E7D32'}]}>{stats.done}</Text>
          <Text style={styles.summaryLabel}>Da giao</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryNumber}>{deliveries.length}</Text>
          <Text style={styles.summaryLabel}>Tong cong</Text>
        </View>
      </View>

      <FlatList
        data={deliveries}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={deliveries.length === 0 ? styles.emptyList : styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchDeliveries(true)}
            colors={['#1565C0']}
            tintColor="#1565C0"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>[ ]</Text>
            <Text style={styles.emptyTitle}>Khong co don hang</Text>
            <Text style={styles.emptySubtitle}>Ban chua duoc phan cong don giao nao.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#757575',
    fontSize: 14,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1565C0',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderCode: {
    fontSize: 15,
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
    fontSize: 11,
    fontWeight: '600',
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginBottom: 2,
  },
  phone: {
    fontSize: 13,
    color: '#1565C0',
    marginBottom: 4,
  },
  address: {
    fontSize: 13,
    color: '#616161',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  footerLeft: {
    flex: 1,
  },
  packageCount: {
    fontSize: 13,
    color: '#757575',
  },
  cod: {
    fontSize: 13,
    color: '#757575',
    marginTop: 2,
  },
  codAmount: {
    color: '#E65100',
    fontWeight: '600',
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrow: {
    fontSize: 16,
    color: '#1565C0',
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 32,
    color: '#BDBDBD',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
