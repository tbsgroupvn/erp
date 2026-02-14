import type { QueryParams } from './common.types';

export interface VendorRating {
  id: string;
  score: number;
  comment?: string;
  ratedBy: string;
  ratedByUser?: { id: string; fullName: string };
  createdAt: string;
}

export interface Vendor {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  country: string;
  isApproved: boolean;
  averageRating: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  paymentTerms?: string;
  ratings?: VendorRating[];
  createdAt: string;
  updatedAt: string;
}

export interface VendorQueryParams extends QueryParams {
  country?: string;
  isApproved?: boolean;
}

export interface CreateVendorDto {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  country: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  paymentTerms?: string;
}

export type UpdateVendorDto = Partial<CreateVendorDto>;

export interface RateVendorDto {
  score: number;
  comment?: string;
}
