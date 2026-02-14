'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { CustomerForm, type CustomerFormData } from '@/features/customers/customer-form';
import { useCreateCustomer } from '@/lib/hooks/use-customers';
import type { CreateCustomerDto } from '@/lib/types';

export default function TaoMoiKhachHangPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();

  const handleSubmit = (data: CustomerFormData) => {
    const dto: CreateCustomerDto = {
      ...data,
      contacts: data.contacts?.map((c) => ({
        fullName: c.fullName,
        phone: c.phone || null,
        email: c.email || null,
        position: c.position || null,
        isPrimary: c.isPrimary,
      })),
    };
    createCustomer.mutate(dto, {
      onSuccess: () => {
        router.push('/khach-hang');
      },
    });
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/khach-hang"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <PageHeader title="Thêm khách hàng" className="pb-0" />
      </div>

      <CustomerForm
        mode="create"
        onSubmit={handleSubmit}
        isPending={createCustomer.isPending}
      />
    </div>
  );
}
