import { describe, it, expect } from 'vitest';
import { percent, currency, basisPoints, compactAum, number } from './format';

describe('percent', () => {
  it('formats 0.0325 as 3.25%', () => {
    expect(percent(0.0325)).toBe('3.25%');
  });
  it('handles null', () => {
    expect(percent(null)).toBe('--');
  });
  it('handles custom decimals', () => {
    expect(percent(0.1, 1)).toBe('10.0%');
  });
});

describe('currency', () => {
  it('formats 10000 with commas and cents', () => {
    expect(currency(10000)).toBe('$10,000.00');
  });
  it('handles null', () => {
    expect(currency(null)).toBe('--');
  });
});

describe('basisPoints', () => {
  it('formats 0.0003 as 3 bps', () => {
    expect(basisPoints(0.0003)).toBe('3 bps');
  });
  it('handles null', () => {
    expect(basisPoints(null)).toBe('--');
  });
});

describe('compactAum', () => {
  it('formats billions', () => {
    expect(compactAum(1_200_000_000)).toBe('$1.2B');
  });
  it('formats millions', () => {
    expect(compactAum(500_000_000)).toBe('$500.0M');
  });
  it('handles null', () => {
    expect(compactAum(null)).toBe('--');
  });
  it('formats trillions', () => {
    expect(compactAum(2_500_000_000_000)).toBe('$2.5T');
  });
});

describe('number', () => {
  it('formats with commas', () => {
    expect(number(10000)).toBe('10,000');
  });
  it('handles decimals', () => {
    expect(number(1234.567, 2)).toBe('1,234.57');
  });
});
