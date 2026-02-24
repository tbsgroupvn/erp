'use client';

import { useState } from 'react';
import { Facebook, Twitter, Linkedin, Link2, Check } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface ShareButtonsProps {
  title?: string;
  description?: string;
  className?: string;
}

export function ShareButtons({
  title = process.env.NEXT_PUBLIC_COMPANY_NAME || 'My Company',
  description,
  className,
}: ShareButtonsProps) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);
  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost'}${pathname}`;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = description
    ? encodeURIComponent(description)
    : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const shareLinks = [
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      color: 'hover:bg-blue-600 hover:text-white',
    },
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      color: 'hover:bg-sky-500 hover:text-white',
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      color: 'hover:bg-blue-700 hover:text-white',
    },
  ];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-sm font-medium text-gray-700">Chia sẻ:</span>
      <div className="flex gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              link.color
            )}
            aria-label={`Chia sẻ trên ${link.name}`}
          >
            <link.icon className="h-4 w-4" aria-hidden="true" />
          </a>
        ))}
        <button
          onClick={handleCopyLink}
          className={cn(
            'inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white p-2 text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            copied ? 'bg-green-50 text-green-600' : 'hover:bg-gray-100'
          )}
          aria-label="Sao chép liên kết"
        >
          {copied ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Link2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {copied && (
        <span
          className="animate-fade-in text-xs text-green-600"
          role="status"
          aria-live="polite"
        >
          Đã sao chép!
        </span>
      )}
    </div>
  );
}
