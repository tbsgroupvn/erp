import { ServiceType } from '@prisma/client';

/**
 * Vietnamese labels for each service type.
 */
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  [ServiceType.VCT]: 'Vận chuyển thuần',
  [ServiceType.MHH]: 'Mua hàng hộ',
  [ServiceType.UTXNK]: 'Ủy thác xuất nhập khẩu',
  [ServiceType.LCLCN]: 'LCL chính ngạch',
};

/**
 * Short descriptions for each service type.
 */
export const SERVICE_TYPE_DESCRIPTIONS: Record<ServiceType, string> = {
  [ServiceType.VCT]: 'Dịch vụ vận chuyển hàng hóa từ Trung Quốc về Việt Nam',
  [ServiceType.MHH]: 'Dịch vụ mua hàng hộ trên các sàn thương mại điện tử Trung Quốc',
  [ServiceType.UTXNK]: 'Dịch vụ ủy thác xuất nhập khẩu, thông quan chính ngạch',
  [ServiceType.LCLCN]: 'Dịch vụ vận chuyển hàng lẻ (LCL) chính ngạch có chứng từ đầy đủ',
};

/**
 * Returns the Vietnamese label for a given service type.
 */
export function getServiceTypeLabel(type: ServiceType): string {
  return SERVICE_TYPE_LABELS[type];
}

/**
 * Returns all service types as an array of { value, label } objects.
 * Useful for populating dropdowns in the frontend.
 */
export function getServiceTypeOptions(): Array<{
  value: ServiceType;
  label: string;
}> {
  return Object.values(ServiceType).map((type) => ({
    value: type,
    label: SERVICE_TYPE_LABELS[type],
  }));
}
