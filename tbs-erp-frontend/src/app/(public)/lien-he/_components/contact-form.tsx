'use client';

import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
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

const contactFormSchema = z.object({
  fullName: z.string().min(2, 'H\u1ecd t\u00ean ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 2 k\u00fd t\u1ef1'),
  phone: z
    .string()
    .min(10, 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 10 s\u1ed1')
    .regex(/^[0-9+\-\s()]+$/, 'S\u1ed1 \u0111i\u1ec7n tho\u1ea1i kh\u00f4ng h\u1ee3p l\u1ec7'),
  email: z.string().email('Email kh\u00f4ng h\u1ee3p l\u1ec7'),
  company: z.string().optional(),
  service: z.string().min(1, 'Vui l\u00f2ng ch\u1ecdn d\u1ecbch v\u1ee5'),
  message: z.string().min(10, 'N\u1ed9i dung ph\u1ea3i c\u00f3 \u00edt nh\u1ea5t 10 k\u00fd t\u1ef1'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const services = [
  { value: 'van-chuyen', label: 'V\u1eadn chuy\u1ec3n h\u00e0ng h\u00f3a' },
  { value: 'mua-hang', label: 'Mua h\u00e0ng h\u1ed9' },
  { value: 'uy-thac-xnk', label: '\u1ee6y th\u00e1c xu\u1ea5t nh\u1eadp kh\u1ea9u' },
  { value: 'lcl-chinh-ngach', label: 'LCL ch\u00ednh ng\u1ea1ch' },
  { value: 'tu-van', label: 'T\u01b0 v\u1ea5n chung' },
];

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const response = await fetch(`${apiUrl}/public/leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Kh\u00f4ng th\u1ec3 g\u1eedi y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau.');
      }

      toast.success('G\u1eedi th\u00e0nh c\u00f4ng!', {
        description: 'Ch\u00fang t\u00f4i s\u1ebd li\u00ean h\u1ec7 v\u1edbi b\u1ea1n trong th\u1eddi gian s\u1edbm nh\u1ea5t.',
      });

      reset();
    } catch (error) {
      toast.error('C\u00f3 l\u1ed7i x\u1ea3y ra!', {
        description:
          error instanceof Error
            ? error.message
            : 'Kh\u00f4ng th\u1ec3 g\u1eedi y\u00eau c\u1ea7u. Vui l\u00f2ng th\u1eed l\u1ea1i sau.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">G\u1eedi y\u00eau c\u1ea7u</CardTitle>
        <p className="text-muted-foreground">
          \u0110i\u1ec1n th\u00f4ng tin v\u00e0o form d\u01b0\u1edbi \u0111\u00e2y \u0111\u1ec3 g\u1eedi y\u00eau c\u1ea7u t\u01b0 v\u1ea5n
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="fullName">
              H\u1ecd v\u00e0 t\u00ean <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fullName"
              placeholder="Nguy\u1ec5n V\u0103n A"
              {...register('fullName')}
              className={errors.fullName ? 'border-destructive' : ''}
            />
            {errors.fullName && (
              <p className="text-sm text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              S\u1ed1 \u0111i\u1ec7n tho\u1ea1i <span className="text-destructive">*</span>
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
            <Label htmlFor="company">C\u00f4ng ty (kh\u00f4ng b\u1eaft bu\u1ed9c)</Label>
            <Input
              id="company"
              placeholder="T\u00ean c\u00f4ng ty c\u1ee7a b\u1ea1n"
              {...register('company')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">
              D\u1ecbch v\u1ee5 quan t\u00e2m <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="service"
              control={control}
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value}>
                  <SelectTrigger
                    className={errors.service ? 'border-destructive' : ''}
                  >
                    <SelectValue placeholder="Ch\u1ecdn d\u1ecbch v\u1ee5" />
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
              N\u1ed9i dung <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Nh\u1eadp n\u1ed9i dung y\u00eau c\u1ea7u c\u1ee7a b\u1ea1n..."
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
                <span className="animate-spin mr-2">{'\u231B'}</span>
                \u0110ang g\u1eedi...
              </>
            ) : (
              <>
                <Send className="mr-2 w-4 h-4" />
                G\u1eedi y\u00eau c\u1ea7u
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
