import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function TestimonialsSkeleton() {
  return (
    <div className="w-full">
      {/* Desktop view - 3 cards */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Tablet view - 2 cards */}
      <div className="hidden md:grid lg:hidden md:grid-cols-2 gap-6">
        {[1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      {/* Mobile view - 1 card */}
      <div className="md:hidden">
        <SkeletonCard />
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-2 w-2 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <Card className="h-full">
      <CardContent className="p-6">
        {/* Rating */}
        <div className="flex gap-1 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-5 w-5 rounded-full" />
          ))}
        </div>

        {/* Testimonial Text */}
        <div className="space-y-2 mb-6">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>

        {/* Author Info */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
