// Isha's trip questions in one go: how long, when, who's going, where from,
// how they'll get there (India only), and optionally budget and interests.
// The server shapes them to the destination and preselects sensible defaults,
// so one tap plans the trip. The button sends the choices as one message
// ("Plan a 6-day trip to Paris from Bengaluru for a couple, in December…").
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';
import { InkButton } from './ui';
import type { TripQuestion } from './types';

/** "5 days" → "5-day". */
const asLength = (days: unknown) => {
  const n = String(days || '').match(/^(\d+)\s*days?$/i);
  return n ? `${n[1]}-day` : String(days || '');
};

// "Getting there" choice → the word the request uses ("by flight")
const BY: Record<string, string> = { Flight: 'flight', 'Train or bus': 'train', 'Train / Bus': 'train', Drive: 'car', Cab: 'cab', Bike: 'bike' };
// "for", not "with": the planner reads the starting city up to the next "for" or comma
const WHO: Record<string, string> = { Couple: 'a couple', Family: 'a family', Friends: 'a group of friends' };

type Answers = Record<string, any>;

export function tripRequest(destination: string, a: Answers) {
  let text = `Plan a ${asLength(a.days)} trip to ${destination}`;
  if (a.from) text += ` from ${a.from}`;
  if (a.transport && BY[a.transport]) text += ` by ${BY[a.transport]}`;
  const who = a.who || a.people;
  if (who === 'Solo') text += ', travelling solo';
  else if (who) text += ` for ${WHO[who] || who}`;
  if (a.when && a.when !== 'Not decided') text += `, in ${a.when}`;
  if (a.budget) text += `, budget ${a.budget} per person`;
  if (a.interests?.length) text += `, interested in ${a.interests.map((i: string) => i.toLowerCase()).join(', ')}`;
  return text;
}

// A city the location lookup couldn't name isn't worth preselecting
const usableCity = (city?: string | null) => (city && !/^(unknown|your location)$/i.test(city) ? city : null);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortLabel = (opt: string) => (MONTHS.includes(opt) ? opt.slice(0, 3) : opt);
const BEST = 'Best time';

// How long is a segmented switch: up to four lengths side by side
const isSwitch = (q: TripQuestion) => q.id === 'days' && !q.multi && q.options.length <= 4;

export default function TripChoices({
  data,
  onSubmit,
  locked = false,
}: {
  data: { destination?: string; questions?: TripQuestion[] };
  onSubmit: (text: string) => void;
  /** Answered already (the chat moved on): shown, not sent again. */
  locked?: boolean;
}) {
  const t = useIsha();
  const detectedCity = usableCity(useChatStore((s) => s.chatContext?.userLocation?.city || null));
  const questions = data?.questions || [];
  const destination = data?.destination || '';
  // What the user changed; anything else falls back to the question's default
  const [chosen, setChosen] = useState<Answers>({});
  const [typedCity, setTypedCity] = useState('');
  const [sentHere, setSent] = useState(false);
  const sent = sentHere || locked;

  const valueOf = (q: TripQuestion) => {
    if (q.id in chosen) return chosen[q.id];
    if (q.type === 'place') return detectedCity || q.default || null;
    return q.default ?? (q.multi ? [] : null);
  };
  const answers: Answers = Object.fromEntries(questions.map((q) => [q.id, valueOf(q)]));
  const missing = questions.filter((q) => !q.optional && !(q.multi ? answers[q.id]?.length : answers[q.id]));
  const ready = !missing.length && !sent;

  const pick = (q: TripQuestion, option: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (q.type === 'place') setTypedCity('');
    setChosen((c) => {
      const current = q.id in c ? c[q.id] : valueOf(q);
      if (q.multi) {
        const list: string[] = current || [];
        return { ...c, [q.id]: list.includes(option) ? list.filter((x) => x !== option) : [...list, option] };
      }
      // The switch always has a pick; other choices clear on a second tap
      return { ...c, [q.id]: current === option && !isSwitch(q) ? null : option };
    });
  };

  const summary = [answers.days, answers.when !== 'Not decided' && answers.when, answers.who || answers.people, answers.from && `from ${answers.from}`]
    .filter(Boolean)
    .join(' · ');

  const submit = () => {
    if (!ready) return;
    setSent(true);
    onSubmit(tripRequest(destination, answers));
  };

  return (
    <View
      accessibilityLabel={`Shape your ${destination} trip`}
      style={[styles.card, { borderColor: t.border, backgroundColor: t.surface, shadowColor: t.shadow }]}
    >
      {questions.map((q) => {
        // The visitor's own city first, without repeating a popular one
        const options =
          q.type === 'place' && detectedCity && !q.options.some((o) => o.toLowerCase() === detectedCity.toLowerCase())
            ? [detectedCity, ...q.options]
            : q.options;
        const hints = q.hints || {};
        const hasBest = options.some((o) => hints[o] === BEST);
        return (
          <View key={q.id}>
            <Text style={[styles.legend, { color: t.body }]}>
              {q.label}
              {q.optional && (
                <Text style={{ color: t.faint, fontWeight: '400' }}> · optional{q.multi ? ', pick any' : ''}</Text>
              )}
            </Text>
            {!!q.note && (
              <View style={styles.note}>
                <Ionicons name="pricetag-outline" size={12} color={t.body} />
                <Text style={[styles.noteText, { color: t.body }]}>{q.note}</Text>
              </View>
            )}

            {isSwitch(q) ? (
              <>
                <View accessibilityRole="radiogroup" style={[styles.switch, { backgroundColor: t.sunken }]}>
                  {options.map((opt) => {
                    const on = answers[q.id] === opt;
                    return (
                      <Pressable
                        key={opt}
                        disabled={sent}
                        onPress={() => pick(q, opt)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: sent }}
                        style={[styles.seg, on && { backgroundColor: t.ink }]}
                      >
                        <Text style={[styles.segText, { color: on ? t.onInk : t.muted, fontWeight: on ? '600' : '500' }]}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!!hints[answers[q.id]] && (
                  <Text style={[styles.hintLine, { color: t.muted }]}>
                    {answers[q.id]} · {hints[answers[q.id]]}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.options} accessibilityRole={q.multi ? undefined : 'radiogroup'}>
                {options.map((opt) => {
                  const on = q.multi ? (answers[q.id] || []).includes(opt) : answers[q.id] === opt;
                  const hint = hints[opt];
                  const best = hint === BEST;
                  const tall = !!hint && !best;
                  return (
                    <Pressable
                      key={opt}
                      disabled={sent}
                      onPress={() => pick(q, opt)}
                      accessibilityRole={q.multi ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: on, disabled: sent }}
                      accessibilityLabel={best ? `${opt}, best time to go` : opt}
                      style={[
                        tall ? styles.optTall : styles.opt,
                        on ? { backgroundColor: t.ink, borderColor: t.ink } : { backgroundColor: t.surface, borderColor: t.border },
                        sent && { opacity: 0.6 },
                      ]}
                    >
                      <View style={styles.optRow}>
                        {q.multi && on && <Ionicons name="checkmark" size={13} color={t.onInk} />}
                        {best && <View style={[styles.bestDot, { backgroundColor: t.best }]} />}
                        <Text style={[styles.optText, { color: on ? t.onInk : t.body, fontWeight: on ? '500' : '400' }]}>
                          {shortLabel(opt)}
                        </Text>
                      </View>
                      {tall && (
                        <Text style={[styles.optHint, { color: on ? (t.isDark ? '#57534e' : '#d6d3d1') : t.faint }]}>{hint}</Text>
                      )}
                    </Pressable>
                  );
                })}
                {q.type === 'place' && (
                  <TextInput
                    value={typedCity}
                    editable={!sent}
                    maxLength={60}
                    placeholder="Other city"
                    placeholderTextColor={t.placeholder}
                    accessibilityLabel="Type your starting city"
                    returnKeyType="done"
                    onChangeText={(v) => {
                      setTypedCity(v);
                      setChosen((c) => ({ ...c, [q.id]: v.trim() || null }));
                    }}
                    style={[
                      styles.cityInput,
                      {
                        color: t.text,
                        backgroundColor: t.surface,
                        borderColor: typedCity.trim() ? t.ink : t.borderStrong,
                        borderStyle: typedCity.trim() ? 'solid' : 'dashed',
                      },
                    ]}
                  />
                )}
              </View>
            )}

            {hasBest && (
              <View style={styles.bestRow}>
                <View style={[styles.bestDot, { backgroundColor: t.best }]} />
                <Text style={[styles.bestText, { color: t.muted }]}>Best time to visit {destination}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={[styles.foot, { borderTopColor: t.divider }]}>
        <Text style={[styles.summary, { color: t.muted }]}>
          {sentHere
            ? 'Planning your trip…'
            : ready || locked
              ? summary
              : `Pick ${missing.map((q) => q.label.replace(/\?$/, '').toLowerCase()).join(', ')}`}
        </Text>
        <InkButton
          size="lg"
          label={sentHere ? 'Planning…' : `Plan my ${destination} trip`}
          iconRight={sentHere ? undefined : 'arrow-forward'}
          disabled={!ready && !sentHere}
          busy={sentHere}
          onPress={submit}
          style={{ width: '100%' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 16,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 1,
  },
  legend: { fontSize: 12.5, fontWeight: '600', marginBottom: 8 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -4, marginBottom: 8 },
  noteText: { fontSize: 12, fontWeight: '500' },
  switch: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  seg: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13.5 },
  hintLine: { fontSize: 12, marginTop: 6 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  opt: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  optTall: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1, justifyContent: 'center' },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optText: { fontSize: 13, lineHeight: 18 },
  optHint: { fontSize: 11.5, lineHeight: 16 },
  bestDot: { width: 6, height: 6, borderRadius: 3 },
  cityInput: { height: 36, minWidth: 128, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, fontSize: 13, paddingVertical: 0 },
  bestRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  bestText: { fontSize: 12 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 10 },
  summary: { fontSize: 12.5 },
});
