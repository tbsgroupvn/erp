'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  Calendar,
  Eye,
  Tag,
  Share2,
  Facebook,
  Twitter,
  Linkedin,
  Link as LinkIcon,
  ArrowLeft,
} from 'lucide-react';
import { useBlogPostBySlug, useIncrementBlogView } from '@/lib/hooks/use-blog-posts';
import { sanitizeHtml } from '@/lib/utils/sanitize-html';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';

export function BlogDetailClient({ slug }: { slug: string }) {
  const router = useRouter();

  const { data: post, isLoading, error } = useBlogPostBySlug(slug);
  const incrementView = useIncrementBlogView();

  useEffect(() => {
    if (post) {
      incrementView.mutate(slug);
    }
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = post?.title || '';

  const handleShare = (platform: string) => {
    let url = '';
    switch (platform) {
      case 'facebook':
        url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
        break;
      case 'twitter':
        url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareTitle)}`;
        break;
      case 'linkedin':
        url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        toast.success('\u0110\u00e3 sao ch\u00e9p li\u00ean k\u1ebft');
        return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 h-8 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mb-4 h-12 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="mb-8 h-6 w-1/2 animate-pulse rounded bg-slate-200" />
          <div className="mb-8 h-96 w-full animate-pulse rounded bg-slate-200" />
          <div className="space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="container mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-slate-900">
            Kh\u00f4ng t\u00ecm th\u1ea5y b\u00e0i vi\u1ebft
          </h1>
          <p className="mb-8 text-lg text-slate-600">
            B\u00e0i vi\u1ebft b\u1ea1n \u0111ang t\u00ecm ki\u1ebfm kh\u00f4ng t\u1ed3n t\u1ea1i ho\u1eb7c \u0111\u00e3 b\u1ecb x\u00f3a.
          </p>
          <Button onClick={() => router.push('/tin-tuc')}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Quay l\u1ea1i danh s\u00e1ch tin t\u1ee9c
          </Button>
        </div>
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Tin t\u1ee9c', href: '/tin-tuc' },
    { label: post.title }
  ];

  return (
    <article className="bg-white">
      {/* Header */}
      <div className="border-b bg-slate-50">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-4">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <Link
              href="/tin-tuc"
              className="mb-6 inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Quay l\u1ea1i danh s\u00e1ch tin t\u1ee9c
            </Link>

            {post.tags.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {post.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <h1 className="mb-6 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={post.author.avatar} alt={post.author.name} />
                  <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-slate-900">{post.author.name}</div>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1 text-xs">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      <span>
                        {format(new Date(post.publishedAt), 'dd MMMM yyyy', {
                          locale: vi,
                        })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {post.viewCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>{post.viewCount} l\u01b0\u1ee3t xem</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {post.coverImage && (
        <div className="border-b">
          <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl">
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-100">
                <Image
                  src={post.coverImage}
                  alt={`Hinh anh minh hoa: ${post.title}`}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1200px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
            <div>
              {post.excerpt && (
                <div className="mb-8 rounded-lg border-l-4 border-blue-500 bg-blue-50 p-6">
                  <p className="text-lg font-medium leading-relaxed text-slate-700">
                    {post.excerpt}
                  </p>
                </div>
              )}

              <div
                className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-p:text-slate-700 prose-p:leading-relaxed prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-strong:font-semibold prose-strong:text-slate-900 prose-img:rounded-lg prose-img:shadow-md"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }}
              />
            </div>

            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
                    <Share2 className="h-5 w-5" aria-hidden="true" />
                    Chia s\u1ebb b\u00e0i vi\u1ebft
                  </h3>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleShare('facebook')}
                    >
                      <Facebook className="mr-2 h-4 w-4 text-blue-600" aria-hidden="true" />
                      Facebook
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleShare('twitter')}
                    >
                      <Twitter className="mr-2 h-4 w-4 text-sky-500" aria-hidden="true" />
                      Twitter
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleShare('linkedin')}
                    >
                      <Linkedin className="mr-2 h-4 w-4 text-blue-700" aria-hidden="true" />
                      LinkedIn
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleShare('copy')}
                    >
                      <LinkIcon className="mr-2 h-4 w-4" aria-hidden="true" />
                      Sao ch\u00e9p li\u00ean k\u1ebft
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <h3 className="mb-4 font-semibold text-slate-900">
                    V\u1ec1 t\u00e1c gi\u1ea3
                  </h3>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={post.author.avatar} alt={post.author.name} />
                      <AvatarFallback>{post.author.name[0]}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-slate-900">
                        {post.author.name}
                      </div>
                      <div className="text-sm text-slate-600">T\u00e1c gi\u1ea3</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <Separator className="my-12" />

          <div className="text-center">
            <Button onClick={() => router.push('/tin-tuc')} size="lg">
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Xem th\u00eam b\u00e0i vi\u1ebft kh\u00e1c
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
