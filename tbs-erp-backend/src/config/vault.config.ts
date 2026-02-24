import { registerAs } from '@nestjs/config';

/**
 * HashiCorp Vault Configuration
 *
 * Vault integration is optional. When VAULT_ENABLED=false (default),
 * the application falls back to standard environment variables.
 *
 * Environment Variables:
 *   VAULT_ENABLED       - Enable/disable Vault (default: false)
 *   VAULT_ADDR          - Vault server address (default: http://vault:8200)
 *   VAULT_TOKEN         - Authentication token
 *   VAULT_SECRET_PATH   - KV v2 secret path (default: secret/data/tbs-erp)
 *   VAULT_RENEW_INTERVAL - Token renewal interval in ms (default: 3600000 = 1 hour)
 */
export default registerAs('vault', () => ({
  enabled: process.env.VAULT_ENABLED === 'true',
  address: process.env.VAULT_ADDR || 'http://vault:8200',
  token: process.env.VAULT_TOKEN || '',
  secretPath: process.env.VAULT_SECRET_PATH || 'secret/data/tbs-erp',
  renewInterval: parseInt(process.env.VAULT_RENEW_INTERVAL || '3600000', 10),
}));
