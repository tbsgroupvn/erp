import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';
import * as http from 'http';

/**
 * HashiCorp Vault Service
 *
 * Integrates with HashiCorp Vault for centralized secrets management.
 * Falls back to environment variables when Vault is disabled or unavailable.
 *
 * Features:
 *   - KV v2 secrets engine support
 *   - Automatic token renewal
 *   - Graceful fallback to env vars
 *   - Dynamic database credentials (when configured)
 */
@Injectable()
export class VaultService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VaultService.name);

  private enabled: boolean;
  private vaultAddr: string;
  private vaultToken: string;
  private secretPath: string;
  private renewInterval: number;
  private renewTimer: NodeJS.Timeout | null = null;

  /** In-memory cache of fetched secrets */
  private readonly secretsCache = new Map<string, { value: string; fetchedAt: number }>();
  private readonly cacheTtlMs = 300_000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<string>('VAULT_ENABLED', 'false') === 'true';
    this.vaultAddr = this.configService.get<string>('VAULT_ADDR', 'http://vault:8200');
    this.vaultToken = this.configService.get<string>('VAULT_TOKEN', '');
    this.secretPath = this.configService.get<string>('VAULT_SECRET_PATH', 'secret/data/tbs-erp');
    this.renewInterval = parseInt(
      this.configService.get<string>('VAULT_RENEW_INTERVAL', '3600000'),
      10,
    );
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log(
        'Vault integration is DISABLED. Falling back to environment variables. ' +
          'Set VAULT_ENABLED=true to enable.',
      );
      return;
    }

    if (!this.vaultToken) {
      this.logger.warn('VAULT_TOKEN is not set. Vault integration disabled.');
      this.enabled = false;
      return;
    }

    // Test connectivity
    try {
      await this.healthCheck();
      this.logger.log(`Vault connected at ${this.vaultAddr}`);

      // Start token renewal timer
      this.startRenewal();
    } catch (error) {
      this.logger.error(
        this.redactSensitive(
          `Failed to connect to Vault at ${this.vaultAddr}: ${error.message}. ` +
            'Falling back to environment variables.',
        ),
      );
      this.enabled = false;
    }
  }

  onModuleDestroy() {
    if (this.renewTimer) {
      clearInterval(this.renewTimer);
      this.renewTimer = null;
    }
  }

  /**
   * Whether Vault is actively connected and available.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get a secret value from Vault.
   * Falls back to the provided default or environment variable.
   *
   * @param key The secret key within the configured secret path
   * @param defaultValue Fallback value if Vault is unavailable
   */
  async getSecret(key: string, defaultValue?: string): Promise<string> {
    if (!this.enabled) {
      // Fallback: try env var with the same name
      return this.configService.get<string>(key, defaultValue ?? '');
    }

    // Check cache
    const cached = this.secretsCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      return cached.value;
    }

    try {
      const secrets = await this.readSecrets();
      const value = secrets[key];

      if (value !== undefined) {
        this.secretsCache.set(key, { value, fetchedAt: Date.now() });
        return value;
      }

      this.logger.warn(
        `Secret "${key}" not found in Vault at path "${this.secretPath}". ` +
          'Using default/env fallback.',
      );
      return this.configService.get<string>(key, defaultValue ?? '');
    } catch (error) {
      this.logger.error(
        this.redactSensitive(`Failed to read secret "${key}" from Vault: ${error.message}. Using fallback.`),
      );
      return this.configService.get<string>(key, defaultValue ?? '');
    }
  }

  /**
   * Store a secret in Vault (KV v2).
   */
  async setSecret(key: string, value: string): Promise<void> {
    if (!this.enabled) {
      this.logger.warn('Vault is not enabled. Cannot store secret.');
      return;
    }

    try {
      // Read current secrets, merge, and write back
      let currentSecrets: Record<string, string> = {};
      try {
        currentSecrets = await this.readSecrets();
      } catch {
        // Path doesn't exist yet, start fresh
      }

      currentSecrets[key] = value;

      await this.writeSecrets(currentSecrets);
      this.secretsCache.set(key, { value, fetchedAt: Date.now() });

      this.logger.log(`Secret "${key}" stored in Vault.`);
    } catch (error) {
      this.logger.error(this.redactSensitive(`Failed to store secret "${key}" in Vault: ${error.message}`));
      throw error;
    }
  }

  /**
   * Get database credentials from Vault.
   * Falls back to DATABASE_URL env var components.
   */
  async getDatabaseCredentials(): Promise<{ username: string; password: string }> {
    if (!this.enabled) {
      return {
        username: this.configService.get<string>('POSTGRES_USER', 'postgres'),
        password: this.configService.get<string>('POSTGRES_PASSWORD', ''),
      };
    }

    try {
      const secrets = await this.readSecrets();
      return {
        username:
          secrets.POSTGRES_USER || this.configService.get<string>('POSTGRES_USER', 'postgres'),
        password:
          secrets.POSTGRES_PASSWORD || this.configService.get<string>('POSTGRES_PASSWORD', ''),
      };
    } catch {
      return {
        username: this.configService.get<string>('POSTGRES_USER', 'postgres'),
        password: this.configService.get<string>('POSTGRES_PASSWORD', ''),
      };
    }
  }

  /**
   * Get the JWT secret from Vault.
   * Falls back to JWT_SECRET env var.
   */
  async getJwtSecret(): Promise<string> {
    return this.getSecret('JWT_SECRET');
  }

  /**
   * Renew the Vault token lease.
   */
  async renewLease(): Promise<void> {
    if (!this.enabled) return;

    try {
      await this.vaultRequest('POST', '/v1/auth/token/renew-self', {});
      this.logger.log('Vault token lease renewed.');
    } catch (error) {
      this.logger.error(this.redactSensitive(`Failed to renew Vault token: ${error.message}`));
    }
  }

  /**
   * Redact sensitive information from error messages before logging.
   */
  private redactSensitive(message: string): string {
    return message
      .replace(/X-Vault-Token:\s*\S+/gi, 'X-Vault-Token: [REDACTED]')
      .replace(/token[=:]\s*\S+/gi, 'token=[REDACTED]')
      .replace(/hvs\.\S+/g, 'hvs.[REDACTED]');
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private startRenewal() {
    this.renewTimer = setInterval(async () => {
      await this.renewLease();
    }, this.renewInterval);
  }

  private async healthCheck(): Promise<void> {
    const response = await this.vaultRequest('GET', '/v1/sys/health');
    if (!response.initialized || response.sealed) {
      throw new Error(
        `Vault is not ready: initialized=${response.initialized}, sealed=${response.sealed}`,
      );
    }
  }

  private async readSecrets(): Promise<Record<string, string>> {
    const response = await this.vaultRequest('GET', `/v1/${this.secretPath}`);
    return response?.data?.data || {};
  }

  private async writeSecrets(data: Record<string, string>): Promise<void> {
    await this.vaultRequest('POST', `/v1/${this.secretPath}`, { data });
  }

  /**
   * Make an HTTP request to the Vault API.
   */
  private vaultRequest(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.vaultAddr);
      const isHttps = url.protocol === 'https:';
      const transport = isHttps ? https : http;

      const rejectUnauthorized =
        this.configService.get<string>('VAULT_REJECT_UNAUTHORIZED', 'true') !== 'false';

      const options: http.RequestOptions & https.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 8200),
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'X-Vault-Token': this.vaultToken,
        },
        timeout: 10000,
        ...(isHttps ? { rejectUnauthorized } : {}),
      };

      const req = transport.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              reject(
                new Error(
                  `Vault API error ${res.statusCode}: ${JSON.stringify(parsed.errors || parsed)}`,
                ),
              );
            } else {
              resolve(parsed);
            }
          } catch {
            resolve(data);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Vault request timed out'));
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }
}
