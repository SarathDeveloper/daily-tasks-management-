import { describe, expect, it } from 'vitest';
import {
  financeCategoryError,
  financeCategoryNames,
  INCOME_CATEGORIES,
  isCustomFinanceCategory,
  quickAddCategoryNames,
  reassignDeletedCategoryBudgets,
} from './financeCategories';

describe('financeCategoryNames', () => {
  it('keeps built-in income names first and Other last, then custom names', () => {
    const names = financeCategoryNames('income', [
      { name: 'Bonus', kind: 'income' },
      { name: 'Rent', kind: 'expense' },
      { name: 'Dividend', kind: 'income' },
    ]);

    expect(names.slice(0, INCOME_CATEGORIES.length)).toEqual([
      'Salary',
      'Freelance',
      'Business',
      'Investment',
      'Interest',
      'Gift',
      'Other',
    ]);
    expect(names.slice(INCOME_CATEGORIES.length)).toEqual(['Bonus', 'Dividend']);
  });

  it('appends a name already used on a transaction and skips Transfer', () => {
    const names = financeCategoryNames('expense', [], ['Tuition', 'Food & Dining', 'Transfer']);
    expect(names.at(-1)).toBe('Tuition');
    expect(names.filter((name) => name === 'Food & Dining')).toHaveLength(1);
    expect(names).not.toContain('Transfer');
    expect(financeCategoryNames('expense', [], ['transfer'])).not.toContain('transfer');
  });
});

describe('isCustomFinanceCategory', () => {
  it('is true only for a name the user added on that side', () => {
    const custom = [{ name: 'Groceries', kind: 'expense' as const }];
    expect(isCustomFinanceCategory('groceries', 'expense', custom)).toBe(true);
    expect(isCustomFinanceCategory('Groceries', 'income', custom)).toBe(false);
    expect(isCustomFinanceCategory('Food & Dining', 'expense', custom)).toBe(false);
    expect(
      isCustomFinanceCategory('Food & Dining', 'expense', [{ name: 'Food & Dining', kind: 'expense' }])
    ).toBe(false);
  });
});

describe('reassignDeletedCategoryBudgets', () => {
  it('keeps the limit by moving it to Other, and drops a second limit for that month', () => {
    const now = '2026-10-31T00:00:00.000Z';
    const result = reassignDeletedCategoryBudgets(
      [
        { id: 'groceries-oct', month: '2026-10', category: 'Groceries', limit: 8000 },
        { id: 'groceries-nov', month: '2026-11', category: 'groceries', limit: 1000 },
        { id: 'other-nov', month: '2026-11', category: 'Other', limit: 500 },
      ],
      'Groceries',
      now
    );
    expect(result.droppedIds).toEqual(['groceries-nov']);
    expect(result.budgets).toEqual([
      { id: 'groceries-oct', month: '2026-10', category: 'Other', limit: 8000, updatedAt: now },
      { id: 'other-nov', month: '2026-11', category: 'Other', limit: 500 },
    ]);
  });
});

describe('quickAddCategoryNames', () => {
  it('keeps recent chips and appends a custom expense name that has not been used', () => {
    const names = quickAddCategoryNames(
      ['Food & Dining', 'Transport', 'Shopping'],
      [
        { name: 'Groceries', kind: 'expense' },
        { name: 'Bonus', kind: 'income' },
      ]
    );
    expect(names.slice(0, 3)).toEqual(['Food & Dining', 'Transport', 'Shopping']);
    expect(names).toContain('Groceries');
    expect(names).not.toContain('Bonus');
  });
});

describe('financeCategoryError', () => {
  it('refuses a blank name and a name that already exists on that side', () => {
    expect(financeCategoryError('   ', 'income', [])).toBe('Enter a category name.');
    expect(financeCategoryError('salary', 'income', [])).toBe('That category already exists.');
    expect(
      financeCategoryError('Bonus', 'income', [{ name: 'bonus', kind: 'income' }])
    ).toBe('That category already exists.');
    expect(financeCategoryError('Bonus', 'expense', [{ name: 'Bonus', kind: 'income' }])).toBeNull();
  });
});
