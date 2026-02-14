/**
 * Vietnamese public holidays (recurring annually).
 * Dates are in MM-DD format. Lunar calendar holidays are approximate
 * and should be updated each year with the actual Gregorian dates.
 */
const FIXED_HOLIDAYS: string[] = [
  '01-01', // Tết Dương lịch
  '04-30', // Ngày Giải phóng miền Nam
  '05-01', // Ngày Quốc tế Lao động
  '09-02', // Ngày Quốc khánh
];

/**
 * Formats a Date object to a string in the specified format.
 *
 * Supported format tokens:
 * - YYYY: 4-digit year
 * - MM: 2-digit month (01-12)
 * - DD: 2-digit day (01-31)
 * - HH: 2-digit hour (00-23)
 * - mm: 2-digit minute (00-59)
 * - ss: 2-digit second (00-59)
 *
 * @param date - The date to format
 * @param format - The format pattern (default: 'DD/MM/YYYY')
 * @returns Formatted date string
 *
 * @example
 * formatDate(new Date('2025-03-15'))                // "15/03/2025"
 * formatDate(new Date('2025-03-15'), 'YYYY-MM-DD')  // "2025-03-15"
 * formatDate(new Date('2025-03-15T14:30:00'), 'DD/MM/YYYY HH:mm:ss') // "15/03/2025 14:30:00"
 */
export function formatDate(
  date: Date,
  format: string = 'DD/MM/YYYY',
): string {
  const pad = (n: number): string => n.toString().padStart(2, '0');

  const tokens: Record<string, string> = {
    YYYY: date.getFullYear().toString(),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  };

  let result = format;
  for (const [token, value] of Object.entries(tokens)) {
    result = result.replace(token, value);
  }
  return result;
}

/**
 * Checks if a given date is a business day (not a weekend and not a Vietnamese public holiday).
 *
 * @param date - The date to check
 * @param additionalHolidays - Optional array of additional holiday dates (YYYY-MM-DD format)
 * @returns True if the date is a business day
 *
 * @example
 * isBusinessDay(new Date('2025-03-15')) // false (Saturday)
 * isBusinessDay(new Date('2025-03-17')) // true (Monday)
 * isBusinessDay(new Date('2025-01-01')) // false (New Year)
 */
export function isBusinessDay(
  date: Date,
  additionalHolidays: string[] = [],
): boolean {
  const dayOfWeek = date.getDay();

  // Weekend check: Sunday = 0, Saturday = 6
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Fixed holiday check (MM-DD format)
  const monthDay = formatDate(date, 'MM-DD');
  if (FIXED_HOLIDAYS.includes(monthDay)) {
    return false;
  }

  // Additional holidays check (YYYY-MM-DD format)
  if (additionalHolidays.length > 0) {
    const fullDate = formatDate(date, 'YYYY-MM-DD');
    if (additionalHolidays.includes(fullDate)) {
      return false;
    }
  }

  return true;
}

/**
 * Adds the specified number of business days to a date.
 * Business days exclude weekends and Vietnamese public holidays.
 *
 * @param startDate - The starting date
 * @param days - The number of business days to add (can be negative to subtract)
 * @param additionalHolidays - Optional array of additional holiday dates (YYYY-MM-DD format)
 * @returns A new Date after adding the business days
 *
 * @example
 * // Starting from Friday 2025-03-14, add 3 business days
 * addBusinessDays(new Date('2025-03-14'), 3) // 2025-03-19 (Wed, skipping Sat+Sun)
 */
export function addBusinessDays(
  startDate: Date,
  days: number,
  additionalHolidays: string[] = [],
): Date {
  const result = new Date(startDate);
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);

  while (remaining > 0) {
    result.setDate(result.getDate() + direction);
    if (isBusinessDay(result, additionalHolidays)) {
      remaining--;
    }
  }

  return result;
}

/**
 * Counts the number of business days between two dates (inclusive of start, exclusive of end).
 *
 * @param startDate - The start date
 * @param endDate - The end date
 * @param additionalHolidays - Optional array of additional holiday dates
 * @returns Number of business days
 */
export function countBusinessDays(
  startDate: Date,
  endDate: Date,
  additionalHolidays: string[] = [],
): number {
  let count = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  // Ensure start is before end
  if (current > end) {
    return 0;
  }

  while (current < end) {
    if (isBusinessDay(current, additionalHolidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Returns the start and end of a given date (midnight to 23:59:59.999).
 * Useful for Prisma date range queries.
 */
export function getDateRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

/**
 * Returns the start and end dates of the current month.
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}
