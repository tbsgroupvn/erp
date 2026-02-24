'use client';

import { useState } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');

  const handleSendMessage = () => {
    const sanitized = message.trim().replace(/<[^>]*>/g, '');
    if (sanitized) {
      // Open Zalo chat with pre-filled message
      const zaloUrl = `https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_ID || '0123456789'}?text=${encodeURIComponent(sanitized)}`;
      window.open(zaloUrl, '_blank', 'noopener,noreferrer');
      setMessage('');
      setIsOpen(false);
    }
  };

  const quickMessages = [
    'Tôi muốn tư vấn về dịch vụ vận chuyển',
    'Báo giá vận chuyển hàng hóa',
    'Tra cứu đơn hàng của tôi',
    'Liên hệ hotline hỗ trợ',
  ];

  return (
    <>
      {/* Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen ? (
          <Button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-6 py-6 rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-105 animate-pulse"
            size="lg"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="hidden sm:inline">Chat với tư vấn viên</span>
          </Button>
        ) : (
          <Card className="w-80 sm:w-96 shadow-2xl">
            <CardHeader className="bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Hỗ trợ trực tuyến
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="text-white hover:bg-blue-700 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-blue-100 mt-1">
                Thời gian phản hồi: {'<'} 5 phút
              </p>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {/* Quick Messages */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Tin nhắn nhanh:
                  </p>
                  <div className="space-y-2">
                    {quickMessages.map((msg, index) => (
                      <button
                        key={index}
                        onClick={() => setMessage(msg)}
                        className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Message Input */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Hoặc nhập tin nhắn:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Nhập tin nhắn..."
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    />
                    <Button
                      onClick={handleSendMessage}
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Contact Options */}
                <div className="pt-4 border-t space-y-2">
                  <p className="text-xs text-gray-500">Liên hệ qua:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`https://zalo.me/${process.env.NEXT_PUBLIC_ZALO_ID || '0123456789'}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Zalo
                    </a>
                    <a
                      href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '84123456789'}?text=${encodeURIComponent('Xin chào, tôi cần tư vấn về dịch vụ vận chuyển')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors text-sm"
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
