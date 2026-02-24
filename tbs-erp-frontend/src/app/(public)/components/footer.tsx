'use client';

import Link from 'next/link';
import {
  Facebook,
  Linkedin,
  Mail,
  MapPin,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { CMSFooterMenu } from '@/components/public/cms-menu';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNewsletterSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newsletterEmail || !newsletterEmail.includes('@')) {
      toast.error('Vui lòng nhập email hợp lệ');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/public/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newsletterEmail }),
      });

      if (!response.ok) {
        throw new Error('Không thể đăng ký');
      }

      toast.success('Đăng ký thành công!', {
        description: 'Cảm ơn bạn đã đăng ký nhận tin tức.',
      });
      setNewsletterEmail('');
    } catch (error) {
      toast.error('Có lỗi xảy ra!', {
        description: 'Vui lòng thử lại sau.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <footer className="border-t border-gray-200 bg-gray-900 text-gray-300">
      {/* Main Footer Content */}
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                <span className="text-xl font-bold">{(process.env.NEXT_PUBLIC_COMPANY_NAME || 'ERP').substring(0, 3)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold text-white">{process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System'}</span>
                <span className="text-xs text-gray-400">{process.env.NEXT_PUBLIC_COMPANY_NAME || ''}</span>
              </div>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-gray-400">
              Hệ thống quản lý vận chuyển và logistics chuyên nghiệp từ Trung
              Quốc về Việt Nam. Giải pháp toàn diện cho doanh nghiệp của bạn.
            </p>
            <div className="flex gap-3">
              {process.env.NEXT_PUBLIC_FACEBOOK_URL && (
                <a
                  href={process.env.NEXT_PUBLIC_FACEBOOK_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-gray-400 transition-colors hover:bg-blue-600 hover:text-white"
                  aria-label="Facebook"
                >
                  <Facebook className="h-5 w-5" />
                </a>
              )}
              {process.env.NEXT_PUBLIC_LINKEDIN_URL && (
                <a
                  href={process.env.NEXT_PUBLIC_LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-gray-400 transition-colors hover:bg-blue-600 hover:text-white"
                  aria-label="LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              )}
              {process.env.NEXT_PUBLIC_ZALO_URL && (
                <a
                  href={process.env.NEXT_PUBLIC_ZALO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-800 text-gray-400 transition-colors hover:bg-blue-600 hover:text-white"
                  aria-label="Zalo"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              )}
            </div>
          </div>

          {/* CMS Footer Menu */}
          <CMSFooterMenu />

          {/* Services */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Dịch vụ
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/dich-vu/mua-hang-ho"
                  className="text-sm transition-colors hover:text-blue-400"
                >
                  Order hàng Trung Quốc
                </Link>
              </li>
              <li>
                <Link
                  href="/dich-vu/van-chuyen-hang-hoa"
                  className="text-sm transition-colors hover:text-blue-400"
                >
                  Vận chuyển hàng hóa
                </Link>
              </li>
              <li>
                <Link
                  href="/dich-vu/uy-thac-xuat-nhap-khau"
                  className="text-sm transition-colors hover:text-blue-400"
                >
                  Khai báo hải quan
                </Link>
              </li>
              <li>
                <Link
                  href="/dich-vu/lcl-chinh-ngach"
                  className="text-sm transition-colors hover:text-blue-400"
                >
                  Kho bãi & đóng gói
                </Link>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
              Đăng ký nhận tin
            </h3>
            <p className="mb-4 text-sm text-gray-400">
              Nhận tin tức mới nhất về logistics và ưu đãi đặc biệt
            </p>
            <form onSubmit={handleNewsletterSubscribe} className="space-y-2">
              <Input
                type="email"
                placeholder="Email của bạn"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                required
              />
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Đang đăng ký...' : 'Đăng ký'}
              </Button>
            </form>
            <p className="mt-3 text-xs text-gray-500">
              Bằng việc đăng ký, bạn đồng ý với{' '}
              <Link href="/chinh-sach-bao-mat" className="text-blue-400 hover:underline">
                chính sách bảo mật
              </Link>{' '}
              của chúng tôi.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 text-sm text-gray-400 md:flex-row">
            <p>
              &copy; {currentYear} {process.env.NEXT_PUBLIC_COMPANY_NAME || 'My ERP'}. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                href="/chinh-sach-bao-mat"
                className="transition-colors hover:text-blue-400"
              >
                Chính sách bảo mật
              </Link>
              <Link
                href="/dieu-khoan-su-dung"
                className="transition-colors hover:text-blue-400"
              >
                Điều khoản sử dụng
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
