// PollsSheet — group voting for "Plan with Friends", the mobile counterpart of
// the web's voting/VotingPoll.jsx (which the mobile app was missing a UI for,
// though pollAPI already existed in shared-services).
//
// Collaborators create polls ("Which beach?", "Dinner where?"), everyone votes,
// live counts show, and the owner can close a poll to lock in the winner.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import { createPoll, getTripPolls, voteOnPoll, closePoll, deletePoll } from '@prayana/shared-services';
import { useAuth } from '@prayana/shared-hooks';
import BottomModal, { BottomModalRef, BottomModalScrollView } from '../common/BottomModal';

const CYAN = '#06B6D4';

const CATEGORIES = [
  { key: 'activity', label: 'Activity', icon: 'compass-outline' },
  { key: 'restaurant', label: 'Food', icon: 'restaurant-outline' },
  { key: 'date', label: 'Dates', icon: 'calendar-outline' },
  { key: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
] as const;

interface PollOption {
  text: string;
  votes: string[]; // user ids
}
interface Poll {
  _id: string;
  question: string;
  category?: string;
  status?: string; // 'active' | 'closed'
  options: PollOption[];
  createdBy?: string;
}

interface Props {
  sheetRef: React.RefObject<BottomModalRef | null>;
  tripId: string | null;
}

const PollsSheet: React.FC<Props> = ({ sheetRef, tripId }) => {
  const { themeColors } = useTheme();
  const { user } = useAuth();
  const uid = (user as any)?.uid;

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // New-poll form
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [category, setCategory] = useState<string>('activity');

  const load = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const res: any = await getTripPolls(tripId);
      const list: Poll[] = res?.data ?? res?.polls ?? (Array.isArray(res) ? res : []);
      setPolls(list);
    } catch {
      setPolls([]);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setQuestion('');
    setOptions(['', '']);
    setCategory('activity');
    setShowCreate(false);
  };

  const handleCreate = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim()) {
      Alert.alert('Question required', 'Enter what everyone should vote on.');
      return;
    }
    if (cleanOptions.length < 2) {
      Alert.alert('Add options', 'A poll needs at least two options.');
      return;
    }
    if (!tripId) {
      Alert.alert('Save the trip first', 'Polls need a saved trip to attach to.');
      return;
    }
    setCreating(true);
    try {
      await createPoll({ tripId, question: question.trim(), options: cleanOptions, category, type: 'single' });
      resetForm();
      await load();
    } catch (e: any) {
      Alert.alert("Couldn't create poll", e?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (poll: Poll, optionIndex: number) => {
    if (poll.status === 'closed') return;
    // Optimistic: reflect the vote immediately, then reconcile from the server.
    setPolls((prev) =>
      prev.map((p) => {
        if (p._id !== poll._id) return p;
        const opts = p.options.map((o, i) => {
          const votes = o.votes.filter((v) => v !== uid);
          if (i === optionIndex && uid) votes.push(uid);
          return { ...o, votes };
        });
        return { ...p, options: opts };
      }),
    );
    try {
      await voteOnPoll(poll._id, optionIndex);
      load();
    } catch {
      load(); // roll back to server truth on failure
    }
  };

  const handleClose = async (poll: Poll) => {
    try {
      await closePoll(poll._id);
      load();
    } catch (e: any) {
      Alert.alert("Couldn't close poll", e?.message || 'Please try again.');
    }
  };

  const handleDelete = async (poll: Poll) => {
    Alert.alert('Delete poll?', poll.question, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePoll(poll._id);
            load();
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const setOption = (i: number, v: string) =>
    setOptions((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  return (
    <BottomModal ref={sheetRef}>
      <BottomModalScrollView>
        <View style={styles.sheetHeader}>
          <Ionicons name="bar-chart" size={18} color={CYAN} />
          <Text style={[styles.sheetTitle, { color: themeColors.text }]}>Group Voting</Text>
        </View>
        {!showCreate ? (
          <TouchableOpacity style={styles.newBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Ionicons name="add-circle" size={18} color="#fff" />
            <Text style={styles.newBtnText}>New poll</Text>
          </TouchableOpacity>
        ) : (
          <View style={[styles.createCard, { borderColor: themeColors.border }]}>
            <TextInput
              value={question}
              onChangeText={setQuestion}
              placeholder="What should we vote on?"
              placeholderTextColor={themeColors.textTertiary}
              style={[styles.input, { color: themeColors.text, borderColor: themeColors.border }]}
            />
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[
                      styles.catChip,
                      { borderColor: active ? CYAN : themeColors.border, backgroundColor: active ? 'rgba(6,182,212,0.1)' : 'transparent' },
                    ]}
                  >
                    <Ionicons name={c.icon as any} size={13} color={active ? CYAN : themeColors.textSecondary} />
                    <Text style={[styles.catChipText, { color: active ? CYAN : themeColors.textSecondary }]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {options.map((o, i) => (
              <View key={i} style={styles.optionInputRow}>
                <TextInput
                  value={o}
                  onChangeText={(v) => setOption(i, v)}
                  placeholder={`Option ${i + 1}`}
                  placeholderTextColor={themeColors.textTertiary}
                  style={[styles.input, { flex: 1, color: themeColors.text, borderColor: themeColors.border }]}
                />
                {options.length > 2 && (
                  <TouchableOpacity onPress={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                    <Ionicons name="close-circle" size={20} color={themeColors.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {options.length < 5 && (
              <TouchableOpacity onPress={() => setOptions((prev) => [...prev, ''])} style={styles.addOptBtn}>
                <Ionicons name="add" size={15} color={CYAN} />
                <Text style={styles.addOptText}>Add option</Text>
              </TouchableOpacity>
            )}
            <View style={styles.createActions}>
              <TouchableOpacity onPress={resetForm} style={styles.cancelBtn}>
                <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={styles.createBtn} disabled={creating}>
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.createBtnText}>Create poll</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.state}>
            <ActivityIndicator color={CYAN} />
          </View>
        ) : polls.length === 0 ? (
          <View style={styles.state}>
            <Ionicons name="bar-chart-outline" size={36} color={themeColors.textTertiary} />
            <Text style={[styles.stateText, { color: themeColors.textSecondary }]}>
              No polls yet. Start one so everyone can vote.
            </Text>
          </View>
        ) : (
          polls.map((poll) => {
            const total = poll.options.reduce((n, o) => n + o.votes.length, 0);
            const closed = poll.status === 'closed';
            const myVote = poll.options.findIndex((o) => uid && o.votes.includes(uid));
            const isOwner = poll.createdBy === uid;
            const winnerIdx = closed
              ? poll.options.reduce((max, o, i, arr) => (o.votes.length > arr[max].votes.length ? i : max), 0)
              : -1;
            return (
              <View key={poll._id} style={[styles.pollCard, { borderColor: themeColors.border, backgroundColor: themeColors.surface }]}>
                <View style={styles.pollHead}>
                  <Text style={[styles.pollQ, { color: themeColors.text }]}>{poll.question}</Text>
                  {isOwner && (
                    <View style={styles.pollActions}>
                      {!closed && (
                        <TouchableOpacity onPress={() => handleClose(poll)} hitSlop={6}>
                          <Ionicons name="lock-closed-outline" size={16} color={themeColors.textSecondary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDelete(poll)} hitSlop={6}>
                        <Ionicons name="trash-outline" size={16} color="#E11D48" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
                {closed && <Text style={styles.closedTag}>CLOSED · winner locked in</Text>}
                {poll.options.map((opt, i) => {
                  const count = opt.votes.length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  const voted = i === myVote;
                  const isWinner = i === winnerIdx;
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={closed ? 1 : 0.7}
                      onPress={() => handleVote(poll, i)}
                      style={[styles.optRow, { borderColor: voted ? CYAN : themeColors.border }]}
                    >
                      <View style={[styles.optFill, { width: `${pct}%`, backgroundColor: isWinner ? 'rgba(16,185,129,0.16)' : 'rgba(6,182,212,0.12)' }]} />
                      <View style={styles.optContent}>
                        <View style={styles.optLeft}>
                          {voted && <Ionicons name="checkmark-circle" size={15} color={CYAN} />}
                          {isWinner && <Ionicons name="trophy" size={14} color="#059669" />}
                          <Text style={[styles.optText, { color: themeColors.text }]} numberOfLines={1}>{opt.text}</Text>
                        </View>
                        <Text style={[styles.optPct, { color: themeColors.textSecondary }]}>{pct}% · {count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                <Text style={[styles.pollTotal, { color: themeColors.textTertiary }]}>
                  {total} vote{total === 1 ? '' : 's'}
                </Text>
              </View>
            );
          })
        )}
        <View style={{ height: spacing.xl }} />
      </BottomModalScrollView>
    </BottomModal>
  );
};

export default PollsSheet;

const styles = StyleSheet.create({
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  sheetTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: CYAN, paddingVertical: spacing.md, borderRadius: borderRadius.lg, marginBottom: spacing.md,
  },
  newBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  createCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.lg },
  input: { borderWidth: 1, borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSize.sm },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1 },
  catChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addOptBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 4 },
  addOptText: { color: CYAN, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  createActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xs },
  cancelBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  cancelBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  createBtn: { backgroundColor: CYAN, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  createBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  pollCard: { borderWidth: 1, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  pollHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  pollQ: { flex: 1, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  pollActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  closedTag: { fontSize: 10, fontWeight: fontWeight.bold, color: '#059669', letterSpacing: 0.5 },
  optRow: { position: 'relative', borderWidth: 1, borderRadius: borderRadius.md, overflow: 'hidden', minHeight: 42, justifyContent: 'center' },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  optText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, flexShrink: 1 },
  optPct: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  pollTotal: { fontSize: fontSize.xs },

  state: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  stateText: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
});
