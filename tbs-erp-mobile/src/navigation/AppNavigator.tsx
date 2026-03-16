/**
 * AppNavigator — he thong dieu huong trung tam
 *
 * Cau truc:
 * - RootStack: Login → DriverTabs | WarehouseTabs
 * - DriverTabs: DeliveryList | ScanQR | Profile
 * - WarehouseTabs: ScanReceive | PackageList | Measure | Profile
 *
 * Authentication flow:
 * 1. Khoi dong → kiem tra AsyncStorage co token hop le khong
 * 2. Co token → xac dinh role → dieu huong den tabs phu hop
 * 3. Khong co token → LoginScreen
 * 4. Token het han → refreshToken() → neu that bai → LoginScreen
 *
 * Network monitoring:
 * - Lang nghe thay doi ket noi mang qua NetInfo
 * - Khi online lai → tu dong goi processQueue()
 * - FIX: De-bounce 2s de tranh goi processQueue() nhieu lan lien tiep
 *   (NetInfo co the fire nhieu event khi mang bat on)
 */
import React, {useEffect, useState, useRef, useCallback} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert} from 'react-native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {isAuthenticated, getCurrentUser, logout, UserInfo} from '../services/auth';
import {processQueue, getQueueSize} from '../services/offline-queue';

// Screens
import LoginScreen from '../screens/LoginScreen';
import DeliveryListScreen from '../screens/driver/DeliveryListScreen';
import DeliveryDetailScreen from '../screens/driver/DeliveryDetailScreen';
import ScanQRScreen from '../screens/driver/ScanQRScreen';
import ScanReceiveScreen from '../screens/warehouse/ScanReceiveScreen';
import MeasureScreen from '../screens/warehouse/MeasureScreen';
import PackageListScreen from '../screens/warehouse/PackageListScreen';

import type {DeliveryItem} from '../screens/driver/DeliveryListScreen';

// ============================================================
// Navigation Type Definitions
// ============================================================

export type RootStackParamList = {
  Login: undefined;
  DriverTabs: undefined;
  WarehouseTabs: undefined;
};

export type DriverStackParamList = {
  DeliveryList: undefined;
  DeliveryDetail: {delivery: DeliveryItem};
};

export type WarehouseStackParamList = {
  ScanReceive: undefined;
  PackageList: undefined;
  Measure: {packageId?: string; packageCode?: string};
};

// ============================================================
// Navigator instances
// ============================================================

const RootStack = createNativeStackNavigator<RootStackParamList>();
const DriverTab = createBottomTabNavigator();
const DriverStack = createNativeStackNavigator<DriverStackParamList>();
const WarehouseTab = createBottomTabNavigator();
const WarehouseStack = createNativeStackNavigator<WarehouseStackParamList>();

// ============================================================
// Profile screen don gian (dung chung cho ca 2 role)
// ============================================================
function ProfileScreen({
  userInfo,
  onLogout,
}: {
  userInfo: UserInfo | null;
  onLogout: () => void;
}): React.JSX.Element {
  const [queueSize, setQueueSize] = useState(0);

  // FIX: Cleanup interval khi component unmount
  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const size = await getQueueSize();
      if (mounted) {
        setQueueSize(size);
      }
    };

    refresh();
    const interval = setInterval(refresh, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Dang xuat',
      'Ban co chac muon dang xuat?',
      [
        {text: 'Huy', style: 'cancel'},
        {
          text: 'Dang xuat',
          style: 'destructive',
          onPress: async () => {
            await logout();
            onLogout();
          },
        },
      ],
    );
  };

  return (
    <View style={profileSt.container}>
      <View style={profileSt.avatarCircle}>
        <Text style={profileSt.avatarText}>
          {userInfo?.fullName?.charAt(0)?.toUpperCase() ?? 'U'}
        </Text>
      </View>
      <Text style={profileSt.name}>{userInfo?.fullName ?? 'Nguoi dung'}</Text>
      <Text style={profileSt.email}>{userInfo?.email}</Text>
      <View style={profileSt.roleBadge}>
        <Text style={profileSt.roleText}>{userInfo?.role}</Text>
      </View>

      {queueSize > 0 ? (
        <View style={profileSt.queueBanner}>
          <Text style={profileSt.queueText}>
            {queueSize} tac vu dang cho dong bo offline
          </Text>
        </View>
      ) : null}

      <TouchableOpacity style={profileSt.logoutBtn} onPress={handleLogout}>
        <Text style={profileSt.logoutText}>Dang xuat</Text>
      </TouchableOpacity>

      <Text style={profileSt.version}>TBS ERP Mobile v1.0</Text>
    </View>
  );
}

const profileSt = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8FAFB', alignItems: 'center', paddingTop: 60},
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1565C0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {fontSize: 36, color: '#FFF', fontWeight: '700'},
  name: {fontSize: 20, fontWeight: '700', color: '#1A1A2E', marginBottom: 4},
  email: {fontSize: 14, color: '#757575', marginBottom: 12},
  roleBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  roleText: {fontSize: 13, fontWeight: '600', color: '#1565C0'},
  queueBanner: {
    backgroundColor: '#FFF3E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 32,
    marginBottom: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  queueText: {fontSize: 13, color: '#E65100', fontWeight: '500'},
  logoutBtn: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginTop: 8,
  },
  logoutText: {color: '#C62828', fontWeight: '700', fontSize: 15},
  version: {marginTop: 40, fontSize: 12, color: '#BDBDBD'},
});

// ============================================================
// Driver Stack: DeliveryList + DeliveryDetail
// ============================================================
function DriverDeliveryStack(): React.JSX.Element {
  return (
    <DriverStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#FFFFFF'},
        headerTitleStyle: {fontWeight: '700', color: '#1A1A2E'},
        headerTintColor: '#1565C0',
        headerBackTitle: 'Quay lai',
      }}>
      <DriverStack.Screen
        name="DeliveryList"
        component={DeliveryListScreen}
        options={{title: 'Don giao hang'}}
      />
      <DriverStack.Screen
        name="DeliveryDetail"
        component={DeliveryDetailScreen}
        options={({route}) => ({title: route.params.delivery.orderCode})}
      />
    </DriverStack.Navigator>
  );
}

// ============================================================
// Driver Tabs: Giao hang | Quet QR | Ca nhan
// ============================================================
function DriverTabNavigator({
  userInfo,
  onLogout,
}: {
  userInfo: UserInfo | null;
  onLogout: () => void;
}): React.JSX.Element {
  return (
    <DriverTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          paddingBottom: 6,
          height: 58,
        },
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
        headerShown: false,
      }}>
      <DriverTab.Screen
        name="Deliveries"
        component={DriverDeliveryStack}
        options={{
          tabBarLabel: 'Giao hang',
          tabBarIcon: ({color}) => <TabIcon label="GO" color={color} />,
        }}
      />
      <DriverTab.Screen
        name="ScanQR"
        component={ScanQRScreen}
        options={{
          tabBarLabel: 'Quet QR',
          tabBarIcon: ({color}) => <TabIcon label="QR" color={color} />,
          headerShown: true,
          headerTitle: 'Quet ma kien hang',
          headerStyle: {backgroundColor: '#FFFFFF'},
          headerTitleStyle: {fontWeight: '700'},
        }}
      />
      <DriverTab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Ca nhan',
          tabBarIcon: ({color}) => <TabIcon label="ME" color={color} />,
          headerShown: true,
          headerTitle: 'Thong tin tai khoan',
          headerStyle: {backgroundColor: '#FFFFFF'},
          headerTitleStyle: {fontWeight: '700'},
        }}>
        {() => <ProfileScreen userInfo={userInfo} onLogout={onLogout} />}
      </DriverTab.Screen>
    </DriverTab.Navigator>
  );
}

// ============================================================
// Warehouse Stack: PackageList + Measure
// ============================================================
function WarehousePackageStack(): React.JSX.Element {
  return (
    <WarehouseStack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: '#FFFFFF'},
        headerTitleStyle: {fontWeight: '700', color: '#1A1A2E'},
        headerTintColor: '#1565C0',
        headerBackTitle: 'Quay lai',
      }}>
      <WarehouseStack.Screen
        name="PackageList"
        component={PackageListScreen}
        options={{title: 'Danh sach kien hang'}}
      />
      <WarehouseStack.Screen
        name="Measure"
        component={MeasureScreen}
        options={({route}) => ({
          title: route.params?.packageCode
            ? `Do: ${route.params.packageCode}`
            : 'Do luong kien hang',
        })}
      />
    </WarehouseStack.Navigator>
  );
}

// ============================================================
// Warehouse Tabs: Nhan hang | Kien hang | Do luong | Ca nhan
// ============================================================
function WarehouseTabNavigator({
  userInfo,
  onLogout,
}: {
  userInfo: UserInfo | null;
  onLogout: () => void;
}): React.JSX.Element {
  return (
    <WarehouseTab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#1565C0',
        tabBarInactiveTintColor: '#9E9E9E',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E0E0E0',
          paddingBottom: 6,
          height: 58,
        },
        tabBarLabelStyle: {fontSize: 11, fontWeight: '600'},
        headerShown: false,
      }}>
      <WarehouseTab.Screen
        name="ScanReceive"
        component={ScanReceiveScreen}
        options={{
          tabBarLabel: 'Nhan hang',
          tabBarIcon: ({color}) => <TabIcon label="IN" color={color} />,
          headerShown: true,
          headerTitle: 'Quet & Nhan hang',
          headerStyle: {backgroundColor: '#FFFFFF'},
          headerTitleStyle: {fontWeight: '700'},
        }}
      />
      <WarehouseTab.Screen
        name="Packages"
        component={WarehousePackageStack}
        options={{
          tabBarLabel: 'Kien hang',
          tabBarIcon: ({color}) => <TabIcon label="PKG" color={color} />,
        }}
      />
      <WarehouseTab.Screen
        name="Profile"
        options={{
          tabBarLabel: 'Ca nhan',
          tabBarIcon: ({color}) => <TabIcon label="ME" color={color} />,
          headerShown: true,
          headerTitle: 'Thong tin tai khoan',
          headerStyle: {backgroundColor: '#FFFFFF'},
          headerTitleStyle: {fontWeight: '700'},
        }}>
        {() => <ProfileScreen userInfo={userInfo} onLogout={onLogout} />}
      </WarehouseTab.Screen>
    </WarehouseTab.Navigator>
  );
}

// ============================================================
// Tab icon component nhe — dung text thay emoji (accessibility tot hon)
// FIX: Thay emoji bang text label ngan de tranh loi render tren mot so
// Android device khong ho tro color tinting cho emoji characters
// ============================================================
function TabIcon({label, color}: {label: string; color: string}): React.JSX.Element {
  return (
    <Text style={{fontSize: 11, color, fontWeight: '700'}}>{label}</Text>
  );
}

// ============================================================
// Root App Navigator — kiem tra auth va dieu huong
// ============================================================
export default function AppNavigator(): React.JSX.Element {
  const [authState, setAuthState] = useState<'checking' | 'unauthenticated' | 'driver' | 'warehouse'>('checking');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // FIX: Dung ref de de-bounce processQueue khi NetInfo fire nhieu event
  const queueDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kiem tra auth khi app khoi dong
  const checkAuth = useCallback(async () => {
    try {
      const authenticated = await isAuthenticated();
      if (!authenticated) {
        setAuthState('unauthenticated');
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        setAuthState('unauthenticated');
        return;
      }

      setUserInfo(user);
      setAuthState(mapRoleToState(user.role));
    } catch {
      setAuthState('unauthenticated');
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Lang nghe thay doi mang — xu ly offline queue khi co mang lai
  // FIX: De-bounce 2000ms de tranh goi processQueue() nhieu lan lien tiep
  // khi tin hieu mang bat on (NetInfo co the fire lien tuc CONNECTED/DISCONNECTED)
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable) {
        // Huy timer cu neu con
        if (queueDebounceTimer.current) {
          clearTimeout(queueDebounceTimer.current);
        }
        // Doi 2s truoc khi xu ly queue (mang vua on dinh)
        queueDebounceTimer.current = setTimeout(() => {
          processQueue().catch(() => {
            // ignore network errors trong queue processing
          });
        }, 2000);
      }
    });

    return () => {
      unsubscribe();
      // FIX: Cleanup debounce timer khi component unmount
      if (queueDebounceTimer.current) {
        clearTimeout(queueDebounceTimer.current);
      }
    };
  }, []);

  function mapRoleToState(role: string): 'driver' | 'warehouse' {
    if (role === 'DRIVER') {
      return 'driver';
    }
    // WAREHOUSE_CN_AGENT, WAREHOUSE_VN_MANAGER, WAREHOUSE_VN_STAFF
    return 'warehouse';
  }

  // Goi sau khi dang nhap thanh cong tu LoginScreen
  const handleLoginSuccess = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

  // Goi sau khi logout
  const handleLogout = useCallback(() => {
    setUserInfo(null);
    setAuthState('unauthenticated');
  }, []);

  // Hien loading trong khi kiem tra auth
  if (authState === 'checking') {
    return (
      <View style={splashSt.container}>
        <Text style={splashSt.logo}>TBS</Text>
        <Text style={splashSt.sub}>ERP Mobile</Text>
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{headerShown: false}}>
      {authState === 'unauthenticated' ? (
        <RootStack.Screen name="Login">
          {() => (
            <LoginScreen onLoginSuccess={handleLoginSuccess} />
          )}
        </RootStack.Screen>
      ) : authState === 'driver' ? (
        <RootStack.Screen name="DriverTabs">
          {() => (
            <DriverTabNavigator userInfo={userInfo} onLogout={handleLogout} />
          )}
        </RootStack.Screen>
      ) : (
        <RootStack.Screen name="WarehouseTabs">
          {() => (
            <WarehouseTabNavigator userInfo={userInfo} onLogout={handleLogout} />
          )}
        </RootStack.Screen>
      )}
    </RootStack.Navigator>
  );
}

const splashSt = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    fontSize: 56,
    fontWeight: '900',
    color: '#1565C0',
    letterSpacing: 6,
  },
  sub: {
    fontSize: 16,
    color: '#9E9E9E',
    marginTop: 8,
    fontWeight: '500',
  },
});
