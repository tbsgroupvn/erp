import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import Navbar from './components/navbar';
import Footer from './components/footer';
import { ChatWidget } from './components/chat-widget';
import { WhatsAppButton } from './components/whatsapp-button';
import { ServiceWorkerRegistration } from '@/components/shared/sw-registration';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost';
const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'My ERP';
const companyFullName = process.env.NEXT_PUBLIC_COMPANY_FULL_NAME || 'My ERP Company';
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Content Management System';
const twitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE || '';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${companyName} - ${appDescription}`,
    template: `%s | ${companyName}`,
  },
  description: appDescription,
  keywords: [
    companyName,
    'logistics',
    'ERP',
  ],
  authors: [{ name: companyFullName }],
  creator: companyFullName,
  publisher: companyFullName,
  alternates: {
    canonical: siteUrl,
    languages: {
      'vi': siteUrl,
      'en': `${siteUrl}/en`,
      'x-default': siteUrl,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: siteUrl,
    title: `${companyName} - ${appDescription}`,
    description: appDescription,
    siteName: companyName,
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: companyName,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${companyName} - ${appDescription}`,
    description: appDescription,
    images: ['/twitter-image.svg'],
    creator: twitterHandle ? `@${twitterHandle}` : undefined,
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
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION || '',
  },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companyPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || '';
  const companyEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || '';
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '';
  const addressLocality = process.env.NEXT_PUBLIC_ADDRESS_LOCALITY || '';
  const addressRegion = process.env.NEXT_PUBLIC_ADDRESS_REGION || '';
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL || '';
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL || '';
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || '';
  const latitude = parseFloat(process.env.NEXT_PUBLIC_LATITUDE || '0');
  const longitude = parseFloat(process.env.NEXT_PUBLIC_LONGITUDE || '0');

  const sameAsLinks = [facebookUrl, linkedinUrl, zaloUrl].filter(Boolean);

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyFullName,
    description: appDescription,
    url: siteUrl,
    logo: `${siteUrl}/logo.svg`,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: companyPhone,
      contactType: 'Customer Service',
      areaServed: 'VN',
      availableLanguage: ['vi', 'zh'],
    },
    sameAs: sameAsLinks,
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'VN',
      addressLocality: addressLocality,
    },
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': siteUrl,
    name: companyFullName,
    image: `${siteUrl}/logo.svg`,
    telephone: companyPhone,
    email: companyEmail,
    address: {
      '@type': 'PostalAddress',
      streetAddress: companyAddress,
      addressLocality: addressLocality,
      addressRegion: addressRegion,
      postalCode: process.env.NEXT_PUBLIC_POSTAL_CODE || '100000',
      addressCountry: 'VN',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: latitude,
      longitude: longitude,
    },
    url: siteUrl,
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
    sameAs: sameAsLinks,
  };

  // Safely serialize JSON-LD: escape </script> sequences to prevent XSS
  const safeJsonLd = (data: Record<string, unknown>): string =>
    JSON.stringify(data).replace(/</g, '\\u003c');

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(localBusinessSchema),
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
      <main id="main-content" role="main" aria-label="Noi dung chinh" className="flex-1" tabIndex={-1}>
        {children}
      </main>
      <Footer />
      <ChatWidget />
      <WhatsAppButton />
    </div>
  );
}
