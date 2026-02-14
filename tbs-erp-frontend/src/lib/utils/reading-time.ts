/**
 * Calculate reading time for content
 * @param content - The text content to analyze
 * @param wordsPerMinute - Average reading speed (default: 200 words per minute)
 * @returns Reading time in minutes
 */
export function calculateReadingTime(
  content: string,
  wordsPerMinute: number = 200
): number {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes;
}

/**
 * Format reading time into human-readable text
 * @param minutes - Reading time in minutes
 * @param locale - Locale for formatting (default: 'vi')
 * @returns Formatted reading time string
 */
export function formatReadingTime(
  minutes: number,
  locale: 'vi' | 'en' = 'vi'
): string {
  if (locale === 'vi') {
    return `${minutes} phút đọc`;
  }
  return `${minutes} min read`;
}

/**
 * Get reading time stats including word count
 * @param content - The text content to analyze
 * @returns Object with word count, character count, and reading time
 */
export function getReadingStats(content: string) {
  const words = content.trim().split(/\s+/).length;
  const characters = content.length;
  const readingTime = calculateReadingTime(content);

  return {
    words,
    characters,
    readingTime,
    formattedReadingTime: formatReadingTime(readingTime),
  };
}
