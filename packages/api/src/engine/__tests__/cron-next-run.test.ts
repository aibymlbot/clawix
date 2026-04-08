import { describe, expect, it } from 'vitest';
import { computeNextRun } from '../cron-next-run.js';

describe('computeNextRun', () => {
  describe('at schedule', () => {
    it('returns the time if in the future', () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      const result = computeNextRun({ type: 'at', time: future });
      expect(result).toEqual(new Date(future));
    });

    it('returns null if in the past', () => {
      const past = new Date(Date.now() - 3600000).toISOString();
      const result = computeNextRun({ type: 'at', time: past });
      expect(result).toBeNull();
    });
  });

  describe('every schedule', () => {
    it('computes next run from now for hours', () => {
      const result = computeNextRun({ type: 'every', interval: '1h' });
      expect(result).not.toBeNull();
      const diff = result!.getTime() - Date.now();
      expect(diff).toBeGreaterThan(3595000);
      expect(diff).toBeLessThan(3605000);
    });

    it('computes next run for minutes', () => {
      const result = computeNextRun({ type: 'every', interval: '5m' });
      expect(result).not.toBeNull();
      const diff = result!.getTime() - Date.now();
      expect(diff).toBeGreaterThan(295000);
      expect(diff).toBeLessThan(305000);
    });

    it('computes next run for seconds', () => {
      const result = computeNextRun({ type: 'every', interval: '60s' });
      expect(result).not.toBeNull();
      const diff = result!.getTime() - Date.now();
      expect(diff).toBeGreaterThan(55000);
      expect(diff).toBeLessThan(65000);
    });

    it('returns null for invalid interval', () => {
      expect(computeNextRun({ type: 'every', interval: 'invalid' })).toBeNull();
    });

    it('returns null for zero interval', () => {
      expect(computeNextRun({ type: 'every', interval: '0s' })).toBeNull();
    });
  });

  describe('cron schedule', () => {
    it('computes next occurrence for hourly', () => {
      const result = computeNextRun({ type: 'cron', expression: '0 * * * *' });
      expect(result).not.toBeNull();
      expect(result!.getTime()).toBeGreaterThan(Date.now());
    });

    it('respects timezone', () => {
      const result = computeNextRun({
        type: 'cron',
        expression: '0 9 * * *',
        tz: 'America/New_York',
      });
      expect(result).not.toBeNull();
    });

    it('returns null for invalid expression', () => {
      expect(computeNextRun({ type: 'cron', expression: 'invalid' })).toBeNull();
    });
  });
});
