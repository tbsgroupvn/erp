'use client';

import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { Breadcrumbs } from '@/app/(public)/components/breadcrumbs';

const contactFormSchema = z.object({
  fullName: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(100, 'Họ tên tối đa 100 ký tự')
    .transform((v) => v.trim().replace(/<[^>]*>/g, '')),
  phone: z
    .string()
    .min(10, 'Số điện thoại phải có ít nhất 10 số')
    .max(15, 'Số điện thoại tối đa 15 ký tự')
    .regex(/^[0-9+\-\s()]+$/, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').max(255, 'Email tối đa 255 ký tự'),
  company: z.string().max(200, 'Tên công ty tối đa 200 ký tự').optional()
    .transform((v) => v?.trim().replace(/<[^>]*>/g, '')),
  service: z.string().min(1, 'Vui lòng chọn dịch vụ'),
  message: z.string().min(10, 'Nội dung phải có ít nhất 10 ký tự').max(2000, 'Nội dung tối đa 2000 ký tự')
    .transform((v) => v.trim().replace(/<[^>]*>/g, '')),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const services = [
  { value: 'van-chuyen', label: 'Vận chuyển hàng hóa' },
  { value: 'mua-hang', label: 'Mua hàng hộ' },
  { value: 'uy-thac-xnk', label: 'Ủy thác xuất nhập khẩu' },
  { value: 'lcl-chinh-ngach', label: 'LCL chính ngạch' },
  { value: 'tu-van', label: 'Tư vấn chung' },
];

const contactInfo = [
  {
    icon: Phone,
    title: 'Điện thoại',
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
    title: 'Địa chỉ',
    content: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Đang cập nhật',
    subContent: '',
  },
  {
    icon: Clock,
    title: 'Giờ làm việc',
    content: 'Thứ 2 - Thứ 6: 8:00 - 18:00',
    subContent: 'Thứ 7: 8:00 - 12:00',
  },
];

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const breadcrumbItems = [
    { label: 'Lien he' }
  ];

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      company: '',
      service: '',
      message: '',
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      // Read CSRF token from cookie for cross-site request protection
      const csrfToken = document.cookie
        .split('; ')
        .find((row) => row.startsWith('XSRF-TOKEN='))
        ?.split('=')[1];
      const response = await fetch(`${apiUrl}/public/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-XSRF-TOKEN': decodeURIComponent(csrfToken) } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Không thể gửi yêu cầu. Vui lòng thử lại sau.');
      }

      toast.success('Gửi thành công!', {
        description: 'Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.',
      });

      reset();
    } catch (error) {
      toast.error('Có lỗi xảy ra!', {
        description:
          error instanceof Error
            ? error.message
            : 'Không thể gửi yêu cầu. Vui lòng thử lại sau.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h1 className="text-4xl md:text-5xl font-bold mb-6">Liên hệ với chúng tôi</h1>
              <p className="text-lg text-muted-foreground">
                Hãy để lại thông tin, chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất để tư
                vấn và hỗ trợ.
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

            {/* Contact Form */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Form */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-2xl">Gửi yêu cầu</CardTitle>
                  <p className="text-muted-foreground">
                    Điền thông tin vào form dưới đây để gửi yêu cầu tư vấn
                  </p>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">
                        Họ và tên <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        placeholder="Nguyễn Văn A"
                        {...register('fullName')}
                        className={errors.fullName ? 'border-destructive' : ''}
                      />
                      {errors.fullName && (
                        <p className="text-sm text-destructive">{errors.fullName.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">
                        Số điện thoại <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="0912345678"
                        {...register('phone')}
                        className={errors.phone ? 'border-destructive' : ''}
                      />
                      {errors.phone && (
                        <p className="text-sm text-destructive">{errors.phone.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="example@email.com"
                        {...register('email')}
                        className={errors.email ? 'border-destructive' : ''}
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Công ty (không bắt buộc)</Label>
                      <Input
                        id="company"
                        placeholder="Tên công ty của bạn"
                        {...register('company')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="service">
                        Dịch vụ quan tâm <span className="text-destructive">*</span>
                      </Label>
                      <Controller
                        name="service"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger
                              className={errors.service ? 'border-destructive' : ''}
                            >
                              <SelectValue placeholder="Chọn dịch vụ" />
                            </SelectTrigger>
                            <SelectContent>
                              {services.map((service) => (
                                <SelectItem key={service.value} value={service.value}>
                                  {service.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.service && (
                        <p className="text-sm text-destructive">{errors.service.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">
                        Nội dung <span className="text-destructive">*</span>
                      </Label>
                      <Textarea
                        id="message"
                        placeholder="Nhập nội dung yêu cầu của bạn..."
                        rows={5}
                        {...register('message')}
                        className={errors.message ? 'border-destructive' : ''}
                      />
                      {errors.message && (
                        <p className="text-sm text-destructive">{errors.message.message}</p>
                      )}
                    </div>

                    <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Đang gửi...
                        </>
                      ) : (
                        <>
                          <Send className="mr-2 w-4 h-4" />
                          Gửi yêu cầu
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Additional Info */}
              <div className="space-y-8">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
                  <CardHeader>
                    <CardTitle>Tại sao chọn TBS Logistics?</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <div>
                          <p className="font-semibold">Hơn 10 năm kinh nghiệm</p>
                          <p className="text-sm text-muted-foreground">
                            Đội ngũ chuyên gia giàu kinh nghiệm
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <div>
                          <p className="font-semibold">Giá cả cạnh tranh</p>
                          <p className="text-sm text-muted-foreground">
                            Chi phí tối ưu, minh bạch
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <div>
                          <p className="font-semibold">Hỗ trợ 24/7</p>
                          <p className="text-sm text-muted-foreground">
                            Luôn sẵn sàng hỗ trợ bạn
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-primary text-xs">✓</span>
                        </div>
                        <div>
                          <p className="font-semibold">Đảm bảo an toàn</p>
                          <p className="text-sm text-muted-foreground">
                            Bảo hiểm hàng hóa toàn diện
                          </p>
                        </div>
                      </li>
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Thông tin liên hệ nhanh</CardTitle>
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
                    <CardTitle>Câu hỏi thường gặp</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      Bạn có thắc mắc? Xem các câu hỏi thường gặp hoặc liên hệ trực tiếp với
                      chúng tôi để được hỗ trợ nhanh nhất.
                    </p>
                    <Button variant="outline" className="w-full">
                      Xem FAQ
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
            <h2 className="text-3xl font-bold text-center mb-12">Vị trí của chúng tôi</h2>
            <GoogleMap />
          </div>
        </div>
      </section>
    </div>
  );
}

function GoogleMap() {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.google && mapRef.current) {
      // Default location: Hanoi, Vietnam
      const location = { lat: 21.028511, lng: 105.804817 };

      const map = new window.google.maps.Map(mapRef.current, {
        center: location,
        zoom: 15,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
      });

      // Add info window
      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="padding: 10px;">
            <h3 style="font-weight: bold; margin-bottom: 5px;">TBS Logistics</h3>
            <p style="margin: 5px 0;">Vận chuyển Trung Quốc - Việt Nam</p>
            <p style="margin: 5px 0;">${process.env.NEXT_PUBLIC_COMPANY_ADDRESS || 'Hà Nội, Việt Nam'}</p>
            <p style="margin: 5px 0;">Hotline: ${process.env.NEXT_PUBLIC_COMPANY_PHONE || '0123 456 789'}</p>
          </div>
        `,
      });

      const marker = new window.google.maps.Marker({
        position: location,
        map,
        title: 'TBS Logistics',
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    }
  }, []);

  return (
    <div
      ref={mapRef}
      className="h-96 w-full rounded-lg shadow-lg border border-gray-200"
    >
      {/* Fallback for when Google Maps is not loaded */}
      <div className="h-full w-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-muted-foreground">Đang tải bản đồ...</p>
        </div>
      </div>
    </div>
  );
}
