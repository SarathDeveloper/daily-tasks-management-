import { describe, expect, it } from 'vitest';
import type { FinanceTransaction } from '../types';
import { buildMonthlyReport, monthlyCsv, monthlyReportPdfLines } from './monthlyReport';
import { buildPdf } from './simplePdf';

let seq = 0;
function tx(partial: Partial<FinanceTransaction>): FinanceTransaction {
  seq += 1;
  return {
    id: `tx-${seq}`,
    type: 'expense',
    amount: 0,
    category: 'Other',
    date: '2026-11-01',
    recurrence: { type: 'none' },
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...partial,
  };
}

const transactions = [
  tx({ type: 'income', amount: 50000, category: 'Salary', date: '2026-11-01' }),
  tx({ amount: 0.1, category: 'Food & Dining', date: '2026-11-01' }),
  tx({ amount: 0.2, category: 'Food & Dining', date: '2026-11-02' }),
  tx({ amount: 1200, category: 'Shopping', date: '2026-11-02', note: 'Amazon' }),
  tx({ type: 'transfer', amount: 9999, category: 'Transfer', date: '2026-11-02', accountId: 'a1', destinationAccountId: 'a2' }),
  tx({ amount: 800, category: 'Shopping', date: '2026-10-15' }),
  tx({ amount: 200, category: 'Food & Dining', date: '2026-10-20' }),
];

describe('buildMonthlyReport', () => {
  const report = buildMonthlyReport(transactions, '2026-11', '2026-11-03');

  it('totals income and spending without float drift or transfers', () => {
    expect(report.income).toBe(50000);
    expect(report.expense).toBe(1200.3);
    expect(report.net).toBe(48799.7);
    expect(report.entryCount).toBe(5);
  });

  it('compares with last month', () => {
    expect(report.previousExpense).toBe(1000);
    expect(report.expenseChange).toBe(20);
    const shopping = report.categories[0];
    expect(shopping).toMatchObject({ category: 'Shopping', amount: 1200, previous: 800 });
  });

  it('lists the biggest spends and day', () => {
    expect(report.topSpends.map((t) => t.amount)).toEqual([1200, 0.2, 0.1]);
    expect(report.biggestDay).toEqual({ date: '2026-11-02', amount: 1200.2 });
  });

  it('averages over the days elapsed in the current month', () => {
    expect(report.dailyAverage).toBe(400.1);
    expect(buildMonthlyReport(transactions, '2026-10', '2026-11-03').dailyAverage).toBeCloseTo(32.26, 2);
  });
});

describe('monthlyCsv', () => {
  it('writes one row per entry with account names, escaping risky cells', () => {
    const csv = monthlyCsv(
      [...transactions, tx({ amount: 5, date: '2026-11-03', note: '=HYPERLINK("x"), ok' })],
      '2026-11',
      [
        { id: 'a1', name: 'YES Bank' },
        { id: 'a2', name: 'Cash, Wallet' },
      ]
    );
    const rows = csv.replace(/^﻿/, '').trim().split('\r\n');
    expect(rows[0]).toBe('Date,Time,Type,Category,Amount,Account,To account,Payment,Note');
    expect(rows).toHaveLength(7);
    expect(csv).toContain('transfer,Transfer,9999.00,YES Bank,"Cash, Wallet"');
    expect(rows[6]).toContain(`"'=HYPERLINK(""x""), ok"`);
  });
});

describe('PDF export', () => {
  it('produces a well-formed PDF with the report text', () => {
    const pdf = buildPdf(monthlyReportPdfLines(buildMonthlyReport(transactions, '2026-11', '2026-11-03')));
    expect(pdf.startsWith('%PDF-1.4')).toBe(true);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf).toContain('Spending by category');
    expect(pdf).toContain('Rs. 1,200');
    expect(pdf).not.toMatch(/[^\x00-\x7f]/);
    const xref = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
  });

  it('starts a new page when the text runs long', () => {
    const pdf = buildPdf(Array.from({ length: 120 }, (_, i) => ({ text: `Line ${i}` })));
    expect(pdf).toMatch(/\/Count 3/);
  });
});
