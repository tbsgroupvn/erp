'use client';

import { useState, useEffect } from 'react';
import { Clock, Gift, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface UrgencyBannerProps {
  type?: 'discount' | 'limited-slots' | 'countdown' | 'social-proof';
  className?: string;
}

export function UrgencyBanner({ type = 'discount', className }: UrgencyBannerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 59,
    seconds: 59,
  });

  useEffect(() => {
    if (type === 'countdown') {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev.seconds > 0) {
            return { ...prev, seconds: prev.seconds - 1 };
          } else if (prev.minutes > 0) {
            return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
          } else if (prev.hours > 0) {
            return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
          }
          return prev;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [type]);

  const bannerContent = {
    discount: {
      icon: Gift,
      text: 'Đặt hàng hôm nay, nhận ưu đãi 10% phí vận chuyển',
      badge: 'HOT',
      color: 'bg-gradient-to-r from-orange-500 to-red-500',
    },
    'limited-slots': {
      icon: Users,
      text: 'Chỉ còn 5 suất tư vấn miễn phí hôm nay',
      badge: 'GIỚI HẠN',
      color: 'bg-gradient-to-r from-blue-500 to-purple-500',
    },
    countdown: {
      icon: Clock,
      text: 'Ưu đãi đặc biệt kết thúc trong:',
      badge: 'NHANH TAY',
      color: 'bg-gradient-to-r from-red-500 to-pink-500',
    },
    'social-proof': {
      icon: TrendingUp,
      text: '127 khách hàng đã đặt hàng trong 24h qua',
      badge: 'PHỔ BIẾN',
      color: 'bg-gradient-to-r from-green-500 to-teal-500',
    },
  };

  const content = bannerContent[type];
  const Icon = content.icon;

  return (
    <div
      className={cn(
        'relative overflow-hidden py-3 px-4 text-white',
        content.color,
        className
      )}
    >
      <div className="container mx-auto max-w-7xl">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 animate-pulse" />
            <span className="font-semibold">{content.text}</span>
          </div>

          {type === 'countdown' && (
            <div className="flex items-center gap-2">
              <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 min-w-[40px] text-center">
                <span className="font-bold text-lg">
                  {String(timeLeft.hours).padStart(2, '0')}
                </span>
              </div>
              <span className="font-bold">:</span>
              <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 min-w-[40px] text-center">
                <span className="font-bold text-lg">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </span>
              </div>
              <span className="font-bold">:</span>
              <div className="bg-white/20 backdrop-blur-sm rounded px-2 py-1 min-w-[40px] text-center">
                <span className="font-bold text-lg">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </span>
              </div>
            </div>
          )}

          <Badge
            variant="secondary"
            className="bg-white text-gray-900 hover:bg-white font-bold"
          >
            {content.badge}
          </Badge>
        </div>
      </div>

      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-shimmer" />
      </div>
    </div>
  );
}

// Service page urgency component
export function ServiceUrgency() {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-6 my-8">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
          <Clock className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-amber-900 mb-2">
            Ưu đãi đặc biệt trong tháng này
          </h3>
          <p className="text-amber-800 mb-4">
            Đăng ký ngay hôm nay để nhận các ưu đãi:
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-amber-800">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              Giảm 10% phí vận chuyển cho đơn hàng đầu tiên
            </li>
            <li className="flex items-center gap-2 text-amber-800">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              Miễn phí tư vấn và báo giá chi tiết
            </li>
            <li className="flex items-center gap-2 text-amber-800">
              <div className="w-2 h-2 bg-amber-500 rounded-full" />
              Ưu tiên xử lý và giao hàng nhanh
            </li>
          </ul>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-900">
            <Clock className="h-4 w-4" />
            Ưu đãi có thời hạn - Đăng ký ngay!
          </div>
        </div>
      </div>
    </div>
  );
}
