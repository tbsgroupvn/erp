/**
 * DeliveryDetailScreen — chi tiet mot don giao hang
 *
 * Chuc nang:
 * 1. Hien thi thong tin day du: khach hang, dia chi, danh sach kien, COD
 * 2. "Chup anh giao hang" — mo camera lay anh Proof of Delivery (POD)
 * 3. "Xac nhan da giao" — POST /warehouse-vn/deliveries/:id/confirm voi anh POD
 * 4. Neu mat mang, luu vao offline queue
 *
 * API: POST /warehouse-vn/deliveries/:id/confirm
 * Body: multipart/form-data voi field "pod" la file anh
 *
 * FIX: Bo prop "phone" trong InfoRow vi khong duoc su dung
 * (TypeScript strict noUnusedParameters se bao loi)
 */
import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {RouteProp} from '@react-navigation/native';
import {launchCamera, Asset} from 'react-native-image-picker';
import {apiUpload} from '../../services/api';
import {enqueue} from '../../services/offline-queue';
import type {DriverStackParamList} from '../../navigation/AppNavigator';
import type {DeliveryItem} from './DeliveryListScreen';

type DetailNav = NativeStackNavigationProp<DriverStackParamList, 'DeliveryDetail'>;
type DetailRoute = RouteProp<DriverStackParamList, 'DeliveryDetail'>;

interface Props {
  navigation: DetailNav;
  route: DetailRoute;
}

export default function DeliveryDetailScreen({navigation, route}: Props): React.JSX.Element {
  const {delivery} = route.params;

  const [podImage, setPodImage] = useState<Asset | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(delivery.status === 'DELIVERED');

  // FIX: Them mounted ref de tranh setState sau khi component da unmount
  // (co the xay ra khi user bam back trong luc dang upload)
  const mountedRef = useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Mo camera chup anh POD
  const handleCapturePhoto = useCallback(() => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,          // Giam kich thuoc file: 70% quality
        maxWidth: 1280,
        maxHeight: 1280,
        includeBase64: false,
        saveToPhotos: false,
      },
      response => {
        if (response.didCancel || response.errorCode) {
          return;
        }
        const asset = response.assets?.[0];
        if (asset && mountedRef.current) {
          setPodImage(asset);
        }
      },
    );
  }, []);

  // Xac nhan da giao — upload anh POD len server
  const handleConfirmDelivery = useCallback(async () => {
    if (!podImage) {
      Alert.alert('Thieu anh', 'Vui long chup anh xac nhan giao hang truoc.');
      return;
    }

    Alert.alert(
      'Xac nhan giao hang',
      `Xac nhan da giao don ${delivery.orderCode} cho khach hang ${delivery.customerName}?`,
      [
        {text: 'Huy', style: 'cancel'},
        {
          text: 'Xac nhan',
          style: 'default',
          onPress: async () => {
            if (!mountedRef.current) {
              return;
            }
            setConfirming(true);
            try {
              // Tao FormData voi anh POD
              const formData = new FormData();
              formData.append('pod', {
                uri: podImage.uri,
                type: podImage.type ?? 'image/jpeg',
                name: podImage.fileName ?? `pod_${delivery.id}.jpg`,
              } as unknown as Blob);
              formData.append('deliveryId', delivery.id);

              await apiUpload(
                `/warehouse-vn/deliveries/${delivery.id}/confirm`,
                formData,
              );

              if (!mountedRef.current) {
                return;
              }
              setConfirmed(true);
              Alert.alert(
                'Giao hang thanh cong',
                `Don ${delivery.orderCode} da duoc xac nhan.`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ],
              );
            } catch (err) {
              const message =
                err instanceof Error ? err.message : 'Loi ket noi';

              // Neu loi mang → luu vao offline queue
              const msgLower = message.toLowerCase();
              if (
                msgLower.includes('network') ||
                msgLower.includes('timeout') ||
                msgLower.includes('econnrefused')
              ) {
                await enqueue('POST', `/warehouse-vn/deliveries/${delivery.id}/confirm`, {
                  deliveryId: delivery.id,
                  podNote: 'Saved offline - image upload pending',
                });
                if (mountedRef.current) {
                  Alert.alert(
                    'Da luu offline',
                    'Xac nhan giao hang duoc luu lai va se tu dong gui khi co mang.',
                    [{text: 'OK', onPress: () => navigation.goBack()}],
                  );
                }
              } else {
                if (mountedRef.current) {
                  Alert.alert('Loi', message);
                }
              }
            } finally {
              if (mountedRef.current) {
                setConfirming(false);
              }
            }
          },
        },
      ],
    );
  }, [delivery, navigation, podImage]);

  const canConfirm =
    !confirmed &&
    (delivery.status === 'DISPATCHED' || delivery.status === 'DELIVERING');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Trang thai don hang */}
      <View style={[styles.statusBanner, confirmed ? styles.statusBannerDone : styles.statusBannerActive]}>
        <Text style={styles.statusBannerText}>
          {confirmed ? 'Da giao hang thanh cong' : 'Dang giao hang'}
        </Text>
      </View>

      {/* Thong tin khach hang */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thong tin khach hang</Text>
        <InfoRow label="Don hang" value={delivery.orderCode} highlight />
        <InfoRow label="Khach hang" value={delivery.customerName} />
        {/* FIX: Bo prop "phone" vi InfoRow khong dung den no */}
        <InfoRow label="So dien thoai" value={delivery.customerPhone} />
        <InfoRow label="Dia chi giao" value={delivery.deliveryAddress} multiline />
        {delivery.note ? <InfoRow label="Ghi chu" value={delivery.note} multiline /> : null}
      </View>

      {/* Thong tin hang hoa */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hang hoa</Text>
        <InfoRow label="So kien" value={`${delivery.packageCount} kien`} />
        {delivery.codAmount > 0 ? (
          <InfoRow
            label="COD can thu"
            value={`${delivery.codAmount.toLocaleString('vi-VN')} ${delivery.currency}`}
            highlight
          />
        ) : (
          <InfoRow label="COD" value="Khong co COD" />
        )}
      </View>

      {/* Section chup anh POD */}
      {canConfirm ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Anh xac nhan giao hang (POD)</Text>
          <Text style={styles.podHint}>
            Chup anh khach hang nhan hang hoac anh kien hang tai dia chi giao.
          </Text>

          {/* Preview anh da chup */}
          {podImage?.uri ? (
            <View style={styles.previewContainer}>
              <Image source={{uri: podImage.uri}} style={styles.podPreview} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={handleCapturePhoto}>
                <Text style={styles.retakeText}>Chup lai</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={handleCapturePhoto}
              accessibilityRole="button"
              accessibilityLabel="Chup anh giao hang">
              <Text style={styles.cameraIcon}>[CAM]</Text>
              <Text style={styles.cameraButtonText}>Chup anh giao hang</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Nut xac nhan */}
      {canConfirm ? (
        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!podImage || confirming) && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirmDelivery}
          disabled={!podImage || confirming}
          accessibilityRole="button"
          accessibilityLabel="Xac nhan da giao hang">
          {confirming ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.confirmButtonText}>Xac nhan da giao hang</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {confirmed ? (
        <View style={styles.confirmedBadge}>
          <Text style={styles.confirmedIcon}>V</Text>
          <Text style={styles.confirmedText}>Don hang da duoc xac nhan giao thanh cong</Text>
        </View>
      ) : null}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// FIX: Xoa prop "phone" vi khong duoc su dung (TypeScript noUnusedParameters)
interface InfoRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  multiline?: boolean;
}

function InfoRow({label, value, highlight, multiline}: InfoRowProps): React.JSX.Element {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text
        style={[infoStyles.value, highlight === true && infoStyles.valueHighlight]}
        numberOfLines={multiline === true ? 3 : 1}>
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  label: {
    width: 110,
    fontSize: 13,
    color: '#757575',
    fontWeight: '500',
    flexShrink: 0,
  },
  value: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
    fontWeight: '400',
  },
  valueHighlight: {
    color: '#1565C0',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  content: {
    paddingBottom: 32,
  },
  statusBanner: {
    padding: 14,
    alignItems: 'center',
  },
  statusBannerActive: {
    backgroundColor: '#E3F2FD',
  },
  statusBannerDone: {
    backgroundColor: '#E8F5E9',
  },
  statusBannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.06,
    shadowRadius: 4,
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
  podHint: {
    fontSize: 13,
    color: '#757575',
    marginBottom: 14,
    lineHeight: 19,
  },
  previewContainer: {
    alignItems: 'center',
  },
  podPreview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover',
    marginBottom: 10,
  },
  retakeButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1565C0',
  },
  retakeText: {
    color: '#1565C0',
    fontWeight: '600',
    fontSize: 13,
  },
  cameraButton: {
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 28,
    alignItems: 'center',
  },
  cameraIcon: {
    fontSize: 16,
    color: '#616161',
    marginBottom: 8,
    fontWeight: '700',
  },
  cameraButtonText: {
    fontSize: 14,
    color: '#616161',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#A5D6A7',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  confirmedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 16,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
  },
  confirmedIcon: {
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: '700',
    marginRight: 8,
  },
  confirmedText: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
