import React from 'react';
import { AlertTriangle, X, TrendingUp } from 'lucide-react';
import type { BudgetAlert } from '../types';
import { formatAlertMessage } from '../lib/budgetAlerts';

interface FinanceAlertBannerProps {
  alerts: BudgetAlert[];
  onDismiss: (key: string) => void;
}

export const FinanceAlertBanner: React.FC<FinanceAlertBannerProps> = ({
  alerts,
  onDismiss,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const isCritical = alert.level === 'critical';
        const Icon = isCritical ? AlertTriangle : TrendingUp;
        return (
          <div
            key={alert.key}
            className={`flex items-start gap-2.5 p-3 rounded-2xl border shadow-sm transition-colors ${
              isCritical
                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200'
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 mt-0.5 ${
                isCritical ? 'text-rose-500' : 'text-amber-500'
              }`}
            />
            <p className="text-xs font-semibold flex-1 leading-relaxed">
              {formatAlertMessage(alert)}
            </p>
            <button
              onClick={() => onDismiss(alert.key)}
              className="shrink-0 p-1 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800/60 transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
