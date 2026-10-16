import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsha } from '../ishaTheme';
import type { ReplyStep } from '../types';

const strip = (text: string) => String(text || '').replace(/…$|\.\.\.$/, '');

/**
 * What Isha is doing for this reply ("Finding places to visit…").
 *
 * While she works and nothing is written yet, the steps show as a live list.
 * Once words arrive the list folds into one chip that opens it again, so the
 * answer leads and the working stays one tap away.
 */
export default function ReplySteps({
  steps = [],
  isStreaming,
  hasContent,
}: {
  steps?: ReplyStep[];
  isStreaming?: boolean;
  hasContent: boolean;
}) {
  const t = useIsha();
  const [open, setOpen] = useState(false);
  const live = isStreaming && !hasContent;

  if (live) {
    const list = steps.length ? steps : [{ text: 'Thinking…', done: false }];
    return (
      <View
        accessibilityLabel="What Isha is doing"
        accessibilityLiveRegion="polite"
        style={[styles.live, { borderColor: t.border, backgroundColor: t.surfaceMuted }]}
      >
        {list.map((step, i) => (
          <View key={`${step.text}-${i}`} style={styles.row}>
            {step.done ? (
              <View style={[styles.check, { backgroundColor: t.ink }]}>
                <Ionicons name="checkmark" size={12} color={t.onInk} />
              </View>
            ) : (
              <ActivityIndicator size="small" color={t.text} style={styles.spinner} />
            )}
            <Text
              style={[
                styles.liveText,
                step.done ? { color: t.muted } : { color: t.text, fontWeight: '500' },
              ]}
            >
              {step.done ? strip(step.text) : step.text}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  if (!steps.length) return null;

  const label = steps.length === 1 ? strip(steps[0].text) : `Checked ${steps.length} things`;
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={6}
        style={({ pressed }) => [styles.chip, { backgroundColor: pressed ? t.border : t.sunken }]}
      >
        <Ionicons name="checkmark" size={13} color={t.body} />
        <Text style={[styles.chipText, { color: t.body }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={t.muted} />
      </Pressable>
      {open && (
        <View style={styles.doneList}>
          {steps.map((step, i) => (
            <View key={`${step.text}-${i}`} style={styles.row}>
              <Ionicons name="checkmark" size={13} color={t.text} />
              <Text style={[styles.doneText, { color: t.muted }]}>{strip(step.text)}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  live: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 18, height: 18, transform: [{ scale: 0.75 }] },
  liveText: { flex: 1, fontSize: 13, lineHeight: 18 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 999,
    maxWidth: '100%',
  },
  chipText: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
  doneList: { marginTop: 8, paddingLeft: 4, gap: 6 },
  doneText: { fontSize: 13, flex: 1 },
});
