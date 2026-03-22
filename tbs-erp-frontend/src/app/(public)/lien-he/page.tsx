import type { Metadata } from 'next';
import Link from 'next/link';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';
import { ContactForm } from './_components/contact-form';

export const metadata: Metadata = {
  title: 'Li\u00ean h\u1ec7 v\u1edbi ch\u00fang t\u00f4i',
  description:
    'Li\u00ean h\u1ec7 \u0111\u1ec3 \u0111\u01b0\u1ee3c t\u01b0 v\u1ea5n v\u00e0 h\u1ed7 tr\u1ee3 v\u1ec1 d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n, mua h\u00e0ng h\u1ed9, \u1ee7y th\u00e1c xu\u1ea5t nh\u1eadp kh\u1ea9u t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam.',
  openGraph: {
    title: 'Li\u00ean h\u1ec7 v\u1edbi ch\u00fang t\u00f4i',
    description:
      'Li\u00ean h\u1ec7 \u0111\u1ec3 \u0111\u01b0\u1ee3c t\u01b0 v\u1ea5n v\u00e0 h\u1ed7 tr\u1ee3 v\u1ec1 d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n, mua h\u00e0ng h\u1ed9, \u1ee7y th\u00e1c xu\u1ea5t nh\u1eadp kh\u1ea9u t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam.',
  },
};

const contactInfo = [
  {
    icon: Phone,
    title: '\u0110i\u1ec7n tho\u1ea1i',
    content: process.env.NEXT_PUBLIC_COMPANY_PHONE || '0123 456 789',
    subContent: 'Hotline 24/7',
  },
  {
    icon: Mail,
    title: 'Email',
    content: process.env.NEXT_PUBLIC_COMPANY_EMAIL || '',
    subContent: process.env.NEXT_PUBLIC_COMPANY_SUPPORT_EMAIL || '',
  },
  {
    icon: MapPin,
    title: '\u0110\u1ecba ch\u1ec9',
    content: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '\u0110ang c\u1eadp nh\u1eadt',
    subContent: '',
  },
  {
    icon: Clock,
    title: 'Gi\u1edd l\u00e0m vi\u1ec7c',
    content: 'Th\u1ee9 2 - Th\u1ee9 6: 8:00 - 18:00',
    subContent: 'Th\u1ee9 7: 8:00 - 12:00',
  },
];

function GoogleMap() {
  const lat = process.env.NEXT_PUBLIC_LATITUDE || '21.028511';
  const lng = process.env.NEXT_PUBLIC_LONGITUDE || '105.804817';

  return (
    <div className="h-96 w-full rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      <iframe
        title="V\u1ecb tr\u00ed c\u00f4ng ty"
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(lng) - 0.01}%2C${Number(lat) - 0.005}%2C${Number(lng) + 0.01}%2C${Number(lat) + 0.005}&layer=mapnik&marker=${lat}%2C${lng}`}
      />
    </div>
  );
}

export default function ContactPage() {
  const breadcrumbItems = [{ label: 'Lien he' }];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <Breadcrumbs items={breadcrumbItems} />
            </div>
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Li\u00ean h\u1ec7 v\u1edbi ch\u00fang t\u00f4i</h1>
              <p className="text-lg text-muted-foreground">
                H\u00e3y \u0111\u1ec3 l\u1ea1i th\u00f4ng tin, ch\u00fang t\u00f4i s\u1ebd li\u00ean h\u1ec7 v\u1edbi b\u1ea1n trong th\u1eddi gian s\u1edbm nh\u1ea5t \u0111\u1ec3 t\u01b0
                v\u1ea5n v\u00e0 h\u1ed7 tr\u1ee3.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
              {contactInfo.map((info, index) => {
                const Icon = info.icon;
                return (
                  <Card key={index}>
                    <CardHeader>
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                        <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
                      </div>
                      <CardTitle className="text-lg">{info.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-semibold mb-1">{info.content}</p>
                      <p className="text-sm text-muted-foreground">{info.subContent}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Contact Form + Additional Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Form (Client Component) */}
              <ContactForm />

              {/* Additional Info (static, server-rendered) */}
              <div className="space-y-8">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <CardTitle>T\u1ea1i sao ch\u1ecdn TBS Logistics?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">{'\u2713'}</span>
                        </div>
                        <div>
                          <p className="font-semibold">H\u01a1n 10 n\u0103m kinh nghi\u1ec7m</p>
                          <p className="text-sm text-muted-foreground">
                            \u0110\u1ed9i ng\u0169 chuy\u00ean gia gi\u00e0u kinh nghi\u1ec7m
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">{'\u2713'}</span>
                        </div>
                        <div>
                          <p className="font-semibold">Gi\u00e1 c\u1ea3 c\u1ea1nh tranh</p>
                          <p className="text-sm text-muted-foreground">
                            Chi ph\u00ed t\u1ed1i \u01b0u, minh b\u1ea1ch
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">{'\u2713'}</span>
                        </div>
                        <div>
                          <p className="font-semibold">H\u1ed7 tr\u1ee3 24/7</p>
                          <p className="text-sm text-muted-foreground">
                            Lu\u00f4n s\u1eb5n s\u00e0ng h\u1ed7 tr\u1ee3 b\u1ea1n
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">{'\u2713'}</span>
                        </div>
                        <div>
                          <p className="font-semibold">\u0110\u1ea3m b\u1ea3o an to\u00e0n</p>
                          <p className="text-sm text-muted-foreground">
                            B\u1ea3o hi\u1ec3m h\u00e0ng h\u00f3a to\u00e0n di\u1ec7n
                          </p>
                        </div>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Th\u00f4ng tin li\u00ean h\u1ec7 nhanh</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Zalo</p>
                      <p className="font-semibold">{process.env.NEXT_PUBLIC_COMPANY_PHONE || '0123 456 789'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">WhatsApp</p>
                      <p className="font-semibold">{process.env.NEXT_PUBLIC_COMPANY_PHONE || '0123 456 789'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">WeChat</p>
                      <p className="font-semibold">{process.env.NEXT_PUBLIC_COMPANY_WECHAT || 'tbslogistics'}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>C\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      B\u1ea1n c\u00f3 th\u1eafc m\u1eafc? Xem c\u00e1c c\u00e2u h\u1ecfi th\u01b0\u1eddng g\u1eb7p ho\u1eb7c li\u00ean h\u1ec7 tr\u1ef1c ti\u1ebfp v\u1edbi
                      ch\u00fang t\u00f4i \u0111\u1ec3 \u0111\u01b0\u1ee3c h\u1ed7 tr\u1ee3 nhanh nh\u1ea5t.
                    </p>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/hoi-dap">Xem FAQ</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">V\u1ecb tr\u00ed c\u1ee7a ch\u00fang t\u00f4i</h2>
            <GoogleMap />
          </div>
        </div>
      </section>
    </div>
  );
}
