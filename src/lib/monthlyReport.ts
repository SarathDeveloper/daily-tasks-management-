import type { Account, FinanceTransaction } from '../types';
import { monthLabelFromKey } from './dateFormat';
import { shiftMonthKey } from './ledger';
import { formatRupees, fromPaise, toPaise } from './money';
import type { PdfLine } from './simplePdf';

/**
 * Month summary for the finance report and its CSV/PDF export. Transfers move
 * money between the user's own accounts, so they never count as income or
 * spending. Sums are done in paise.
 */
export interface CategoryLine {
  category: string;
  /** Rupees spent this month. */
  amount: number;
  /** Rupees spent in the same category the month before. */
  previous: number;
  /** Share of this month's spending, 0–100. */
  share: number;
}

export interface MonthlyReport {
  month: string;
  income: number;
  expense: number;
  net: number;
  previousIncome: number;
  previousExpense: number;
  /** Percent change in spending vs last month; null when last month had none. */
  expenseChange: number | null;
  categories: CategoryLine[];
  topSpends: FinanceTransaction[];
  /** Day with the most spending, and how much. */
  biggestDay: { date: string; amount: number } | null;
  /** Average spend per day, over the days elapsed so far for the current month. */
  dailyAverage: number;
  entryCount: number;
}

function totals(transactions: FinanceTransaction[], month: string) {
  let incomePaise = 0;
  let expensePaise = 0;
  const byCategory = new Map<string, number>();
  const byDay = new Map<string, number>();
  const monthTx: FinanceTransaction[] = [];
  for (const tx of transactions) {
    if (!tx.date?.startsWith(month)) continue;
    monthTx.push(tx);
    const paise = toPaise(tx.amount);
    if (tx.type === 'income') incomePaise += paise;
    if (tx.type !== 'expense') continue;
    expensePaise += paise;
    const category = tx.category || 'Other';
    byCategory.set(category, (byCategory.get(category) ?? 0) + paise);
    byDay.set(tx.date, (byDay.get(tx.date) ?? 0) + paise);
  }
  return { incomePaise, expensePaise, byCategory, byDay, monthTx };
}

function daysCounted(month: string, today: string): number {
  const [year, monthIndex] = month.split('-').map(Number);
  const inMonth = new Date(year, monthIndex, 0).getDate();
  if (today.startsWith(month)) return Number(today.slice(8, 10));
  return today < month ? 0 : inMonth;
}

export function buildMonthlyReport(
  transactions: FinanceTransaction[],
  month: string,
  today: string
): MonthlyReport {
  const current = totals(transactions, month);
  const previous = totals(transactions, shiftMonthKey(month, -1));

  const categories = [...new Set([...current.byCategory.keys()])]
    .map((category) => {
      const paise = current.byCategory.get(category) ?? 0;
      return {
        category,
        amount: fromPaise(paise),
        previous: fromPaise(previous.byCategory.get(category) ?? 0),
        share: current.expensePaise > 0 ? Math.round((paise / current.expensePaise) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const topSpends = current.monthTx
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))
    .slice(0, 5);

  let biggestDay: MonthlyReport['biggestDay'] = null;
  for (const [date, paise] of current.byDay) {
    if (!biggestDay || paise > toPaise(biggestDay.amount)) biggestDay = { date, amount: fromPaise(paise) };
  }

  const days = daysCounted(month, today);
  return {
    month,
    income: fromPaise(current.incomePaise),
    expense: fromPaise(current.expensePaise),
    net: fromPaise(current.incomePaise - current.expensePaise),
    previousIncome: fromPaise(previous.incomePaise),
    previousExpense: fromPaise(previous.expensePaise),
    expenseChange:
      previous.expensePaise > 0
        ? Math.round(((current.expensePaise - previous.expensePaise) / previous.expensePaise) * 1000) / 10
        : null,
    categories,
    topSpends,
    biggestDay,
    dailyAverage: days > 0 ? fromPaise(Math.round(current.expensePaise / days)) : 0,
    entryCount: current.monthTx.length,
  };
}

function csvCell(value: string | number | undefined): string {
  const text = value === undefined || value === null ? '' : String(value);
  // A leading = + - @ would run as a formula in Excel or Sheets.
  const safe = /^[=+\-@]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Every entry in the month, oldest first, with account names instead of ids. */
export function monthlyCsv(
  transactions: FinanceTransaction[],
  month: string,
  accounts: Pick<Account, 'id' | 'name'>[]
): string {
  const accountName = (id?: string) => (id ? accounts.find((a) => a.id === id)?.name ?? '' : '');
  const rows = transactions
    .filter((tx) => tx.date?.startsWith(month))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  const header = ['Date', 'Time', 'Type', 'Category', 'Amount', 'Account', 'To account', 'Payment', 'Note'];
  const lines = [header.join(',')];
  for (const tx of rows) {
    lines.push(
      [
        tx.date,
        tx.time,
        tx.type,
        tx.category,
        fromPaise(toPaise(tx.amount)).toFixed(2),
        accountName(tx.accountId),
        accountName(tx.destinationAccountId),
        tx.paymentMethod,
        tx.note,
      ]
        .map(csvCell)
        .join(',')
    );
  }
  // CRLF and a BOM so Excel opens it as UTF-8 with rows intact.
  return `﻿${lines.join('\r\n')}\r\n`;
}

const money = formatRupees;

function changeText(now: number, before: number): string {
  if (before <= 0) return now > 0 ? 'new' : '';
  const pct = Math.round(((now - before) / before) * 100);
  return pct === 0 ? 'same as last month' : `${pct > 0 ? '+' : ''}${pct}% vs last month`;
}

export function monthlyReportPdfLines(report: MonthlyReport): PdfLine[] {
  const lines: PdfLine[] = [
    { text: `Dayflow money report - ${monthLabelFromKey(report.month)}`, size: 18, bold: true },
    { text: `Generated ${new Date().toLocaleDateString('en-IN')}`, size: 9, gap: 2 },
    { text: 'Summary', size: 13, bold: true, gap: 14 },
    { text: 'Income', right: money(report.income) },
    { text: 'Spending', right: money(report.expense) },
    { text: 'Net', right: money(report.net), bold: true },
    {
      text: `Spending ${changeText(report.expense, report.previousExpense) || 'with no spending last month'}`,
      size: 9,
      gap: 2,
    },
    { text: 'Average per day', right: money(report.dailyAverage) },
  ];
  if (report.biggestDay) {
    lines.push({ text: `Biggest day: ${report.biggestDay.date}`, right: money(report.biggestDay.amount) });
  }
  lines.push({ text: 'Spending by category', size: 13, bold: true, gap: 14 });
  if (report.categories.length === 0) lines.push({ text: 'No spending this month.' });
  for (const line of report.categories) {
    const change = changeText(line.amount, line.previous);
    lines.push({
      text: `${line.category} (${line.share}%)${change ? ` - ${change}` : ''}`,
      right: money(line.amount),
    });
  }
  if (report.topSpends.length > 0) {
    lines.push({ text: 'Biggest spends', size: 13, bold: true, gap: 14 });
    for (const tx of report.topSpends) {
      lines.push({
        text: `${tx.date}  ${tx.category}${tx.note ? ` - ${tx.note}` : ''}`.slice(0, 80),
        right: money(tx.amount),
      });
    }
  }
  lines.push({ text: `${report.entryCount} entries this month.`, size: 9, gap: 14 });
  return lines;
}
