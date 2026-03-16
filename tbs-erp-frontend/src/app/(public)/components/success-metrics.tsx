'use client';

import { useEffect, useRef, useState, type ElementType } from 'react';
import { Calendar, TrendingUp, Users, Heart, Package } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

interface Metric {
  icon: ElementType;
  label: string;
  value: number;
  suffix: string;
  duration: number;
}

// Fallback values shown while the API is loading or if it fails
const FALLBACK_METRICS: Metric[] = [
  {
    icon: Calendar,
    label: 'Năm kinh nghiệm',
    value: 10,
    suffix: '+',
    duration: 2000,
  },
  {
    icon: Package,
    label: 'Tổng đơn hàng',
    value: 50000,
    suffix: '+',
    duration: 2500,
  },
  {
    icon: Users,
    label: 'Khách hàng hoạt động',
    value: 3000,
    suffix: '+',
    duration: 2000,
  },
  {
    icon: TrendingUp,
    label: 'Đơn hàng mỗi tháng',
    value: 5000,
    suffix: '+',
    duration: 2000,
  },
  {
    icon: Heart,
    label: 'Độ hài lòng',
    value: 99,
    suffix: '%',
    duration: 2000,
  },
];

/**
 * Build metrics array from API stats, falling back to defaults for
 * values that cannot be derived from the backend (e.g. satisfaction %).
 */
function buildMetrics(stats: {
  yearsOfOperation: number;
  totalCompletedOrders: number;
  totalCustomers: number;
}): Metric[] {
  return [
    {
      icon: Calendar,
      label: 'Năm kinh nghiệm',
      value: stats.yearsOfOperation,
      suffix: '+',
      duration: 2000,
    },
    {
      icon: Package,
      label: 'Tổng đơn hàng',
      value: stats.totalCompletedOrders,
      suffix: '+',
      duration: 2500,
    },
    {
      icon: Users,
      label: 'Khách hàng hoạt động',
      value: stats.totalCustomers,
      suffix: '+',
      duration: 2000,
    },
    {
      // Not available from API - keep hardcoded fallback
      icon: TrendingUp,
      label: 'Đơn hàng mỗi tháng',
      value: 5000,
      suffix: '+',
      duration: 2000,
    },
    {
      // Not available from API - keep hardcoded fallback
      icon: Heart,
      label: 'Độ hài lòng',
      value: 99,
      suffix: '%',
      duration: 2000,
    },
  ];
}

function useCountUp(end: number, duration: number, shouldStart: boolean) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shouldStart) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration, shouldStart]);

  return count;
}

function MetricCard({ metric, shouldAnimate }: { metric: Metric; shouldAnimate: boolean }) {
  const Icon = metric.icon;
  const count = useCountUp(metric.value, metric.duration, shouldAnimate);

  const formatNumber = (num: number) => {
    return num.toLocaleString('vi-VN');
  };

  return (
    <div className="text-center">
      <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-8 w-8 text-primary" aria-hidden="true" />
      </div>
      <div className="mb-2 text-4xl font-bold text-gray-900">
        {formatNumber(count)}
        {count === metric.value && metric.suffix}
      </div>
      <div className="text-gray-600">{metric.label}</div>
    </div>
  );
}

export function SuccessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>(FALLBACK_METRICS);
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Fetch real stats from the public API
  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const res = await fetch(`${API_BASE_URL}/public/stats`);
        if (!res.ok) return;
        const json = await res.json();
        const stats = json.data;
        if (!cancelled && stats) {
          setMetrics(buildMetrics(stats));
        }
      } catch {
        // Keep fallback values on error
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !shouldAnimate) {
            setShouldAnimate(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    const currentRef = sectionRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [shouldAnimate]);

  return (
    <section ref={sectionRef} className="bg-gradient-to-br from-primary/5 via-white to-primary/5 px-4 py-16 md:py-24">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-gray-900 md:text-4xl">
            Con số ấn tượng
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">
            Được tin tưởng bởi hàng nghìn khách hàng trên toàn quốc
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 lg:grid-cols-5">
          {metrics.map((metric, index) => (
            <MetricCard
              key={index}
              metric={metric}
              shouldAnimate={shouldAnimate}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
