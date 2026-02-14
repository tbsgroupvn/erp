import {
  AbilityBuilder,
  createMongoAbility,
  ExtractSubjectType,
  InferSubjects,
  MongoAbility,
  MongoQuery,
} from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';

// Define all subject types that can be managed by CASL
export type Subjects =
  | 'Order'
  | 'OrderItem'
  | 'Customer'
  | 'Package'
  | 'Container'
  | 'Delivery'
  | 'PaymentVoucher'
  | 'AccountReceivable'
  | 'AccountPayable'
  | 'CashTransaction'
  | 'Invoice'
  | 'ExchangeRate'
  | 'DebtNetting'
  | 'Approval'
  | 'User'
  | 'AuditLog'
  | 'Notification'
  | 'PreAlert'
  | 'LostAndFound'
  | 'Dashboard'
  | 'Report'
  | 'all';

// Define all actions
export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'approve' | 'export';

export type AppAbility = MongoAbility<[Actions, Subjects], MongoQuery>;

interface UserContext {
  userId: string;
  role: UserRole;
  branch?: string | null;
}

@Injectable()
export class CaslAbilityFactory {
  createForUser(user: UserContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createMongoAbility,
    );

    switch (user.role) {
      // ---------------------------------------------------------------
      // Executive: full access to everything
      // ---------------------------------------------------------------
      case UserRole.CEO:
      case UserRole.COO:
        can('manage', 'all');
        break;

      // ---------------------------------------------------------------
      // Sales Director: manage all orders/customers across branches
      // ---------------------------------------------------------------
      case UserRole.SALES_DIRECTOR:
        can('manage', 'Order');
        can('manage', 'OrderItem');
        can('manage', 'Customer');
        can('manage', 'PreAlert');
        can('read', 'Package');
        can('read', 'Container');
        can('read', 'Delivery');
        can('read', 'PaymentVoucher');
        can('read', 'AccountReceivable');
        can('read', 'Report');
        can('read', 'Dashboard');
        can('approve', 'Order');
        can('export', 'Order');
        can('export', 'Customer');
        can('manage', 'User', { role: { $in: [UserRole.SALES_LEADER, UserRole.SALE] } } as any);
        break;

      // ---------------------------------------------------------------
      // Sales Leader: manage orders/customers for their team members
      // ---------------------------------------------------------------
      case UserRole.SALES_LEADER:
        can('manage', 'Order');
        can('manage', 'OrderItem');
        can('manage', 'Customer');
        can('manage', 'PreAlert');
        can('read', 'Package');
        can('read', 'Container');
        can('read', 'Delivery');
        can('read', 'PaymentVoucher');
        can('read', 'AccountReceivable');
        can('read', 'Dashboard');
        can('approve', 'Order');
        can('export', 'Order');
        // Note: data-scoping to team is handled by DataScopeService
        break;

      // ---------------------------------------------------------------
      // Sale: manage own orders/customers only
      // ---------------------------------------------------------------
      case UserRole.SALE:
        can('create', 'Order');
        can('read', 'Order');
        can('update', 'Order');
        can('manage', 'OrderItem');
        can('create', 'Customer');
        can('read', 'Customer');
        can('update', 'Customer');
        can('manage', 'PreAlert');
        can('read', 'Package');
        can('read', 'Container');
        can('read', 'Delivery');
        can('read', 'PaymentVoucher');
        can('read', 'AccountReceivable');
        can('read', 'Dashboard');
        // Note: data-scoping to own records is handled by DataScopeService
        cannot('delete', 'Order');
        cannot('approve', 'Order');
        break;

      // ---------------------------------------------------------------
      // Chief Accountant: manage all finance-related entities
      // ---------------------------------------------------------------
      case UserRole.CHIEF_ACCOUNTANT:
        can('manage', 'PaymentVoucher');
        can('manage', 'AccountReceivable');
        can('manage', 'AccountPayable');
        can('manage', 'CashTransaction');
        can('manage', 'Invoice');
        can('manage', 'ExchangeRate');
        can('manage', 'DebtNetting');
        can('approve', 'PaymentVoucher');
        can('approve', 'DebtNetting');
        can('read', 'Order');
        can('read', 'Customer');
        can('read', 'Dashboard');
        can('read', 'Report');
        can('export', 'Report');
        can('export', 'PaymentVoucher');
        can('export', 'AccountReceivable');
        break;

      // ---------------------------------------------------------------
      // Accountant AR: manage payment vouchers & accounts receivable
      // ---------------------------------------------------------------
      case UserRole.ACCOUNTANT_AR:
        can('manage', 'PaymentVoucher');
        can('manage', 'AccountReceivable');
        can('manage', 'CashTransaction');
        can('read', 'AccountPayable');
        can('read', 'Invoice');
        can('read', 'Order');
        can('read', 'Customer');
        can('read', 'Dashboard');
        cannot('approve', 'PaymentVoucher');
        cannot('delete', 'PaymentVoucher');
        break;

      // ---------------------------------------------------------------
      // Accountant Cost: manage cost-related transactions
      // ---------------------------------------------------------------
      case UserRole.ACCOUNTANT_COST:
        can('manage', 'AccountPayable');
        can('manage', 'CashTransaction');
        can('read', 'PaymentVoucher');
        can('read', 'AccountReceivable');
        can('read', 'Invoice');
        can('read', 'Order');
        can('read', 'Dashboard');
        cannot('approve', 'PaymentVoucher');
        break;

      // ---------------------------------------------------------------
      // XNK Manager: manage containers, customs, import-export
      // ---------------------------------------------------------------
      case UserRole.XNK_MANAGER:
        can('manage', 'Container');
        can('manage', 'Package');
        can('update', 'Order');
        can('read', 'Order');
        can('read', 'Customer');
        can('read', 'Delivery');
        can('read', 'Dashboard');
        can('approve', 'Container');
        can('export', 'Container');
        break;

      // ---------------------------------------------------------------
      // XNK Staff: assist with containers and customs
      // ---------------------------------------------------------------
      case UserRole.XNK_STAFF:
        can('read', 'Container');
        can('update', 'Container');
        can('read', 'Package');
        can('update', 'Package');
        can('read', 'Order');
        can('read', 'Dashboard');
        break;

      // ---------------------------------------------------------------
      // Warehouse CN Agent: update packages in China warehouse
      // ---------------------------------------------------------------
      case UserRole.WAREHOUSE_CN_AGENT:
        can('create', 'Package');
        can('read', 'Package');
        can('update', 'Package');
        can('read', 'Order');
        can('read', 'Container');
        can('read', 'PreAlert');
        can('update', 'PreAlert');
        can('manage', 'LostAndFound');
        can('read', 'Dashboard');
        break;

      // ---------------------------------------------------------------
      // Warehouse VN Manager: manage VN warehouse + deliveries
      // ---------------------------------------------------------------
      case UserRole.WAREHOUSE_VN_MANAGER:
        can('manage', 'Package');
        can('manage', 'Delivery');
        can('manage', 'LostAndFound');
        can('read', 'Order');
        can('read', 'Customer');
        can('read', 'Container');
        can('read', 'Dashboard');
        can('approve', 'Delivery');
        can('export', 'Package');
        break;

      // ---------------------------------------------------------------
      // Warehouse VN Staff: assist in VN warehouse
      // ---------------------------------------------------------------
      case UserRole.WAREHOUSE_VN_STAFF:
        can('read', 'Package');
        can('update', 'Package');
        can('read', 'Delivery');
        can('update', 'Delivery');
        can('read', 'Order');
        can('read', 'LostAndFound');
        can('update', 'LostAndFound');
        can('read', 'Dashboard');
        break;

      // ---------------------------------------------------------------
      // Driver: update delivery status
      // ---------------------------------------------------------------
      case UserRole.DRIVER:
        can('read', 'Delivery');
        can('update', 'Delivery');
        can('read', 'Package');
        can('read', 'Order');
        can('read', 'Dashboard');
        break;

      // ---------------------------------------------------------------
      // Marketing Staff
      // ---------------------------------------------------------------
      case UserRole.MARKETING_STAFF:
        can('read', 'Customer');
        can('read', 'Order');
        can('read', 'Dashboard');
        can('read', 'Report');
        break;

      // ---------------------------------------------------------------
      // CSKH (Customer Service)
      // ---------------------------------------------------------------
      case UserRole.CSKH:
        can('read', 'Customer');
        can('read', 'Order');
        can('read', 'Package');
        can('read', 'Delivery');
        can('read', 'Dashboard');
        can('create', 'PreAlert');
        can('read', 'PreAlert');
        break;

      default:
        // No permissions for unknown roles
        break;
    }

    // All authenticated users can read notifications and manage own profile
    can('read', 'Notification');
    can('read', 'AuditLog');

    return build({
      detectSubjectType: (item) =>
        (item as any).constructor as ExtractSubjectType<Subjects>,
    });
  }
}
