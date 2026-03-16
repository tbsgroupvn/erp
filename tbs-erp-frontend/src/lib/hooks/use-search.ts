import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/lib/api/search.api';

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchApi.search(query),
    enabled: query.trim().length >= 2,
    staleTime: 5_000,
    placeholderData: [],
  });
}

export function useRecentItems() {
  return useQuery({
    queryKey: ['search', 'recent'],
    queryFn: searchApi.getRecent,
    staleTime: 30_000,
    placeholderData: [],
  });
}
