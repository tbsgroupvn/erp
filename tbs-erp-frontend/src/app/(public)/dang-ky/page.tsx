import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { RegisterForm } from './_components/register-form';

export const metadata: Metadata = {
  title: '\u0110\u0103ng k\u00fd',
  description:
    'T\u1ea1o t\u00e0i kho\u1ea3n \u0111\u1ec3 b\u1eaft \u0111\u1ea7u s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n v\u00e0 mua h\u00e0ng h\u1ed9 t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam.',
  openGraph: {
    title: '\u0110\u0103ng k\u00fd t\u00e0i kho\u1ea3n',
    description:
      'T\u1ea1o t\u00e0i kho\u1ea3n \u0111\u1ec3 b\u1eaft \u0111\u1ea7u s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n v\u00e0 mua h\u00e0ng h\u1ed9 t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam.',
  },
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">{'\u0110\u0103ng k\u00fd'}</h1>
          <p className="text-gray-600">
            T\u1ea1o t\u00e0i kho\u1ea3n \u0111\u1ec3 b\u1eaft \u0111\u1ea7u s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5 TBS ERP
          </p>
        </div>

        {/* Client Component: interactive form */}
        <RegisterForm />

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay l\u1ea1i trang ch\u1ee7
          </Link>
        </div>
      </div>
    </div>
  );
}
