import { Newspaper, Radio, Tv, Globe } from 'lucide-react';

const mediaOutlets = [
  {
    name: 'VnExpress',
    icon: Globe,
    description: 'Báo điện tử hàng đầu Việt Nam',
  },
  {
    name: 'Vietnam Logistics Review',
    icon: Newspaper,
    description: 'Tạp chí chuyên ngành Logistics',
  },
  {
    name: 'Báo Đầu Tư',
    icon: Newspaper,
    description: 'Tin tức kinh tế và đầu tư',
  },
  {
    name: 'Thương Mại Điện Tử',
    icon: Globe,
    description: 'Chuyên trang thương mại',
  },
  {
    name: 'VOV Giao Thông',
    icon: Radio,
    description: 'Đài Tiếng nói Việt Nam',
  },
  {
    name: 'VTV1 - Thời sự',
    icon: Tv,
    description: 'Đài Truyền hình Việt Nam',
  },
];

export function MediaMentions() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Được Nhắc Đến Trên
            </h2>
            <p className="text-lg text-muted-foreground">
              TBS Logistics được các báo chí và truyền thông uy tín đưa tin
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            {mediaOutlets.map((outlet, index) => {
              const Icon = outlet.icon;
              return (
                <div
                  key={index}
                  className="group flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg hover:bg-white hover:shadow-lg transition-all border border-gray-100"
                >
                  <div className="w-14 h-14 flex items-center justify-center mb-3 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                    <Icon className="h-7 w-7 text-gray-400 group-hover:text-primary transition-colors" aria-hidden="true" />
                  </div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors text-center mb-1">
                    {outlet.name}
                  </h3>
                  <p className="text-xs text-gray-500 text-center">
                    {outlet.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 italic">
              Và nhiều phương tiện truyền thông khác
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
