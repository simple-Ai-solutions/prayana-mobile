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
import { TouchableOpacity } from 'react-native-gesture-handler';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing, borderRadius, shadow } from '@prayana/shared-ui';
import { useCreateTripStore } from '@prayana/shared-stores';

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

const BudgetTrackerSheet: React.FC<BudgetTrackerSheetProps> = ({ sheetRef }) => {
  const budgetAmount = useCreateTripStore((s) => s.budgetAmount);
  const expenses = useCreateTripStore((s) => s.expenses) || [];
  const setBudgetAmount = useCreateTripStore((s) => s.setBudgetAmount);
  const addExpense = useCreateTripStore((s) => s.addExpense);
  const removeExpense = useCreateTripStore((s) => s.removeExpense);
  const getTotalSpent = useCreateTripStore((s) => s.getTotalSpent);
  const getSpentByCategory = useCreateTripStore((s) => s.getSpentByCategory);

  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'add'>('overview');
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(String(budgetAmount || 0));

  // Add expense form
  const [expCategory, setExpCategory] = useState<CategoryKey>('food');
  const [expAmount, setExpAmount] = useState('');
  const [expNote, setExpNote] = useState('');

  const totalSpent = useMemo(() => (getTotalSpent ? getTotalSpent() : 0), [expenses, getTotalSpent]);
  const remaining = (budgetAmount || 0) - totalSpent;
  const progress = budgetAmount ? Math.min(totalSpent / budgetAmount, 1) : 0;

  const handleSaveBudget = useCallback(() => {
    const amount = parseFloat(budgetInput);
    if (!isNaN(amount) && amount > 0) {
      setBudgetAmount(amount);
    }
    setEditingBudget(false);
  }, [budgetInput, setBudgetAmount]);

  const handleAddExpense = useCallback(() => {
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    addExpense({
      category: expCategory,
      amount,
      note: expNote.trim() || `${CATEGORIES.find(c => c.key === expCategory)?.label} expense`,
      date: new Date().toISOString(),
    });

    setExpAmount('');
    setExpNote('');
    setActiveTab('overview');
  }, [expCategory, expAmount, expNote, addExpense]);

  const handleRemoveExpense = useCallback(
    (index: number) => {
      Alert.alert('Remove Expense', 'Delete this expense?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => removeExpense(index) },
      ]);
    },
    [removeExpense]
  );

  const renderOverview = () => (
    <View style={styles.overviewContainer}>
      {/* Budget header */}
      <View style={styles.budgetHeader}>
        <Text style={styles.budgetLabel}>Total Budget</Text>
        {editingBudget ? (
          <View style={styles.budgetEditRow}>
            <Text style={styles.currencySymbol}>INR</Text>
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
            <Text style={styles.budgetValue}>
              {'\u20B9'}{(budgetAmount || 0).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
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
          <Text style={styles.spentLabel}>
            Spent: {'\u20B9'}{totalSpent.toLocaleString()}
          </Text>
          <Text style={[styles.remainingLabel, remaining < 0 && { color: colors.error }]}>
            {remaining >= 0 ? `Remaining: \u20B9${remaining.toLocaleString()}` : `Over by: \u20B9${Math.abs(remaining).toLocaleString()}`}
          </Text>
        </View>
      </View>

      {/* Category breakdown */}
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
              <Text style={styles.categoryAmount}>{'\u20B9'}{spent.toLocaleString()}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderExpenses = () => (
    <View style={styles.expensesContainer}>
      {expenses.length === 0 ? (
        <View style={styles.emptyExpenses}>
          <Ionicons name="receipt-outline" size={40} color={colors.gray[300]} />
          <Text style={styles.emptyExpensesText}>No expenses recorded</Text>
          <TouchableOpacity
            style={styles.addExpenseBtn}
            onPress={() => setActiveTab('add')}
          >
            <Ionicons name="add" size={16} color="#ffffff" />
            <Text style={styles.addExpenseBtnText}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      ) : (
        expenses.map((expense: any, index: number) => {
          const cat = CATEGORIES.find((c) => c.key === expense.category);
          return (
            <View key={index} style={styles.expenseItem}>
              <View style={[styles.expenseIcon, { backgroundColor: (cat?.color || '#6B7280') + '20' }]}>
                <Ionicons name={(cat?.icon || 'ellipsis-horizontal') as any} size={16} color={cat?.color || '#6B7280'} />
              </View>
              <View style={styles.expenseContent}>
                <Text style={styles.expenseName}>{expense.note || cat?.label || 'Expense'}</Text>
                <Text style={styles.expenseCategory}>{cat?.label || expense.category}</Text>
              </View>
              <Text style={styles.expenseAmount}>{'\u20B9'}{expense.amount.toLocaleString()}</Text>
              <TouchableOpacity
                onPress={() => handleRemoveExpense(index)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
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
      <Text style={styles.sectionTitle}>Add Expense</Text>

      {/* Category picker */}
      <View style={styles.categoryPicker}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryPickerItem,
              expCategory === cat.key && { backgroundColor: cat.color + '20', borderColor: cat.color },
            ]}
            onPress={() => setExpCategory(cat.key)}
          >
            <Ionicons name={cat.icon as any} size={16} color={expCategory === cat.key ? cat.color : colors.textTertiary} />
            <Text
              style={[
                styles.categoryPickerText,
                expCategory === cat.key && { color: cat.color },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Amount */}
      <View style={styles.inputRow}>
        <Text style={styles.inputLabel}>Amount ({'\u20B9'})</Text>
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

      <TouchableOpacity style={styles.saveBtn} onPress={handleAddExpense} activeOpacity={0.8}>
        <Ionicons name="checkmark" size={18} color="#ffffff" />
        <Text style={styles.saveBtnText}>Save Expense</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );

  return (
    <BottomModal ref={sheetRef} maxHeightPercent={0.88} fillHeight>
      <View style={styles.header}>
        <Ionicons name="wallet-outline" size={20} color={colors.primary[500]} />
        <Text style={styles.headerTitle}>Budget Tracker</Text>
        <TouchableOpacity onPress={() => sheetRef.current?.close()}>
          <Ionicons name="close" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['overview', 'expenses', 'add'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'add' ? '+ Add' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <BottomModalScrollView contentContainerStyle={styles.contentContainer}>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'expenses' && renderExpenses()}
        {activeTab === 'add' && renderAddForm()}
      </BottomModalScrollView>
    </BottomModal>
  );
};

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handleIndicator: { backgroundColor: colors.gray[300], width: 36 },
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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[50],
  },
  tabActive: { backgroundColor: colors.primary[500] },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: colors.textSecondary },
  tabTextActive: { color: '#ffffff' },
  contentContainer: { padding: spacing.lg, paddingBottom: 40 },

  // Overview
  overviewContainer: { gap: spacing.lg },
  budgetHeader: { alignItems: 'center', gap: spacing.xs },
  budgetLabel: { fontSize: fontSize.xs, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1 },
  budgetValue: { fontSize: 32, fontWeight: fontWeight.bold, color: colors.text },
  budgetEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  currencySymbol: { fontSize: fontSize.lg, color: colors.textSecondary },
  budgetInput: { fontSize: 28, fontWeight: fontWeight.bold, color: colors.text, minWidth: 100, textAlign: 'center', borderBottomWidth: 2, borderBottomColor: colors.primary[500], paddingVertical: spacing.xs },
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
  addExpenseBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.primary[500] },
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
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: colors.primary[500], borderRadius: borderRadius.xl, ...shadow.md },
  saveBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: '#ffffff' },
});

export default BudgetTrackerSheet;
