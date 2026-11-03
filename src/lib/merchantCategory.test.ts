import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../data/financeCategories';
import { normalizeMerchant, suggestCategory } from './merchantCategory';

const expense = [...EXPENSE_CATEGORIES];
const income = [...INCOME_CATEGORIES];

describe('normalizeMerchant', () => {
  it('drops punctuation and company suffixes', () => {
    expect(normalizeMerchant('SWIGGY PVT LTD.')).toBe('swiggy');
    expect(normalizeMerchant('www.amazon.in')).toBe('amazon');
  });
});

describe('suggestCategory', () => {
  it('uses keyword rules for merchants never seen before', () => {
    expect(suggestCategory('Zomato Ltd', 'expense', [], expense)).toBe('Food & Dining');
    expect(suggestCategory('HPCL Petrol Pump', 'expense', [], expense)).toBe('Fuel');
    expect(suggestCategory('UBER INDIA', 'expense', [], expense)).toBe('Transport');
    expect(suggestCategory('Airtel Payments', 'expense', [], expense)).toBe('Bills & Utilities');
    expect(suggestCategory('ACME PAYROLL', 'income', [], income)).toBe('Salary');
  });

  it('does not match keywords inside other words', () => {
    expect(suggestCategory('Parent Teacher Assoc', 'expense', [], expense)).toBeUndefined();
    expect(suggestCategory('Las Vegas Grill', 'expense', [], expense)).toBeUndefined();
  });

  it('prefers the category last used for the same merchant', () => {
    const history = [
      { type: 'expense' as const, note: 'Amazon', category: 'Shopping', date: '2026-10-01', updatedAt: 'a' },
      { type: 'expense' as const, note: 'AMAZON PVT LTD', category: 'Education', date: '2026-10-20', updatedAt: 'b' },
      { type: 'expense' as const, note: 'Amazon', category: 'Other', date: '2026-10-25', updatedAt: 'c' },
    ];
    expect(suggestCategory('amazon', 'expense', history, expense)).toBe('Education');
  });

  it('ignores learned categories that are not available', () => {
    const history = [
      { type: 'expense' as const, note: 'Swiggy', category: 'Deleted Cat', date: '2026-10-01', updatedAt: 'a' },
    ];
    expect(suggestCategory('Swiggy', 'expense', history, expense)).toBe('Food & Dining');
  });

  it('returns nothing without a merchant', () => {
    expect(suggestCategory(undefined, 'expense', [], expense)).toBeUndefined();
    expect(suggestCategory('Someone Random', 'expense', [], expense)).toBeUndefined();
  });
});
