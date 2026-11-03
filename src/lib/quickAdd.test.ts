import { describe, expect, it } from 'vitest';
import { describeQuickAdd, parseQuickAdd } from './quickAdd';

// Tuesday 3 Nov 2026, mid-morning.
const now = new Date(2026, 10, 3, 10, 30);
const categories = [{ name: 'Work' }, { name: 'Personal' }, { name: 'Health & Fitness' }];
const parse = (text: string) => parseQuickAdd(text, { categories, now });

describe('parseQuickAdd', () => {
  it('reads a monthly bill with time and category', () => {
    expect(parse('Pay electricity bill every 5th at 9am #personal')).toMatchObject({
      title: 'Pay electricity bill',
      date: '2026-11-05',
      time: '09:00',
      category: 'Personal',
      recurrence: { type: 'monthly' },
    });
  });

  it('moves a monthly day already past to next month', () => {
    expect(parse('Rent every 1st').date).toBe('2026-12-01');
  });

  it('clamps day 31 to the end of a short month', () => {
    expect(parse('Close books every 31st').date).toBe('2026-11-30');
  });

  it('understands relative days', () => {
    expect(parse('Call mom tomorrow').date).toBe('2026-11-04');
    expect(parse('Dentist day after tomorrow').date).toBe('2026-11-05');
    expect(parse('Renew passport in 2 weeks').date).toBe('2026-11-17');
    expect(parse('Plain task').date).toBe('2026-11-03');
  });

  it('picks the next matching weekday', () => {
    expect(parse('Standup friday').date).toBe('2026-11-06');
    expect(parse('Review tuesday').date).toBe('2026-11-03');
    expect(parse('Review next tuesday').date).toBe('2026-11-10');
  });

  it('reads day-month dates and rolls past ones into next year', () => {
    expect(parse('Trip on 12 dec').date).toBe('2026-12-12');
    expect(parse('Tax filing jan 15th').date).toBe('2027-01-15');
  });

  it('reads recurring weekdays and weekly days', () => {
    expect(parse('Gym every weekday').recurrence).toEqual({ type: 'weekdays' });
    const weekly = parse('Laundry every saturday');
    expect(weekly.recurrence).toEqual({ type: 'weekly', daysOfWeek: [6] });
    expect(weekly.date).toBe('2026-11-07');
    expect(parse('Water plants every 3 days').recurrence).toEqual({ type: 'custom', intervalDays: 3 });
    expect(parse('Meditate daily').recurrence).toEqual({ type: 'daily' });
  });

  it('reads multi-week and every-other repeats', () => {
    expect(parse('Pay card every 2 weeks').recurrence).toEqual({ type: 'custom', intervalDays: 14 });
    expect(parse('Clean fridge every other week').recurrence).toEqual({ type: 'custom', intervalDays: 14 });
    expect(parse('Payroll fortnightly').recurrence).toEqual({ type: 'custom', intervalDays: 14 });
    expect(parse('Run every other day').recurrence).toEqual({ type: 'custom', intervalDays: 2 });
    expect(parse('Review every 1 week').recurrence).toEqual({ type: 'weekly' });
    expect(describeQuickAdd(parse('Pay card every 2 weeks'), now)[0]).toBe('Every 2 weeks');
    expect(parse('Pay card every 2 weeks').title).toBe('Pay card');
  });

  it('reads times in several shapes', () => {
    expect(parse('Call at 6:30pm').time).toBe('18:30');
    expect(parse('Call 12am').time).toBe('00:00');
    expect(parse('Lunch at noon').time).toBe('12:00');
    expect(parse('Sync at 14:15').time).toBe('14:15');
    expect(parse('Sync at 7').time).toBe('07:00');
    expect(parse('Walk in the evening').time).toBe('18:00');
  });

  it('keeps a duration apart from the time', () => {
    const result = parse('Deep work at 10am for 1.5h');
    expect(result.time).toBe('10:00');
    expect(result.estimatedMinutes).toBe(90);
    expect(result.title).toBe('Deep work');
  });

  it('reads priority markers', () => {
    expect(parse('Ship it !!!').priority).toBe('urgent');
    expect(parse('Ship it !high').priority).toBe('high');
    expect(parse('Ship it p4').priority).toBe('low');
  });

  it('matches categories loosely and keeps unknown hashtags as tags', () => {
    const result = parse('Run 5k #health #outdoors');
    expect(result.category).toBe('Health & Fitness');
    expect(result.tags).toEqual(['outdoors']);
    expect(result.title).toBe('Run 5k');
  });

  it('leaves unrecognised text in the title', () => {
    expect(parse('Buy 2 kg rice').title).toBe('Buy 2 kg rice');
    expect(parse('Read chapter 31st').title).toBe('Read chapter 31st');
  });
});

describe('describeQuickAdd', () => {
  it('lists what was understood', () => {
    expect(describeQuickAdd(parse('Pay rent every 5th at 9am #work !high'), now)).toEqual([
      'Every month',
      'Thu, 5 Nov',
      '09:00',
      'High',
      'Work',
    ]);
    expect(describeQuickAdd(parse('Call tomorrow'), now)).toEqual(['Tomorrow']);
  });
});
