import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Navbar from './components/navbar';
import Footer from './components/footer';
import { ChatWidget } from './components/chat-widget';
import { WhatsAppButton } from './components/whatsapp-button';
import { ServiceWorkerRegistration } from '@/components/shared/sw-registration';


const inter = Inter({ subsets: ['latin', 'vietnamese'] });

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'My ERP';
const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || 'ERP System';
const appDescription = process.env.NEXT_PUBLIC_APP_DESCRIPTION || 'Enterprise Resource Planning System';
const domain = process.env.NEXT_PUBLIC_DOMAIN || 'localhost';
const baseUrl = domain === 'localhost' ? 'http://localhost:3000' : `https://${domain}`;
const twitterHandle = process.env.NEXT_PUBLIC_TWITTER_HANDLE || '';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: `${appTitle} - ${appDescription}`,
    template: `%s | ${appTitle}`,
  },
  description: appDescription,
  keywords: [
    appTitle,
    companyName,
    'logistics',
    'ERP',
  ],
  authors: [{ name: companyName }],
  creator: companyName,
  publisher: companyName,
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    type: 'website',
    locale: 'vi_VN',
    url: baseUrl,
    title: `${appTitle} - ${appDescription}`,
    description: appDescription,
    siteName: appTitle,
    images: [
      {
        url: '/og-image.svg',
        width: 1200,
        height: 630,
        alt: appTitle,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${appTitle} - ${appDescription}`,
    description: appDescription,
    images: ['/twitter-image.svg'],
    ...(twitterHandle ? { creator: twitterHandle } : {}),
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
  children: ReactNode;
}) {
  const supportPhone = process.env.NEXT_PUBLIC_COMPANY_PHONE || '';
  const supportEmail = process.env.NEXT_PUBLIC_COMPANY_EMAIL || '';
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '';
  const facebookUrl = process.env.NEXT_PUBLIC_FACEBOOK_URL || '';
  const linkedinUrl = process.env.NEXT_PUBLIC_LINKEDIN_URL || '';
  const zaloUrl = process.env.NEXT_PUBLIC_ZALO_URL || '';
  const lat = parseFloat(process.env.NEXT_PUBLIC_LATITUDE || '0');
  const lng = parseFloat(process.env.NEXT_PUBLIC_LONGITUDE || '0');
  const locality = process.env.NEXT_PUBLIC_ADDRESS_LOCALITY || '';
  const region = process.env.NEXT_PUBLIC_ADDRESS_REGION || '';

  const sameAs = [facebookUrl, linkedinUrl, zaloUrl].filter(Boolean);

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: companyName,
    description: appDescription,
    url: baseUrl,
    logo: `${baseUrl}/logo.svg`,
    ...(supportPhone ? {
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: supportPhone,
        contactType: 'Customer Service',
        areaServed: 'VN',
        availableLanguage: ['vi', 'zh'],
      },
    } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
    ...(locality ? {
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'VN',
        addressLocality: locality,
      },
    } : {}),
  };

  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': baseUrl,
    name: companyName,
    image: `${baseUrl}/logo.svg`,
    ...(supportPhone ? { telephone: supportPhone } : {}),
    ...(supportEmail ? { email: supportEmail } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(companyAddress ? { streetAddress: companyAddress } : {}),
      ...(locality ? { addressLocality: locality } : {}),
      ...(region ? { addressRegion: region } : {}),
      postalCode: '100000',
      addressCountry: 'VN',
    },
    ...(lat && lng ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lng,
      },
    } : {}),
    url: baseUrl,
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
    ...(sameAs.length > 0 ? { sameAs } : {}),
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
