import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Field-Level Encryption Service
 *
 * Provides AES-256-GCM encryption for PII fields stored in the database.
 * Supports:
 *   - Standard encryption (random IV, non-deterministic) for fields like phone, ID card
 *   - Deterministic encryption (HMAC-based) for searchable fields like email
 *   - SHA-256 hashing for blind index lookups
 *   - Key rotation with multiple key support
 *
 * Format: keyVersion:iv:authTag:ciphertext (all base64-encoded)
 */
@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';

  /** Current encryption key (32 bytes) */
  private currentKey: Buffer;

  /** Current key version identifier */
  private currentKeyVersion: string;

  /** Map of key version -> key buffer for decryption of older data */
  private readonly keys = new Map<string, Buffer>();

  /** HMAC key derived from the encryption key for deterministic encryption */
  private hmacKey: Buffer;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    // Load the primary encryption key
    const rawKey = this.configService.get<string>(
      'FIELD_ENCRYPTION_KEY',
      '',
    );

    if (!rawKey) {
      this.logger.warn(
        'FIELD_ENCRYPTION_KEY not set. Field-level encryption is DISABLED. ' +
        'Set FIELD_ENCRYPTION_KEY env var (min 32 chars) to enable.',
      );
      // Derive a deterministic "noop" key so the service doesn't crash
      // but log warnings on every encrypt/decrypt call
      this.currentKey = crypto.createHash('sha256').update('disabled').digest();
      this.currentKeyVersion = 'v0';
      this.hmacKey = crypto.createHash('sha256').update('disabled-hmac').digest();
      this.keys.set(this.currentKeyVersion, this.currentKey);
      return;
    }

    // Derive a proper 32-byte key using PBKDF2
    this.currentKey = crypto.pbkdf2Sync(rawKey, 'tbs-erp-field-encryption-salt', 100000, 32, 'sha256');
    this.currentKeyVersion = this.configService.get<string>(
      'FIELD_ENCRYPTION_KEY_VERSION',
      'v1',
    );
    this.keys.set(this.currentKeyVersion, this.currentKey);

    // Derive HMAC key using PBKDF2 with a different salt
    this.hmacKey = crypto.pbkdf2Sync(rawKey, 'tbs-erp-hmac-salt', 100000, 32, 'sha256');

    // Load previous keys for rotation support
    // Format: FIELD_ENCRYPTION_PREVIOUS_KEYS=v0:base64key1,v_old:base64key2
    const previousKeys = this.configService.get<string>(
      'FIELD_ENCRYPTION_PREVIOUS_KEYS',
      '',
    );

    if (previousKeys) {
      for (const entry of previousKeys.split(',')) {
        const [version, b64Key] = entry.split(':');
        if (version && b64Key) {
          this.keys.set(
            version.trim(),
            crypto.createHash('sha256').update(Buffer.from(b64Key.trim(), 'base64')).digest(),
          );
        }
      }
    }

    this.logger.log(
      `Encryption service initialized. Current key version: ${this.currentKeyVersion}. ` +
      `Total keys loaded: ${this.keys.size}.`,
    );
  }

  /**
   * Check if encryption is properly configured (not using disabled fallback).
   */
  isEnabled(): boolean {
    return this.currentKeyVersion !== 'v0';
  }

  /**
   * Encrypt a plaintext string using AES-256-GCM with a random IV.
   * Returns format: keyVersion:iv:authTag:ciphertext (base64-encoded components).
   *
   * This is NON-deterministic: the same plaintext produces different ciphertext each time.
   * Use for fields that don't need to be searched (phone numbers, ID cards, etc).
   */
  encrypt(plaintext: string): string {
    if (!plaintext) return plaintext;

    if (!this.isEnabled()) {
      this.logger.warn('Encryption called but FIELD_ENCRYPTION_KEY is not configured.');
      return plaintext;
    }

    const iv = crypto.randomBytes(12); // 96-bit IV for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.currentKey, iv);

    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Format: keyVersion:iv:authTag:ciphertext
    return [
      this.currentKeyVersion,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  /**
   * Decrypt an encrypted string in the format keyVersion:iv:authTag:ciphertext.
   * Supports decryption with previous key versions for key rotation.
   */
  decrypt(encrypted: string): string {
    if (!encrypted) return encrypted;

    // Check if the value looks encrypted (has our format with colons)
    const parts = encrypted.split(':');
    if (parts.length !== 4) {
      // Value is not encrypted (plain text) — return as-is for backwards compatibility
      return encrypted;
    }

    const [keyVersion, ivB64, authTagB64, ciphertextB64] = parts;

    const key = this.keys.get(keyVersion);
    if (!key) {
      this.logger.error(
        `Cannot decrypt: unknown key version "${keyVersion}". ` +
        'Add the key to FIELD_ENCRYPTION_PREVIOUS_KEYS.',
      );
      throw new Error(`Unknown encryption key version: ${keyVersion}`);
    }

    try {
      const iv = Buffer.from(ivB64, 'base64');
      const authTag = Buffer.from(authTagB64, 'base64');
      const ciphertext = Buffer.from(ciphertextB64, 'base64');

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      return decrypted.toString('utf8');
    } catch (error) {
      this.logger.error(
        `Decryption failed for key version "${keyVersion}": ${error.message}`,
      );
      throw new Error('Failed to decrypt field value. Data may be corrupted.');
    }
  }

  /**
   * Deterministic encryption for searchable fields (e.g., email).
   *
   * Uses HMAC-SHA256 to produce a consistent output for the same input,
   * allowing WHERE email = encryptDeterministic('test@test.com') queries.
   *
   * Format: d:keyVersion:hmacValue (base64)
   *
   * SECURITY NOTE: Deterministic encryption leaks equality — if two rows
   * have the same plaintext, their ciphertext will match. This is the
   * necessary trade-off for searchability.
   */
  encryptDeterministic(plaintext: string): string {
    if (!plaintext) return plaintext;

    if (!this.isEnabled()) {
      return plaintext;
    }

    // Warn if plaintext looks like a high-entropy value (not suitable for deterministic encryption)
    if (plaintext.length > 64 || /^[0-9a-fA-F]+$/.test(plaintext)) {
      this.logger.warn('Deterministic encryption used on potentially high-entropy value');
    }

    const hmac = crypto
      .createHmac('sha256', this.hmacKey)
      .update(plaintext.toLowerCase().trim())
      .digest('base64');

    return `d:${this.currentKeyVersion}:${hmac}`;
  }

  /**
   * SHA-256 hash for creating blind indexes on encrypted fields.
   * Useful for uniqueness constraints and lookups without revealing the value.
   */
  hash(value: string): string {
    if (!value) return value;

    return crypto
      .createHash('sha256')
      .update(value.toLowerCase().trim())
      .digest('hex');
  }

  /**
   * Check if a value appears to be encrypted by this service.
   */
  isEncrypted(value: string): boolean {
    if (!value) return false;
    // Standard encryption: keyVersion:iv:authTag:ciphertext
    const standardParts = value.split(':');
    if (standardParts.length === 4 && this.keys.has(standardParts[0])) {
      return true;
    }
    // Deterministic encryption: d:keyVersion:hmac
    if (value.startsWith('d:') && standardParts.length === 3) {
      return true;
    }
    return false;
  }

  /**
   * Re-encrypt a value with the current key.
   * Used during key rotation to update old ciphertexts.
   */
  reEncrypt(encrypted: string): string {
    const plaintext = this.decrypt(encrypted);
    return this.encrypt(plaintext);
  }

  /**
   * Get the current key version (for key rotation tracking).
   */
  getCurrentKeyVersion(): string {
    return this.currentKeyVersion;
  }
}
