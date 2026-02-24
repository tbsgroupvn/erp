import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EncryptionService } from './encryption.service';
import { ENCRYPTED_FIELDS } from './prisma-encryption.extension';

/**
 * Key Rotation Service
 *
 * Re-encrypts all PII fields in the database with the current encryption key.
 * Used when rotating the FIELD_ENCRYPTION_KEY:
 *
 * Steps to rotate keys:
 *   1. Set FIELD_ENCRYPTION_PREVIOUS_KEYS to include the old key
 *      (format: oldVersion:base64OldKey)
 *   2. Set FIELD_ENCRYPTION_KEY to the new key
 *   3. Set FIELD_ENCRYPTION_KEY_VERSION to a new version (e.g. v2)
 *   4. Deploy and run: npx ts-node src/scripts/rotate-encryption-key.ts
 *   5. After migration completes, you can remove the old key from
 *      FIELD_ENCRYPTION_PREVIOUS_KEYS (but keep for rollback safety).
 */
@Injectable()
export class KeyRotationService {
  private readonly logger = new Logger(KeyRotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Re-encrypt all PII fields across all configured models.
   * Processes records in batches to avoid memory issues.
   *
   * @param batchSize Number of records to process at a time (default: 100)
   * @returns Summary of re-encrypted records
   */
  async rotateAllKeys(
    batchSize = 100,
  ): Promise<{ model: string; processed: number; reEncrypted: number }[]> {
    if (!this.encryptionService.isEnabled()) {
      throw new Error(
        'Encryption is not enabled. Set FIELD_ENCRYPTION_KEY before running key rotation.',
      );
    }

    const currentVersion = this.encryptionService.getCurrentKeyVersion();
    this.logger.log(
      `Starting key rotation to version "${currentVersion}". Batch size: ${batchSize}.`,
    );

    const results: { model: string; processed: number; reEncrypted: number }[] = [];

    for (const [modelName, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      const result = await this.rotateModelKeys(
        modelName,
        fields,
        currentVersion,
        batchSize,
      );
      results.push(result);
    }

    this.logger.log(
      `Key rotation complete. Results: ${JSON.stringify(results)}`,
    );

    return results;
  }

  /**
   * Re-encrypt all PII fields for a specific Prisma model.
   */
  private async rotateModelKeys(
    modelName: string,
    fields: string[],
    currentVersion: string,
    batchSize: number,
  ): Promise<{ model: string; processed: number; reEncrypted: number }> {
    this.logger.log(`Rotating keys for model: ${modelName}, fields: [${fields.join(', ')}]`);

    // Access the Prisma model dynamically
    const prismaModel = (this.prisma as any)[
      modelName.charAt(0).toLowerCase() + modelName.slice(1)
    ];

    if (!prismaModel) {
      this.logger.warn(`Prisma model "${modelName}" not found. Skipping.`);
      return { model: modelName, processed: 0, reEncrypted: 0 };
    }

    let processed = 0;
    let reEncrypted = 0;
    let cursor: string | undefined;

    while (true) {
      // Fetch a batch of records
      const records = await prismaModel.findMany({
        take: batchSize,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
        orderBy: { id: 'asc' },
      });

      if (records.length === 0) break;

      for (const record of records) {
        processed++;
        let needsUpdate = false;
        const updateData: Record<string, string> = {};

        for (const field of fields) {
          const value = record[field];
          if (!value || typeof value !== 'string') continue;

          // Check if the value is encrypted with an old key version
          if (this.encryptionService.isEncrypted(value)) {
            const parts = value.split(':');
            const valueVersion = parts[0] === 'd' ? parts[1] : parts[0];

            if (valueVersion !== currentVersion) {
              // Re-encrypt with current key
              updateData[field] = this.encryptionService.reEncrypt(value);
              needsUpdate = true;
            }
          } else {
            // Value is not encrypted at all (legacy data) — encrypt it
            updateData[field] = this.encryptionService.encrypt(value);
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await prismaModel.update({
            where: { id: record.id },
            data: updateData,
          });
          reEncrypted++;
        }
      }

      cursor = records[records.length - 1].id;

      this.logger.log(
        `${modelName}: processed ${processed} records, re-encrypted ${reEncrypted}`,
      );
    }

    return { model: modelName, processed, reEncrypted };
  }
}
