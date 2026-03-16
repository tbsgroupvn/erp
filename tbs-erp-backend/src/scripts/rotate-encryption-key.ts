/**
 * Encryption Key Rotation Script
 *
 * Re-encrypts all PII fields in the database with the current encryption key.
 *
 * Prerequisites:
 *   1. Set FIELD_ENCRYPTION_PREVIOUS_KEYS to include the old key
 *   2. Set FIELD_ENCRYPTION_KEY to the new key
 *   3. Set FIELD_ENCRYPTION_KEY_VERSION to a new version (e.g. v2)
 *
 * Usage:
 *   npx ts-node src/scripts/rotate-encryption-key.ts
 *   npx ts-node src/scripts/rotate-encryption-key.ts --batch-size=200
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { KeyRotationService } from '../core/encryption/key-rotation.service';
import { Logger } from '@nestjs/common';

async function main() {
  const logger = new Logger('KeyRotation');

  logger.log('Initializing application for key rotation...');

  const app = await NestFactory.createApplicationContext(AppModule);

  const keyRotationService = app.get(KeyRotationService);

  // Parse batch size from command line args
  const batchSizeArg = process.argv.find((arg) => arg.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1], 10) : 100;

  logger.log(`Starting key rotation with batch size: ${batchSize}`);

  try {
    const results = await keyRotationService.rotateAllKeys(batchSize);

    logger.log('=== Key Rotation Results ===');
    for (const result of results) {
      logger.log(
        `  ${result.model}: ${result.processed} processed, ${result.reEncrypted} re-encrypted`,
      );
    }
    logger.log('=== Key Rotation Complete ===');
  } catch (error) {
    logger.error(`Key rotation failed: ${error.message}`, error.stack);
    process.exit(1);
  } finally {
    await app.close();
  }
}

main();
