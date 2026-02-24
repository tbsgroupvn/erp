import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Suspense } from 'react';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';

interface PageData {
  id: string;
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  metaTitle?: string;
  metaDescription?: string;
  template?: string;
  createdAt: string;
  updatedAt: string;
}

async function getPublicPage(slug: string): Promise<PageData> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const res = await fetch(`${apiUrl}/public/cms/pages/${slug}`, {
    next: { revalidate: 60 } // Revalidate every 60 seconds
  });
  if (!res.ok) {
    throw new Error('Page not found');
  }
  const data = await res.json();
  return data.data;
}

export default async function PublicCMSPage({ params }: { params: { slug: string } }) {
  // Reserved paths that should not be handled by this catch-all route
  const reservedPaths = ['cms', 'dashboard', 'login', 'api', '_next'];
  if (reservedPaths.includes(params.slug)) {
    notFound();
  }

  let page: PageData;

  try {
    page = await getPublicPage(params.slug);
  } catch (error) {
    notFound();
  }

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section with Featured Image */}
      {page.featuredImage && (
        <div className="relative h-[400px] w-full">
          <Image
            src={page.featuredImage}
            alt={page.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white text-center px-4">
              {page.title}
            </h1>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="container mx-auto px-4 py-12">
        <article className="max-w-4xl mx-auto">
          {!page.featuredImage && (
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              {page.title}
            </h1>
          )}

          {page.excerpt && (
            <p className="text-xl text-muted-foreground mb-8">
              {page.excerpt}
            </p>
          )}

          {/* CMS Content - Raw HTML */}
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-heading prose-headings:text-foreground
              prose-p:text-foreground prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-semibold
              prose-ul:text-foreground prose-ol:text-foreground
              prose-img:rounded-lg prose-img:shadow-lg"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
          />

          {/* Metadata */}
          <div className="mt-12 pt-8 border-t text-sm text-muted-foreground">
            <p>Cập nhật lần cuối: {new Date(page.updatedAt).toLocaleDateString('vi-VN')}</p>
          </div>
        </article>
      </div>
    </div>
  );
}

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: { slug: string } }) {
  try {
    const page = await getPublicPage(params.slug);
    return {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.excerpt,
    };
  } catch {
    return {
      title: 'Không tìm thấy trang',
    };
  }
}
