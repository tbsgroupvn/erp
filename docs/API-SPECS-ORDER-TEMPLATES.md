# API Specification: Order Templates

> **Target:** Backend Team (NestJS/Prisma)
> **Priority:** HIGH
> **Estimated effort:** 2-3 days
> **Status:** REQUIRED for Phase 2 completion

---

## Overview

Order Templates cho phép Sales lưu các đơn hàng phổ biến thành template để tái sử dụng nhanh chóng.

**Use case:**
- Sale thường xuyên nhận đơn "Combo mỹ phẩm 10 món" → Lưu thành template
- Lần sau chỉ cần: Chọn template → Chọn khách hàng → Submit
- Tiết kiệm từ 20 phút → 2-3 phút/đơn

---

## Database Schema (Prisma)

```prisma
// prisma/schema.prisma

model OrderTemplate {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(200)
  description String?  @db.Text
  branch      Branch?

  // Relations
  createdById String
  createdBy   User     @relation(fields: [createdById], references: [id])

  subOrders   OrderTemplateSubOrder[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([createdById])
  @@index([branch])
  @@map("order_templates")
}

model OrderTemplateSubOrder {
  id             String        @id @default(uuid())
  templateId     String
  template       OrderTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  serviceType    ServiceType
  clearanceType  ClearanceType
  shippingRoute  ShippingRoute?
  note           String?       @db.Text

  items          OrderTemplateItem[]

  createdAt      DateTime      @default(now())

  @@index([templateId])
  @@map("order_template_sub_orders")
}

model OrderTemplateItem {
  id           String                @id @default(uuid())
  subOrderId   String
  subOrder     OrderTemplateSubOrder @relation(fields: [subOrderId], references: [id], onDelete: Cascade)

  productName  String   @db.VarChar(500)
  productUrl   String?  @db.Text
  quantity     Int      @default(1)
  unitPrice    Decimal  @default(0) @db.Decimal(15, 2)
  note         String?  @db.Text

  createdAt    DateTime @default(now())

  @@index([subOrderId])
  @@map("order_template_items")
}
```

---

## API Endpoints

### 1. List Templates
```http
GET /order-templates
Authorization: Bearer {token}
```

**Query Parameters:**
- `page` (number, optional): Số trang (default: 1)
- `limit` (number, optional): Số records/trang (default: 10)
- `search` (string, optional): Tìm kiếm theo tên template
- `branch` (Branch, optional): Filter theo chi nhánh

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Combo Mỹ phẩm 10 món",
      "description": "Template cho combo mỹ phẩm phổ biến",
      "branch": "HN",
      "subOrders": [
        {
          "id": "uuid",
          "serviceType": "VCT",
          "clearanceType": "TIEU_NGACH",
          "shippingRoute": "AIR",
          "note": "Hàng dễ vỡ",
          "items": [
            {
              "id": "uuid",
              "productName": "Serum Vitamin C",
              "productUrl": "https://1688.com/...",
              "quantity": 5,
              "unitPrice": 89.5,
              "note": ""
            }
          ]
        }
      ],
      "createdBy": {
        "id": "uuid",
        "fullName": "Nguyễn Văn A",
        "email": "a@example.com"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3
  }
}
```

**Implementation Notes:**
- Chỉ trả về templates của user hiện tại (`createdById = currentUser.id`)
- Hoặc templates shared/public (nếu có feature sharing sau này)
- Include relations: `subOrders`, `items`, `createdBy`

---

### 2. Get Template by ID
```http
GET /order-templates/:id
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Combo Mỹ phẩm 10 món",
    "description": "...",
    "branch": "HN",
    "subOrders": [...],
    "createdBy": {...},
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

**Error 404:**
```json
{
  "statusCode": 404,
  "message": "Template not found"
}
```

**Authorization:**
- Chỉ user tạo template mới được xem
- Admin có thể xem tất cả

---

### 3. Create Template
```http
POST /order-templates
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Combo Mỹ phẩm 10 món",
  "description": "Template cho combo mỹ phẩm phổ biến",
  "branch": "HN",
  "subOrders": [
    {
      "serviceType": "VCT",
      "clearanceType": "TIEU_NGACH",
      "shippingRoute": "AIR",
      "note": "Hàng dễ vỡ",
      "items": [
        {
          "productName": "Serum Vitamin C",
          "productUrl": "https://1688.com/product/123",
          "quantity": 5,
          "unitPrice": 89.5,
          "note": ""
        },
        {
          "productName": "Toner AHA/BHA",
          "productUrl": "https://1688.com/product/456",
          "quantity": 3,
          "unitPrice": 120.0,
          "note": "Chai 100ml"
        }
      ]
    }
  ]
}
```

**Validation Rules:**
- `name`: required, max 200 chars
- `subOrders`: required, min 1 sub-order
- `items`: required, min 1 item per sub-order
- `productName`: required
- `quantity`: min 1
- `unitPrice`: min 0

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Combo Mỹ phẩm 10 món",
    "description": "...",
    "branch": "HN",
    "subOrders": [...],
    "createdBy": {...},
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Error 400:**
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Template name is required"
    }
  ]
}
```

**Implementation:**
```typescript
// Pseudo-code
async create(createDto: CreateOrderTemplateDto, userId: string) {
  // 1. Validate DTO
  // 2. Create template với createdById = userId
  // 3. Tạo sub-orders và items (nested create)
  // 4. Return với relations

  return this.prisma.orderTemplate.create({
    data: {
      ...createDto,
      createdById: userId,
      subOrders: {
        create: createDto.subOrders.map(so => ({
          ...so,
          items: {
            create: so.items
          }
        }))
      }
    },
    include: {
      subOrders: { include: { items: true } },
      createdBy: true
    }
  });
}
```

---

### 4. Update Template
```http
PATCH /order-templates/:id
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** (All fields optional)
```json
{
  "name": "Combo Mỹ phẩm 10 món - Updated",
  "description": "Updated description",
  "branch": "HCM",
  "subOrders": [...]
}
```

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "Combo Mỹ phẩm 10 món - Updated",
    ...
  }
}
```

**Authorization:**
- Chỉ user tạo template mới được update
- Admin có thể update tất cả

**Implementation Notes:**
- Nếu update `subOrders`: Xóa hết sub-orders cũ, tạo mới (hoặc dùng upsert)
- Đơn giản hơn: Delete cascade rồi create mới

---

### 5. Delete Template
```http
DELETE /order-templates/:id
Authorization: Bearer {token}
```

**Response 200:**
```json
{
  "message": "Template deleted successfully"
}
```

**Error 404:**
```json
{
  "statusCode": 404,
  "message": "Template not found"
}
```

**Authorization:**
- Chỉ user tạo template mới được xóa
- Admin có thể xóa tất cả

**Implementation:**
- Dùng `onDelete: Cascade` trong schema → tự động xóa sub-orders và items

---

## DTOs (NestJS)

```typescript
// src/modules/order-templates/dto/create-order-template.dto.ts

import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  MaxLength
} from 'class-validator';
import { Type } from 'class-transformer';
import { Branch, ServiceType, ClearanceType, ShippingRoute } from '@prisma/client';

export class CreateOrderTemplateItemDto {
  @IsString()
  @MaxLength(500)
  productName: string;

  @IsOptional()
  @IsString()
  productUrl?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateOrderTemplateSubOrderDto {
  @IsEnum(ServiceType)
  serviceType: ServiceType;

  @IsEnum(ClearanceType)
  clearanceType: ClearanceType;

  @IsOptional()
  @IsEnum(ShippingRoute)
  shippingRoute?: ShippingRoute;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 sản phẩm' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderTemplateItemDto)
  items: CreateOrderTemplateItemDto[];
}

export class CreateOrderTemplateDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @IsArray()
  @ArrayMinSize(1, { message: 'Cần ít nhất 1 đơn con' })
  @ValidateNested({ each: true })
  @Type(() => CreateOrderTemplateSubOrderDto)
  subOrders: CreateOrderTemplateSubOrderDto[];
}

export class UpdateOrderTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderTemplateSubOrderDto)
  subOrders?: CreateOrderTemplateSubOrderDto[];
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Create template với valid data → Success
- [ ] Create template thiếu name → Validation error
- [ ] Create template với 0 items → Validation error
- [ ] Update template với valid data → Success
- [ ] Delete template → Success + cascade delete sub-orders/items

### Integration Tests
- [ ] User A không thể xem template của User B
- [ ] User A không thể update template của User B
- [ ] User A không thể delete template của User B
- [ ] Admin có thể xem/update/delete tất cả templates
- [ ] List templates với pagination hoạt động đúng
- [ ] Search template theo tên hoạt động đúng

### Performance
- [ ] Query list templates với 1000 records < 500ms
- [ ] Include relations không tạo N+1 queries
- [ ] Index trên `createdById` và `branch` hoạt động

---

## Migration Script

```bash
# Generate migration
npx prisma migrate dev --name add_order_templates

# Apply migration
npx prisma migrate deploy
```

**Migration content:**
```sql
-- CreateTable
CREATE TABLE "order_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "branch" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_template_sub_orders" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "clearanceType" TEXT NOT NULL,
    "shippingRoute" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_template_sub_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_template_items" (
    "id" TEXT NOT NULL,
    "subOrderId" TEXT NOT NULL,
    "productName" VARCHAR(500) NOT NULL,
    "productUrl" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_templates_createdById_idx" ON "order_templates"("createdById");
CREATE INDEX "order_templates_branch_idx" ON "order_templates"("branch");
CREATE INDEX "order_template_sub_orders_templateId_idx" ON "order_template_sub_orders"("templateId");
CREATE INDEX "order_template_items_subOrderId_idx" ON "order_template_items"("subOrderId");

-- AddForeignKey
ALTER TABLE "order_templates" ADD CONSTRAINT "order_templates_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_template_sub_orders" ADD CONSTRAINT "order_template_sub_orders_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "order_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_template_items" ADD CONSTRAINT "order_template_items_subOrderId_fkey"
    FOREIGN KEY ("subOrderId") REFERENCES "order_template_sub_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

---

## Example Implementation (NestJS Controller)

Xem file `BACKEND-IMPLEMENTATION-GUIDE.md` để có code mẫu đầy đủ.

---

## Questions?

Contact: Frontend Team
- File types: `src/lib/types/order-template.types.ts`
- API client: `src/lib/api/order-templates.api.ts`
- Hooks: `src/lib/hooks/use-order-templates.ts`
- UI: `src/app/(dashboard)/don-hang/template/page.tsx`
