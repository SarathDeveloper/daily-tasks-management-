import type { Category, Priority, TaskRecurrence } from '../types';
import { todayString } from './ledger';

/**
 * Natural-language quick add: "Pay rent every 5th at 9am #home !high for 15m".
 * Whatever is not recognised stays in the title, so a typo never loses text.
 */
export interface QuickAddResult {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  priority?: Priority;
  category?: string;
  tags: string[];
  estimatedMinutes?: number;
  recurrence: TaskRecurrence;
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const WEEKDAY = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|rsday|urday|sday)?';
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
const ORDINAL = '(\\d{1,2})(?:st|nd|rd|th)?';

function weekdayIndex(word: string): number {
  return WEEKDAYS.findIndex((day) => day.startsWith(word.slice(0, 3).toLowerCase()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The next date (today counts) falling on `weekday`. */
function nextWeekday(from: Date, weekday: number, skipToday = false): Date {
  let diff = (weekday - from.getDay() + 7) % 7;
  if (diff === 0 && skipToday) diff = 7;
  return addDays(from, diff);
}

/** The next date (today counts) on day-of-month `day`, clamped to short months. */
function nextDayOfMonth(from: Date, day: number): Date {
  const clamp = (year: number, month: number) =>
    new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));
  const thisMonth = clamp(from.getFullYear(), from.getMonth());
  if (thisMonth.getDate() >= from.getDate()) return thisMonth;
  return clamp(from.getFullYear(), from.getMonth() + 1);
}

function to24h(hourRaw: string, minuteRaw: string | undefined, meridiem: string | undefined): string | null {
  let hour = Number(hourRaw);
  const minute = minuteRaw ? Number(minuteRaw) : 0;
  if (minute > 59) return null;
  const ampm = meridiem?.toLowerCase();
  if (ampm) {
    if (hour < 1 || hour > 12) return null;
    if (ampm.startsWith('p') && hour !== 12) hour += 12;
    if (ampm.startsWith('a') && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function matchCategory(word: string, categories: Pick<Category, 'name'>[]): string | undefined {
  const key = word.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!key) return undefined;
  const squash = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    categories.find((cat) => squash(cat.name) === key)?.name ??
    categories.find((cat) => squash(cat.name).startsWith(key))?.name ??
    categories.find((cat) => cat.name.toLowerCase().split(/[^a-z0-9]+/).includes(key))?.name
  );
}

export function parseQuickAdd(
  input: string,
  options: {
    categories?: Pick<Category, 'name'>[];
    now?: Date;
    /** Used when the text names no date, e.g. the day open in the planner. */
    defaultDate?: string;
  } = {}
): QuickAddResult {
  const now = options.now ?? new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let text = ` ${input.replace(/\s+/g, ' ').trim()} `;
  let date: Date | undefined;
  let time: string | undefined;
  let priority: Priority | undefined;
  let category: string | undefined;
  let estimatedMinutes: number | undefined;
  let recurrence: TaskRecurrence = { type: 'none' };
  const tags: string[] = [];

  /** Runs `pattern` once; on a match calls `apply` and cuts the text out unless it returns false. */
  const take = (pattern: RegExp, apply: (match: RegExpMatchArray) => boolean | void) => {
    const match = text.match(pattern);
    if (!match || match.index === undefined) return;
    if (apply(match) === false) return;
    text = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`;
  };
  const word = (body: string) => new RegExp(`\\s${body}(?=\\s)`, 'i');

  // Recurrence first, so "every monday" is not read as a one-off "monday", and
  // "every 3 days" before "every 3rd".
  take(word(`every\\s+(\\d{1,3})\\s+days?`), (m) => {
    const interval = Number(m[1]);
    if (interval < 1) return false;
    recurrence = interval === 1 ? { type: 'daily' } : { type: 'custom', intervalDays: interval };
  });
  take(word(`every\\s+(\\d{1,2})\\s+weeks?`), (m) => {
    const weeks = Number(m[1]);
    if (weeks < 1) return false;
    recurrence = weeks === 1 ? { type: 'weekly' } : { type: 'custom', intervalDays: weeks * 7 };
  });
  take(word('(?:every\\s+other\\s+week|biweekly|fortnightly)'), () => {
    recurrence = { type: 'custom', intervalDays: 14 };
  });
  take(word('every\\s+other\\s+day'), () => {
    recurrence = { type: 'custom', intervalDays: 2 };
  });
  take(word(`every\\s+${ORDINAL}(?:\\s+of\\s+(?:the|every)\\s+month)?`), (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    recurrence = { type: 'monthly' };
    date = nextDayOfMonth(today, day);
  });
  take(word('(?:every\\s+day|everyday|daily)'), () => {
    recurrence = { type: 'daily' };
  });
  take(word('(?:every\\s+weekdays?|on\\s+weekdays|weekdays)'), () => {
    recurrence = { type: 'weekdays' };
    date = today.getDay() === 0 ? addDays(today, 1) : today.getDay() === 6 ? addDays(today, 2) : today;
  });
  take(word(`every\\s+${WEEKDAY}`), (m) => {
    const weekday = weekdayIndex(m[1]);
    recurrence = { type: 'weekly', daysOfWeek: [weekday] };
    date = nextWeekday(today, weekday);
  });
  take(word('(?:every\\s+week|weekly)'), () => {
    recurrence = { type: 'weekly' };
  });
  take(word('(?:every\\s+month|monthly)'), () => {
    recurrence = { type: 'monthly' };
  });

  // One-off dates.
  take(word('(?:day\\s+after\\s+tomorrow|day\\s+after\\s+tmrw?)'), () => {
    date = addDays(today, 2);
  });
  take(word('(?:tomorrow|tmrw?|tmw)'), () => {
    date = addDays(today, 1);
  });
  take(word('(?:today|tonight)'), (m) => {
    date = today;
    if (/tonight/i.test(m[0]) && !time) time = '20:00';
  });
  take(word('in\\s+(\\d{1,3})\\s+(days?|weeks?)'), (m) => {
    const amount = Number(m[1]);
    date = addDays(today, /week/i.test(m[2]) ? amount * 7 : amount);
  });
  take(word('next\\s+week'), () => {
    date = nextWeekday(today, 1, true);
  });
  take(word(`(?:(next|this|on)\\s+)?${WEEKDAY}`), (m) => {
    date = nextWeekday(today, weekdayIndex(m[2]), m[1]?.toLowerCase() === 'next');
  });
  take(word(`(?:on\\s+)?(?:${ORDINAL}\\s+${MONTH}|${MONTH}\\s+${ORDINAL})`), (m) => {
    const day = Number(m[1] ?? m[4]);
    const month = MONTHS.indexOf((m[2] ?? m[3]).slice(0, 3).toLowerCase());
    if (day < 1 || day > 31 || month < 0) return false;
    let candidate = new Date(today.getFullYear(), month, day);
    if (candidate.getMonth() !== month) return false;
    if (candidate < today) candidate = new Date(today.getFullYear() + 1, month, day);
    date = candidate;
  });
  take(word(`on\\s+(?:the\\s+)?${ORDINAL}`), (m) => {
    const day = Number(m[1]);
    if (day < 1 || day > 31) return false;
    date = nextDayOfMonth(today, day);
  });

  // Duration before time, so "for 2h" is not read as 2 o'clock.
  take(word('for\\s+(\\d+(?:\\.\\d+)?)\\s*(h|hrs?|hours?|m|mins?|minutes?)'), (m) => {
    const value = Number(m[1]);
    const minutes = Math.round(/^h/i.test(m[2]) ? value * 60 : value);
    if (minutes < 1) return false;
    estimatedMinutes = minutes;
  });

  take(word('(?:at\\s+)?(noon|midnight)'), (m) => {
    time = m[1].toLowerCase() === 'noon' ? '12:00' : '00:00';
  });
  take(word('(?:at\\s+)?(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|a\\.m\\.|p\\.m\\.)'), (m) => {
    const parsed = to24h(m[1], m[2], m[3]);
    if (!parsed) return false;
    time = parsed;
  });
  take(word('(?:at\\s+)?(\\d{1,2}):(\\d{2})'), (m) => {
    const parsed = to24h(m[1], m[2], undefined);
    if (!parsed) return false;
    time = parsed;
  });
  take(word('at\\s+(\\d{1,2})'), (m) => {
    const parsed = to24h(m[1], undefined, undefined);
    if (!parsed) return false;
    time = parsed;
  });
  take(word('(?:in\\s+the\\s+)?(morning|afternoon|evening)'), (m) => {
    if (time) return false;
    time = { morning: '09:00', afternoon: '14:00', evening: '18:00' }[m[1].toLowerCase()];
  });

  take(word('(!{1,3}|!urgent|!high|!medium|!low|p[1-4])'), (m) => {
    const token = m[1].toLowerCase();
    const map: Record<string, Priority> = {
      '!!!': 'urgent',
      '!!': 'high',
      '!': 'high',
      '!urgent': 'urgent',
      '!high': 'high',
      '!medium': 'medium',
      '!low': 'low',
      p1: 'urgent',
      p2: 'high',
      p3: 'medium',
      p4: 'low',
    };
    priority = map[token];
  });

  // #word picks the first matching category; every other #word becomes a tag.
  for (let guard = 0; guard < 20; guard += 1) {
    const before = text;
    take(word('#([A-Za-z0-9_-]+)'), (m) => {
      const matched = !category ? matchCategory(m[1], options.categories ?? []) : undefined;
      if (matched) category = matched;
      else if (!tags.includes(m[1].toLowerCase())) tags.push(m[1].toLowerCase());
    });
    if (text === before) break;
  }

  const title = text.replace(/\s+/g, ' ').trim();
  return {
    title,
    date: date ? todayString(date) : options.defaultDate ?? todayString(today),
    time,
    priority,
    category,
    tags,
    estimatedMinutes,
    recurrence,
  };
}

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Every day',
  weekdays: 'Weekdays',
  weekly: 'Every week',
  monthly: 'Every month',
};

/** Short chips describing what the parser understood, for the live preview. */
export function describeQuickAdd(result: QuickAddResult, now: Date = new Date()): string[] {
  const chips: string[] = [];
  const today = todayString(now);
  const tomorrow = todayString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  if (result.recurrence.type === 'custom') {
    const days = result.recurrence.intervalDays ?? 1;
    chips.push(days % 7 === 0 ? `Every ${days / 7} weeks` : `Every ${days} days`);
  } else if (result.recurrence.type === 'weekly' && result.recurrence.daysOfWeek?.length) {
    const name = WEEKDAYS[result.recurrence.daysOfWeek[0]];
    chips.push(`Every ${name[0].toUpperCase()}${name.slice(1)}`);
  } else if (result.recurrence.type !== 'none') {
    chips.push(RECURRENCE_LABELS[result.recurrence.type]);
  }
  if (result.date === today) chips.push('Today');
  else if (result.date === tomorrow) chips.push('Tomorrow');
  else {
    const [y, m, d] = result.date.split('-').map(Number);
    chips.push(
      new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    );
  }
  if (result.time) chips.push(result.time);
  if (result.estimatedMinutes) chips.push(`${result.estimatedMinutes} min`);
  if (result.priority) chips.push(result.priority[0].toUpperCase() + result.priority.slice(1));
  if (result.category) chips.push(result.category);
  for (const tag of result.tags) chips.push(`#${tag}`);
  return chips;
}
