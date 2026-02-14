import { MetadataRoute } from 'next';
import { blogApi } from '@/lib/api/blog';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://nhaphangchinhngach.vn';

  // Static routes with specific priorities and change frequencies
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/gioi-thieu`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/lien-he`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tinh-phi`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/tra-cuu`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/dang-ky`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
  ];

  // Service pages - high priority
  const serviceRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/dich-vu`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dich-vu/van-chuyen-hang-hoa`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dich-vu/mua-hang-ho`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dich-vu/uy-thac-xuat-nhap-khau`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/dich-vu/lcl-chinh-ngach`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ];

  // Legal pages - lower priority
  const legalRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/chinh-sach-bao-mat`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/dieu-khoan-su-dung`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Blog index
  const blogIndexRoute: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/tin-tuc`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Dynamic blog posts
  let blogRoutes: MetadataRoute.Sitemap = [];
  try {
    const blogResponse = await blogApi.list({
      status: 'published',
      limit: 1000, // Get all published posts
    });

    blogRoutes = blogResponse.items.map((post) => ({
      url: `${baseUrl}/tin-tuc/${post.slug}`,
      lastModified: post.publishedAt
        ? new Date(post.publishedAt)
        : new Date(post.createdAt),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
    // Continue without blog posts if API fails
  }

  return [
    ...staticRoutes,
    ...serviceRoutes,
    ...blogIndexRoute,
    ...blogRoutes,
    ...legalRoutes,
  ];
}
