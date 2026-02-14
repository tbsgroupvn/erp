import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import Navbar from './components/navbar';
import Footer from './components/footer';
import { ChatWidget } from './components/chat-widget';
import { WhatsAppButton } from './components/whatsapp-button';
import { ServiceWorkerRegistration } from '@/components/shared/sw-registration';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://nhaphangchinhngach.vn'),
  title: {
    default: 'TBS ERP - Hệ thống quản lý vận chuyển Trung Quốc - Việt Nam',
    template: '%s | TBS ERP',
  },
  description:
    'Vận chuyển hàng Trung Quốc chuyên nghiệp, giá tốt. Order hàng Taobao, 1688. Ủy thác xuất nhập khẩu chính ngạch. Giao hàng 5-7 ngày. Đăng ký ngay!',
  keywords: [
    'TBS ERP',
    'vận chuyển Trung Quốc Việt Nam',
    'order hàng Trung Quốc',
    'logistics',
    'hải quan',
    'giao nhận',
    'ERP',
  ],
  authors: [{ name: 'TBS Logistics' }],
  creator: 'TBS Logistics',
  publisher: 'TBS Logistics',
  alternates: {
    canonical: 'https://nhaphangchinhngach.vn',
    languages: {
      'vi': 'https://nhaphangchinhngach.vn',
      'en': 'https://nhaphangchinhngach.vn/en',
      'x-default': 'https://nhaphangchinhngach.vn',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: 'https://nhaphangchinhngach.vn',
    title: 'TBS ERP - Hệ thống quản lý vận chuyển Trung Quốc - Việt Nam',
    description:
      'Giải pháp vận chuyển & logistics chuyên nghiệp từ Trung Quốc về Việt Nam',
    siteName: 'TBS ERP',
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: 'TBS ERP',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TBS ERP - Hệ thống quản lý vận chuyển Trung Quốc - Việt Nam',
    description:
      'Giải pháp vận chuyển & logistics chuyên nghiệp từ Trung Quốc về Việt Nam',
    images: ['/twitter-image.svg'],
    creator: '@tbslogistics',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TBS Logistics',
    description:
      'Công ty vận chuyển và logistics chuyên nghiệp từ Trung Quốc về Việt Nam',
    url: 'https://nhaphangchinhngach.vn',
    logo: 'https://nhaphangchinhngach.vn/logo.svg',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+84-xxx-xxx-xxx',
      contactType: 'Customer Service',
      areaServed: 'VN',
      availableLanguage: ['vi', 'zh'],
    },
    sameAs: [
      'https://facebook.com/tbslogistics',
      'https://linkedin.com/company/tbs-logistics',
      'https://zalo.me/tbslogistics',
    ],
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'VN',
      addressLocality: 'Hà Nội',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '10',
      bestRating: '5',
      worstRating: '1',
    },
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': 'https://nhaphangchinhngach.vn',
    name: 'TBS Logistics',
    image: 'https://nhaphangchinhngach.vn/logo.svg',
    telephone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+84-xxx-xxx-xxx',
    email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'info@nhaphangchinhngach.vn',
    address: {
      '@type': 'PostalAddress',
      streetAddress: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Đang cập nhật',
      addressLocality: 'Hà Nội',
      addressRegion: 'Hà Nội',
      postalCode: '100000',
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 21.028511,
      longitude: 105.804817,
    },
    url: 'https://nhaphangchinhngach.vn',
    priceRange: '$$',
    openingHoursSpecification: [
      {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ],
        opens: '08:00',
        closes: '18:00',
      },
    ],
    sameAs: [
      'https://facebook.com/tbslogistics',
      'https://linkedin.com/company/tbs-logistics',
      'https://zalo.me/tbslogistics',
    ],
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5.0',
      reviewCount: '10',
      bestRating: '5',
      worstRating: '1',
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(localBusinessSchema),
        }}
      />

      {/* Google Maps Script */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || ''}`}
        strategy="lazyOnload"
      />

      {/* Zalo Chat Plugin Script */}
      <Script
        src="https://sp.zalo.me/plugins/sdk.js"
        strategy="lazyOnload"
      />

      <ServiceWorkerRegistration />
      <Navbar />
      <main id="main-content" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <ChatWidget />
      <WhatsAppButton />
    </div>
  );
}
