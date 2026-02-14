import { Truck, Package, Ship, Plane } from 'lucide-react';

const partners = [
  { name: 'China Post', icon: Package },
  { name: 'DHL Express', icon: Plane },
  { name: 'FedEx', icon: Plane },
  { name: 'SF Express', icon: Truck },
  { name: 'YTO Express', icon: Truck },
  { name: 'ZTO Express', icon: Truck },
  { name: 'Viettel Post', icon: Package },
  { name: 'GHTK', icon: Truck },
];

export function PartnerLogos() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">
            Đối Tác Vận Chuyển
          </h2>
          <p className="text-lg text-gray-600">
            Hợp tác với các đơn vị vận chuyển uy tín hàng đầu
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {partners.map((partner, index) => {
            const Icon = partner.icon;
            return (
              <div
                key={index}
                className="group flex flex-col items-center justify-center p-6 bg-gray-50 rounded-lg hover:bg-white hover:shadow-lg transition-all border border-gray-100"
              >
                <div className="w-16 h-16 flex items-center justify-center mb-3 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                  <Icon className="h-8 w-8 text-gray-400 group-hover:text-primary transition-colors" aria-hidden="true" />
                </div>
                <span className="text-sm font-semibold text-gray-700 group-hover:text-primary transition-colors text-center">
                  {partner.name}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
            Và nhiều đối tác khác trên toàn Trung Quốc và Việt Nam
          </p>
        </div>
      </div>
    </section>
  );
}
