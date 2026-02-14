// ============================================
// CUSTOMER TYPES — Customer, Contact, Wallet
// ============================================

import { QueryParams } from './common.types';
import { Branch, Currency, CustomerTier } from './enums';

/** Full Customer entity */
export interface Customer {
  id: string;
  code: string;
  companyName: string | null;
  fullName: string;
  phone: string;
  email: string | null;
  address: string | null;
  taxCode: string | null;
  tier: CustomerTier;
  creditLimit: number;
  currentDebt: number;
  depositRate: number;
  totalOrders: number;
  totalRevenue: number;
  branch: Branch | null;
  saleId: string | null;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;

  // Nested relations (optionally populated)
  contacts?: Contact[];
  wallet?: Wallet | null;
}

/** Customer contact person */
export interface Contact {
  id: string;
  customerId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  position: string | null;
  isPrimary: boolean;
  createdAt: string;
}

/** Customer wallet (prepaid balance) */
export interface Wallet {
  id: string;
  customerId: string;
  balance: number;
  currency: Currency;
  updatedAt: string;

  transactions?: WalletTransaction[];
}

/** Individual wallet transaction record */
export interface WalletTransaction {
  id: string;
  walletId: string;
  amount: number;
  type: 'TOPUP' | 'DEDUCT' | 'REFUND';
  reference: string | null;
  note: string | null;
  createdAt: string;
}

/** DTO for creating a new customer */
export interface CreateCustomerDto {
  fullName: string;
  companyName?: string;
  phone: string;
  email?: string;
  address?: string;
  taxCode?: string;
  tier?: CustomerTier;
  creditLimit?: number;
  depositRate?: number;
  branch?: Branch;
  saleId?: string;
  note?: string;
  contacts?: Omit<Contact, 'id' | 'customerId' | 'createdAt'>[];
}

/** DTO for updating an existing customer */
export interface UpdateCustomerDto {
  fullName?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxCode?: string;
  tier?: CustomerTier;
  creditLimit?: number;
  depositRate?: number;
  branch?: Branch;
  saleId?: string;
  note?: string;
  isActive?: boolean;
}

/** Query params specific to customer listing */
export interface CustomerQueryParams extends QueryParams {
  tier?: CustomerTier;
  branch?: Branch;
  saleId?: string;
  isActive?: boolean;
}

/** DTO for topping up a wallet */
export interface TopupWalletDto {
  customerId: string;
  amount: number;
  note?: string;
  reference?: string;
}
