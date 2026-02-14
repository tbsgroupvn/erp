# Public Module - Lead Capture

This module provides public API endpoints that do not require JWT authentication.

## Features

### Lead Capture Endpoint

**POST** `/api/public/leads`

Captures leads from the public website without authentication.

#### Phone Deduplication Logic

1. **Existing Customer**: If a customer with the same phone number exists:
   - Adds a new `Contact` to the existing customer
   - Returns `isNewCustomer: false`

2. **New Customer**: If no customer exists with that phone:
   - Creates a new `Customer` with `tier=NEW`
   - Creates a primary `Contact`
   - Creates a `Wallet` for the customer
   - Returns `isNewCustomer: true`

#### Request Body

```json
{
  "fullName": "Nguyen Van A",
  "phone": "0912345678",
  "email": "customer@example.com",
  "service": "VCT",
  "message": "Toi muon van chuyen hang tu Trung Quoc ve Viet Nam"
}
```

**Validations:**
- `fullName`: Required, max 255 characters
- `phone`: Required, must match Vietnamese phone format (e.g., 0912345678 or +84912345678)
- `email`: Optional, must be valid email
- `service`: Required, enum: `VCT`, `MHH`, `UTXNK`, `LCLCN`
- `message`: Optional, max 1000 characters

#### Response

```json
{
  "statusCode": 201,
  "message": "Lead captured - New customer created",
  "data": {
    "customer": {
      "id": "cm...",
      "code": "TBS-KH-000001",
      "fullName": "Nguyen Van A",
      "phone": "0912345678",
      "email": "customer@example.com",
      "tier": "NEW"
    },
    "contact": {
      "id": "cm...",
      "fullName": "Nguyen Van A",
      "phone": "0912345678",
      "email": "customer@example.com",
      "position": "Lead - VCT"
    },
    "isNewCustomer": true
  }
}
```

#### Event Emission

After capturing a lead, the service emits a `lead.captured` event with the following payload:

```typescript
{
  customer: Customer,
  contact: Contact,
  isNewCustomer: boolean,
  service: ServiceType,
  message?: string
}
```

This event can be listened to by the notification module to send alerts to sales teams.

## Implementation Details

### Phone Normalization

The service normalizes phone numbers before checking for duplicates:
- Removes spaces and dashes
- Converts `+84` prefix to `0`
- Trims whitespace

Examples:
- `+84 912 345 678` → `0912345678`
- `0912-345-678` → `0912345678`

### Customer Tier

New customers are automatically assigned:
- **Tier**: `NEW`
- **Deposit Rate**: 100% (from `CustomerTierService`)
- **Credit Limit**: 0 (from `CustomerTierService`)

### Security

The endpoint uses the `@Public()` decorator to bypass JWT authentication.
The `JwtAuthGuard` checks for this decorator and allows public access.

## Module Structure

```
src/modules/public/
├── dto/
│   └── capture-lead.dto.ts       # Request validation DTO
├── public.controller.ts           # Controller with @Public() endpoints
├── public.module.ts               # Module configuration
├── public.service.ts              # Business logic for lead capture
└── README.md                      # This file
```

## CORS Configuration

Update `.env` to allow frontend domain:

```env
CORS_ORIGINS=http://localhost:3001,http://localhost:4001,https://tbsgroup.vn
```

## Testing

### Using cURL

```bash
# New Customer
curl -X POST http://localhost:4000/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyen Van A",
    "phone": "0912345678",
    "email": "customer@example.com",
    "service": "VCT",
    "message": "Toi muon van chuyen hang"
  }'

# Existing Customer (same phone)
curl -X POST http://localhost:4000/api/public/leads \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Nguyen Van A - Contact 2",
    "phone": "0912345678",
    "email": "contact2@example.com",
    "service": "MHH",
    "message": "Another inquiry"
  }'
```

### Using Swagger

Visit: `http://localhost:4000/api/docs`

Look for the **Public** section at the top (no authentication required).

## Dependencies

This module depends on:
- `CrmModule` - for customer and contact operations
- `PrismaService` - for database access
- `EventEmitter2` - for event emission
