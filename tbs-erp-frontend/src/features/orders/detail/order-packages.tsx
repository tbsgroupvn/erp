'use client';

import Link from 'next/link';
import { formatCurrency } from '@/lib/utils/format';

interface OrderItem {
  id: string;
  productName: string;
  productUrl?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency?: string | null;
}

interface OrderPackagesProps {
  items: OrderItem[];
  currency?: string | null;
}

export function OrderPackages({ items, currency }: OrderPackagesProps) {
  if (!items || items.length === 0) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">Hang hoa</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="pb-2 font-medium">San pham</th>
            <th className="pb-2 font-medium">SL</th>
            <th className="pb-2 font-medium text-right">Don gia</th>
            <th className="pb-2 font-medium text-right">Thanh tien</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-2">
                <p>{item.productName}</p>
                {item.productUrl && (
                  <a
                    href={item.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Link san pham
                  </a>
                )}
              </td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2 text-right">
                {formatCurrency(item.unitPrice, (item.currency ?? currency) || undefined)}
              </td>
              <td className="py-2 text-right font-medium">
                {formatCurrency(item.totalPrice, (item.currency ?? currency) || undefined)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
