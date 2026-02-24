'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, FileText, Package, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

interface SearchResult {
  type: 'service' | 'blog' | 'page';
  title: string;
  description: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

// TODO: Replace with dynamic content from CMS API when available
const searchableContent: SearchResult[] = [
  {
    type: 'service',
    title: 'Vận chuyển hàng hóa',
    description: 'Dịch vụ vận chuyển đường bộ, biển từ Trung Quốc',
    url: '/dich-vu/van-chuyen-hang-hoa',
    icon: Package,
  },
  {
    type: 'service',
    title: 'Mua hàng hộ',
    description: 'Dịch vụ order hàng Trung Quốc giá tốt',
    url: '/dich-vu/mua-hang-ho',
    icon: Package,
  },
  {
    type: 'service',
    title: 'Ủy thác xuất nhập khẩu',
    description: 'Khai báo hải quan, thủ tục pháp lý',
    url: '/dich-vu/uy-thac-xuat-nhap-khau',
    icon: FileText,
  },
  {
    type: 'service',
    title: 'LCL chính ngạch',
    description: 'Vận chuyển hàng lẻ LCL chính ngạch',
    url: '/dich-vu/lcl-chinh-ngach',
    icon: Package,
  },
  {
    type: 'page',
    title: 'Tính phí vận chuyển',
    description: 'Tính toán chi phí vận chuyển hàng hóa',
    url: '/tinh-phi',
    icon: TrendingUp,
  },
  {
    type: 'page',
    title: 'Tra cứu đơn hàng',
    description: 'Theo dõi tình trạng đơn hàng',
    url: '/tra-cuu',
    icon: Search,
  },
  {
    type: 'page',
    title: 'Giới thiệu',
    description: 'Thông tin về TBS Logistics',
    url: '/gioi-thieu',
    icon: FileText,
  },
  {
    type: 'page',
    title: 'Liên hệ',
    description: 'Liên hệ tư vấn dịch vụ',
    url: '/lien-he',
    icon: FileText,
  },
  {
    type: 'blog',
    title: 'Tin tức',
    description: 'Tin tức và bài viết về logistics',
    url: '/tin-tuc',
    icon: FileText,
  },
];

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    const sanitized = q.replace(/<[^>]*>/g, '').trim();
    if (!sanitized) {
      setResults([]);
      return;
    }

    const lowercaseQuery = sanitized.toLowerCase();
    const filtered = searchableContent.filter(
      (item) =>
        item.title.toLowerCase().includes(lowercaseQuery) ||
        item.description.toLowerCase().includes(lowercaseQuery)
    );

    setResults(filtered.slice(0, 6)); // Limit to 6 results
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      search(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, search]);

  // Close search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setQuery('');
    setResults([]);
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Tìm kiếm dịch vụ, bài viết..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            <p className="text-xs text-gray-500 px-3 py-2">
              Tìm thấy {results.length} kết quả
            </p>
            {results.map((result, index) => {
              const Icon = result.icon;
              return (
                <Link
                  key={index}
                  href={result.url}
                  onClick={() => {
                    setIsOpen(false);
                    setQuery('');
                  }}
                  className="flex items-start gap-3 px-3 py-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {result.description}
                    </p>
                    <span className="inline-block mt-1 text-xs text-blue-600 capitalize">
                      {result.type === 'service' && 'Dịch vụ'}
                      {result.type === 'blog' && 'Tin tức'}
                      {result.type === 'page' && 'Trang'}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* No Results */}
      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-8 text-center">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            Không tìm thấy kết quả cho &quot;{query}&quot;
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Thử tìm với từ khóa khác hoặc{' '}
            <Link href="/lien-he" className="text-blue-600 hover:underline">
              liên hệ với chúng tôi
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
