import { describe, it, expect } from 'vitest';
import { calculateWarmupDailyLimit } from './queue';

describe('calculateWarmupDailyLimit', () => {
  const target = 30;
  const anchor = '2026-01-01T00:00:00.000Z';

  it('day 0 (anchor day) returns the start volume', () => {
    expect(calculateWarmupDailyLimit(target, anchor, new Date('2026-01-01T12:00:00Z'))).toBe(5);
  });

  it('mid-ramp (day 7) returns an interpolated value between start and target', () => {
    const result = calculateWarmupDailyLimit(target, anchor, new Date('2026-01-08T00:00:00Z'));
    expect(result).toBeGreaterThan(5);
    expect(result).toBeLessThan(30);
  });

  it('day 13 (ramp complete) returns the full target', () => {
    expect(calculateWarmupDailyLimit(target, anchor, new Date('2026-01-14T00:00:00Z'))).toBe(30);
  });

  it('day 30 (long past ramp) stays held at target, does not overshoot', () => {
    expect(calculateWarmupDailyLimit(target, anchor, new Date('2026-01-31T00:00:00Z'))).toBe(30);
  });

  it('target below start volume never exceeds the configured target', () => {
    expect(calculateWarmupDailyLimit(3, anchor, new Date('2026-01-01T00:00:00Z'))).toBe(3);
    expect(calculateWarmupDailyLimit(3, anchor, new Date('2026-01-20T00:00:00Z'))).toBe(3);
  });

  it('null warmup_started_at while enabled defensively treats "now" as day 0', () => {
    const now = new Date('2026-03-01T00:00:00Z');
    expect(calculateWarmupDailyLimit(target, null, now)).toBe(5);
  });
});
