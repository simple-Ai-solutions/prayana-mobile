import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
// RN's own TouchableOpacity: BottomModal is built on a raw RN <Modal> with no
// GestureHandlerRootView, so gesture-handler touchables don't reliably receive
// taps inside it (same dead-tap class fixed in planner.tsx / ItineraryMap.tsx).
import { TouchableOpacity } from 'react-native';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';
import { useAuth } from '@prayana/shared-hooks';
import { POPULAR_CURRENCIES, getAllCurrencies, formatCurrency } from '@prayana/shared-utils';
import {
  calculateNetBalances,
  minimizeTransactions,
  getPersonSummary,
  settlementKey,
  type Participant,
  type Expense,
} from '../../utils/splitwiseCalculator';

interface BudgetTrackerSheetProps {
  sheetRef: React.RefObject<BottomModalRef | null>;
}

const CATEGORIES = [
  { key: 'accommodation', label: 'Stay', icon: 'bed-outline', color: '#8B5CF6' },
  { key: 'food', label: 'Food', icon: 'restaurant-outline', color: '#F59E0B' },
  { key: 'transport', label: 'Transport', icon: 'car-outline', color: '#3B82F6' },
  { key: 'activities', label: 'Activities', icon: 'ticket-outline', color: '#10B981' },
  { key: 'shopping', label: 'Shopping', icon: 'bag-outline', color: '#EC4899' },
  { key: 'misc', label: 'Other', icon: 'ellipsis-horizontal', color: '#6B7280' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];
type TabKey = 'overview' | 'expenses' | 'add' | 'settle';

// Cyan accent to match the planner theme (PWA parity).
const ACCENT = '#06B6D4';

// Deterministic color per participant (mirrors the PWA avatar palette).
const MEMBER_COLORS = ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#3B82F6', '#F97316', '#14B8A6', '#A855F7'];
function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

const BudgetTrackerSheet: React.FC<BudgetTrackerSheetProps> = ({ sheetRef }) => {
  const { user } = useAuth();

  const budgetAmount = useCreateTripStore((s) => s.budgetAmount);
  const expenses = (useCreateTripStore((s) => s.expenses) || []) as Expense[];
  const currency = useCreateTripStore((s) => s.currency) || 'INR';
  const collaborators = useCreateTripStore((s) => s.collaborators) || [];
  const offlineMembers = useCreateTripStore((s) => s.offlineMembers) || [];
  const settledTransactions = useCreateTripStore((s) => s.settledTransactions) || {};

  const setBudgetAmount = useCreateTripStore((s) => s.setBudgetAmount);
  const setCurrency = useCreateTripStore((s) => s.setCurrency);
  const addExpense = useCreateTripStore((s) => s.addExpense);
  const removeExpense = useCreateTripStore((s) => s.removeExpense);
  const addOfflineMember = useCreateTripStore((s) => s.addOfflineMember);
  const removeOfflineMember = useCreateTripStore((s) => s.removeOfflineMember);
  const markSettled = useCreateTripStore((s) => s.markSettled);
  const unmarkSettled = useCreateTripStore((s) => s.unmarkSettled);
  const updateExpense = useCreateTripStore((s) => s.updateExpense);
  const days = useCreateTripStore((s) => s.days) || [];
  const getTotalSpent = useCreateTripStore((s) => s.getTotalSpent);
  const getSpentByCategory = useCreateTripStore((s) => s.getSpentByCategory);

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(budgetAmount || 0));
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');

  // Add/edit-expense form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expCategory, setExpCategory] = useState<CategoryKey>('food');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');
  const [expPaidBy, setExpPaidBy] = useState<string>('');
  const [expSplitAmong, setExpSplitAmong] = useState<string[]>([]);
  // Custom split modes (mirrors the PWA: equal | byAmount | byPercent | byShares)
  const [splitMode, setSplitMode] = useState<'equal' | 'byAmount' | 'byPercent' | 'byShares'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [customPercents, setCustomPercents] = useState<Record<string, string>>({});
  const [customShares, setCustomShares] = useState<Record<string, string>>({});

  const fmt = useCallback((n: number) => formatCurrency(Math.round(n), currency), [currency]);

  // ── Participants: current user + collaborators + offline members ──
  const participants: Participant[] = useMemo(() => {
    const list: Participant[] = [];
    const seen = new Set<string>();
    const meId = user?.uid || 'me';
    list.push({ userId: meId, userName: user?.displayName || 'You' });
    seen.add(meId);
    collaborators.forEach((c: any) => {
      const uid = c.userId || c.uid || c.email;
      if (uid && !seen.has(uid)) {
        seen.add(uid);
        list.push({ userId: uid, userName: c.name || c.displayName || c.email || 'Member' });
      }
    });
    offlineMembers.forEach((m: any) => {
      if (m.id && !seen.has(m.id)) {
        seen.add(m.id);
        list.push({ userId: m.id, userName: m.name });
      }
    });
    return list;
  }, [user?.uid, user?.displayName, collaborators, offlineMembers]);

  const isShared = participants.length > 1;

  const totalSpent = useMemo(() => (getTotalSpent ? getTotalSpent() : 0), [expenses, getTotalSpent]);
  const remaining = (budgetAmount || 0) - totalSpent;
  const progress = budgetAmount ? Math.min(totalSpent / budgetAmount, 1) : 0;

  // ── Settlement math (ported from PWA) ──
  const personSummary = useMemo(
    () => (isShared ? getPersonSummary(expenses, participants) : []),
    [expenses, participants, isShared]
  );
  const settlements = useMemo(() => {
    if (!isShared) return [];
    const balances = calculateNetBalances(expenses, participants);
    return minimizeTransactions(balances, participants);
  }, [expenses, participants, isShared]);

  const handleSaveBudget = useCallback(() => {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) setBudgetAmount(amount);
    setEditingBudget(false);
  }, [budgetInput, setBudgetAmount]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setExpAmount('');
    setExpNote('');
    setExpCategory('food');
    setSplitMode('equal');
    setCustomAmounts({});
    setCustomPercents({});
    setCustomShares({});
  }, []);

  const openAddForm = useCallback(() => {
    // Default payer = me; default split = everyone.
    resetForm();
    setExpPaidBy(user?.uid || 'me');
    setExpSplitAmong(participants.map((p) => p.userId));
    setActiveTab('add');
  }, [user?.uid, participants, resetForm]);

  const openEditForm = useCallback((e: any) => {
    setEditingId(e.id);
    setExpCategory(e.category || 'food');
    setExpAmount(String(e.amount ?? ''));
    setExpNote(e.note || '');
    setExpPaidBy(e.paidBy || user?.uid || 'me');
    setExpSplitAmong(e.splitAmong?.length ? e.splitAmong : participants.map((p) => p.userId));
    // Reconstruct split mode/inputs from a saved custom split (best-effort: amounts).
    if (e.splitType === 'custom' && e.customSplits) {
      setSplitMode('byAmount');
      const amts: Record<string, string> = {};
      Object.entries(e.customSplits).forEach(([uid, v]) => { amts[uid] = String(v); });
      setCustomAmounts(amts);
    } else {
      setSplitMode('equal');
      setCustomAmounts({}); setCustomPercents({}); setCustomShares({});
    }
    setActiveTab('add');
  }, [user?.uid, participants]);

  // Resolve customSplits for the active mode (mirrors the PWA buildCustomSplits).
  const buildCustomSplits = useCallback((amount: number): Record<string, number> => {
    const splits: Record<string, number> = {};
    if (splitMode === 'byAmount') {
      expSplitAmong.forEach((uid) => {
        const v = parseFloat(customAmounts[uid] || '0');
        if (v > 0) splits[uid] = v;
      });
    } else if (splitMode === 'byPercent') {
      expSplitAmong.forEach((uid) => {
        const pct = parseFloat(customPercents[uid] || '0');
        if (pct > 0 && amount > 0) splits[uid] = Math.round((pct / 100) * amount * 100) / 100;
      });
    } else if (splitMode === 'byShares') {
      const totalShares = expSplitAmong.reduce((s, uid) => s + parseFloat(customShares[uid] || '1'), 0);
      expSplitAmong.forEach((uid) => {
        const sh = parseFloat(customShares[uid] || '1');
        if (totalShares > 0 && amount > 0) splits[uid] = Math.round((sh / totalShares) * amount * 100) / 100;
      });
    }
    return splits;
  }, [splitMode, expSplitAmong, customAmounts, customPercents, customShares]);

  // Validation sums for byAmount / byPercent.
  const totalAmount = parseFloat(expAmount || '0');
  const customAmountsSum = expSplitAmong.reduce((s, uid) => s + parseFloat(customAmounts[uid] || '0'), 0);
  const customPercentSum = expSplitAmong.reduce((s, uid) => s + parseFloat(customPercents[uid] || '0'), 0);
  const amountDiff = Math.round((totalAmount - customAmountsSum) * 100) / 100;
  const percentDiff = Math.round((100 - customPercentSum) * 100) / 100;

  const handleAddExpense = useCallback(() => {
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    if (isShared) {
      if (splitMode === 'byAmount' && Math.abs(amountDiff) >= 0.02) {
        Alert.alert('Split mismatch', `Amounts must add up to ${fmt(amount)} (off by ${fmt(Math.abs(amountDiff))}).`);
        return;
      }
      if (splitMode === 'byPercent' && Math.abs(percentDiff) >= 0.5) {
        Alert.alert('Split mismatch', `Percentages must add up to 100% (off by ${percentDiff.toFixed(1)}%).`);
        return;
      }
    }
    const exp: any = {
      category: expCategory,
      amount,
      note: expNote.trim() || `${CATEGORIES.find((c) => c.key === expCategory)?.label} expense`,
    };
    if (isShared) {
      exp.paidBy = expPaidBy || participants[0]?.userId;
      exp.splitAmong = expSplitAmong.length ? expSplitAmong : participants.map((p) => p.userId);
      if (splitMode === 'equal') {
        exp.splitType = 'equal';
        exp.customSplits = {};
      } else {
        exp.splitType = 'custom';
        exp.customSplits = buildCustomSplits(amount);
      }
    }
    if (editingId) {
      updateExpense(editingId, exp);
    } else {
      addExpense({ ...exp, date: new Date().toISOString() });
    }
    resetForm();
    setActiveTab(isShared ? 'settle' : 'overview');
  }, [editingId, expCategory, expAmount, expNote, expPaidBy, expSplitAmong, isShared, splitMode, amountDiff, percentDiff, buildCustomSplits, participants, addExpense, updateExpense, resetForm, fmt]);

  const handleRemoveExpense = useCallback((expense: Expense) => {
    Alert.alert('Remove Expense', 'Delete this expense?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeExpense((expense as any).id) },
    ]);
  }, [removeExpense]);

  // Daily breakdown (group expenses by dayIndex, fallback to date).
  const dailyBreakdown = useMemo<Array<{ idx: number; title: string; total: number }>>(() => {
    if (!days.length || !expenses.length) return [];
    return days
      .map((day: any, idx: number) => {
        const dayExps = expenses.filter((e: any) => {
          if (e.dayIndex !== undefined && e.dayIndex !== null) return e.dayIndex === idx;
          if (e.date && day.date) return new Date(e.date).toDateString() === new Date(day.date).toDateString();
          return false;
        });
        const total = dayExps.reduce((s: number, e: any) => s + (e.amount || 0), 0);
        return { idx, title: day.title || `Day ${idx + 1}`, total };
      })
      .filter((d: { idx: number; title: string; total: number }) => d.total > 0);
  }, [expenses, days]);

  // "You owe / you're owed" banner figure for the current user.
  const myNet = useMemo(() => {
    if (!isShared) return 0;
    const me = personSummary.find((s) => s.userId === (user?.uid || 'me'));
    return me?.netBalance || 0;
  }, [personSummary, isShared, user?.uid]);

  const toggleSplitMember = useCallback((uid: string) => {
    setExpSplitAmong((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));
  }, []);

  const handleAddMember = useCallback(() => {
    const name = newMemberName.trim();
    if (name.length < 1) return;
    addOfflineMember(name);
    setNewMemberName('');
  }, [newMemberName, addOfflineMember]);

  // ── Currency picker ──
  const renderCurrencyPicker = () => {
    const all = getAllCurrencies();
    const popular = POPULAR_CURRENCIES
      .map((code) => all.find((c: any) => c.code === code))
      .filter(Boolean);
    const rest = all.filter((c: any) => !POPULAR_CURRENCIES.includes(c.code));
    const ordered = [...popular, ...rest];
    return (
      <View style={styles.currencyOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => setShowCurrencyPicker(false)}
        />
        <View style={styles.currencySheet}>
          <View style={styles.currencyHead}>
            <Text style={styles.currencyHeadText}>Trip Currency</Text>
            <TouchableOpacity onPress={() => setShowCurrencyPicker(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <BottomModalScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {ordered.map((c: any) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.currencyRow, currency === c.code && { backgroundColor: ACCENT + '15' }]}
                onPress={() => { setCurrency(c.code); setShowCurrencyPicker(false); }}
              >
                <Text style={styles.currencySym}>{c.symbol}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currencyCode}>{c.code}</Text>
                  <Text style={styles.currencyName}>{c.name}</Text>
                </View>
                {currency === c.code && <Ionicons name="checkmark-circle" size={18} color={ACCENT} />}
              </TouchableOpacity>
            ))}
          </BottomModalScrollView>
        </View>
      </View>
    );
  };

  // ── Tabs ──
  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetLabel}>Total Budget</Text>
        {editingBudget ? (
          <View style={styles.budgetEditRow}>
            <TextInput
              style={styles.budgetInput}
              value={budgetInput}
              onChangeText={setBudgetInput}
              keyboardType="numeric"
              autoFocus
              onBlur={handleSaveBudget}
              onSubmitEditing={handleSaveBudget}
            />
          </View>
        ) : (
          <TouchableOpacity onPress={() => { setBudgetInput(String(budgetAmount || 0)); setEditingBudget(true); }}>
            <Text style={styles.budgetValue}>{fmt(budgetAmount || 0)}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBg}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${progress * 100}%`,
                backgroundColor: progress > 0.9 ? colors.error : progress > 0.7 ? '#F59E0B' : colors.success,
              },
            ]}
          />
        </View>
        <View style={styles.progressLabels}>
          <Text style={styles.spentLabel}>Spent: {fmt(totalSpent)}</Text>
          <Text style={[styles.remainingLabel, remaining < 0 && { color: colors.error }]}>
            {remaining >= 0 ? `Remaining: ${fmt(remaining)}` : `Over by: ${fmt(Math.abs(remaining))}`}
          </Text>
        </View>
      </View>

      {/* You owe / you're owed banner (shared trips) */}
      {isShared && Math.abs(myNet) > 0.01 && (
        <TouchableOpacity
          style={[styles.owedBanner, { backgroundColor: (myNet > 0 ? colors.success : colors.error) + '15', borderColor: (myNet > 0 ? colors.success : colors.error) + '40' }]}
          onPress={() => setActiveTab('settle')}
          activeOpacity={0.8}
        >
          <Ionicons name={myNet > 0 ? 'arrow-down-circle' : 'arrow-up-circle'} size={20} color={myNet > 0 ? colors.success : colors.error} />
          <Text style={[styles.owedText, { color: myNet > 0 ? colors.success : colors.error }]}>
            {myNet > 0 ? `You're owed ${fmt(myNet)}` : `You owe ${fmt(Math.abs(myNet))}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={myNet > 0 ? colors.success : colors.error} />
        </TouchableOpacity>
      )}

      <Text style={styles.sectionTitle}>By Category</Text>
      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const spentMap = getSpentByCategory ? getSpentByCategory() : {};
          const spent = (spentMap as Record<string, number>)[cat.key] || 0;
          return (
            <View key={cat.key} style={styles.categoryCard}>
              <View style={[styles.categoryIcon, { backgroundColor: cat.color + '20' }]}>
                <Ionicons name={cat.icon as any} size={18} color={cat.color} />
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
              <Text style={styles.categoryAmount}>{fmt(spent)}</Text>
            </View>
          );
        })}
      </View>

      {/* Daily breakdown */}
      {dailyBreakdown.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>By Day</Text>
          <View style={styles.dailyWrap}>
            {dailyBreakdown.map((d) => (
              <View key={d.idx} style={styles.dailyRow}>
                <View style={[styles.dailyDot, { backgroundColor: ACCENT }]} />
                <Text style={styles.dailyTitle} numberOfLines={1}>{d.title}</Text>
                <Text style={styles.dailyTotal}>{fmt(d.total)}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderExpenses = () => (
    <View style={styles.expensesContainer}>
      {expenses.length === 0 ? (
        <View style={styles.emptyExpenses}>
          <Ionicons name="receipt-outline" size={40} color={colors.gray[300]} />
          <Text style={styles.emptyExpensesText}>No expenses recorded</Text>
          <TouchableOpacity style={styles.addExpenseBtn} onPress={openAddForm}>
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addExpenseBtnText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        expenses.map((expense: any, index: number) => {
          const cat = CATEGORIES.find((c) => c.key === expense.category);
          const payer = participants.find((p) => p.userId === expense.paidBy);
          return (
            <View key={expense.id || index} style={styles.expenseItem}>
              <View style={[styles.expenseIcon, { backgroundColor: (cat?.color || '#6B7280') + '20' }]}>
                <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={16} color={cat?.color || '#6B7280'} />
              </View>
              <View style={styles.expenseContent}>
                <Text style={styles.expenseName}>{expense.note || cat?.label || 'Expense'}</Text>
                <Text style={styles.expenseCategory}>
                  {cat?.label || expense.category}
                  {isShared && payer ? `  ·  ${payer.userName} paid` : ''}
                  {isShared && expense.splitAmong?.length ? `  ·  split ${expense.splitAmong.length}` : ''}
                </Text>
              </View>
              <Text style={styles.expenseAmount}>{fmt(expense.amount)}</Text>
              <TouchableOpacity onPress={() => openEditForm(expense)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="create-outline" size={17} color={colors.gray[400]} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleRemoveExpense(expense)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                <Ionicons name="close-circle" size={18} color={colors.gray[400]} />
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  const renderAddForm = () => (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.addFormContainer}>
      <Text style={styles.sectionTitle}>{editingId ? 'Edit Expense' : 'Add Expense'}</Text>

      {/* Category */}
      <View style={styles.categoryPicker}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[styles.categoryPickerItem, expCategory === cat.key && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
            onPress={() => setExpCategory(cat.key)}
          >
            <Ionicons name={cat.icon as any} size={16} color={expCategory === cat.key ? cat.color : colors.textTertiary} />
            <Text style={[styles.categoryPickerText, expCategory === cat.key && { color: cat.color }]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Amount</Text>
        <TextInput
          style={styles.textInput}
          value={expAmount}
          onChangeText={setExpAmount}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Note */}
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Note</Text>
        <TextInput
          style={styles.textInput}
          value={expNote}
          onChangeText={setExpNote}
          placeholder="What was this for?"
          placeholderTextColor={colors.textTertiary}
        />
      </View>

      {/* Split controls — only when the trip is shared */}
      {isShared && (
        <>
          <View style={styles.inputRow}>
            <Text style={styles.inputLabel}>Paid by</Text>
            <View style={styles.memberWrap}>
              {participants.map((p) => (
                <TouchableOpacity
                  key={p.userId}
                  style={[styles.memberChip, expPaidBy === p.userId && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
                  onPress={() => setExpPaidBy(p.userId)}
                >
                  <View style={[styles.memberDot, { backgroundColor: colorForId(p.userId) }]}>
                    <Text style={styles.memberDotText}>{p.userName[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.memberChipText, expPaidBy === p.userId && { color: ACCENT, fontWeight: fontWeight.semibold }]}>{p.userName}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.splitHeaderRow}>
              <Text style={styles.inputLabel}>Split among</Text>
              <Text style={styles.splitHint}>{expSplitAmong.length} selected</Text>
            </View>
            {/* Who's in the split */}
            <View style={styles.memberWrap}>
              {participants.map((p) => {
                const on = expSplitAmong.includes(p.userId);
                return (
                  <TouchableOpacity
                    key={p.userId}
                    style={[styles.memberChip, on && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
                    onPress={() => toggleSplitMember(p.userId)}
                  >
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={on ? ACCENT : colors.textTertiary} />
                    <Text style={[styles.memberChipText, on && { color: ACCENT }]}>{p.userName}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Split mode selector */}
            <View style={styles.splitModeRow}>
              {([
                { id: 'equal', label: 'Equal ÷' },
                { id: 'byAmount', label: 'Amount' },
                { id: 'byPercent', label: '%' },
                { id: 'byShares', label: 'Shares' },
              ] as const).map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.splitModeBtn, splitMode === m.id && styles.splitModeBtnActive]}
                  onPress={() => setSplitMode(m.id)}
                >
                  <Text style={[styles.splitModeText, splitMode === m.id && styles.splitModeTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Equal preview */}
            {splitMode === 'equal' && Number(expAmount) > 0 && expSplitAmong.length > 0 ? (
              <Text style={styles.splitPreview}>{fmt(Number(expAmount) / expSplitAmong.length)} each</Text>
            ) : null}

            {/* Per-person inputs for custom modes */}
            {splitMode !== 'equal' && expSplitAmong.length > 0 && (
              <View style={styles.customSplitWrap}>
                {expSplitAmong.map((uid) => {
                  const p = participants.find((x) => x.userId === uid);
                  const val =
                    splitMode === 'byAmount' ? (customAmounts[uid] ?? '')
                    : splitMode === 'byPercent' ? (customPercents[uid] ?? '')
                    : (customShares[uid] ?? '');
                  const onChange = (t: string) => {
                    if (splitMode === 'byAmount') setCustomAmounts((s) => ({ ...s, [uid]: t }));
                    else if (splitMode === 'byPercent') setCustomPercents((s) => ({ ...s, [uid]: t }));
                    else setCustomShares((s) => ({ ...s, [uid]: t }));
                  };
                  return (
                    <View key={uid} style={styles.customSplitRow}>
                      <Text style={styles.customSplitName} numberOfLines={1}>{p?.userName || 'Member'}</Text>
                      <TextInput
                        style={styles.customSplitInput}
                        value={val}
                        onChangeText={onChange}
                        keyboardType="numeric"
                        placeholder={splitMode === 'byShares' ? '1' : '0'}
                        placeholderTextColor={colors.textTertiary}
                      />
                      <Text style={styles.customSplitUnit}>
                        {splitMode === 'byPercent' ? '%' : splitMode === 'byShares' ? 'sh' : ''}
                      </Text>
                    </View>
                  );
                })}
                {/* Running total / validation hint */}
                {splitMode === 'byAmount' && (
                  <Text style={[styles.splitHint, Math.abs(amountDiff) < 0.02 ? { color: colors.success } : { color: colors.error }]}>
                    {fmt(customAmountsSum)} of {fmt(totalAmount || 0)}{Math.abs(amountDiff) >= 0.02 ? `  ·  ${amountDiff > 0 ? 'short' : 'over'} ${fmt(Math.abs(amountDiff))}` : '  ·  ✓'}
                  </Text>
                )}
                {splitMode === 'byPercent' && (
                  <Text style={[styles.splitHint, Math.abs(percentDiff) < 0.5 ? { color: colors.success } : { color: colors.error }]}>
                    {customPercentSum.toFixed(0)}% of 100%{Math.abs(percentDiff) >= 0.5 ? `  ·  ${percentDiff > 0 ? 'short' : 'over'} ${Math.abs(percentDiff).toFixed(0)}%` : '  ·  ✓'}
                  </Text>
                )}
              </View>
            )}
          </View>
        </>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={handleAddExpense} activeOpacity={0.8}>
        <Ionicons name="checkmark" size={18} color="#ffffff" />
        <Text style={styles.saveBtnText}>{editingId ? 'Update Expense' : 'Save Expense'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );

  const renderSettle = () => (
    <View style={styles.settleContainer}>
      {/* Members management */}
      <Text style={styles.sectionTitle}>Members ({participants.length})</Text>
      <View style={styles.memberWrap}>
        {participants.map((p) => {
          const offline = offlineMembers.find((m: any) => m.id === p.userId);
          return (
            <View key={p.userId} style={styles.memberPill}>
              <View style={[styles.memberDot, { backgroundColor: colorForId(p.userId) }]}>
                <Text style={styles.memberDotText}>{p.userName[0]?.toUpperCase()}</Text>
              </View>
              <Text style={styles.memberPillText}>{p.userName}</Text>
              {offline && (
                <TouchableOpacity onPress={() => removeOfflineMember(p.userId)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Ionicons name="close" size={13} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
      <View style={styles.addMemberRow}>
        <TextInput
          style={styles.addMemberInput}
          value={newMemberName}
          onChangeText={setNewMemberName}
          placeholder="Add a member (no account)…"
          placeholderTextColor={colors.textTertiary}
          onSubmitEditing={handleAddMember}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addMemberBtn} onPress={handleAddMember}>
          <Ionicons name="person-add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Per-person summary */}
      {personSummary.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Per Person</Text>
          {personSummary.map((s) => (
            <View key={s.userId} style={styles.personRow}>
              <View style={[styles.memberDot, { backgroundColor: colorForId(s.userId) }]}>
                <Text style={styles.memberDotText}>{s.userName[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{s.userName}</Text>
                <Text style={styles.personSub}>paid {fmt(s.totalPaid)} · owes {fmt(s.totalOwed)}</Text>
              </View>
              <Text
                style={[
                  styles.personBalance,
                  { color: s.netBalance > 0.01 ? colors.success : s.netBalance < -0.01 ? colors.error : colors.textTertiary },
                ]}
              >
                {s.netBalance > 0.01 ? `+${fmt(s.netBalance)}` : s.netBalance < -0.01 ? `-${fmt(Math.abs(s.netBalance))}` : 'settled'}
              </Text>
            </View>
          ))}
        </>
      )}

      {/* Settlements */}
      <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>Settle Up</Text>
      {settlements.length === 0 ? (
        <View style={styles.allSettled}>
          <Ionicons name="checkmark-done-circle" size={28} color={colors.success} />
          <Text style={styles.allSettledText}>All settled up 🎉</Text>
        </View>
      ) : (
        settlements.map((s) => {
          const key = settlementKey(s);
          const isSettled = !!settledTransactions[key];
          return (
            <View key={key} style={[styles.settleRow, isSettled && styles.settleRowDone]}>
              <Text style={styles.settleText}>
                <Text style={{ fontWeight: fontWeight.semibold as any }}>{s.fromName}</Text>
                {' → '}
                <Text style={{ fontWeight: fontWeight.semibold as any }}>{s.toName}</Text>
              </Text>
              <Text style={styles.settleAmount}>{fmt(s.amount)}</Text>
              <TouchableOpacity
                style={[styles.settleBtn, isSettled && styles.settleBtnDone]}
                onPress={() => (isSettled ? unmarkSettled(key) : markSettled(key))}
              >
                <Ionicons name={isSettled ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={isSettled ? '#fff' : ACCENT} />
                <Text style={[styles.settleBtnText, isSettled && { color: '#fff' }]}>{isSettled ? 'Settled' : 'Mark paid'}</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'add', label: '+ Add' },
    ...(isShared ? [{ key: 'settle' as TabKey, label: 'Settle' }] : []),
  ];

  return (
    <BottomModal ref={sheetRef} maxHeightPercent={0.9} fillHeight>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={ACCENT} />
        <Text style={styles.headerTitle}>Budget Tracker</Text>
        <TouchableOpacity
          style={styles.currencyBtn}
          onPress={() => setShowCurrencyPicker(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.currencyBtnText}>{currency}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => sheetRef.current?.close()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => (tab.key === 'add' ? openAddForm() : setActiveTab(tab.key))}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <BottomModalScrollView contentContainerStyle={styles.contentContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'expenses' && renderExpenses()}
        {activeTab === 'add' && renderAddForm()}
        {activeTab === 'settle' && renderSettle()}
      </BottomModalScrollView>

      {showCurrencyPicker && renderCurrencyPicker()}
    </BottomModal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  currencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.gray[100] },
  currencyBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textSecondary },
  tabs: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 6 },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: borderRadius.lg, backgroundColor: colors.gray[50] },
  tabActive: { backgroundColor: ACCENT },
  tabText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },
  tabTextActive: { color: '#ffffff' },
  contentContainer: { padding: spacing.lg, paddingBottom: 40 },

  // Overview
  overviewContainer: { gap: spacing.lg },
  budgetHeader: { alignItems: 'center', gap: spacing.xs },
  budgetLabel: { fontSize: fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 },
  budgetValue: { fontSize: 32, fontWeight: fontWeight.bold, color: colors.text },
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  budgetInput: { fontSize: 28, fontWeight: fontWeight.bold, color: colors.text, minWidth: 100, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: ACCENT, paddingVertical: spacing.xs },
  progressContainer: { gap: spacing.sm },
  progressBg: { height: 8, backgroundColor: colors.gray[200], borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  spentLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },
  remainingLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.success },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryCard: { width: '30%', alignItems: 'center', gap: spacing.xs, padding: spacing.md, backgroundColor: colors.gray[50], borderRadius: borderRadius.lg },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { fontSize: fontSize.xs, color: colors.textSecondary },
  categoryAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  // Expenses
  expensesContainer: { gap: spacing.sm },
  emptyExpenses: { alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.md },
  emptyExpensesText: { fontSize: fontSize.sm, color: colors.textTertiary },
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: ACCENT },
  addExpenseBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: '#ffffff' },
  expenseItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  expenseIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  expenseContent: { flex: 1 },
  expenseName: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.text },
  expenseCategory: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
  expenseAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  // Add Form
  addFormContainer: { gap: spacing.lg },
  categoryPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryPickerItem: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, borderColor: colors.border },
  categoryPickerText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: colors.textSecondary },
  inputRow: { gap: spacing.xs },
  inputLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  textInput: { fontSize: fontSize.md, color: colors.text, paddingVertical: spacing.md, paddingHorizontal: spacing.md, backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: ACCENT, borderRadius: borderRadius.xl, ...shadow.md },
  saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#ffffff' },

  // Split member chips
  memberWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  memberChipText: { fontSize: fontSize.xs, color: colors.textSecondary },
  memberDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  memberDotText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#fff' },
  splitHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  splitHint: { fontSize: fontSize.xs, color: colors.textTertiary },
  splitPreview: { fontSize: fontSize.xs, color: ACCENT, fontWeight: fontWeight.semibold, marginTop: 6 },
  splitModeRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  splitModeBtn: { flex: 1, paddingVertical: 6, borderRadius: borderRadius.lg, backgroundColor: colors.gray[100], alignItems: 'center' },
  splitModeBtnActive: { backgroundColor: ACCENT },
  splitModeText: { fontSize: 11, fontWeight: fontWeight.medium, color: colors.textSecondary },
  splitModeTextActive: { color: '#fff', fontWeight: fontWeight.semibold },
  customSplitWrap: { marginTop: 10, gap: 6 },
  customSplitRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customSplitName: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  customSplitInput: { width: 80, fontSize: fontSize.sm, color: colors.text, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.gray[50], borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border, textAlign: 'right' },
  customSplitUnit: { width: 22, fontSize: fontSize.xs, color: colors.textTertiary },

  // You-owe banner
  owedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, borderWidth: 1 },
  owedText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Daily breakdown
  dailyWrap: { gap: 2 },
  dailyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  dailyDot: { width: 7, height: 7, borderRadius: 4 },
  dailyTitle: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  dailyTotal: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },

  // Settle tab
  settleContainer: { gap: spacing.md },
  memberPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.gray[100] },
  memberPillText: { fontSize: fontSize.xs, color: colors.text, fontWeight: fontWeight.medium },
  addMemberRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addMemberInput: { flex: 1, fontSize: fontSize.sm, color: colors.text, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.gray[50], borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.border },
  addMemberBtn: { width: 40, height: 40, borderRadius: borderRadius.lg, backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  personName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  personSub: { fontSize: fontSize.xs, color: colors.textTertiary, marginTop: 1 },
  personBalance: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  allSettled: { alignItems: 'center', gap: 6, paddingVertical: spacing.lg },
  allSettledText: { fontSize: fontSize.sm, color: colors.textSecondary },
  settleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  settleRowDone: { opacity: 0.55 },
  settleText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  settleAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  settleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: ACCENT },
  settleBtnDone: { backgroundColor: colors.success, borderColor: colors.success },
  settleBtnText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: ACCENT },

  // Currency picker
  currencyOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  currencySheet: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%', paddingBottom: 8 },
  currencyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  currencyHeadText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  currencySym: { fontSize: fontSize.lg, width: 32, textAlign: 'center', color: colors.text },
  currencyCode: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  currencyName: { fontSize: fontSize.xs, color: colors.textTertiary },
});

export default BudgetTrackerSheet;
