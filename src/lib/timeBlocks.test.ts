import { describe, expect, it } from 'vitest';
import { blockLabel, currentBlock, droppedTime, fromMinutes, timelineHours } from './timeBlocks';

describe('time blocks', () => {
  it('labels a block with its end time, defaulting to 30 minutes', () => {
    expect(blockLabel({ time: '09:00', estimatedMinutes: 45 })).toBe('09:00–09:45');
    expect(blockLabel({ time: '23:50', estimatedMinutes: undefined })).toBe('23:50–23:59');
    expect(blockLabel({ time: undefined, estimatedMinutes: 30 })).toBe('');
  });

  it('keeps minutes past the hour when a block is dropped on another hour', () => {
    expect(droppedTime('09:15', 14)).toBe('14:15');
    expect(droppedTime(undefined, 7)).toBe('07:00');
  });

  it('widens the day for early and late tasks', () => {
    expect(timelineHours([])).toEqual(Array.from({ length: 17 }, (_, i) => i + 6));
    const hours = timelineHours([{ time: '05:30' }, { time: '23:10' }]);
    expect(hours[0]).toBe(5);
    expect(hours[hours.length - 1]).toBe(23);
  });

  it('finds the open block running now and the minutes it has left', () => {
    const tasks = [
      { id: 'a', time: '09:00', estimatedMinutes: 120, completed: false },
      { id: 'b', time: '10:00', estimatedMinutes: 30, completed: false },
      { id: 'c', time: '10:00', estimatedMinutes: 60, completed: true },
    ];
    expect(currentBlock(tasks, 9 * 60 + 15)).toEqual({ task: tasks[0], minutesLeft: 105 });
    expect(currentBlock(tasks, 10 * 60 + 10)).toEqual({ task: tasks[1], minutesLeft: 20 });
    expect(currentBlock(tasks, 11 * 60 + 30)).toBeNull();
    expect(fromMinutes(-5)).toBe('00:00');
  });
});
