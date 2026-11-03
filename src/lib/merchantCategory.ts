import type { FinanceTransaction } from '../types';

/**
 * Category suggestion for a bank spend, from the merchant name.
 * Learned first: the category last used for the same merchant wins. Built-in
 * keyword rules cover merchants the user has never confirmed.
 */

const EXPENSE_RULES: [RegExp, string][] = [
  [/swiggy|zomato|domino|pizza|kfc|mcdonald|burger|cafe|coffee|starbucks|restaurant|hotel|bakery|eatclub|faasos|haldiram|chai/, 'Food & Dining'],
  [/blinkit|zepto|instamart|bigbasket|dmart|grocer|supermarket|kirana|reliance\s*fresh|more\s*retail/, 'Food & Dining'],
  [/petrol|diesel|fuel|hpcl|bpcl|iocl|indian\s*oil|bharat\s*petroleum|hindustan\s*petroleum|shell|nayara/, 'Fuel'],
  [/uber|ola(?:cabs)?\b|rapido|metro|irctc|railway|redbus|makemytrip|goibibo|indigo|air\s*india|akasa|spicejet|fastag|parking|toll|namma\s*yatri/, 'Transport'],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|tata\s*cliq|croma|decathlon|ikea|lifestyle|westside|shoppers\s*stop/, 'Shopping'],
  [/airtel|jio|vodafone|\bvi\b|bsnl|act\s*fibernet|electricity|bescom|tneb|tangedco|msedcl|adani\s*electric|water\s*board|\bgas\b|indane|bharatgas|broadband|dth|tata\s*play|recharge|bill\s*pay/, 'Bills & Utilities'],
  [/\brent\b|nobroker|housing|society|maintenance/, 'Rent & Housing'],
  [/pharm|apollo|medplus|netmeds|1mg|pharmeasy|hospital|clinic|diagnostic|\blabs?\b|health/, 'Health'],
  [/netflix|spotify|hotstar|prime\s*video|youtube|bookmyshow|pvr|inox|cinema|steam|playstation|sony\s*liv|zee5/, 'Entertainment'],
  [/school|college|universit|udemy|coursera|byju|unacademy|tuition|exam|books?\b/, 'Education'],
  [/salon|spa|barber|parlour|parlor|urban\s*company|grooming/, 'Personal Care'],
];

const INCOME_RULES: [RegExp, string][] = [
  [/salary|payroll|sal\s*credit/, 'Salary'],
  [/interest|int\.?\s*pd|int\s*credit/, 'Interest'],
  [/dividend|mutual\s*fund|zerodha|groww|upstox|nse|bse/, 'Investment'],
  [/refund|cashback/, 'Other'],
];

export function normalizeMerchant(merchant: string | undefined): string {
  return (merchant ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pvt|private|ltd|limited|india|technologies|services|payments?|upi|www|com|in)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns a category from `allowed`, or undefined when nothing fits so the
 * caller keeps its own default.
 */
export function suggestCategory(
  merchant: string | undefined,
  type: 'expense' | 'income',
  history: Pick<FinanceTransaction, 'type' | 'note' | 'category' | 'date' | 'updatedAt'>[],
  allowed: string[]
): string | undefined {
  const key = normalizeMerchant(merchant);
  if (!key) return undefined;
  const isAllowed = (name: string) => allowed.includes(name);

  let learned: { category: string; stamp: string } | undefined;
  for (const tx of history) {
    if (tx.type !== type || !tx.category || tx.category === 'Other') continue;
    if (normalizeMerchant(tx.note) !== key || !isAllowed(tx.category)) continue;
    const stamp = `${tx.date}|${tx.updatedAt ?? ''}`;
    if (!learned || stamp > learned.stamp) learned = { category: tx.category, stamp };
  }
  if (learned) return learned.category;

  const rules = type === 'expense' ? EXPENSE_RULES : INCOME_RULES;
  const hit = rules.find(([pattern]) => pattern.test(key));
  return hit && isAllowed(hit[1]) ? hit[1] : undefined;
}
