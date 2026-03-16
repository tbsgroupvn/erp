/**
 * PackageListScreen — danh sach kien hang tai kho (CN hoac VN)
 *
 * API: GET /warehouse-cn/packages  hoac  GET /warehouse-vn/packages
 * Params: ?status=RECEIVED&search=TRK123&page=1&limit=20
 *
 * Chuc nang:
 * - FlatList voi virtualization cho list lon
 * - Filter theo trang thai (tab row)
 * - Tim kiem theo tracking / ma kien / ma don hang
 * - Pull-to-refresh va load more (pagination)
 * - Tap vao kien → mo MeasureScreen voi packageId
 *
 * FIX: Sua double-fetch khi search/filter thay doi
 * Truoc do co 2 useEffect deu goi fetchPackages khi dependency thay doi.
 * Giai phap: chi dung 1 useEffect duy nhat cho ca load dau, search va filter.
 *
 * FIX: Cleanup searchTimer khi component unmount
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
  TextInput,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {apiGet} from '../../services/api';
import PackageCard, {PackageCardData} from '../../components/PackageCard';
import type {WarehouseStackParamList} from '../../navigation/AppNavigator';

type PackageListNav = NativeStackNavigationProp<WarehouseStackParamList, 'PackageList'>;

interface Props {
  navigation: PackageListNav;
}

// API response
interface PackageListResponse {
  data: PackageCardData[];
  total: number;
  page: number;
  limit: number;
}

// Filter tabs — trang thai kho TQ
const STATUS_FILTERS = [
  {key: '', label: 'Tat ca'},
  {key: 'RECEIVED', label: 'Da nhan'},
  {key: 'INSPECTED', label: 'Da kiem'},
  {key: 'PACKED', label: 'Dong goi'},
  {key: 'SHIPPED', label: 'Da xuat'},
] as const;

type FilterKey = (typeof STATUS_FILTERS)[number]['key'];

const PAGE_SIZE = 20;

export default function PackageListScreen({navigation}: Props): React.JSX.Element {
  const [packages, setPackages] = useState<PackageCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search: doi 400ms sau khi user ngung go
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // FIX: Cleanup searchTimer khi component unmount — tranh setState sau unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
        searchTimer.current = null;
      }
    };
  }, []);

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      if (mountedRef.current) {
        setDebouncedSearch(text);
      }
    }, 400);
  }, []);

  // Fetch packages
  // FIX: Nhan tham so filter va q truc tiep thay vi dung state co the stale
  const fetchPackages = useCallback(
    async (opts: {isRefresh?: boolean; newPage?: number; filter?: FilterKey; q?: string}) => {
      const {isRefresh = false, newPage = 1, filter = activeFilter, q = debouncedSearch} = opts;

      if (!mountedRef.current) {
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
        } else if (newPage === 1) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
        setError(null);

        const params: Record<string, unknown> = {
          page: newPage,
          limit: PAGE_SIZE,
        };
        if (filter) {
          params.status = filter;
        }
        if (q.trim()) {
          params.search = q.trim();
        }

        const result = await apiGet<PackageListResponse>('/warehouse-cn/packages', params);

        if (!mountedRef.current) {
          return;
        }

        const newItems = result.data ?? [];
        if (newPage === 1 || isRefresh) {
          setPackages(newItems);
        } else {
          setPackages(prev => [...prev, ...newItems]);
        }

        setHasMore(newItems.length >= PAGE_SIZE);
        setPage(newPage);
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Khong the tai danh sach');
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [activeFilter, debouncedSearch],
  );

  // FIX: Dung 1 useEffect duy nhat, trigger khi debouncedSearch hoac activeFilter thay doi
  // Truoc do co 2 useEffect — mot load dau, mot theo doi search/filter → double fetch
  useEffect(() => {
    fetchPackages({newPage: 1, q: debouncedSearch, filter: activeFilter});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter]);
  // Note: Khong dua fetchPackages vao dep array de tranh infinite loop
  // fetchPackages phu thuoc activeFilter va debouncedSearch (da co trong dep)

  // FIX: handleFilterChange chi set state, khong goi fetchPackages truc tiep
  // useEffect tren se tu dong trigger khi activeFilter thay doi
  const handleFilterChange = useCallback((key: FilterKey) => {
    setActiveFilter(key);
    // Reset page khi doi filter
    setPage(1);
    setHasMore(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore || loading) {
      return;
    }
    fetchPackages({newPage: page + 1});
  }, [hasMore, loadingMore, loading, page, fetchPackages]);

  const handlePackagePress = useCallback(
    (pkg: PackageCardData) => {
      navigation.navigate('Measure', {
        packageId: pkg.id,
        packageCode: pkg.code,
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({item}: {item: PackageCardData}) => (
      <PackageCard
        data={item}
        onPress={() => handlePackagePress(item)}
        showWeight={true}
      />
    ),
    [handlePackagePress],
  );

  const keyExtractor = useCallback((item: PackageCardData) => item.id, []);

  const renderFooter = useCallback(() => {
    if (!loadingMore) {
      return null;
    }
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#1565C0" />
      </View>
    );
  }, [loadingMore]);

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={handleSearchChange}
          placeholder="Tim theo tracking, ma kien, ma don..."
          placeholderTextColor="#BDBDBD"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.filterTab,
              activeFilter === f.key && styles.filterTabActive,
            ]}
            onPress={() => handleFilterChange(f.key)}
            accessibilityRole="tab"
            accessibilityState={{selected: activeFilter === f.key}}>
            <Text
              style={[
                styles.filterTabText,
                activeFilter === f.key && styles.filterTabTextActive,
              ]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1565C0" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchPackages({isRefresh: true})}>
            <Text style={styles.retryText}>Thu lai</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={packages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={packages.length === 0 ? styles.emptyList : styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPackages({isRefresh: true})}
              colors={['#1565C0']}
              tintColor="#1565C0"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>[ ]</Text>
              <Text style={styles.emptyTitle}>Khong co kien hang</Text>
              <Text style={styles.emptySubtitle}>
                {debouncedSearch
                  ? `Khong tim thay ket qua cho "${debouncedSearch}"`
                  : 'Chua co kien hang nao trong bo loc nay.'}
              </Text>
            </View>
          }
          // Performance optimizations
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          windowSize={10}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  searchBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A2E',
  },
  filterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterTabActive: {
    backgroundColor: '#1565C0',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#757575',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingVertical: 12,
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#1565C0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
    lineHeight: 19,
  },
});
