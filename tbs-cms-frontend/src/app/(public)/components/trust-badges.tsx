import { Shield, Users, TrendingUp, Clock, Award } from 'lucide-react';

const badges = [
  {
    icon: Award,
    title: '10+ Năm',
    subtitle: 'Kinh Nghiệm',
    color: 'from-blue-500 to-blue-600',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Users,
    title: '3000+',
    subtitle: 'Khách Hàng Tin Tưởng',
    color: 'from-green-500 to-green-600',
    bgColor: 'bg-green-50',
  },
  {
    icon: Shield,
    title: '99%',
    subtitle: 'Hàng Về An Toàn',
    color: 'from-purple-500 to-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    icon: Clock,
    title: 'Hỗ Trợ 24/7',
    subtitle: 'Luôn Sẵn Sàng',
    color: 'from-orange-500 to-orange-600',
    bgColor: 'bg-orange-50',
  },
  {
    icon: Award,
    title: 'Bảo Hiểm 100%',
    subtitle: 'An Tâm Tuyệt Đối',
    color: 'from-red-500 to-red-600',
    bgColor: 'bg-red-50',
  },
];

export function TrustBadges() {
  return (
    <section className="py-12 bg-gradient-to-b from-white to-gray-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
          {badges.map((badge, index) => {
            const Icon = badge.icon;
            return (
              <div
                key={index}
                className={`${badge.bgColor} rounded-xl p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1`}
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br ${badge.color} mb-3`}>
                  <Icon className="h-7 w-7 text-white" aria-hidden="true" />
                </div>
                <div className={`text-2xl font-bold bg-gradient-to-r ${badge.color} bg-clip-text text-transparent mb-1`}>
                  {badge.title}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  {badge.subtitle}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
