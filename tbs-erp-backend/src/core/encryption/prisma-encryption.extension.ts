import { Prisma } from '@prisma/client';
import { EncryptionService } from './encryption.service';

/**
 * Field-level encryption configuration.
 *
 * Maps Prisma model names to arrays of field names that contain PII
 * and should be automatically encrypted/decrypted.
 *
 * Fields listed here will be:
 *   - Encrypted on create and update operations
 *   - Decrypted on read operations (findUnique, findMany, etc.)
 *
 * IMPORTANT: Only add String fields. Null values are preserved as-is.
 */
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  User: ['phoneNumber'],
  Employee: ['phone', 'bankAccount', 'taxCode', 'insuranceId'],
  Customer: ['contactPhone', 'contactEmail'],
  Vendor: ['phone', 'bankAccount'],
};

/**
 * Fields that use deterministic encryption for searchability.
 * These fields can be used in WHERE clauses with exact match.
 */
export const DETERMINISTIC_ENCRYPTED_FIELDS: Record<string, string[]> = {
  Customer: ['contactEmail'],
};

/**
 * Create a Prisma extension that automatically encrypts and decrypts PII fields.
 *
 * Usage in PrismaService:
 *   const extendedClient = prismaClient.$extends(
 *     createPrismaEncryptionExtension(encryptionService)
 *   );
 *
 * This extension is transparent to the rest of the application:
 *   - On write (create, update, upsert, createMany, updateMany):
 *     Encrypts PII fields before they reach the database.
 *   - On read (findUnique, findFirst, findMany):
 *     Decrypts PII fields after they are read from the database.
 *
 * BACKWARDS COMPATIBILITY: If a field value does not appear to be encrypted
 * (e.g. legacy data), the decrypt method returns it as-is.
 */
export function createPrismaEncryptionExtension(
  encryptionService: EncryptionService,
) {
  return Prisma.defineExtension({
    name: 'field-level-encryption',

    query: {
      $allModels: {
        // ─── Write operations: encrypt before saving ───

        async create({ model, args, query }) {
          encryptFields(encryptionService, model, args.data);
          return decryptResult(encryptionService, model, await query(args));
        },

        async createMany({ model, args, query }) {
          if (Array.isArray(args.data)) {
            for (const item of args.data) {
              encryptFields(encryptionService, model, item);
            }
          } else {
            encryptFields(encryptionService, model, args.data);
          }
          return query(args);
        },

        async update({ model, args, query }) {
          encryptFields(encryptionService, model, args.data);
          return decryptResult(encryptionService, model, await query(args));
        },

        async updateMany({ model, args, query }) {
          encryptFields(encryptionService, model, args.data);
          return query(args);
        },

        async upsert({ model, args, query }) {
          encryptFields(encryptionService, model, args.create);
          encryptFields(encryptionService, model, args.update);
          return decryptResult(encryptionService, model, await query(args));
        },

        // ─── Read operations: decrypt after reading ───

        async findUnique({ model, args, query }) {
          return decryptResult(encryptionService, model, await query(args));
        },

        async findUniqueOrThrow({ model, args, query }) {
          return decryptResult(encryptionService, model, await query(args));
        },

        async findFirst({ model, args, query }) {
          return decryptResult(encryptionService, model, await query(args));
        },

        async findFirstOrThrow({ model, args, query }) {
          return decryptResult(encryptionService, model, await query(args));
        },

        async findMany({ model, args, query }) {
          const results = await query(args);
          if (Array.isArray(results)) {
            return results.map((r: any) =>
              decryptResult(encryptionService, model, r),
            );
          }
          return results;
        },
      },
    },
  });
}

// ─── Helper functions ───────────────────────────────────────────────────────

/**
 * Encrypt PII fields in a data object before writing to the database.
 */
function encryptFields(
  encryptionService: EncryptionService,
  model: string,
  data: any,
): void {
  if (!data || !encryptionService.isEnabled()) return;

  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return;

  const deterministicFields = DETERMINISTIC_ENCRYPTED_FIELDS[model] || [];

  for (const field of fields) {
    if (data[field] != null && typeof data[field] === 'string') {
      if (deterministicFields.includes(field)) {
        data[field] = encryptionService.encryptDeterministic(data[field]);
      } else {
        data[field] = encryptionService.encrypt(data[field]);
      }
    }
  }
}

/**
 * Decrypt PII fields in a result object after reading from the database.
 */
function decryptResult(
  encryptionService: EncryptionService,
  model: string,
  result: any,
): any {
  if (!result || !encryptionService.isEnabled()) return result;

  const fields = ENCRYPTED_FIELDS[model];
  if (!fields) return result;

  for (const field of fields) {
    if (result[field] != null && typeof result[field] === 'string') {
      try {
        result[field] = encryptionService.decrypt(result[field]);
      } catch {
        // If decryption fails, the value is likely not encrypted (legacy data).
        // Leave it as-is for backwards compatibility.
      }
    }
  }

  return result;
}
