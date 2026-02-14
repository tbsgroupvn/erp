import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RelatedService {
  title: string;
  description: string;
  href: string;
}

interface RelatedServicesProps {
  services: RelatedService[];
  title?: string;
}

export function RelatedServices({
  services,
  title = 'Dịch vụ liên quan',
}: RelatedServicesProps) {
  return (
    <section className="py-12 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{service.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {service.description}
                  </p>
                  <Link
                    href={service.href}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all"
                  >
                    Tìm hiểu thêm
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
