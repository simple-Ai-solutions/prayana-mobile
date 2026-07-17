import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  TextInput as RNTextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import {
  Card,
  TextInput,
  Badge,
  EmptyState,
  useTheme,
} from '@prayana/shared-ui';
import { Button, LoadingSpinner } from '../../../components/ui';
import {
  colors,
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
} from '../../../theme/vendorColors';
import { questionAPI } from '@prayana/shared-services';

// ============================================================
// Types — mirror server ActivityQuestion schema
// ============================================================
type QuestionType =
  | 'text'
  | 'textarea'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox';

type Question = {
  _id: string;
  type: QuestionType;
  question: string;
  description?: string;
  required: boolean;
  options?: string[];
  placeholder?: string;
  validation?: Record<string, any>;
  displayOrder: number;
  category: string;
  isActive?: boolean;
  isNew?: boolean;
  // Server-managed fields stripped before create/update calls
  activity?: string;
  __v?: number;
  createdAt?: string;
  updatedAt?: string;
  stats?: any;
};

type QuestionTemplate = Partial<Question>;

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Multiple Choice' },
  { value: 'checkbox', label: 'Checkboxes' },
];

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'dietary', label: 'Dietary' },
  { value: 'health', label: 'Health & Fitness' },
  { value: 'preferences', label: 'Preferences' },
  { value: 'logistics', label: 'Logistics' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'custom', label: 'Custom' },
];

const typeLabel = (t: string) =>
  QUESTION_TYPES.find((x) => x.value === t)?.label || t;

const needsOptions = (t: QuestionType) =>
  ['select', 'radio', 'checkbox'].includes(t);

const needsPlaceholder = (t: QuestionType) =>
  ['text', 'textarea', 'email', 'phone', 'number'].includes(t);

// ============================================================
// Screen — pre-booking questions builder (QuestionBuilder port)
// ============================================================
export default function QuestionsScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<QuestionTemplate[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // ── Load ────────────────────────────────────────────────
  const loadQuestions = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await questionAPI.getActivityQuestions(id);
      if (res?.success) {
        setQuestions(res.data || []);
      }
    } catch (err: any) {
      console.warn('[Questions] fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await questionAPI.getTemplates();
      if (res?.success) {
        setTemplates(res.data || []);
      }
    } catch (err: any) {
      console.warn('[Questions] templates fetch failed:', err?.message);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
    loadTemplates();
  }, [loadQuestions, loadTemplates]);

  // ── Mutations (local state) ─────────────────────────────
  const addQuestion = () => {
    const newQuestion: Question = {
      _id: `temp_${Date.now()}`,
      type: 'text',
      question: '',
      description: '',
      required: false,
      options: [],
      placeholder: '',
      validation: {},
      displayOrder: questions.length,
      category: 'custom',
      isActive: true,
      isNew: true,
    };
    setQuestions([...questions, newQuestion]);
    setExpandedQuestion(newQuestion._id);
    setPreviewMode(false);
    Haptics.selectionAsync();
  };

  const addFromTemplate = (template: QuestionTemplate) => {
    // Strip any server-managed fields the template may carry, then apply
    // over sane defaults so the result is always a complete question.
    const { _id, __v, createdAt, updatedAt, stats, activity, ...rest } =
      template;
    const newQuestion: Question = {
      type: 'text',
      question: '',
      description: '',
      required: false,
      options: [],
      placeholder: '',
      validation: {},
      category: 'custom',
      isActive: true,
      ...rest,
      _id: `temp_${Date.now()}`,
      displayOrder: questions.length,
      isNew: true,
    };
    setQuestions([...questions, newQuestion]);
    setShowTemplates(false);
    Haptics.selectionAsync();
  };

  const updateQuestionField = useCallback(
    <K extends keyof Question>(questionId: string, field: K, value: Question[K]) => {
      setQuestions((prev) =>
        prev.map((q) => (q._id === questionId ? { ...q, [field]: value } : q))
      );
    },
    []
  );

  const performDelete = async (questionId: string) => {
    // New unsaved question — remove locally only.
    if (questionId.startsWith('temp_')) {
      setQuestions((prev) => prev.filter((q) => q._id !== questionId));
      return;
    }
    try {
      const res = await questionAPI.deleteQuestion(questionId);
      if (res?.success) {
        setQuestions((prev) => prev.filter((q) => q._id !== questionId));
        Toast.show({ type: 'success', text1: 'Question deleted' });
      } else {
        Toast.show({ type: 'error', text1: 'Failed to delete question', text2: res?.message });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to delete question', text2: err?.message });
    }
  };

  const confirmDelete = (questionId: string) => {
    Alert.alert(
      'Delete question',
      'Are you sure you want to delete this question?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => performDelete(questionId) },
      ]
    );
  };

  const duplicateQuestion = (question: Question) => {
    // Drop server-managed fields; keep everything else, marked as new.
    const { __v, createdAt, updatedAt, stats, ...rest } = question;
    const duplicate: Question = {
      ...rest,
      _id: `temp_${Date.now()}`,
      question: `${question.question} (Copy)`,
      displayOrder: questions.length,
      isNew: true,
    };
    setQuestions([...questions, duplicate]);
    Haptics.selectionAsync();
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    const next = [...questions];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    // Rewrite displayOrder for ALL questions to match new positions.
    setQuestions(next.map((q, i) => ({ ...q, displayOrder: i })));
    Haptics.selectionAsync();
  };

  // ── Persist ─────────────────────────────────────────────
  const saveAllQuestions = async () => {
    if (!id) return;
    setSaving(true);
    try {
      // Map temp ids -> server ids as new questions get created, so the
      // reorder call below can use real ids.
      const idMap: Record<string, string> = {};

      for (const question of questions) {
        if (question.isNew) {
          const { _id, isNew, ...questionData } = question;
          const res = await questionAPI.createQuestion(id, questionData);
          const createdId = res?.data?._id;
          if (createdId) idMap[_id] = createdId;
        } else {
          const { _id, __v, createdAt, updatedAt, stats, activity, isNew, ...questionData } =
            question;
          await questionAPI.updateQuestion(_id, questionData);
        }
      }

      const questionOrder = questions
        .map((q, index) => ({
          questionId: idMap[q._id] || q._id,
          displayOrder: index,
        }))
        .filter((o) => o.questionId && !String(o.questionId).startsWith('temp_'));

      if (questionOrder.length > 0) {
        await questionAPI.reorderQuestions(id, questionOrder);
      }

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      Toast.show({ type: 'success', text1: 'Questions saved' });
      await loadQuestions(); // reload to get server ids
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Failed to save questions', text2: err?.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <Header themeColors={themeColors} onBack={() => router.back()} onAdd={addQuestion} />
        <LoadingSpinner fullScreen message="Loading questions…" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Header themeColors={themeColors} onBack={() => router.back()} onAdd={addQuestion} />

      {/* Toolbar: preview/edit toggle + templates toggle */}
      <View style={[styles.toolbar, { borderColor: themeColors.border }]}>
        <ToolChip
          themeColors={themeColors}
          icon={previewMode ? 'create-outline' : 'eye-outline'}
          label={previewMode ? 'Edit mode' : 'Preview'}
          active={previewMode}
          onPress={() => setPreviewMode(!previewMode)}
        />
        <ToolChip
          themeColors={themeColors}
          icon="copy-outline"
          label="Templates"
          active={showTemplates}
          onPress={() => setShowTemplates(!showTemplates)}
        />
        <ToolChip
          themeColors={themeColors}
          icon="add"
          label="Add question"
          onPress={addQuestion}
        />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            Ask customers important questions before they book.
          </Text>

          {/* ── Templates panel ── */}
          {showTemplates && (
            <Card bordered elevated={false} style={styles.templatesCard}>
              <View style={styles.templatesHead}>
                <Text style={[styles.templatesTitle, { color: themeColors.text }]}>
                  Question templates
                </Text>
                <TouchableOpacity onPress={() => setShowTemplates(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>
              {templates.length === 0 ? (
                <Text style={[styles.templatesEmpty, { color: themeColors.textTertiary }]}>
                  No templates available.
                </Text>
              ) : (
                templates.map((template, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => addFromTemplate(template)}
                    activeOpacity={0.7}
                    style={[styles.templateItem, { borderColor: themeColors.border }]}
                  >
                    <View style={styles.templateMeta}>
                      <Badge label={template.category || 'custom'} variant="default" size="sm" />
                      <Text style={[styles.templateType, { color: themeColors.textTertiary }]}>
                        {typeLabel(template.type || 'text')}
                      </Text>
                    </View>
                    <Text style={[styles.templateQuestion, { color: themeColors.text }]}>
                      {template.question}
                    </Text>
                    {template.description ? (
                      <Text style={[styles.templateDesc, { color: themeColors.textSecondary }]}>
                        {template.description}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </Card>
          )}

          {/* ── Question list / preview / empty ── */}
          {questions.length === 0 ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon={<Ionicons name="help-circle-outline" size={56} color={themeColors.textTertiary} />}
                title="No questions yet"
                description="Add questions to gather important information from customers."
                actionLabel="Add question"
                onAction={addQuestion}
              />
              <View style={{ height: spacing.lg }} />
              <Button
                title="Browse templates"
                onPress={() => setShowTemplates(true)}
                variant="outline"
                size="md"
                fullWidth
              />
            </View>
          ) : previewMode ? (
            <Card bordered elevated={false} style={styles.previewCard}>
              <Text style={[styles.previewHeading, { color: themeColors.text }]}>
                Customer preview
              </Text>
              {questions.map((question, index) => (
                <QuestionPreviewItem
                  key={question._id}
                  question={question}
                  index={index}
                  themeColors={themeColors}
                />
              ))}
            </Card>
          ) : (
            questions.map((question, index) => (
              <QuestionEditorCard
                key={question._id}
                question={question}
                index={index}
                isExpanded={expandedQuestion === question._id}
                onToggleExpand={() =>
                  setExpandedQuestion(expandedQuestion === question._id ? null : question._id)
                }
                onUpdate={updateQuestionField}
                onDelete={confirmDelete}
                onDuplicate={duplicateQuestion}
                onMove={moveQuestion}
                isFirst={index === 0}
                isLast={index === questions.length - 1}
                themeColors={themeColors}
              />
            ))
          )}

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky save bar — only when there are questions to save */}
        {questions.length > 0 && (
          <View style={[styles.saveBar, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Button
              title={saving ? 'Saving…' : 'Save all questions'}
              onPress={saveAllQuestions}
              loading={saving}
              disabled={saving}
              fullWidth
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================
// Header
// ============================================================
function Header({
  themeColors,
  onBack,
  onAdd,
}: {
  themeColors: any;
  onBack: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={[styles.header, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={8}>
        <Ionicons name="chevron-back" size={22} color={themeColors.text} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>Pre-booking questions</Text>
      <TouchableOpacity onPress={onAdd} style={styles.headerBtn} hitSlop={8}>
        <Ionicons name="add" size={26} color={colors.primary[500]} />
      </TouchableOpacity>
    </View>
  );
}

// ============================================================
// Toolbar chip
// ============================================================
function ToolChip({
  themeColors,
  icon,
  label,
  active,
  onPress,
}: {
  themeColors: any;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.toolChip,
        { borderColor: themeColors.border },
        active && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? '#fff' : themeColors.textSecondary} />
      <Text style={[styles.toolChipText, { color: active ? '#fff' : themeColors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================
// Question editor (accordion card)
// ============================================================
function QuestionEditorCard({
  question,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onDuplicate,
  onMove,
  isFirst,
  isLast,
  themeColors,
}: {
  question: Question;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: <K extends keyof Question>(questionId: string, field: K, value: Question[K]) => void;
  onDelete: (questionId: string) => void;
  onDuplicate: (question: Question) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  isFirst: boolean;
  isLast: boolean;
  themeColors: any;
}) {
  const addOption = () => {
    onUpdate(question._id, 'options', [...(question.options || []), '']);
  };

  const updateOption = (optionIndex: number, value: string) => {
    const newOptions = [...(question.options || [])];
    newOptions[optionIndex] = value;
    onUpdate(question._id, 'options', newOptions);
  };

  const removeOption = (optionIndex: number) => {
    onUpdate(
      question._id,
      'options',
      (question.options || []).filter((_, i) => i !== optionIndex)
    );
  };

  return (
    <Card bordered elevated={false} style={styles.questionCard}>
      {/* Header row */}
      <TouchableOpacity onPress={onToggleExpand} activeOpacity={0.7} style={styles.questionHead}>
        <View style={[styles.qBadge, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Text style={[styles.qBadgeText, { color: themeColors.textSecondary }]}>Q{index + 1}</Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.questionTitle, { color: themeColors.text }]} numberOfLines={1}>
            {question.question || 'Untitled question'}
          </Text>
          <Text style={[styles.questionMeta, { color: themeColors.textTertiary }]} numberOfLines={1}>
            {typeLabel(question.type)}
            {question.required ? <Text style={styles.requiredStar}>  *Required</Text> : null}
          </Text>
        </View>

        <View style={styles.questionActions}>
          {!isFirst && (
            <TouchableOpacity onPress={() => onMove(index, 'up')} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="arrow-up" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}
          {!isLast && (
            <TouchableOpacity onPress={() => onMove(index, 'down')} hitSlop={6} style={styles.iconBtn}>
              <Ionicons name="arrow-down" size={18} color={themeColors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => onDuplicate(question)} hitSlop={6} style={styles.iconBtn}>
            <Ionicons name="copy-outline" size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(question._id)} hitSlop={6} style={styles.iconBtn}>
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeColors.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {/* Expanded editor */}
      {isExpanded && (
        <View style={[styles.editorBody, { borderColor: themeColors.border }]}>
          <TextInput
            label="Question text *"
            value={question.question}
            onChangeText={(t) => onUpdate(question._id, 'question', t)}
            placeholder="What do you want to ask?"
          />

          {/* Type */}
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Type</Text>
          <View style={styles.chipWrap}>
            {QUESTION_TYPES.map((t) => {
              const active = question.type === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => onUpdate(question._id, 'type', t.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.chip,
                    { borderColor: themeColors.border },
                    active && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Category */}
          <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Category</Text>
          <View style={styles.chipWrap}>
            {CATEGORIES.map((c) => {
              const active = question.category === c.value;
              return (
                <TouchableOpacity
                  key={c.value}
                  onPress={() => onUpdate(question._id, 'category', c.value)}
                  activeOpacity={0.7}
                  style={[
                    styles.chip,
                    { borderColor: themeColors.border },
                    active && { backgroundColor: colors.primary[500], borderColor: colors.primary[500] },
                  ]}
                >
                  <Text style={[styles.chipText, { color: active ? '#fff' : themeColors.textSecondary }]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            label="Description (optional)"
            value={question.description || ''}
            onChangeText={(t) => onUpdate(question._id, 'description', t)}
            placeholder="Helper text for customers"
          />

          {/* Placeholder — text-style inputs only */}
          {needsPlaceholder(question.type) && (
            <TextInput
              label="Placeholder"
              value={question.placeholder || ''}
              onChangeText={(t) => onUpdate(question._id, 'placeholder', t)}
              placeholder="E.g., Enter your answer…"
            />
          )}

          {/* Options — select / radio / checkbox only */}
          {needsOptions(question.type) && (
            <View style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>Options</Text>
              {(question.options || []).map((option, optionIndex) => (
                <View key={optionIndex} style={styles.optionRow}>
                  <RNTextInput
                    value={option}
                    onChangeText={(t) => updateOption(optionIndex, t)}
                    placeholder={`Option ${optionIndex + 1}`}
                    placeholderTextColor={themeColors.textTertiary}
                    style={[
                      styles.optionInput,
                      {
                        backgroundColor: themeColors.field,
                        borderColor: themeColors.fieldBorder,
                        color: themeColors.text,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() => removeOption(optionIndex)}
                    hitSlop={6}
                    style={styles.iconBtn}
                  >
                    <Ionicons name="close" size={20} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              <Button title="+ Add option" onPress={addOption} variant="outline" size="sm" />
            </View>
          )}

          {/* Required toggle */}
          <View style={styles.switchRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.text, marginBottom: 0 }]}>
              Required question
            </Text>
            <Switch
              value={question.required}
              onValueChange={(v) => onUpdate(question._id, 'required', v)}
              trackColor={{ true: colors.primary[400] }}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

// ============================================================
// Question preview (read-only customer view)
// ============================================================
function QuestionPreviewItem({
  question,
  index,
  themeColors,
}: {
  question: Question;
  index: number;
  themeColors: any;
}) {
  const options = question.options || [];
  const fieldStyle = [
    styles.previewField,
    { backgroundColor: themeColors.field, borderColor: themeColors.fieldBorder },
  ];

  return (
    <View style={styles.previewItem}>
      <Text style={[styles.previewLabel, { color: themeColors.text }]}>
        {index + 1}. {question.question || 'Untitled question'}
        {question.required ? <Text style={styles.requiredStar}> *</Text> : null}
      </Text>

      {question.description ? (
        <Text style={[styles.previewDesc, { color: themeColors.textSecondary }]}>
          {question.description}
        </Text>
      ) : null}

      {(question.type === 'text' ||
        question.type === 'email' ||
        question.type === 'phone' ||
        question.type === 'number') && (
        <RNTextInput
          editable={false}
          placeholder={question.placeholder || 'Your answer'}
          placeholderTextColor={themeColors.textTertiary}
          style={[...fieldStyle, { color: themeColors.text }]}
        />
      )}

      {question.type === 'textarea' && (
        <RNTextInput
          editable={false}
          multiline
          placeholder={question.placeholder || 'Your answer'}
          placeholderTextColor={themeColors.textTertiary}
          style={[...fieldStyle, styles.previewTextarea, { color: themeColors.text }]}
        />
      )}

      {question.type === 'date' && (
        <View style={[...fieldStyle, styles.previewRowField]}>
          <Ionicons name="calendar-outline" size={18} color={themeColors.textTertiary} />
          <Text style={[styles.previewPlaceholder, { color: themeColors.textTertiary }]}>
            {question.placeholder || 'Select a date'}
          </Text>
        </View>
      )}

      {question.type === 'select' && (
        <View style={[...fieldStyle, styles.previewRowField]}>
          <Text style={[styles.previewPlaceholder, { color: themeColors.textTertiary, flex: 1 }]}>
            Select an option…
          </Text>
          <Ionicons name="chevron-down" size={18} color={themeColors.textTertiary} />
        </View>
      )}

      {(question.type === 'radio' || question.type === 'checkbox') &&
        (options.length === 0 ? (
          <Text style={[styles.previewPlaceholder, { color: themeColors.textTertiary }]}>
            No options added yet
          </Text>
        ) : (
          <View style={styles.previewOptions}>
            {options.map((option, i) => (
              <View key={i} style={styles.previewOptionRow}>
                <Ionicons
                  name={question.type === 'radio' ? 'radio-button-off' : 'square-outline'}
                  size={20}
                  color={themeColors.textTertiary}
                />
                <Text style={[styles.previewOptionText, { color: themeColors.textSecondary }]}>
                  {option}
                </Text>
              </View>
            ))}
          </View>
        ))}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },

  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  toolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  scroll: { padding: spacing.lg },
  subtitle: { fontSize: fontSize.sm, marginBottom: spacing.lg, lineHeight: 20 },

  // Templates panel
  templatesCard: { marginBottom: spacing.lg },
  templatesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  templatesTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  templatesEmpty: { fontSize: fontSize.sm },
  templateItem: {
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  templateType: { fontSize: fontSize.xs },
  templateQuestion: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  templateDesc: { fontSize: fontSize.xs, marginTop: 2 },

  // Question cards (edit mode)
  questionCard: { marginBottom: spacing.md },
  questionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  qBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.md,
  },
  qBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  questionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  questionMeta: { fontSize: fontSize.xs, marginTop: 2 },
  requiredStar: { color: colors.error, fontWeight: fontWeight.semibold },
  questionActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: spacing.xs },

  editorBody: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.lg,
  },

  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  optionInput: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 44,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },

  // Preview mode
  previewCard: { marginBottom: spacing.md },
  previewHeading: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginBottom: spacing.lg },
  previewItem: { marginBottom: spacing.xl },
  previewLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: spacing.xs },
  previewDesc: { fontSize: fontSize.xs, marginBottom: spacing.sm, lineHeight: 18 },
  previewField: {
    borderWidth: 1.5,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    minHeight: 48,
  },
  previewTextarea: { minHeight: 96, textAlignVertical: 'top' },
  previewRowField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewPlaceholder: { fontSize: fontSize.md },
  previewOptions: { gap: spacing.sm },
  previewOptionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  previewOptionText: { fontSize: fontSize.sm },

  // Save bar
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: spacing.lg,
    borderTopWidth: 1,
  },
});
