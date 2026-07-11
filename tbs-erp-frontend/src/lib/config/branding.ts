// Branding configuration — all values are configurable via environment variables.
// This allows self-hosted deployments to customize the app without code changes.

export const branding = {
  companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || 'My ERP',
  companyFullName: process.env.NEXT_PUBLIC_COMPANY_FULL_NAME || 'My ERP Company',
  domain: process.env.NEXT_PUBLIC_DOMAIN || 'localhost',
  appTitle: process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System',
  appDescription: process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Enterprise Resource Planning System',
  supportEmail: process.env.NEXT_PUBLIC_COMPANY_EMAIL || '',
  supportEmailFallback: process.env.NEXT_PUBLIC_COMPANY_SUPPORT_EMAIL || '',
  supportPhone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '',
  companyAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
  companyTaxCode: process.env.NEXT_PUBLIC_COMPANY_TAX_CODE || '',
  companyWechat: process.env.NEXT_PUBLIC_COMPANY_WECHAT || '',
  zaloId: process.env.NEXT_PUBLIC_ZALO_ID || '',
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
  facebookUrl: process.env.NEXT_PUBLIC_FACEBOOK_URL || '',
  linkedinUrl: process.env.NEXT_PUBLIC_LINKEDIN_URL || '',
  zaloUrl: process.env.NEXT_PUBLIC_ZALO_URL || '',
  twitterHandle: process.env.NEXT_PUBLIC_TWITTER_HANDLE || '',
  latitude: parseFloat(process.env.NEXT_PUBLIC_LATITUDE || '0'),
  longitude: parseFloat(process.env.NEXT_PUBLIC_LONGITUDE || '0'),
  addressLocality: process.env.NEXT_PUBLIC_ADDRESS_LOCALITY || '',
  addressRegion: process.env.NEXT_PUBLIC_ADDRESS_REGION || '',

  // Auth cookie name
  authCookie: process.env.NEXT_PUBLIC_AUTH_COOKIE || 'erp-auth',
  authStorageName: process.env.NEXT_PUBLIC_AUTH_STORAGE_NAME || 'erp-auth-storage',

  // Demo mode
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === 'true',
} as const;
