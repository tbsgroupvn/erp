/**
 * @deprecated THIS FILE IS NOT USED AND HAS NO EFFECT.
 *
 * Field-level encryption for PII fields (User.phoneNumber, Employee.phone/bankAccount/taxCode/
 * insuranceId, Customer.contactPhone/contactEmail, Vendor.phone/bankAccount) is implemented
 * via a Prisma extension that patches model delegates directly on PrismaService.
 *
 * How it works (see prisma.service.ts onModuleInit):
 *   1. PrismaService calls this.$extends(createPrismaEncryptionExtension(encryptionService))
 *      to obtain an extended client with AES-256-GCM encrypt/decrypt hooks on all PII models.
 *   2. The model-level delegate properties (user, employee, customer, vendor) from the extended
 *      client are then assigned back onto `this` (the PrismaService singleton), so that all
 *      existing service code using `this.prisma.customer.findMany(...)` automatically goes
 *      through the encryption/decryption hooks without any changes.
 *
 * Configuration:
 *   FIELD_ENCRYPTION_KEY         = required, min 32 chars (hex string)
 *   FIELD_ENCRYPTION_KEY_VERSION = optional, default "v1"
 *   FIELD_ENCRYPTION_PREVIOUS_KEYS = optional, for key rotation
 *
 * This file is kept to preserve git history context. Do not add providers or logic here.
 */
