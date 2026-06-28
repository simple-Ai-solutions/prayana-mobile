// @ts-nocheck — pure JS utility, runtime-tested. Types not added because
// callers use it through any-typed Zustand stores. Re-enable strict when
// shared-utils gets a proper d.ts pass.
/**
 * splitwiseCalculator.js
 * Pure Splitwise-style settlement algorithm.
 *
 * Given a list of expenses (each with paidBy + splitAmong),
 * returns the minimum set of transactions needed to settle all debts.
 */

/**
 * Calculate net balances for all participants.
 * Positive balance = person is owed money.
 * Negative balance = person owes money.
 *
 * @param {Array} expenses - Array of expense objects
 * @param {Array} participants - Array of { userId, userName, avatar }
 * @returns {Object} { [userId]: netBalance }
 */
export function calculateNetBalances(expenses, participants) {
  const balances = {};

  // Initialize all known participants at 0
  participants.forEach((p) => {
    balances[p.userId] = 0;
  });

  expenses.forEach((expense) => {
    const { amount, paidBy, splitAmong, splitType = "equal" } = expense;
    if (!paidBy || !splitAmong || splitAmong.length === 0 || !amount) return;

    // Payer is owed the full amount first
    balances[paidBy] = (balances[paidBy] || 0) + amount;

    if (splitType === "equal") {
      const share = amount / splitAmong.length;
      splitAmong.forEach((userId) => {
        balances[userId] = (balances[userId] || 0) - share;
      });
    } else if (splitType === "custom" && expense.customSplits) {
      // customSplits: { [userId]: amount }
      Object.entries(expense.customSplits).forEach(([userId, share]) => {
        balances[userId] = (balances[userId] || 0) - share;
      });
    }
  });

  return balances;
}

/**
 * Minimize transactions using the greedy algorithm:
 * Sort by balance, then match largest debtor with largest creditor.
 *
 * @param {Object} balances - { [userId]: netBalance }
 * @param {Array} participants - Array of { userId, userName, avatar }
 * @returns {Array} settlements: [{ from, fromName, fromAvatar, to, toName, toAvatar, amount }]
 */
export function minimizeTransactions(balances, participants) {
  const participantMap = {};
  participants.forEach((p) => { participantMap[p.userId] = p; });

  // Build sorted arrays of debtors (negative) and creditors (positive)
  const entries = Object.entries(balances)
    .map(([userId, balance]) => ({ userId, balance }))
    .filter((e) => Math.abs(e.balance) > 0.01); // ignore dust

  const debtors = entries.filter((e) => e.balance < 0).sort((a, b) => a.balance - b.balance);
  const creditors = entries.filter((e) => e.balance > 0).sort((a, b) => b.balance - a.balance);

  const settlements = [];

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

/**
 * Get a summary of what each person paid vs what they owe
 * @param {Array} expenses
 * @param {Array} participants
 * @returns {Array} [{ userId, userName, avatar, totalPaid, totalOwed, netBalance }]
 */
export function getPersonSummary(expenses, participants) {
  const paid = {};
  const owed = {};

  participants.forEach((p) => {
    paid[p.userId] = 0;
    owed[p.userId] = 0;
  });

  expenses.forEach(({ amount, paidBy, splitAmong, splitType = "equal", customSplits }) => {
    if (!paidBy || !splitAmong || splitAmong.length === 0 || !amount) return;

    paid[paidBy] = (paid[paidBy] || 0) + amount;

    if (splitType === "equal") {
      const share = amount / splitAmong.length;
      splitAmong.forEach((uid) => { owed[uid] = (owed[uid] || 0) + share; });
    } else if (splitType === "custom" && customSplits) {
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
