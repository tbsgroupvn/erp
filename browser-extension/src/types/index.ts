/** Product data scraped from Taobao/1688 product pages */
export interface ScrapedProduct {
  title: string;
  price: number | null;
  priceCurrency: string;
  imageUrl: string | null;
  productUrl: string;
  shopName: string | null;
  specs: string | null;
  source: 'taobao' | '1688' | 'tmall';
  scrapedAt: string; // ISO timestamp
}

/** Item stored in the extension cart */
export interface CartItem extends ScrapedProduct {
  id: string; // unique ID for cart management
  quantity: number;
  note: string;
}

/** Authentication state managed by background worker */
export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // Unix timestamp ms
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  } | null;
}

/** Customer from ERP API */
export interface ERPCustomer {
  id: string;
  code: string;
  fullName: string;
  phone: string | null;
  companyName: string | null;
  tier: string;
}

/** Branch enum matching backend */
export type Branch = 'HN' | 'HCM';

/** Service type enum matching backend */
export type ServiceType = 'VCT' | 'MHH' | 'UTXNK' | 'LCLCN';
