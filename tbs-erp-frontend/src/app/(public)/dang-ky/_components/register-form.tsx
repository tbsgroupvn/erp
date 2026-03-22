'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData(e.currentTarget as HTMLFormElement);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.get('contactName'),
          phone: formData.get('phone'),
          email: formData.get('email'),
          company: formData.get('companyName'),
          service: 'GENERAL',
          message: formData.get('needs') || 'Registration from website'
        })
      });

      if (response.ok) {
        toast.success('\u0110\u0103ng k\u00fd th\u00e0nh c\u00f4ng! Ch\u00fang t\u00f4i s\u1ebd li\u00ean h\u1ec7 b\u1ea1n s\u1edbm.');
        router.push('/login?registered=true');
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      toast.error('\u0110\u0103ng k\u00fd th\u1ea5t b\u1ea1i. Vui l\u00f2ng th\u1eed l\u1ea1i.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="company-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            T\u00ean c\u00f4ng ty <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="company-name"
            name="companyName"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Nh\u1eadp t\u00ean c\u00f4ng ty"
          />
        </div>

        <div>
          <label
            htmlFor="contact-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            H\u1ecd v\u00e0 t\u00ean <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="contact-name"
            name="contactName"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Nh\u1eadp h\u1ecd v\u00e0 t\u00ean"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="email@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            S\u1ed1 \u0111i\u1ec7n tho\u1ea1i <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="phone"
            name="phone"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="0xxx xxx xxx"
          />
        </div>

        <div>
          <label
            htmlFor="message"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Nhu c\u1ea7u s\u1eed d\u1ee5ng
          </label>
          <textarea
            id="message"
            name="needs"
            rows={4}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="M\u00f4 t\u1ea3 ng\u1eafn v\u1ec1 nhu c\u1ea7u s\u1eed d\u1ee5ng d\u1ecbch v\u1ee5 c\u1ee7a b\u1ea1n"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '\u0110ang x\u1eed l\u00fd...' : '\u0110\u0103ng k\u00fd ngay'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        \u0110\u00e3 c\u00f3 t\u00e0i kho\u1ea3n?{' '}
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-700"
        >
          \u0110\u0103ng nh\u1eadp
        </Link>
      </div>
    </div>
  );
}
