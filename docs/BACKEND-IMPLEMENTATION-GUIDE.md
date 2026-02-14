# Backend Implementation Guide: Order Templates

> **For:** Backend Team (NestJS)
> **Time estimate:** 2-3 days
> **Complexity:** Medium

---

## Table of Contents

1. [Setup](#setup)
2. [Prisma Schema](#prisma-schema)
3. [Module Structure](#module-structure)
4. [Controller](#controller)
5. [Service](#service)
6. [Guards & Decorators](#guards--decorators)
7. [Testing](#testing)

---

## Setup

### 1. Generate Module

```bash
cd tbs-erp-backend
nest g module modules/order-templates
nest g controller modules/order-templates
nest g service modules/order-templates
```

### 2. Create DTOs Directory

```bash
mkdir -p src/modules/order-templates/dto
mkdir -p src/modules/order-templates/guards
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

model OrderTemplate {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(200)
  description String?  @db.Text
  branch      Branch?

  createdById String
  createdBy   User     @relation("UserOrderTemplates", fields: [createdById], references: [id])

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

// Update User model
model User {
  // ... existing fields
  orderTemplates OrderTemplate[] @relation("UserOrderTemplates")
}
```

**Run migration:**
```bash
npx prisma migrate dev --name add_order_templates
npx prisma generate
```

---

## Module Structure

```
src/modules/order-templates/
├── dto/
│   ├── create-order-template.dto.ts
│   ├── update-order-template.dto.ts
│   └── query-order-template.dto.ts
├── guards/
│   └── template-owner.guard.ts
├── order-templates.controller.ts
├── order-templates.service.ts
└── order-templates.module.ts
```

---

## DTOs

### create-order-template.dto.ts

```typescript
import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsNumber,
  Min,
  MaxLength,
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
```

### update-order-template.dto.ts

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateOrderTemplateDto } from './create-order-template.dto';

export class UpdateOrderTemplateDto extends PartialType(CreateOrderTemplateDto) {}
```

### query-order-template.dto.ts

```typescript
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Branch } from '@prisma/client';

export class QueryOrderTemplateDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Branch)
  branch?: Branch;
}
```

---

## Controller

### order-templates.controller.ts

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { OrderTemplatesService } from './order-templates.service';
import { CreateOrderTemplateDto } from './dto/create-order-template.dto';
import { UpdateOrderTemplateDto } from './dto/update-order-template.dto';
import { QueryOrderTemplateDto } from './dto/query-order-template.dto';
import { TemplateOwnerGuard } from './guards/template-owner.guard';

@Controller('order-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderTemplatesController {
  constructor(private readonly orderTemplatesService: OrderTemplatesService) {}

  /**
   * GET /order-templates
   * List all templates for current user
   */
  @Get()
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.BOD)
  async findAll(@Req() req, @Query() query: QueryOrderTemplateDto) {
    const userId = req.user.id;
    const userRole = req.user.role;

    return this.orderTemplatesService.findAll(userId, userRole, query);
  }

  /**
   * GET /order-templates/:id
   * Get template by ID
   */
  @Get(':id')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.BOD)
  @UseGuards(TemplateOwnerGuard)
  async findOne(@Param('id') id: string) {
    return this.orderTemplatesService.findOne(id);
  }

  /**
   * POST /order-templates
   * Create new template
   */
  @Post()
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.BOD)
  async create(@Req() req, @Body() createDto: CreateOrderTemplateDto) {
    const userId = req.user.id;
    return this.orderTemplatesService.create(userId, createDto);
  }

  /**
   * PATCH /order-templates/:id
   * Update template
   */
  @Patch(':id')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.BOD)
  @UseGuards(TemplateOwnerGuard)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderTemplateDto,
  ) {
    return this.orderTemplatesService.update(id, updateDto);
  }

  /**
   * DELETE /order-templates/:id
   * Delete template
   */
  @Delete(':id')
  @Roles(UserRole.SALE, UserRole.SALES_LEADER, UserRole.SALES_DIRECTOR, UserRole.BOD)
  @UseGuards(TemplateOwnerGuard)
  async remove(@Param('id') id: string) {
    return this.orderTemplatesService.remove(id);
  }
}
```

---

## Service

### order-templates.service.ts

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderTemplateDto } from './dto/create-order-template.dto';
import { UpdateOrderTemplateDto } from './dto/update-order-template.dto';
import { QueryOrderTemplateDto } from './dto/query-order-template.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class OrderTemplatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find all templates with pagination and filters
   */
  async findAll(userId: string, userRole: UserRole, query: QueryOrderTemplateDto) {
    const { page = 1, limit = 10, search, branch } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    // Only show user's own templates (unless admin/BOD)
    if (userRole !== UserRole.BOD && userRole !== UserRole.SALES_DIRECTOR) {
      where.createdById = userId;
    }

    // Search by name
    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    // Filter by branch
    if (branch) {
      where.branch = branch;
    }

    // Execute query
    const [templates, total] = await Promise.all([
      this.prisma.orderTemplate.findMany({
        where,
        skip,
        take: limit,
        include: {
          subOrders: {
            include: {
              items: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.orderTemplate.count({ where }),
    ]);

    return {
      data: templates,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find one template by ID
   */
  async findOne(id: string) {
    const template = await this.prisma.orderTemplate.findUnique({
      where: { id },
      include: {
        subOrders: {
          include: {
            items: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return { data: template };
  }

  /**
   * Create new template
   */
  async create(userId: string, createDto: CreateOrderTemplateDto) {
    const template = await this.prisma.orderTemplate.create({
      data: {
        name: createDto.name,
        description: createDto.description,
        branch: createDto.branch,
        createdById: userId,
        subOrders: {
          create: createDto.subOrders.map((subOrder) => ({
            serviceType: subOrder.serviceType,
            clearanceType: subOrder.clearanceType,
            shippingRoute: subOrder.shippingRoute,
            note: subOrder.note,
            items: {
              create: subOrder.items.map((item) => ({
                productName: item.productName,
                productUrl: item.productUrl,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                note: item.note,
              })),
            },
          })),
        },
      },
      include: {
        subOrders: {
          include: {
            items: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return { data: template };
  }

  /**
   * Update template
   */
  async update(id: string, updateDto: UpdateOrderTemplateDto) {
    // Check if template exists
    await this.findOne(id);

    // If updating subOrders, delete old ones and create new
    if (updateDto.subOrders) {
      await this.prisma.orderTemplateSubOrder.deleteMany({
        where: { templateId: id },
      });
    }

    const template = await this.prisma.orderTemplate.update({
      where: { id },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        branch: updateDto.branch,
        ...(updateDto.subOrders && {
          subOrders: {
            create: updateDto.subOrders.map((subOrder) => ({
              serviceType: subOrder.serviceType,
              clearanceType: subOrder.clearanceType,
              shippingRoute: subOrder.shippingRoute,
              note: subOrder.note,
              items: {
                create: subOrder.items.map((item) => ({
                  productName: item.productName,
                  productUrl: item.productUrl,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  note: item.note,
                })),
              },
            })),
          },
        }),
      },
      include: {
        subOrders: {
          include: {
            items: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    });

    return { data: template };
  }

  /**
   * Delete template
   */
  async remove(id: string) {
    // Check if template exists
    await this.findOne(id);

    await this.prisma.orderTemplate.delete({
      where: { id },
    });

    return { message: 'Template deleted successfully' };
  }

  /**
   * Check if user owns template
   * Used by TemplateOwnerGuard
   */
  async isOwner(templateId: string, userId: string, userRole: UserRole): Promise<boolean> {
    // BOD and SALES_DIRECTOR can access all templates
    if (userRole === UserRole.BOD || userRole === UserRole.SALES_DIRECTOR) {
      return true;
    }

    const template = await this.prisma.orderTemplate.findUnique({
      where: { id: templateId },
      select: { createdById: true },
    });

    if (!template) {
      return false;
    }

    return template.createdById === userId;
  }
}
```

---

## Guards

### guards/template-owner.guard.ts

```typescript
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { OrderTemplatesService } from '../order-templates.service';

@Injectable()
export class TemplateOwnerGuard implements CanActivate {
  constructor(private orderTemplatesService: OrderTemplatesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const templateId = request.params.id;
    const userId = request.user.id;
    const userRole = request.user.role;

    const isOwner = await this.orderTemplatesService.isOwner(
      templateId,
      userId,
      userRole,
    );

    if (!isOwner) {
      throw new ForbiddenException('You do not have permission to access this template');
    }

    return true;
  }
}
```

---

## Module

### order-templates.module.ts

```typescript
import { Module } from '@nestjs/common';
import { OrderTemplatesController } from './order-templates.controller';
import { OrderTemplatesService } from './order-templates.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrderTemplatesController],
  providers: [OrderTemplatesService],
  exports: [OrderTemplatesService],
})
export class OrderTemplatesModule {}
```

**Register in app.module.ts:**
```typescript
import { OrderTemplatesModule } from './modules/order-templates/order-templates.module';

@Module({
  imports: [
    // ... other modules
    OrderTemplatesModule,
  ],
})
export class AppModule {}
```

---

## Testing

### order-templates.service.spec.ts

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { OrderTemplatesService } from './order-templates.service';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, ServiceType, ClearanceType } from '@prisma/client';

describe('OrderTemplatesService', () => {
  let service: OrderTemplatesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    orderTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    orderTemplateSubOrder: {
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderTemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OrderTemplatesService>(OrderTemplatesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated templates for user', async () => {
      const userId = 'user-123';
      const userRole = UserRole.SALE;
      const query = { page: 1, limit: 10 };

      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Test Template',
          description: 'Test',
          branch: 'HN',
          createdById: userId,
          subOrders: [],
          createdBy: { id: userId, fullName: 'Test User', email: 'test@example.com' },
        },
      ];

      mockPrismaService.orderTemplate.findMany.mockResolvedValue(mockTemplates);
      mockPrismaService.orderTemplate.count.mockResolvedValue(1);

      const result = await service.findAll(userId, userRole, query);

      expect(result.data).toEqual(mockTemplates);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });
  });

  describe('create', () => {
    it('should create a new template', async () => {
      const userId = 'user-123';
      const createDto = {
        name: 'New Template',
        description: 'Test template',
        branch: 'HN',
        subOrders: [
          {
            serviceType: ServiceType.VCT,
            clearanceType: ClearanceType.TIEU_NGACH,
            items: [
              {
                productName: 'Product 1',
                quantity: 5,
                unitPrice: 100,
              },
            ],
          },
        ],
      };

      const mockCreatedTemplate = {
        id: 'template-1',
        ...createDto,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.orderTemplate.create.mockResolvedValue(mockCreatedTemplate);

      const result = await service.create(userId, createDto as any);

      expect(result.data).toEqual(mockCreatedTemplate);
      expect(mockPrismaService.orderTemplate.create).toHaveBeenCalled();
    });
  });
});
```

---

## Postman Collection

```json
{
  "info": {
    "name": "Order Templates API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "List Templates",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/order-templates?page=1&limit=10",
          "host": ["{{baseUrl}}"],
          "path": ["order-templates"],
          "query": [
            { "key": "page", "value": "1" },
            { "key": "limit", "value": "10" },
            { "key": "search", "value": "", "disabled": true },
            { "key": "branch", "value": "HN", "disabled": true }
          ]
        }
      }
    },
    {
      "name": "Create Template",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{accessToken}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Combo Mỹ phẩm 10 món\",\n  \"description\": \"Template cho combo mỹ phẩm phổ biến\",\n  \"branch\": \"HN\",\n  \"subOrders\": [\n    {\n      \"serviceType\": \"VCT\",\n      \"clearanceType\": \"TIEU_NGACH\",\n      \"shippingRoute\": \"AIR\",\n      \"note\": \"Hàng dễ vỡ\",\n      \"items\": [\n        {\n          \"productName\": \"Serum Vitamin C\",\n          \"productUrl\": \"https://1688.com/product/123\",\n          \"quantity\": 5,\n          \"unitPrice\": 89.5\n        }\n      ]\n    }\n  ]\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/order-templates",
          "host": ["{{baseUrl}}"],
          "path": ["order-templates"]
        }
      }
    }
  ]
}
```

---

## Deployment Checklist

- [ ] Run Prisma migration
- [ ] Update seeds if needed
- [ ] Deploy to staging
- [ ] Test all endpoints on staging
- [ ] Update API documentation
- [ ] Notify frontend team
- [ ] Deploy to production

---

## Support

For questions or issues:
- Frontend team: Check `docs/API-SPECS-ORDER-TEMPLATES.md`
- Backend lead: Review this implementation guide
- Database: See Prisma schema section

**Estimated completion:** 2-3 days including testing.
