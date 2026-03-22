'use client';

import { useRouter } from 'next/navigation';
import { ShieldX } from 'lucide-react';

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          403
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Bạn không có quyền truy cập trang này
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là lỗi.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Quay lại
          </button>
          <button
            onClick={() => router.push('/tong-quan')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    </div>
  );
}
