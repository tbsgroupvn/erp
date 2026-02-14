'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Search, Tag, Calendar, User, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBlogPosts, useBlogTags } from '@/lib/hooks/use-blog-posts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';

export default function BlogListingPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | undefined>();

  const breadcrumbItems = [
    { label: 'Tin tuc' }
  ];

  const { data, isLoading } = useBlogPosts({
    page,
    limit: 12,
    search: search || undefined,
    tag: selectedTag,
    status: 'published',
    sortBy: 'publishedAt',
    sortOrder: 'desc',
  });

  const { data: tags } = useBlogTags();

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleTagClick = (tag: string) => {
    setSelectedTag(selectedTag === tag ? undefined : tag);
    setPage(1);
  };

  return (
    <div className="bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <section className="border-b bg-white">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                Tin Tức & Kiến Thức
              </h1>
              <p className="text-lg text-slate-600">
                Cập nhật thông tin mới nhất về vận chuyển, logistics và thương mại Trung Quốc - Việt Nam
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mx-auto mt-8 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                type="text"
                placeholder="Tìm kiếm bài viết..."
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
          </div>

          {/* Tags Filter */}
          {tags && tags.length > 0 && (
            <div className="mx-auto mt-6 max-w-4xl">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  variant={selectedTag === undefined ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleTagClick('')}
                  className="rounded-full"
                >
                  Tất cả
                </Button>
                {tags.map((tag) => (
                  <Button
                    key={tag}
                    variant={selectedTag === tag ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleTagClick(tag)}
                    className="rounded-full"
                  >
                    <Tag className="mr-1 h-3 w-3" aria-hidden="true" />
                    {tag}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Blog Posts Grid */}
      <section className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <Skeleton className="h-48 w-full rounded-t-lg" />
                <CardContent className="p-6">
                  <Skeleton className="mb-2 h-4 w-3/4" />
                  <Skeleton className="mb-4 h-6 w-full" />
                  <Skeleton className="mb-4 h-20 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100">
              <Search className="h-10 w-10 text-slate-400" aria-hidden="true" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              Không tìm thấy bài viết
            </h3>
            <p className="text-slate-600">
              Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {data?.items.map((post) => (
                <Link
                  key={post.id}
                  href={`/tin-tuc/${post.slug}`}
                  className="group"
                >
                  <Card className="h-full overflow-hidden transition-shadow hover:shadow-lg">
                    {post.coverImage && (
                      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                        <Image
                          src={post.coverImage}
                          alt={`Hinh anh minh hoa: ${post.title}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <CardContent className="p-6">
                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {post.tags.slice(0, 2).map((tag) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="text-xs"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Title */}
                      <h3 className="mb-2 line-clamp-2 text-xl font-semibold text-slate-900 group-hover:text-blue-600">
                        {post.title}
                      </h3>

                      {/* Excerpt */}
                      {post.excerpt && (
                        <p className="mb-4 line-clamp-3 text-sm text-slate-600">
                          {post.excerpt}
                        </p>
                      )}

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" aria-hidden="true" />
                          <span>{post.author.name}</span>
                        </div>
                        {post.publishedAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" aria-hidden="true" />
                            <span>
                              {format(new Date(post.publishedAt), 'dd/MM/yyyy', {
                                locale: vi,
                              })}
                            </span>
                          </div>
                        )}
                        {post.viewCount !== undefined && (
                          <div className="flex items-center gap-1">
                            <Eye className="h-3 w-3" aria-hidden="true" />
                            <span>{post.viewCount}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {data && data.totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Trước
                </Button>

                <div className="flex items-center gap-1">
                  {[...Array(data.totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    // Show first, last, current, and adjacent pages
                    if (
                      pageNum === 1 ||
                      pageNum === data.totalPages ||
                      (pageNum >= page - 1 && pageNum <= page + 1)
                    ) {
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                          className="min-w-[2.5rem]"
                        >
                          {pageNum}
                        </Button>
                      );
                    } else if (pageNum === page - 2 || pageNum === page + 2) {
                      return (
                        <span key={pageNum} className="px-2 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page === data.totalPages}
                >
                  Sau
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
