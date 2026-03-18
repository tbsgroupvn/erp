/**
 * Business Hours Calculator
 * Calculates deadlines considering only business hours, weekends, and holidays.
 * Used by: KD-3 (overdraft), TX-3 (COD deadline), escalation rules
 */
import { BadRequestException } from '@nestjs/common';

export interface BusinessHoursConfig {
  workStart: number; // e.g. 8 (8:00 AM)
  workEnd: number; // e.g. 17 (5:00 PM)
  weekends: number[]; // e.g. [0, 6] for Sunday and Saturday
  holidays: string[]; // ISO date strings: ['2026-01-01', '2026-04-30']
}

const DEFAULT_CONFIG: BusinessHoursConfig = {
  workStart: 8,
  workEnd: 17,
  weekends: [0, 6], // Sunday, Saturday
  holidays: [],
};

/**
 * Check if a given date is a business day (not weekend, not holiday).
 */
export function isBusinessDay(date: Date, config: Partial<BusinessHoursConfig> = {}): boolean {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const dayOfWeek = date.getDay();

  if (cfg.weekends.includes(dayOfWeek)) {
    return false;
  }

  const dateStr = date.toISOString().slice(0, 10);
  if (cfg.holidays.includes(dateStr)) {
    return false;
  }

  return true;
}

/**
 * Get the next business day from a given date.
 */
export function nextBusinessDay(date: Date, config: Partial<BusinessHoursConfig> = {}): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);

  while (!isBusinessDay(result, config)) {
    result.setDate(result.getDate() + 1);
  }

  return result;
}

/**
 * Calculate a deadline in business hours from a start time.
 *
 * Example: startTime = Friday 4pm, hours = 4, workEnd = 5pm
 * → 1 hour on Friday, 3 hours on Monday → Monday 11am
 */
export function calculateBusinessHoursDeadline(
  startTime: Date,
  hours: number,
  config: Partial<BusinessHoursConfig> = {},
): Date {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const workHoursPerDay = cfg.workEnd - cfg.workStart;

  if (workHoursPerDay <= 0) {
    throw new BadRequestException('workEnd must be greater than workStart');
  }

  if (hours <= 0) {
    return new Date(startTime);
  }

  let remainingHours = hours;
  const current = new Date(startTime);

  // If start time is not a business day, move to next business day start
  if (!isBusinessDay(current, cfg)) {
    const nextBd = nextBusinessDay(current, cfg);
    nextBd.setHours(cfg.workStart, 0, 0, 0);
    current.setTime(nextBd.getTime());
  }

  // If before work hours, move to work start
  if (current.getHours() < cfg.workStart) {
    current.setHours(cfg.workStart, 0, 0, 0);
  }

  // If after work hours, move to next business day start
  if (current.getHours() >= cfg.workEnd) {
    const nextBd = nextBusinessDay(current, cfg);
    nextBd.setHours(cfg.workStart, 0, 0, 0);
    current.setTime(nextBd.getTime());
  }

  while (remainingHours > 0) {
    // Hours remaining in current business day
    const currentHour = current.getHours() + current.getMinutes() / 60;
    const hoursLeftToday = cfg.workEnd - currentHour;

    if (remainingHours <= hoursLeftToday) {
      // Deadline falls within today
      current.setTime(current.getTime() + remainingHours * 60 * 60 * 1000);
      remainingHours = 0;
    } else {
      // Consume remaining hours today and move to next business day
      remainingHours -= hoursLeftToday;
      const nextBd = nextBusinessDay(current, cfg);
      nextBd.setHours(cfg.workStart, 0, 0, 0);
      current.setTime(nextBd.getTime());
    }
  }

  return current;
}

/**
 * Calculate the number of business hours between two dates.
 */
export function businessHoursBetween(
  start: Date,
  end: Date,
  config: Partial<BusinessHoursConfig> = {},
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (end <= start) return 0;

  let totalHours = 0;
  const current = new Date(start);

  while (current < end) {
    if (isBusinessDay(current, cfg)) {
      const dayStart = new Date(current);
      dayStart.setHours(cfg.workStart, 0, 0, 0);

      const dayEnd = new Date(current);
      dayEnd.setHours(cfg.workEnd, 0, 0, 0);

      const effectiveStart = current > dayStart ? current : dayStart;
      const effectiveEnd = end < dayEnd ? end : dayEnd;

      if (effectiveStart < effectiveEnd) {
        totalHours += (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);
      }
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(cfg.workStart, 0, 0, 0);
  }

  return totalHours;
}
