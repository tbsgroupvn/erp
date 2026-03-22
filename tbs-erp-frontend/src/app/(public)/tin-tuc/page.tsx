import type { Metadata } from 'next';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';
import { BlogListingClient } from './_components/blog-listing-client';

export const metadata: Metadata = {
  title: 'Tin T\u1ee9c & Ki\u1ebfn Th\u1ee9c',
  description:
    'C\u1eadp nh\u1eadt th\u00f4ng tin m\u1edbi nh\u1ea5t v\u1ec1 v\u1eadn chuy\u1ec3n, logistics v\u00e0 th\u01b0\u01a1ng m\u1ea1i Trung Qu\u1ed1c - Vi\u1ec7t Nam',
  openGraph: {
    title: 'Tin T\u1ee9c & Ki\u1ebfn Th\u1ee9c',
    description:
      'C\u1eadp nh\u1eadt th\u00f4ng tin m\u1edbi nh\u1ea5t v\u1ec1 v\u1eadn chuy\u1ec3n, logistics v\u00e0 th\u01b0\u01a1ng m\u1ea1i Trung Qu\u1ed1c - Vi\u1ec7t Nam',
  },
};

export default function BlogListingPage() {
  const breadcrumbItems = [{ label: 'Tin tuc' }];

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      {/* Static hero heading rendered on server for SEO */}
      <section className="border-b bg-white">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Tin T\u1ee9c & Ki\u1ebfn Th\u1ee9c
              </h1>
              <p className="text-lg text-slate-600">
                C\u1eadp nh\u1eadt th\u00f4ng tin m\u1edbi nh\u1ea5t v\u1ec1 v\u1eadn chuy\u1ec3n, logistics v\u00e0 th\u01b0\u01a1ng m\u1ea1i Trung Qu\u1ed1c - Vi\u1ec7t Nam
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Client-side interactive: search, tag filter, post grid, pagination */}
      <BlogListingClient />
    </div>
  );
}
