'use client';

import Link from 'next/link';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, Search, Loader2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

const categoryIcons: Record<string, string> = {
  'D\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n': '\uD83D\uDE9A',
  'Mua h\u00e0ng v\u00e0 \u0111\u1eb7t h\u00e0ng': '\uD83D\uDECD\uFE0F',
  'H\u1ea3i quan v\u00e0 th\u1ee7 t\u1ee5c': '\uD83D\uDCCB',
  'B\u1ea3o hi\u1ec3m v\u00e0 b\u1ed3i th\u01b0\u1eddng': '\uD83D\uDEE1\uFE0F',
  'Theo d\u00f5i v\u00e0 giao nh\u1eadn': '\uD83D\uDCE6',
};

interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
  viewCount: number;
}

interface FaqCategory {
  title: string;
  icon: string;
  faqs: { question: string; answer: string }[];
}

const fallbackFaqCategories: FaqCategory[] = [
  {
    title: 'D\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n',
    icon: '\uD83D\uDE9A',
    faqs: [
      {
        question: 'TBS Logistics cung c\u1ea5p nh\u1eefng d\u1ecbch v\u1ee5 v\u1eadn chuy\u1ec3n n\u00e0o?',
        answer:
          'Ch\u00fang t\u00f4i cung c\u1ea5p \u0111\u1ea7y \u0111\u1ee7 c\u00e1c d\u1ecbch v\u1ee5: V\u1eadn chuy\u1ec3n thu\u1ea7n (VCT), Mua h\u00e0ng h\u1ed9 (MHH), \u1ee6y th\u00e1c xu\u1ea5t nh\u1eadp kh\u1ea9u (UTXNK), v\u00e0 LCL ch\u00ednh ng\u1ea1ch. B\u1ea1n c\u00f3 th\u1ec3 ch\u1ecdn d\u1ecbch v\u1ee5 ph\u00f9 h\u1ee3p v\u1edbi nhu c\u1ea7u v\u00e0 ng\u00e2n s\u00e1ch c\u1ee7a m\u00ecnh.',
      },
      {
        question: 'Th\u1eddi gian v\u1eadn chuy\u1ec3n t\u1eeb Trung Qu\u1ed1c v\u1ec1 Vi\u1ec7t Nam m\u1ea5t bao l\u00e2u?',
        answer:
          'Th\u1eddi gian v\u1eadn chuy\u1ec3n ph\u1ee5 thu\u1ed9c v\u00e0o ph\u01b0\u01a1ng th\u1ee9c: \u0110\u01b0\u1eddng h\u00e0ng kh\u00f4ng 3-5 ng\u00e0y, \u0111\u01b0\u1eddng b\u1ed9 5-7 ng\u00e0y, \u0111\u01b0\u1eddng bi\u1ec3n 15-25 ng\u00e0y. Th\u1eddi gian c\u00f3 th\u1ec3 thay \u0111\u1ed5i t\u00f9y theo m\u00f9a v\u1ee5 v\u00e0 \u0111\u1ecba \u0111i\u1ec3m c\u1ee5 th\u1ec3.',
      },
      {
        question: 'Chi ph\u00ed v\u1eadn chuy\u1ec3n \u0111\u01b0\u1ee3c t\u00ednh nh\u01b0 th\u1ebf n\u00e0o?',
        answer:
          'Chi ph\u00ed bao g\u1ed3m: Ph\u00ed v\u1eadn chuy\u1ec3n (t\u00ednh theo kg ho\u1eb7c CBM), ph\u00ed d\u1ecbch v\u1ee5, ph\u00ed h\u1ea3i quan (n\u1ebfu c\u00f3). Ch\u00fang t\u00f4i t\u00ednh theo tr\u1ecdng l\u01b0\u1ee3ng l\u1edbn h\u01a1n gi\u1eefa tr\u1ecdng l\u01b0\u1ee3ng th\u1ef1c t\u1ebf v\u00e0 tr\u1ecdng l\u01b0\u1ee3ng quy \u0111\u1ed5i. B\u1ea1n c\u00f3 th\u1ec3 d\u00f9ng c\u00f4ng c\u1ee5 t\u00ednh ph\u00ed tr\u00ean website \u0111\u1ec3 \u01b0\u1edbc t\u00ednh.',
      },
      {
        question: 'C\u00f3 gi\u1edbi h\u1ea1n v\u1ec1 tr\u1ecdng l\u01b0\u1ee3ng hay k\u00edch th\u01b0\u1edbc h\u00e0ng h\u00f3a kh\u00f4ng?',
        answer:
          '\u0110\u01b0\u1eddng bi\u1ec3n kh\u00f4ng gi\u1edbi h\u1ea1n k\u00edch th\u01b0\u1edbc. \u0110\u01b0\u1eddng b\u1ed9 v\u00e0 h\u00e0ng kh\u00f4ng c\u00f3 gi\u1edbi h\u1ea1n t\u00f9y t\u1eebng lo\u1ea1i xe/m\u00e1y bay. Vui l\u00f2ng li\u00ean h\u1ec7 \u0111\u1ec3 \u0111\u01b0\u1ee3c t\u01b0 v\u1ea5n c\u1ee5 th\u1ec3 cho l\u00f4 h\u00e0ng c\u1ee7a b\u1ea1n.',
      },
      {
        question: 'TBS c\u00f3 v\u1eadn chuy\u1ec3n h\u00e0ng nguy hi\u1ec3m, d\u1ec5 v\u1ee1 kh\u00f4ng?',
        answer:
          'Ch\u00fang t\u00f4i v\u1eadn chuy\u1ec3n h\u00e0ng d\u1ec5 v\u1ee1 v\u1edbi d\u1ecbch v\u1ee5 \u0111\u00f3ng g\u00f3i \u0111\u1eb7c bi\u1ec7t. V\u1edbi h\u00e0ng nguy hi\u1ec3m, c\u1ea7n ki\u1ec3m tra gi\u1ea5y ph\u00e9p v\u00e0 tu\u00e2n th\u1ee7 quy \u0111\u1ecbnh v\u1eadn chuy\u1ec3n. Vui l\u00f2ng th\u00f4ng b\u00e1o tr\u01b0\u1edbc lo\u1ea1i h\u00e0ng \u0111\u1ec3 \u0111\u01b0\u1ee3c t\u01b0 v\u1ea5n.',
      },
    ],
  },
  {
    title: 'Mua h\u00e0ng v\u00e0 \u0111\u1eb7t h\u00e0ng',
    icon: '\uD83D\uDECD\uFE0F',
    faqs: [
      {
        question: 'L\u00e0m th\u1ebf n\u00e0o \u0111\u1ec3 order h\u00e0ng t\u1eeb Trung Qu\u1ed1c?',
        answer:
          'B\u1ea1n c\u00f3 th\u1ec3: 1) G\u1eedi link s\u1ea3n ph\u1ea9m cho ch\u00fang t\u00f4i, 2) \u0110\u0103ng k\u00fd t\u00e0i kho\u1ea3n tr\u00ean h\u1ec7 th\u1ed1ng, 3) Ch\u00fang t\u00f4i s\u1ebd ki\u1ec3m tra, b\u00e1o gi\u00e1 v\u00e0 \u0111\u1eb7t h\u00e0ng gi\u00fap b\u1ea1n.',
      },
      {
        question: 'TBS c\u00f3 h\u1ed7 tr\u1ee3 t\u00ecm ngu\u1ed3n h\u00e0ng v\u00e0 \u0111\u00e0m ph\u00e1n gi\u00e1 kh\u00f4ng?',
        answer:
          'C\u00f3, ch\u00fang t\u00f4i c\u00f3 \u0111\u1ed9i ng\u0169 sourcing t\u1ea1i Trung Qu\u1ed1c gi\u00fap t\u00ecm nh\u00e0 cung c\u1ea5p uy t\u00edn, so s\u00e1nh gi\u00e1, v\u00e0 \u0111\u00e0m ph\u00e1n \u0111\u1ec3 b\u1ea1n c\u00f3 \u0111\u01b0\u1ee3c gi\u00e1 t\u1ed1t nh\u1ea5t.',
      },
      {
        question: 'T\u00f4i c\u00f3 th\u1ec3 mua h\u00e0ng t\u1eeb Taobao, 1688, Alibaba \u0111\u01b0\u1ee3c kh\u00f4ng?',
        answer:
          'C\u00f3, ch\u00fang t\u00f4i h\u1ed7 tr\u1ee3 order t\u1eeb t\u1ea5t c\u1ea3 c\u00e1c s\u00e0n th\u01b0\u01a1ng m\u1ea1i \u0111i\u1ec7n t\u1eed Trung Qu\u1ed1c: Taobao, Tmall, 1688, Alibaba, JD.com, Pinduoduo.',
      },
      {
        question: 'Ph\u00ed mua h\u00e0ng h\u1ed9 l\u00e0 bao nhi\u00eau?',
        answer:
          'Ph\u00ed mua h\u00e0ng h\u1ed9 th\u01b0\u1eddng t\u1eeb 3-5% gi\u00e1 tr\u1ecb \u0111\u01a1n h\u00e0ng. \u0110\u01a1n h\u00e0ng l\u1edbn s\u1ebd \u0111\u01b0\u1ee3c gi\u1ea3m ph\u00ed.',
      },
      {
        question: 'T\u00f4i c\u1ea7n thanh to\u00e1n nh\u01b0 th\u1ebf n\u00e0o?',
        answer:
          'Chuy\u1ec3n kho\u1ea3n ng\u00e2n h\u00e0ng, v\u00ed \u0111i\u1ec7n t\u1eed (Momo, ZaloPay), ho\u1eb7c thanh to\u00e1n t\u1ea1i v\u0103n ph\u00f2ng.',
      },
    ],
  },
  {
    title: 'H\u1ea3i quan v\u00e0 th\u1ee7 t\u1ee5c',
    icon: '\uD83D\uDCCB',
    faqs: [
      {
        question: 'H\u00e0ng h\u00f3a c\u00f3 c\u1ea7n khai b\u00e1o h\u1ea3i quan kh\u00f4ng?',
        answer:
          'T\u00f9y v\u00e0o gi\u00e1 tr\u1ecb v\u00e0 lo\u1ea1i h\u00e0ng. H\u00e0ng c\u00e1 nh\u00e2n d\u01b0\u1edbi 1 tri\u1ec7u VN\u0110 th\u01b0\u1eddng kh\u00f4ng c\u1ea7n khai b\u00e1o. H\u00e0ng th\u01b0\u01a1ng m\u1ea1i c\u1ea7n khai b\u00e1o \u0111\u1ea7y \u0111\u1ee7.',
      },
      {
        question: 'Thu\u1ebf nh\u1eadp kh\u1ea9u \u0111\u01b0\u1ee3c t\u00ednh nh\u01b0 th\u1ebf n\u00e0o?',
        answer:
          'Thu\u1ebf nh\u1eadp kh\u1ea9u = (Gi\u00e1 tr\u1ecb h\u00e0ng + Ph\u00ed v\u1eadn chuy\u1ec3n + B\u1ea3o hi\u1ec3m) x Thu\u1ebf su\u1ea5t. Thu\u1ebf su\u1ea5t ph\u1ee5 thu\u1ed9c lo\u1ea1i h\u00e0ng (th\u01b0\u1eddng 0-50%).',
      },
      {
        question: 'T\u00f4i c\u1ea7n chu\u1ea9n b\u1ecb gi\u1ea5y t\u1edd g\u00ec \u0111\u1ec3 khai b\u00e1o h\u1ea3i quan?',
        answer:
          'CMND/CCCD, h\u00f3a \u0111\u01a1n mua h\u00e0ng, packing list, gi\u1ea5y \u1ee7y quy\u1ec1n (n\u1ebfu \u1ee7y th\u00e1c). H\u00e0ng \u0111\u1eb7c bi\u1ec7t c\u1ea7n gi\u1ea5y ph\u00e9p ri\u00eang.',
      },
      {
        question: 'N\u1ebfu h\u00e0ng b\u1ecb h\u1ea3i quan gi\u1eef l\u1ea1i th\u00ec sao?',
        answer:
          'Ch\u00fang t\u00f4i s\u1ebd li\u00ean h\u1ec7 h\u1ea3i quan \u0111\u1ec3 x\u1eed l\u00fd. Th\u01b0\u1eddng do thi\u1ebfu gi\u1ea5y t\u1edd ho\u1eb7c c\u1ea7n b\u1ed5 sung th\u00f4ng tin.',
      },
      {
        question: 'C\u00f3 nh\u1eefng lo\u1ea1i h\u00e0ng n\u00e0o kh\u00f4ng \u0111\u01b0\u1ee3c ph\u00e9p nh\u1eadp kh\u1ea9u?',
        answer:
          'V\u0169 kh\u00ed, ma t\u00fay, h\u00e0ng nh\u00e1i, h\u00e0ng g\u00e2y h\u1ea1i m\u00f4i tr\u01b0\u1eddng, m\u1ed9t s\u1ed1 lo\u1ea1i th\u1ef1c ph\u1ea9m, m\u1ef9 ph\u1ea9m kh\u00f4ng r\u00f5 ngu\u1ed3n g\u1ed1c.',
      },
    ],
  },
  {
    title: 'B\u1ea3o hi\u1ec3m v\u00e0 b\u1ed3i th\u01b0\u1eddng',
    icon: '\uD83D\uDEE1\uFE0F',
    faqs: [
      {
        question: 'H\u00e0ng h\u00f3a c\u00f3 \u0111\u01b0\u1ee3c b\u1ea3o hi\u1ec3m kh\u00f4ng?',
        answer:
          'C\u00f3, b\u1ea3o hi\u1ec3m c\u01a1 b\u1ea3n cho t\u1ea5t c\u1ea3 l\u00f4 h\u00e0ng. C\u00f3 th\u1ec3 mua th\u00eam b\u1ea3o hi\u1ec3m to\u00e0n di\u1ec7n, ph\u00ed 0.3-1% gi\u00e1 tr\u1ecb h\u00e0ng.',
      },
      {
        question: 'N\u1ebfu h\u00e0ng b\u1ecb th\u1ea5t l\u1ea1c ho\u1eb7c h\u01b0 h\u1ecfng th\u00ec sao?',
        answer:
          'Ch\u00fang t\u00f4i \u0111i\u1ec1u tra v\u00e0 x\u1eed l\u00fd theo quy tr\u00ecnh. N\u1ebfu c\u00f3 b\u1ea3o hi\u1ec3m, b\u1ea1n s\u1ebd \u0111\u01b0\u1ee3c b\u1ed3i th\u01b0\u1eddng theo gi\u00e1 tr\u1ecb h\u00e0ng.',
      },
      {
        question: 'Th\u1eddi gian x\u1eed l\u00fd khi\u1ebfu n\u1ea1i m\u1ea5t bao l\u00e2u?',
        answer:
          '3-5 ng\u00e0y l\u00e0m vi\u1ec7c cho khi\u1ebfu n\u1ea1i \u0111\u01a1n gi\u1ea3n, 7-15 ng\u00e0y cho tr\u01b0\u1eddng h\u1ee3p ph\u1ee9c t\u1ea1p.',
      },
      {
        question: 'T\u00f4i c\u00f3 th\u1ec3 ki\u1ec3m tra h\u00e0ng tr\u01b0\u1edbc khi nh\u1eadn kh\u00f4ng?',
        answer:
          'C\u00f3, ki\u1ec3m tra h\u00e0ng t\u1ea1i kho. Ch\u00fang t\u00f4i c\u0169ng c\u00f3 d\u1ecbch v\u1ee5 ch\u1ee5p \u1ea3nh, quay video x\u00e1c nh\u1eadn h\u00e0ng.',
      },
    ],
  },
  {
    title: 'Theo d\u00f5i v\u00e0 giao nh\u1eadn',
    icon: '\uD83D\uDCE6',
    faqs: [
      {
        question: 'L\u00e0m sao \u0111\u1ec3 theo d\u00f5i \u0111\u01a1n h\u00e0ng?',
        answer:
          'Theo d\u00f5i tr\u00ean website, app di \u0111\u1ed9ng, ho\u1eb7c hotline. C\u1eadp nh\u1eadt realtime.',
      },
      {
        question: 'T\u00f4i c\u00f3 th\u1ec3 thay \u0111\u1ed5i \u0111\u1ecba ch\u1ec9 giao h\u00e0ng kh\u00f4ng?',
        answer:
          'C\u00f3, c\u1ea7n th\u00f4ng b\u00e1o s\u1edbm. Ch\u01b0a xu\u1ea5t kho: mi\u1ec5n ph\u00ed. \u0110ang v\u1eadn chuy\u1ec3n: c\u00f3 th\u1ec3 ph\u00e1t sinh ph\u00ed.',
      },
      {
        question: 'TBS c\u00f3 giao h\u00e0ng t\u1eadn n\u01a1i kh\u00f4ng?',
        answer:
          'C\u00f3, giao to\u00e0n qu\u1ed1c. N\u1ed9i th\u00e0nh th\u01b0\u1eddng mi\u1ec5n ph\u00ed v\u1edbi \u0111\u01a1n tr\u00ean 5kg.',
      },
      {
        question: 'N\u1ebfu kh\u00f4ng c\u00f3 ng\u01b0\u1eddi nh\u1eadn h\u00e0ng th\u00ec sao?',
        answer:
          'H\u00e0ng chuy\u1ec3n v\u1ec1 kho, gi\u1eef mi\u1ec5n ph\u00ed 3 ng\u00e0y. Sau \u0111\u00f3 t\u00ednh ph\u00ed l\u01b0u kho.',
      },
    ],
  },
];

function groupFaqsByCategory(items: FaqItem[]): FaqCategory[] {
  const grouped: Record<string, { question: string; answer: string }[]> = {};

  for (const item of items) {
    if (!grouped[item.category]) {
      grouped[item.category] = [];
    }
    grouped[item.category].push({
      question: item.question,
      answer: item.answer,
    });
  }

  return Object.entries(grouped).map(([category, faqs]) => ({
    title: category,
    icon: categoryIcons[category] || '\u2753',
    faqs,
  }));
}

export function FAQAccordion() {
  const [searchQuery, setSearchQuery] = useState('');
  const [faqCategories, setFaqCategories] = useState<FaqCategory[]>(fallbackFaqCategories);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

    fetch(`${apiUrl}/public/cms/faqs`)
      .then((res) => {
        if (!res.ok) throw new Error('API error');
        return res.json();
      })
      .then((data: FaqItem[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setFaqCategories(groupFaqsByCategory(data));
        }
      })
      .catch(() => {
        // Keep fallback data on error
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const filteredCategories = searchQuery
    ? faqCategories
        .map((category) => ({
          ...category,
          faqs: category.faqs.filter(
            (faq) =>
              faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
              faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
          ),
        }))
        .filter((category) => category.faqs.length > 0)
    : faqCategories;

  return (
    <>
      {/* Search Box */}
      <section className="pb-8">
        <div className="container mx-auto px-4">
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="search"
              placeholder="T\u00ecm ki\u1ebfm c\u00e2u h\u1ecfi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-base"
            />
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">\u0110ang t\u1ea3i c\u00e2u h\u1ecfi...</p>
              </div>
            ) : filteredCategories.length > 0 ? (
              <div className="space-y-8">
                {filteredCategories.map((category, categoryIndex) => (
                  <Card key={categoryIndex}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <span className="text-3xl">{category.icon}</span>
                        {category.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible className="w-full">
                        {category.faqs.map((faq, faqIndex) => (
                          <AccordionItem
                            key={faqIndex}
                            value={`item-${categoryIndex}-${faqIndex}`}
                          >
                            <AccordionTrigger className="text-left">
                              {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground">
                              {faq.answer}
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Search className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-lg text-muted-foreground">
                  Kh\u00f4ng t\u00ecm th\u1ea5y c\u00e2u h\u1ecfi n\u00e0o ph\u00f9 h\u1ee3p v\u1edbi &quot;{searchQuery}&quot;
                </p>
                <Button
                  variant="link"
                  onClick={() => setSearchQuery('')}
                  className="mt-2"
                >
                  X\u00f3a t\u00ecm ki\u1ebfm
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="py-8">
                <MessageCircle className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-3">
                  Kh\u00f4ng t\u00ecm th\u1ea5y c\u00e2u tr\u1ea3 l\u1eddi?
                </h3>
                <p className="text-muted-foreground mb-6">
                  \u0110\u1ed9i ng\u0169 h\u1ed7 tr\u1ee3 c\u1ee7a ch\u00fang t\u00f4i lu\u00f4n s\u1eb5n s\u00e0ng gi\u1ea3i \u0111\u00e1p m\u1ecdi th\u1eafc m\u1eafc
                  c\u1ee7a b\u1ea1n
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" asChild>
                    <Link href="/lien-he">Li\u00ean h\u1ec7 t\u01b0 v\u1ea5n</Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link
                      href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_ID || '0123456789'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Chat qua Zalo
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
