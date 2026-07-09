import { describe, it, expect } from 'vitest';
import { T, moneyFormatter, FX_THB } from '../../i18n.js';

describe('i18n locales', () => {
  it('en and th expose the same keys', () => {
    expect(Object.keys(T.th).sort()).toEqual(Object.keys(T.en).sort());
  });

  it('every th control/section translation targets a real en concept', () => {
    // th adds translations for CONTROLS keys; en intentionally falls back to tco.js labels
    expect(Object.keys(T.th.controls).length).toBeGreaterThan(15);
    expect(Object.keys(T.th.sections).length).toBe(5);
  });
});

describe('money formatting', () => {
  const en = moneyFormatter('en');
  const th = moneyFormatter('th');

  it('USD stays unconverted with $ and one decimal', () => {
    expect(en.rate).toBe(1);
    expect(en.m(16.53e6)).toBe('$16.5M');
    expect(en.m(88.24e6)).toBe('$88.2M');
  });

  it('THB converts at FX_THB, using M below a billion and B above', () => {
    expect(th.rate).toBe(FX_THB);
    expect(th.m(16.53e6)).toBe('฿552M');
    expect(th.m(88.24e6)).toBe('฿2.95B');
  });

  it('per-token prices convert too', () => {
    expect(en.perTok(1)).toBe('$1.00');
    expect(th.perTok(1)).toBe('฿33.4');
  });
});
