'use client';

import { useEffect } from 'react';

export default function AdminRedirect() {
  useEffect(() => {
    // Redirect to CMS admin on port 3002
    window.location.href = 'http://localhost:3002/admin';
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Đang chuyển hướng...</h1>
        <p className="text-slate-600">CMS Admin đang ở port 3002</p>
      </div>
    </div>
  );
}
