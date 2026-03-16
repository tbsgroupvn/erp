export type SearchResultType =
  | 'order'
  | 'customer'
  | 'task'
  | 'wiki'
  | 'complaint'
  | 'quotation'
  | 'employee';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  icon: string;
}
