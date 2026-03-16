'use client';

import { useState } from 'react';
import { BookOpen, Clock, TrendingUp } from 'lucide-react';
import { useWikiSpaces } from '@/lib/hooks/use-wiki';
import { SpaceList } from '@/features/wiki/space-list';
import { WikiSearch } from '@/features/wiki/wiki-search';

export default function WikiPage() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-screen-xl mx-auto">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Wiki</h1>
        </div>
        <p className="text-sm text-gray-500">
          Knowledge base nội bộ — tài liệu quy trình, hướng dẫn và kiến thức chia sẻ
        </p>
      </div>

      {/* Search bar */}
      <WikiSearch
        placeholder="Tìm kiếm tài liệu, quy trình, hướng dẫn..."
        className="max-w-xl"
      />

      {/* Spaces grid */}
      <SpaceList />
    </div>
  );
}
