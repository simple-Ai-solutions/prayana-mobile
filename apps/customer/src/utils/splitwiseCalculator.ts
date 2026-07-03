// splitwiseCalculator — Splitwise-style settlement, ported verbatim from the PWA
// (travel-ai-nextjs/utils/splitwiseCalculator.js) so mobile produces identical
// balances/settlements. Pure functions; supports "equal" and "custom" splits.

export interface Participant {
  userId: string;
  userName: string;
  avatar?: string | null;
}

export interface Expense {
  amount: number;
  paidBy?: string;
  splitAmong?: string[];
  splitType?: 'equal' | 'custom';
  customSplits?: Record<string, number>;
  category?: string;
  dayIndex?: number | null;
  date?: string;
}

export interface Settlement {
  from: string;
  fromName: string;
  fromAvatar: string | null;
  to: string;
  toName: string;
  toAvatar: string | null;
  amount: number;
}

export interface PersonSummary {
  userId: string;
  userName: string;
  avatar?: string | null;
  totalPaid: number;
  totalOwed: number;
  netBalance: number;
}

// Positive balance = owed money; negative = owes money.
export function calculateNetBalances(
  expenses: Expense[],
  participants: Participant[]
): Record<string, number> {
  const balances: Record<string, number> = {};
  participants.forEach((p) => { balances[p.userId] = 0; });

  expenses.forEach((expense) => {
    const { amount, paidBy, splitAmong, splitType = 'equal' } = expense;
    if (!paidBy || !splitAmong || splitAmong.length === 0 || !amount) return;

    balances[paidBy] = (balances[paidBy] || 0) + amount;

    if (splitType === 'equal') {
      const share = amount / splitAmong.length;
      splitAmong.forEach((userId) => {
        balances[userId] = (balances[userId] || 0) - share;
      });
    } else if (splitType === 'custom' && expense.customSplits) {
      Object.entries(expense.customSplits).forEach(([userId, share]) => {
        balances[userId] = (balances[userId] || 0) - share;
      });
    }
  });

  return balances;
}

// Greedy debt minimization: match largest debtor with largest creditor.
export function minimizeTransactions(
  balances: Record<string, number>,
  participants: Participant[]
): Settlement[] {
  const participantMap: Record<string, Participant> = {};
  participants.forEach((p) => { participantMap[p.userId] = p; });

  const entries = Object.entries(balances)
    .map(([userId, balance]) => ({ userId, balance }))
    .filter((e) => Math.abs(e.balance) > 0.01);

  const debtors = entries.filter((e) => e.balance < 0).sort((a, b) => a.balance - b.balance);
  const creditors = entries.filter((e) => e.balance > 0).sort((a, b) => b.balance - a.balance);

  const settlements: Settlement[] = [];

  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    const amount = Math.min(-debtor.balance, creditor.balance);

    if (amount > 0.01) {
      const fromP = participantMap[debtor.userId] || { userId: debtor.userId, userName: debtor.userId };
      const toP = participantMap[creditor.userId] || { userId: creditor.userId, userName: creditor.userId };
      settlements.push({
        from: debtor.userId,
        fromName: fromP.userName || fromP.userId,
        fromAvatar: fromP.avatar || null,
        to: creditor.userId,
        toName: toP.userName || toP.userId,
        toAvatar: toP.avatar || null,
        amount: Math.round(amount * 100) / 100,
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;
    if (Math.abs(debtor.balance) < 0.01) i++;
    if (Math.abs(creditor.balance) < 0.01) j++;
  }

  return settlements;
}

// What each person paid vs owes.
export function getPersonSummary(
  expenses: Expense[],
  participants: Participant[]
): PersonSummary[] {
  const paid: Record<string, number> = {};
  const owed: Record<string, number> = {};
  participants.forEach((p) => { paid[p.userId] = 0; owed[p.userId] = 0; });

  expenses.forEach(({ amount, paidBy, splitAmong, splitType = 'equal', customSplits }) => {
    if (!paidBy || !splitAmong || splitAmong.length === 0 || !amount) return;
    paid[paidBy] = (paid[paidBy] || 0) + amount;

    if (splitType === 'equal') {
      const share = amount / splitAmong.length;
      splitAmong.forEach((uid) => { owed[uid] = (owed[uid] || 0) + share; });
    } else if (splitType === 'custom' && customSplits) {
      Object.entries(customSplits).forEach(([uid, share]) => {
        owed[uid] = (owed[uid] || 0) + share;
      });
    }
  });

  return participants.map((p) => ({
    userId: p.userId,
    userName: p.userName,
    avatar: p.avatar,
    totalPaid: Math.round((paid[p.userId] || 0) * 100) / 100,
    totalOwed: Math.round((owed[p.userId] || 0) * 100) / 100,
    netBalance: Math.round(((paid[p.userId] || 0) - (owed[p.userId] || 0)) * 100) / 100,
  }));
}

// Stable key for a settlement (used with the store's settledTransactions map).
export function settlementKey(s: Settlement): string {
  return `${s.from}:${s.to}:${s.amount}`;
}
