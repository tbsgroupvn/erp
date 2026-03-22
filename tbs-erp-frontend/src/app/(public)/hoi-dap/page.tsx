import type { Metadata } from 'next';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';
import { FAQAccordion } from './_components/faq-accordion';

export const metadata: Metadata = {
  title: 'C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p',
  description:
    'T\u00ecm c\u00e2u tr\u1ea3 l\u1eddi cho c\u00e1c th\u1eafc m\u1eafc ph\u1ed5 bi\u1ebfn v\u1ec1 d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n, mua h\u00e0ng h\u1ed9, h\u1ea3i quan, b\u1ea3o hi\u1ec3m v\u00e0 giao nh\u1eadn h\u00e0ng h\u00f3a t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam.',
  openGraph: {
    title: 'C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p',
    description:
      'T\u00ecm c\u00e2u tr\u1ea3 l\u1eddi cho c\u00e1c th\u1eafc m\u1eafc ph\u1ed5 bi\u1ebfn v\u1ec1 d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n, mua h\u00e0ng h\u1ed9, h\u1ea3i quan, b\u1ea3o hi\u1ec3m v\u00e0 giao nh\u1eadn h\u00e0ng h\u00f3a.',
  },
};

// FAQ structured data for SEO (static hardcoded FAQs for crawlers)
const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'TBS Logistics cung c\u1ea5p nh\u1eefng d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n n\u00e0o?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ch\u00fang t\u00f4i cung c\u1ea5p \u0111\u1ea7y \u0111\u1ee7 c\u00e1c d\u1ecbch v\u1ee5: V\u1eadn chuy\u1ec3n thu\u1ea7n (VCT), Mua h\u00e0ng h\u1ed9 (MHH), \u1ee6y th\u00e1c xu\u1ea5t nh\u1eadp kh\u1ea9u (UTXNK), v\u00e0 LCL ch\u00ednh ng\u1ea1ch.',
      },
    },
    {
      '@type': 'Question',
      name: 'Th\u1eddi gian v\u1eadn chuy\u1ec3n t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam m\u1ea5t bao l\u00e2u?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '\u0110\u01b0\u1eddng h\u00e0ng kh\u00f4ng 3-5 ng\u00e0y, \u0111\u01b0\u1eddng b\u1ed9 5-7 ng\u00e0y, \u0111\u01b0\u1eddng bi\u1ec3n 15-25 ng\u00e0y.',
      },
    },
    {
      '@type': 'Question',
      name: 'Chi ph\u00ed v\u1eadn chuy\u1ec3n \u0111\u01b0\u1ee3c t\u00ednh nh\u01b0 th\u1ebf n\u00e0o?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Chi ph\u00ed bao g\u1ed3m ph\u00ed v\u1eadn chuy\u1ec3n (t\u00ednh theo kg ho\u1eb7c CBM), ph\u00ed d\u1ecbch v\u1ee5, ph\u00ed h\u1ea3i quan. T\u00ednh theo tr\u1ecdng l\u01b0\u1ee3ng l\u1edbn h\u01a1n gi\u1eefa th\u1ef1c t\u1ebf v\u00e0 quy \u0111\u1ed5i.',
      },
    },
    {
      '@type': 'Question',
      name: 'Ph\u00ed mua h\u00e0ng h\u1ed9 l\u00e0 bao nhi\u00eau?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Ph\u00ed mua h\u00e0ng h\u1ed9 th\u01b0\u1eddng t\u1eeb 3-5% gi\u00e1 tr\u1ecb \u0111\u01a1n h\u00e0ng, t\u00f9y thu\u1ed9c v\u00e0o \u0111\u1ed9 ph\u1ee9c t\u1ea1p v\u00e0 gi\u00e1 tr\u1ecb.',
      },
    },
    {
      '@type': 'Question',
      name: 'H\u00e0ng h\u00f3a c\u00f3 \u0111\u01b0\u1ee3c b\u1ea3o hi\u1ec3m kh\u00f4ng?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'C\u00f3, b\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n cho t\u1ea5t c\u1ea3 l\u00f4 h\u00e0ng. C\u00f3 th\u1ec3 mua th\u00eam b\u1ea3o hi\u1ec3m to\u00e0n di\u1ec7n, ph\u00ed 0.3-1% gi\u00e1 tr\u1ecb h\u00e0ng.',
      },
    },
  ],
};

export default function FAQPage() {
  const breadcrumbItems = [{ label: 'H\u1ecfi \u0111\u00e1p' }];

  return (
    <div className="min-h-screen">
      {/* FAQ structured data for search engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />

      {/* Hero Section - static content rendered on server */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                T\u00ecm c\u00e2u tr\u1ea3 l\u1eddi cho c\u00e1c th\u1eafc m\u1eafc ph\u1ed5 bi\u1ebfn v\u1ec1 d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n c\u1ee7a
                ch\u00fang t\u00f4i
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Client-side: search box, accordion content, contact CTA */}
      <FAQAccordion />
    </div>
  );
}
