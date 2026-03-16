import { ContractType, ContractStatus, Currency } from './enums';

export interface Contract {
  id: string;
  code: string;
  customerId: string;
  customer?: {
    id: string;
    code: string;
    fullName: string;
    companyName?: string;
    phone?: string;
    email?: string;
    tier?: string;
  };
  saleId: string;
  sale?: {
    id: string;
    fullName: string;
    email?: string;
  };
  type: ContractType;
  parentId?: string;
  parent?: {
    id: string;
    code: string;
    title: string;
    status?: ContractStatus;
  };
  quotationId?: string;
  quotation?: {
    id: string;
    code: string;
    status?: string;
    totalAmount?: number;
  };
  title: string;
  signedDate?: string;
  effectiveDate: string;
  expiryDate?: string;
  totalValue: number;
  depositRequired: number;
  depositPaid: number;
  totalPaid: number;
  currency: Currency;
  status: ContractStatus;
  settledAt?: string;
  closedAt?: string;
  attachments: string[];
  terms?: string;
  note?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  appendixes?: {
    id: string;
    code: string;
    title: string;
    status: ContractStatus;
    totalValue: number;
    createdAt: string;
  }[];
  orders?: {
    id: string;
    code: string;
    status: string;
    totalAmount: number;
  }[];
  _count?: {
    appendixes?: number;
    orders?: number;
  };
}

export interface CreateContractDto {
  customerId: string;
  saleId: string;
  type: ContractType;
  parentId?: string;
  quotationId?: string;
  title: string;
  effectiveDate: string;
  expiryDate?: string;
  totalValue?: number;
  depositRequired?: number;
  currency?: Currency;
  terms?: string;
  note?: string;
  attachments?: string[];
}

export interface UpdateContractDto {
  title?: string;
  effectiveDate?: string;
  expiryDate?: string;
  totalValue?: number;
  depositRequired?: number;
  currency?: Currency;
  terms?: string;
  note?: string;
  attachments?: string[];
}

export interface ContractQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: ContractStatus;
  type?: ContractType;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}
