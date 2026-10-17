// Step 4 — amenities (pre-ticked for the property type), check-in and
// check-out, cancellation preset, the house rules Indian guests filter on
// (couple-friendly, local ID, pets …), children, and experiences on offer.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput as RNTextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextInput } from '../../../../components/ui';
import { fontSize, fontWeight, spacing, borderRadius } from '../../../../theme/vendorColors';
import { usePalette, Section, Chip, ChipRow, OptionCard, YesNo, SelectField, SwitchRow } from '../controls';
import {
  AMENITIES,
  CANCELLATION_POLICIES,
  EXPERIENCE_SUGGESTIONS,
  HOUSE_RULES,
  MAX_EXPERIENCES,
  Policies,
  StepProps,
  TIME_OPTIONS,
} from '../stayConfig';

const TIMES = TIME_OPTIONS.map((t) => ({ value: t.value, label: t.label }));
const FREE_AGES = [0, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => ({ value: String(n), label: n === 0 ? 'No free age' : `${n} years` }));
const MIN_AGES = [18, 21, 25].map((n) => ({ value: String(n), label: `${n} years` }));

export default function RulesStep({ draft, update }: StepProps) {
  const p = usePalette();
  const [showAll, setShowAll] = useState(false);
  const [custom, setCustom] = useState('');
  const amenities = draft.amenities || [];
  const policies = draft.policies || { houseRules: {} };
  const rules = policies.houseRules || {};
  const experiences = draft.experiences || [];

  const setPolicies = (patch: Partial<Policies>) => update((d) => ({ policies: { ...(d.policies || { houseRules: {} }), ...patch } }));
  const setRule = (id: string, v: boolean | null) =>
    update((d) => ({ policies: { ...(d.policies || {}), houseRules: { ...(d.policies?.houseRules || {}), [id]: v } } }));
  const toggleAmenity = (id: string) =>
    update((d) => ({ amenities: d.amenities.includes(id) ? d.amenities.filter((a) => a !== id) : [...d.amenities, id] }));
  const toggleExperience = (name: string) =>
    update((d) => ({
      experiences: d.experiences.includes(name) ? d.experiences.filter((x) => x !== name) : [...d.experiences, name].slice(0, MAX_EXPERIENCES),
    }));
  const addCustom = () => {
    const name = custom.trim();
    if (!name) return;
    if (!experiences.includes(name)) toggleExperience(name);
    setCustom('');
  };

  const shown = showAll ? AMENITIES : AMENITIES.filter((a) => a.popular || amenities.includes(a.id));
  const allExperiences = [...new Set([...EXPERIENCE_SUGGESTIONS, ...experiences])];

  return (
    <View>
      <Section
        title="Amenities"
        hint="We've ticked the usual ones for your type of property. Untick anything you don't have."
        aside={<Text style={[styles.count, { color: p.c.textTertiary }]}>{amenities.length} selected</Text>}
      >
        <ChipRow>
          {shown.map((a) => (
            <Chip key={a.id} label={a.label} selected={amenities.includes(a.id)} onPress={() => toggleAmenity(a.id)} />
          ))}
        </ChipRow>
        <TouchableOpacity onPress={() => setShowAll((s) => !s)} accessibilityRole="button" style={styles.linkBtn}>
          <Text style={[styles.link, { color: p.brand }]}>{showAll ? 'Show fewer' : `Show all ${AMENITIES.length} amenities`}</Text>
        </TouchableOpacity>
      </Section>

      <Section title="Check-in and check-out">
        <SelectField label="Check-in from" value={policies.checkInFrom || '12:00'} options={TIMES} onChange={(v) => setPolicies({ checkInFrom: v })} />
        <SelectField
          label="Check-in until"
          value={policies.checkInUntil || ''}
          options={[{ value: '', label: 'Any time (24 hours)' }, ...TIMES]}
          onChange={(v) => setPolicies({ checkInUntil: v || null })}
        />
        <SelectField label="Check-out by" value={policies.checkOutBy || '11:00'} options={TIMES} onChange={(v) => setPolicies({ checkOutBy: v })} />
        <SwitchRow
          label="24-hour check-out"
          hint="A guest who checks in at 6 PM can stay until 6 PM the next day."
          value={!!policies.flexibleCheckout24h}
          onChange={(v) => setPolicies({ flexibleCheckout24h: v })}
        />
      </Section>

      <Section title="Cancellation policy" hint="You can change this any time.">
        <View style={styles.cards} accessibilityRole="radiogroup">
          {CANCELLATION_POLICIES.map((c) => (
            <OptionCard
              key={c.id}
              selected={policies.cancellation === c.id}
              onPress={() => setPolicies({ cancellation: c.id })}
              title={c.label}
              hint={c.hint}
              badge={c.popular ? 'Most popular' : undefined}
            />
          ))}
        </View>
      </Section>

      <Section title="House rules" hint="Guests filter on these. Answer the ones that apply.">
        <View style={[styles.box, { borderColor: p.c.border }]}>
          {HOUSE_RULES.map((r, i) => (
            <View key={r.id} style={i ? [styles.divider, { borderTopColor: p.c.border }] : undefined}>
              <YesNo label={r.label} hint={r.hint} value={rules[r.id] ?? null} onChange={(v) => setRule(r.id, v)} />
            </View>
          ))}
        </View>
      </Section>

      <Section title="Children">
        <View style={[styles.box, { borderColor: p.c.border }]}>
          <YesNo
            label="Children welcome"
            allowClear={false}
            value={policies.childrenAllowed !== false}
            onChange={(v) => setPolicies({ childrenAllowed: v !== false })}
          />
          {policies.childrenAllowed !== false ? (
            <View style={[styles.divider, styles.selectRow, { borderTopColor: p.c.border }]}>
              <Text style={[styles.rowLabel, { color: p.c.text }]}>Children stay free up to age</Text>
              <View style={styles.selectNarrow}>
                <SelectField
                  compact
                  sheetTitle="Children stay free up to age"
                  value={String(policies.childFreeUnderAge ?? 5)}
                  options={FREE_AGES}
                  onChange={(v) => setPolicies({ childFreeUnderAge: Number(v) })}
                />
              </View>
            </View>
          ) : null}
          <View style={[styles.divider, styles.selectRow, { borderTopColor: p.c.border }]}>
            <Text style={[styles.rowLabel, { color: p.c.text }]}>Youngest age to check in</Text>
            <View style={styles.selectNarrow}>
              <SelectField
                compact
                sheetTitle="Youngest age to check in"
                value={String(policies.minCheckInAge ?? 18)}
                options={MIN_AGES}
                onChange={(v) => setPolicies({ minCheckInAge: Number(v) })}
              />
            </View>
          </View>
        </View>
      </Section>

      <Section title="Experiences you offer (optional)" hint="Prayana also sells experiences; guests love stays that come with something to do.">
        <ChipRow>
          {allExperiences.map((x) => (
            <Chip key={x} label={x} selected={experiences.includes(x)} onPress={() => toggleExperience(x)} />
          ))}
        </ChipRow>
        <View style={styles.customRow}>
          <RNTextInput
            value={custom}
            onChangeText={setCustom}
            maxLength={60}
            placeholder="Something else, e.g. Coracle ride"
            placeholderTextColor={p.c.textTertiary}
            returnKeyType="done"
            onSubmitEditing={addCustom}
            accessibilityLabel="Add another experience"
            style={[styles.customInput, { color: p.c.text, borderColor: p.c.fieldBorder, backgroundColor: p.c.field }]}
          />
          <TouchableOpacity
            onPress={addCustom}
            disabled={!custom.trim() || experiences.length >= MAX_EXPERIENCES}
            accessibilityRole="button"
            accessibilityLabel="Add experience"
            style={[styles.addBtn, { borderColor: p.c.fieldBorder }, (!custom.trim() || experiences.length >= MAX_EXPERIENCES) && styles.disabled]}
          >
            <Ionicons name="add" size={20} color={p.brand} />
          </TouchableOpacity>
        </View>
        {experiences.length >= MAX_EXPERIENCES ? (
          <Text style={[styles.count, { color: p.c.textTertiary }]}>Up to {MAX_EXPERIENCES} experiences.</Text>
        ) : null}
      </Section>

      <Section title="Anything else guests should know? (optional)">
        <TextInput
          value={policies.notes || ''}
          onChangeText={(t) => setPolicies({ notes: t })}
          maxLength={1000}
          multiline
          textAlignVertical="top"
          style={styles.textarea}
          placeholder="e.g. Quiet hours after 10 PM. The last 200 m is a dirt road; we pick you up from the main road."
          accessibilityLabel="Notes for guests"
          containerStyle={styles.noGap}
        />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  count: { fontSize: fontSize.xs },
  linkBtn: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  link: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  cards: { gap: spacing.sm },
  box: { borderWidth: 1, borderRadius: borderRadius.xl, paddingHorizontal: spacing.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowLabel: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  selectNarrow: { width: 140 },
  customRow: { flexDirection: 'row', gap: spacing.sm },
  customInput: { flex: 1, borderWidth: 1.5, borderRadius: borderRadius.lg, paddingHorizontal: spacing.md, minHeight: 44, fontSize: fontSize.md },
  addBtn: { width: 44, height: 44, borderWidth: 1.5, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  textarea: { minHeight: 100 },
  noGap: { marginBottom: 0 },
});
