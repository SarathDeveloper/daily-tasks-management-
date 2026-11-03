import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import type { Account, FinanceTransaction } from '../types';
import { isShareCancel, saveBackupFile } from '../lib/backup';
import { todayString } from '../lib/ledger';
import { formatRupees } from '../lib/money';
import { buildMonthlyReport, monthlyCsv, monthlyReportPdfLines } from '../lib/monthlyReport';
import { isNativeAndroid } from '../lib/platform';
import { buildPdf } from '../lib/simplePdf';
import { DayflowAlarm } from '../services/dayflowAlarm';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface MonthlyReportCardProps {
  transactions: FinanceTransaction[];
  accounts: Account[];
  month: string; // YYYY-MM
}

async function shareFile(contents: string, filename: string, mimeType: string, title: string) {
  if (isNativeAndroid()) {
    await DayflowAlarm.shareBackup({ filename, contents, mimeType, title });
  } else {
    await saveBackupFile(contents, filename, { type: mimeType, title });
  }
}

/** Month summary with the biggest spends and CSV / PDF export. */
export const MonthlyReportCard: React.FC<MonthlyReportCardProps> = ({ transactions, accounts, month }) => {
  const report = useMemo(
    () => buildMonthlyReport(transactions, month, todayString()),
    [transactions, month]
  );
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const exportAs = async (kind: 'csv' | 'pdf') => {
    setExporting(kind);
    try {
      if (kind === 'csv') {
        await shareFile(
          monthlyCsv(transactions, month, accounts),
          `dayflow-money-${month}.csv`,
          'text/csv',
          'Share money report'
        );
      } else {
        await shareFile(
          buildPdf(monthlyReportPdfLines(report)),
          `dayflow-money-${month}.pdf`,
          'application/pdf',
          'Share money report'
        );
      }
    } catch (error) {
      if (!isShareCancel(error)) {
        console.warn('Report export failed:', error);
        alert('Could not export the report.');
      }
    } finally {
      setExporting(null);
    }
  };

  const change = report.expenseChange;
  const spentMore = change !== null && change > 0;

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Monthly report</span>
          </h3>
          {change !== null ? (
            <p
              className={`text-xs font-semibold mt-1 flex items-center gap-1 ${
                spentMore ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {spentMore ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {change === 0
                ? 'Spending same as last month'
                : `Spending ${spentMore ? 'up' : 'down'} ${Math.abs(change)}% vs last month (${formatRupees(report.previousExpense)})`}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">No spending last month to compare.</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={exporting !== null || report.entryCount === 0}
            onClick={() => void exportAs('csv')}
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting === 'csv' ? 'Exporting…' : 'CSV'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={exporting !== null || report.entryCount === 0}
            onClick={() => void exportAs('pdf')}
          >
            <FileText className="w-4 h-4" />
            {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Average per day</p>
          <p className="text-base font-black text-slate-900 dark:text-white">{formatRupees(report.dailyAverage)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Biggest day</p>
          <p className="text-base font-black text-slate-900 dark:text-white">
            {report.biggestDay ? formatRupees(report.biggestDay.amount) : '—'}
          </p>
          {report.biggestDay && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{report.biggestDay.date}</p>
          )}
        </div>
      </div>

      {report.topSpends.length > 0 && (
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Biggest spends</p>
          <ul className="space-y-1.5">
            {report.topSpends.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400 dark:text-slate-500 mr-1.5">{tx.date.slice(8)}</span>
                  {tx.note || tx.category}
                  {tx.note && <span className="text-slate-400 dark:text-slate-500"> · {tx.category}</span>}
                </span>
                <span className="font-bold text-slate-900 dark:text-white shrink-0">{formatRupees(tx.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
};
