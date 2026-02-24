import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
  Context,
} from '@nestjs/graphql';
import { UseGuards, Logger } from '@nestjs/common';
import { GqlAuthGuard } from '@core/graphql/guards/gql-auth.guard';
import { IDataLoaders } from '@core/graphql/dataloader.service';
import {
  OrderType,
  PaginatedOrders,
  OrderQueryArgs,
  CreateOrderInput,
} from '@core/graphql/types/order.type';
import { CustomerType } from '@core/graphql/types/customer.type';
import { PackageType } from '@core/graphql/types/package.type';
import { OrderService } from './order.service';
import { PrismaService } from '@core/database/prisma.service';

@Resolver(() => OrderType)
@UseGuards(GqlAuthGuard)
export class OrderResolver {
  private readonly logger = new Logger(OrderResolver.name);

  constructor(
    private readonly orderService: OrderService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Queries ───

  @Query(() => PaginatedOrders, {
    name: 'orders',
    description: 'Retrieve a paginated list of orders with optional filters',
  })
  async getOrders(
    @Args() args: OrderQueryArgs,
    @Context() ctx: { req: any },
  ): Promise<PaginatedOrders> {
    const page = args.page ?? 1;
    const limit = args.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (args.status) where.status = args.status;
    if (args.serviceType) where.serviceType = args.serviceType;
    if (args.branch) where.branch = args.branch;
    if (args.customerId) where.customerId = args.customerId;
    if (args.startDate || args.endDate) {
      where.createdAt = {};
      if (args.startDate) where.createdAt.gte = args.startDate;
      if (args.endDate) where.createdAt.lte = args.endDate;
    }
    if (args.search) {
      where.OR = [
        { code: { contains: args.search, mode: 'insensitive' } },
        { customer: { fullName: { contains: args.search, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items: items.map((item) => this.mapOrder(item)),
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  @Query(() => OrderType, {
    name: 'order',
    description: 'Retrieve a single order by ID',
    nullable: true,
  })
  async getOrder(@Args('id') id: string): Promise<OrderType | null> {
    const order = await this.prisma.order.findUnique({ where: { id } });
    return order ? this.mapOrder(order) : null;
  }

  // ─── Mutations ───

  @Mutation(() => OrderType, {
    name: 'createOrder',
    description: 'Create a new logistics order',
  })
  async createOrder(
    @Args('input') input: CreateOrderInput,
    @Context() ctx: { req: any },
  ): Promise<OrderType> {
    const currentUser = ctx.req.user;
    const dto: any = {
      customerId: input.customerId,
      serviceType: input.serviceType,
      clearanceType: input.clearanceType,
      branch: input.branch,
      note: input.note,
      items: input.items?.map((item) => ({
        description: item.description,
        weight: item.weight,
        length: item.length,
        width: item.width,
        height: item.height,
        quantity: item.quantity ?? 1,
      })),
    };

    const order = await this.orderService.createOrder(dto, currentUser);
    return this.mapOrder(order);
  }

  // ─── Field Resolvers (use DataLoader for N+1 prevention) ───

  @ResolveField('customer', () => CustomerType, {
    nullable: true,
    description: 'The customer who placed this order',
  })
  async resolveCustomer(
    @Parent() order: OrderType,
    @Context('loaders') loaders: IDataLoaders,
  ): Promise<CustomerType | null> {
    if (!order.customerId) return null;
    return loaders.customerLoader.load(order.customerId);
  }

  @ResolveField('packages', () => [PackageType], {
    nullable: true,
    description: 'Packages belonging to this order',
  })
  async resolvePackages(
    @Parent() order: OrderType,
    @Context('loaders') loaders: IDataLoaders,
  ): Promise<PackageType[]> {
    return loaders.packagesByOrderLoader.load(order.id);
  }

  // ─── Helpers ───

  private mapOrder(order: any): OrderType {
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      serviceType: order.serviceType,
      clearanceType: order.clearanceType ?? undefined,
      totalAmount: order.totalAmount?.toNumber?.() ?? Number(order.totalAmount ?? 0),
      depositAmount: order.depositAmount?.toNumber?.() ?? Number(order.depositAmount ?? 0),
      depositPaid: order.depositPaid?.toNumber?.() ?? Number(order.depositPaid ?? 0),
      branch: order.branch ?? undefined,
      note: order.note ?? undefined,
      customerId: order.customerId,
      salesPersonId: order.salesPersonId ?? undefined,
      completedAt: order.completedAt ?? undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
