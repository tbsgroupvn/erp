import { registerAs } from '@nestjs/config';

export default registerAs('branding', () => ({
  companyName: process.env.COMPANY_NAME || 'My ERP',
  companyFullName: process.env.COMPANY_FULL_NAME || 'My ERP Company',
  domain: process.env.COMPANY_DOMAIN || 'localhost',
  customerCodePrefix: process.env.CUSTOMER_CODE_PREFIX || 'ERP-KH-',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@localhost',
  supportPhone: process.env.SUPPORT_PHONE || '',
  appTitle: process.env.APP_TITLE || 'ERP System',
  companyAddress: process.env.COMPANY_ADDRESS || '',
  taxCode: process.env.COMPANY_TAX_CODE || '',
}));
