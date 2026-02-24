'use client';

import { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Testimonial {
  id: number;
  name: string;
  company: string;
  role: string;
  rating: number;
  text: string;
  avatar: string;
  location: string;
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Nguyễn Văn Minh',
    company: 'Công ty TNHH Thương Mại Minh Anh',
    role: 'Giám đốc',
    rating: 5,
    text: 'Dịch vụ vận chuyển nhanh chóng, chi phí hợp lý. Đã sử dụng TBS được 2 năm và rất hài lòng. Đội ngũ hỗ trợ nhiệt tình, giải quyết mọi vấn đề nhanh gọn. Hàng về luôn đúng hẹn, ít khi có sự cố.',
    avatar: 'NV',
    location: 'Hà Nội',
  },
  {
    id: 2,
    name: 'Trần Thị Hương',
    company: 'Shop Thời Trang Hương Bella',
    role: 'Chủ shop online',
    rating: 5,
    text: 'Nhân viên tư vấn chuyên nghiệp, theo dõi đơn hàng sát sao. Giá cả minh bạch, không phát sinh thêm chi phí. Order hàng từ Trung Quốc về rất nhanh, chất lượng dịch vụ xuất sắc. Sẽ tiếp tục sử dụng lâu dài.',
    avatar: 'TH',
    location: 'TP. Hồ Chí Minh',
  },
  {
    id: 3,
    name: 'Lê Hoàng Nam',
    company: 'Cửa hàng điện tử Nam Phong',
    role: 'Quản lý',
    rating: 5,
    text: 'Uy tín, minh bạch về giá cả. Rất hài lòng với dịch vụ. Đã thử nhiều đơn vị nhưng TBS là tốt nhất về tốc độ và chất lượng. Hệ thống theo dõi đơn hàng rất tiện lợi, luôn cập nhật trạng thái realtime.',
    avatar: 'LN',
    location: 'Đà Nẵng',
  },
  {
    id: 4,
    name: 'Phạm Thị Mai',
    company: 'Công ty CP Nội Thất Mai Hương',
    role: 'Trưởng phòng Kinh doanh',
    rating: 5,
    text: 'Vận chuyển hàng nội thất cồng kềnh rất chuyên nghiệp. Đóng gói cẩn thận, giao hàng tận nơi. Chi phí hợp lý hơn so với các đơn vị khác. Nhân viên hỗ trợ thủ tục hải quan rất tận tình.',
    avatar: 'PM',
    location: 'Hải Phòng',
  },
  {
    id: 5,
    name: 'Đặng Quốc Bảo',
    company: 'Siêu thị điện máy Bảo Anh',
    role: 'Chủ doanh nghiệp',
    rating: 5,
    text: 'Hỗ trợ mua hàng tại Trung Quốc rất tốt, tìm được nhà cung cấp uy tín với giá tốt. Đàm phán giúp mình tiết kiệm được nhiều chi phí. Vận chuyển an toàn, chưa bao giờ thất lạc hàng. Rất đáng tin cậy!',
    avatar: 'DB',
    location: 'Cần Thơ',
  },
  {
    id: 6,
    name: 'Võ Thị Lan',
    company: 'Cửa hàng mỹ phẩm Lan Anh',
    role: 'Chủ cửa hàng',
    rating: 5,
    text: 'Dịch vụ order hàng mỹ phẩm từ Trung Quốc rất chuyên nghiệp. Kiểm tra hàng kỹ lưỡng trước khi gửi, tư vấn về thuế và giấy tờ rất chi tiết. Thời gian vận chuyển nhanh hơn dự kiến. Rất hài lòng!',
    avatar: 'VL',
    location: 'Biên Hòa',
  },
  {
    id: 7,
    name: 'Ngô Văn Tùng',
    company: 'Công ty TNHH XNK Tùng Lâm',
    role: 'Giám đốc Điều hành',
    rating: 5,
    text: 'Là đối tác lâu năm của TBS, tôi đánh giá cao sự chuyên nghiệp và tận tâm của họ. Quy trình làm việc chặt chẽ, báo cáo minh bạch. Giải quyết vấn đề linh hoạt, luôn đặt lợi ích khách hàng lên đầu.',
    avatar: 'NT',
    location: 'Hà Nội',
  },
  {
    id: 8,
    name: 'Bùi Thị Ngọc',
    company: 'Shop phụ kiện Ngọc Trinh',
    role: 'Chủ shop',
    rating: 5,
    text: 'Order hàng phụ kiện với số lượng lớn, TBS hỗ trợ rất tốt từ khâu tìm nguồn hàng đến vận chuyển về Việt Nam. Giá cước cạnh tranh, thời gian giao hàng đúng cam kết. Đội ngũ CSKH phản hồi nhanh 24/7.',
    avatar: 'BN',
    location: 'Nha Trang',
  },
  {
    id: 9,
    name: 'Trương Minh Tuấn',
    company: 'Công ty CP Thương Mại Minh Tuấn',
    role: 'Phó Giám đốc',
    rating: 5,
    text: 'Sử dụng dịch vụ ủy thác xuất nhập khẩu của TBS đã được 3 năm. Thủ tục hải quan được xử lý nhanh chóng, chính xác. Nhân viên am hiểu pháp luật, tư vấn tận tình. Chi phí hợp lý, không phát sinh.',
    avatar: 'TT',
    location: 'TP. Hồ Chí Minh',
  },
  {
    id: 10,
    name: 'Lý Thanh Hà',
    company: 'Cửa hàng thiết bị y tế Thanh Hà',
    role: 'Chủ doanh nghiệp',
    rating: 5,
    text: 'Vận chuyển hàng y tế đòi hỏi độ cẩn thận cao, TBS làm rất tốt. Hàng được đóng gói kỹ, có bảo hiểm đầy đủ. Nhân viên hỗ trợ giấy tờ chứng nhận chất lượng rất chuyên nghiệp. Đáng tin cậy!',
    avatar: 'LH',
    location: 'Huế',
  },
];

export function Testimonials() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Generate review schemas for all testimonials
  const reviewSchemas = testimonials.map((testimonial) => ({
    '@context': 'https://schema.org',
    '@type': 'Review',
    author: {
      '@type': 'Person',
      name: testimonial.name,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: testimonial.rating.toString(),
      bestRating: '5',
      worstRating: '1',
    },
    reviewBody: testimonial.text,
    datePublished: new Date().toISOString().split('T')[0],
    itemReviewed: {
      '@type': 'Organization',
      name: 'TBS Logistics',
    },
  }));

  const handlePrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handleDotClick = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const getVisibleTestimonials = () => {
    const visible = [];
    for (let i = 0; i < 3; i++) {
      visible.push(testimonials[(currentIndex + i) % testimonials.length]);
    }
    return visible;
  };

  return (
    <div className="w-full">
      {/* Review Schemas */}
      {reviewSchemas.map((schema, index) => (
        <script
          key={`review-schema-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}
        />
      ))}

      {/* Desktop view - 3 cards */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6">
        {getVisibleTestimonials().map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>

      {/* Tablet view - 2 cards */}
      <div className="hidden md:grid lg:hidden md:grid-cols-2 gap-6">
        {getVisibleTestimonials().slice(0, 2).map((testimonial) => (
          <TestimonialCard key={testimonial.id} testimonial={testimonial} />
        ))}
      </div>

      {/* Mobile view - 1 card */}
      <div className="md:hidden">
        <TestimonialCard testimonial={testimonials[currentIndex]} />
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 mt-8">
        <Button
          variant="outline"
          size="icon"
          onClick={handlePrevious}
          className="rounded-full"
          aria-label="Testimonial trước"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Dots */}
        <div className="flex gap-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Đi đến testimonial ${index + 1}`}
            />
          ))}
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleNext}
          className="rounded-full"
          aria-label="Testimonial tiếp theo"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <Card className="relative h-full hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/10" aria-hidden="true" />

        {/* Rating */}
        <div className="flex gap-1 mb-4">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`h-5 w-5 ${
                i < testimonial.rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Testimonial Text */}
        <p className="text-muted-foreground mb-6 line-clamp-5">
          {testimonial.text}
        </p>

        {/* Author Info */}
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-semibold">
              {testimonial.avatar}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {testimonial.name}
            </p>
            <p className="text-sm text-primary truncate">
              {testimonial.role}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {testimonial.company}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {testimonial.location}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
