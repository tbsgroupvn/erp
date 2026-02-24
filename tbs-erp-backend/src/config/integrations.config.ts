import { registerAs } from '@nestjs/config';

export default registerAs('integrations', () => ({
  customs: {
    vnaccsUrl: process.env.VNACCS_API_URL || '',
    vnaccsKey: process.env.VNACCS_API_KEY || '',
    enabled: process.env.CUSTOMS_INTEGRATION_ENABLED === 'true',
  },
  accounting: {
    misaApiUrl: process.env.MISA_API_URL || '',
    misaApiKey: process.env.MISA_API_KEY || '',
    fastApiUrl: process.env.FAST_API_URL || '',
    fastApiKey: process.env.FAST_API_KEY || '',
    enabled: process.env.ACCOUNTING_INTEGRATION_ENABLED === 'true',
  },
  banking: {
    provider: process.env.BANKING_PROVIDER || 'vietcombank',
    apiUrl: process.env.BANKING_API_URL || '',
    apiKey: process.env.BANKING_API_KEY || '',
    enabled: process.env.BANKING_INTEGRATION_ENABLED === 'true',
  },
  shipping: {
    carriers: (process.env.SHIPPING_CARRIERS || '').split(',').filter(Boolean),
    enabled: process.env.SHIPPING_INTEGRATION_ENABLED === 'true',
  },
  larksuite: {
    appId: process.env.LARK_APP_ID || '',
    appSecret: process.env.LARK_APP_SECRET || '',
    webhookUrl: process.env.LARK_WEBHOOK_URL || '',
    enabled: process.env.LARK_INTEGRATION_ENABLED === 'true',
  },
}));
