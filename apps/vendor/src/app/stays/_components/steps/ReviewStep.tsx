// Step 6 — review and submit: everything still missing, grouped by step with
// a link straight to it, a summary of what guests will see, and what happens
// after submitting. A draft that was never reviewed can be deleted here.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { staysAPI } from '../api';
import { Button } from '../../../../components/ui';
import { fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import { usePalette, Banner, InfoRow } from '../controls';
import { CANCELLATION_POLICIES, STEPS, StepProps, apiError, rupees, submitAction, timeLabel } from '../stayConfig';

export default function ReviewStep({ draft, stay, applyServer, save, goTo, leave }: StepProps) {
  const p = usePalette();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const completeness = stay.completeness || { items: [], canSubmit: false, percent: 0, missing: [] };
  const action = submitAction(stay);
  const steps = STEPS.filter((s) => s.id !== 'review');
  const canDelete = stay.status === 'draft' && !stay.moderation?.approvedAt;

  const submit = async () => {
    setBusy(true);
    try {
      if (!(await save())) throw new Error("Couldn't save your last changes. Check your connection and try again.");
      const res: any = await staysAPI.submit(stay._id);
      if (res?.success === false) throw new Error(res.message);
      applyServer(res?.data);
      setJustSubmitted(true);
      Toast.show({ type: 'success', text1: res?.message || 'Submitted for review' });
    } catch (e: any) {
      // 400: what's still missing, with the fresh readiness to show it.
      const body = e?.data;
      if (body?.data) applyServer(body.data);
      const missing: string[] = Array.isArray(body?.missing) ? body.missing.map((m: { label: string }) => m.label) : [];
      Toast.show({
        type: 'error',
        text1: apiError(e, "Couldn't submit. Try again."),
        text2: missing.length ? missing.slice(0, 2).join(' · ') + (missing.length > 2 ? ` +${missing.length - 2} more` : '') : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert('Delete this draft?', "It hasn't been reviewed yet, so it's removed for good, with its photos and documents.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            const res: any = await staysAPI.remove(stay._id);
            if (res?.success === false) throw new Error(res.message);
            Toast.show({ type: 'success', text1: res?.message || 'Draft deleted' });
            leave();
          } catch (e) {
            Toast.show({ type: 'error', text1: "Couldn't delete the draft", text2: apiError(e, 'Try again.') });
            setDeleting(false);
          }
        },
      },
    ]);

  if (justSubmitted) {
    const live = stay.status === 'published';
    return (
      <View style={styles.success}>
        <View style={[styles.successIcon, { backgroundColor: p.soft.blue.bg }]}>
          <Ionicons name={live ? 'checkmark-done' : 'paper-plane-outline'} size={30} color={p.brand} />
        </View>
        <Text style={[styles.successTitle, { color: p.c.text }]} accessibilityRole="header">
          {live ? "You're live again" : 'Submitted for review'}
        </Text>
        <Text style={[styles.successText, { color: p.c.textSecondary }]}>
          {live
            ? 'Your property is back on Prayana.'
            : "Our team checks your property and documents, usually within 24 hours. We'll email you, and you can keep editing meanwhile."}
        </Text>
        {!live ? (
          <View style={styles.timeline}>
            {[
              { done: true, text: 'Submitted' },
              { done: false, text: 'We review it (usually within 24 hours)' },
              { done: false, text: "You get an email when it's approved" },
            ].map((s) => (
              <View key={s.text} style={styles.timelineRow}>
                <Ionicons name={s.done ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={s.done ? p.success : p.c.textTertiary} />
                <Text style={[styles.timelineText, { color: p.c.text }]}>{s.text}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.successBtns}>
          <Button title="Back to your properties" onPress={() => leave()} fullWidth />
          <Button title="Add another property" variant="outline" onPress={() => leave('/stays/new')} fullWidth />
        </View>
      </View>
    );
  }

  const cancellation = CANCELLATION_POLICIES.find((c) => c.id === draft.policies?.cancellation);
  const rooms = (draft.roomTypes || []).filter((r) => r.isActive !== false);
  const prices = rooms.map((r) => Number(r.price?.perNight)).filter((n) => n > 0);
  const pol = draft.policies || { houseRules: {} };

  return (
    <View>
      <View style={styles.groups}>
        {steps.map((s) => {
          const items = completeness.items.filter((i) => i.step === s.id);
          if (!items.length) return null;
          const left = items.filter((i) => i.required && !i.done);
          const tips = items.filter((i) => !i.required && !i.done);
          return (
            <View key={s.id} style={[styles.group, { borderColor: p.c.border, backgroundColor: p.c.surface }]}>
              <View style={styles.groupHead}>
                <Ionicons name={left.length ? 'ellipse-outline' : 'checkmark-circle'} size={18} color={left.length ? p.warning : p.success} />
                <Text style={[styles.groupTitle, { color: p.c.text }]}>{s.label}</Text>
                <TouchableOpacity
                  onPress={() => goTo(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${left.length ? 'Fix' : 'Edit'} ${s.label}`}
                  hitSlop={8}
                  style={styles.fix}
                >
                  <Text style={[styles.fixText, { color: p.brand }]}>{left.length ? 'Fix' : 'Edit'}</Text>
                  <Ionicons name="chevron-forward" size={16} color={p.brand} />
                </TouchableOpacity>
              </View>
              {left.length || tips.length ? (
                <View style={styles.groupItems}>
                  {left.map((i) => (
                    <Text key={i.key} style={[styles.item, { color: p.warning }]}>
                      • {i.label}
                    </Text>
                  ))}
                  {tips.map((i) => (
                    <Text key={i.key} style={[styles.item, { color: p.c.textTertiary }]}>
                      • Suggested: {i.label.charAt(0).toLowerCase() + i.label.slice(1)}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={[styles.summary, { borderColor: p.c.border, backgroundColor: p.c.surface }]}>
        <Text style={[styles.summaryTitle, { color: p.c.text }]}>What guests will see</Text>
        <InfoRow label="Name" value={draft.name || ''} />
        <InfoRow label="Where" value={[draft.location?.locality, draft.location?.city, draft.location?.state].filter(Boolean).join(', ')} />
        <InfoRow
          label="Check-in / check-out"
          value={`From ${timeLabel(pol.checkInFrom || '12:00')}${pol.checkInUntil ? ` to ${timeLabel(pol.checkInUntil)}` : ''} · out by ${timeLabel(pol.checkOutBy || '11:00')}${pol.flexibleCheckout24h ? ' · 24-hour check-out' : ''}`}
        />
        <InfoRow label="Cancellation" value={cancellation?.label || ''} />
        <InfoRow label="Rooms" value={rooms.map((r) => `${r.count}× ${r.name}`).join(', ')} />
        <InfoRow label="From" value={prices.length ? `${rupees(Math.min(...prices))} a night` : ''} />
        <InfoRow label="Photos" value={String((stay.photos || []).length)} />
        <InfoRow
          label="GST"
          value={draft.legal?.gstRegistered === true ? draft.legal.gstin || 'Registered' : draft.legal?.gstRegistered === false ? 'Not registered' : ''}
        />
      </View>

      {action ? (
        <View style={[styles.submitBox, { backgroundColor: p.soft.gray.bg }]}>
          <Text style={[styles.submitText, { color: p.c.textSecondary }]}>
            {completeness.canSubmit
              ? 'Everything we need is here. Our team reviews new properties, usually within 24 hours.'
              : 'Finish the items above to submit. Your progress is saved.'}
          </Text>
          <Button
            title={action.label}
            onPress={submit}
            disabled={!completeness.canSubmit}
            loading={busy}
            size="lg"
            icon={<Ionicons name="paper-plane-outline" size={18} color="#fff" />}
            fullWidth
          />
        </View>
      ) : stay.status === 'pending_review' ? (
        <Banner tone="amber">In review. You'll get an email when it's approved; edits you make meanwhile save as usual.</Banner>
      ) : stay.status === 'published' ? (
        <Banner tone="green">Live on Prayana. Changes you make save automatically and go live right away.</Banner>
      ) : null}

      {canDelete ? (
        <TouchableOpacity onPress={confirmDelete} disabled={deleting} style={styles.deleteBtn} accessibilityRole="button" accessibilityLabel="Delete this draft">
          <Ionicons name="trash-outline" size={16} color={p.danger} />
          <Text style={[styles.deleteText, { color: p.danger }]}>{deleting ? 'Deleting…' : 'Delete this draft'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.sm, marginBottom: spacing.lg },
  group: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupTitle: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  fix: { flexDirection: 'row', alignItems: 'center', minHeight: 32 },
  fixText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  groupItems: { marginTop: spacing.xs, paddingLeft: 26, gap: 2 },
  item: { fontSize: fontSize.sm, lineHeight: 19 },

  summary: { borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, marginBottom: spacing.lg },
  summaryTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },

  submitBox: { borderRadius: borderRadius.xl, padding: spacing.lg, gap: spacing.md },
  submitText: { fontSize: fontSize.sm, lineHeight: 19 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.xl, minHeight: 40 },
  deleteText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  success: { alignItems: 'center', paddingVertical: spacing.lg },
  successIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  successTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'center' },
  successText: { fontSize: fontSize.sm, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
  timeline: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  timelineText: { flex: 1, fontSize: fontSize.sm },
  successBtns: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.xl },
});
