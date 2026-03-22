import type { Metadata } from 'next';
import { BlogDetailClient } from './_components/blog-detail-client';

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  coverImage?: string;
  author: { id: string; name: string; avatar?: string };
  tags: string[];
  status: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const domain = process.env.NEXT_PUBLIC_DOMAIN || 'localhost';
const baseUrl = domain === 'localhost' ? 'http://localhost:3000' : `https://${domain}`;
const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || 'TBS';

async function getBlogPost(slug: string): Promise<BlogPostData | null> {
  try {
    const res = await fetch(`${apiUrl}/blog-posts/slug/${slug}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getBlogPost(params.slug);

  if (!post) {
    return {
      title: 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u00e0i vi\u1ebft',
    };
  }

  const ogImages = post.coverImage
    ? [{ url: post.coverImage, width: 1200, height: 630, alt: post.title }]
    : [];

  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      url: `${baseUrl}/tin-tuc/${post.slug}`,
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt || post.title,
      images: post.coverImage ? [post.coverImage] : [],
    },
    alternates: {
      canonical: `${baseUrl}/tin-tuc/${post.slug}`,
    },
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const post = await getBlogPost(params.slug);

  const articleSchema = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.title,
        description: post.excerpt || post.title,
        image: post.coverImage
          ? {
              '@type': 'ImageObject',
              url: post.coverImage,
              width: 1200,
              height: 630,
            }
          : undefined,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: {
          '@type': 'Person',
          name: post.author.name,
          image: post.author.avatar,
        },
        publisher: {
          '@type': 'Organization',
          name: companyName,
          logo: {
            '@type': 'ImageObject',
            url: `${baseUrl}/logo.svg`,
            width: 600,
            height: 60,
          },
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': `${baseUrl}/tin-tuc/${params.slug}`,
        },
      }
    : null;

  return (
    <>
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
        />
      )}
      <BlogDetailClient slug={params.slug} />
    </>
  );
}
