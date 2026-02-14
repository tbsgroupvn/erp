import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function PricingCalculatorSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Input Form Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin hàng hóa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>

      {/* Result Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>Báo giá ước tính</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-48" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
