import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight } from '@prayana/shared-ui';
import { inkColors } from './ishaInk';

// Isha's trip options, as on the website: how long, when (the best months
// dotted), who's going, how much of the activity they've done (when they
// asked about one), where from, how they'll get there (India only), and
// optionally budget and interests. The server shapes them to the place and
// preselects sensible defaults, so one tap plans the trip: the button sends
// the choices as one message ("Plan a 5-day trip to Goa for a couple, in
// December"), which builds the itinerary.

export type TripQuestion = {
  id: string;
  label: string;
  options: string[];
  hints?: Record<string, string>;
  default?: string | string[];
  optional?: boolean;
  multi?: boolean;
  type?: 'place';
  note?: string | null;
};

export type TripChoicesData = {
  destination: string;
  questions: TripQuestion[];
  focus?: { activity: string } | null;
};

type Answers = Record<string, string | string[] | null>;

const asLength = (days: unknown) => {
  const n = String(days || '').match(/^(\d+)\s*days?$/i);
  return n ? `${n[1]}-day` : String(days || '');
};
// "Getting there" choice -> the word the request uses ("by flight")
const BY: Record<string, string> = { Flight: 'flight', 'Train or bus': 'train', 'Train / Bus': 'train', Drive: 'car', Cab: 'cab', Bike: 'bike' };
// "for", not "with": the planner reads the starting city up to the next "for" or comma
const WHO: Record<string, string> = { Couple: 'a couple', Family: 'a family', Friends: 'a group of friends' };

/** The message the choices send, as the website builds it. */
export function tripRequest(destination: string, a: Answers, focus?: { activity: string } | null) {
  let text = `Plan a ${asLength(a.days)} trip to ${destination}`;
  if (a.from) text += ` from ${a.from}`;
  if (typeof a.transport === 'string' && BY[a.transport]) text += ` by ${BY[a.transport]}`;
  const who = (a.who || a.people) as string | null;
  if (who === 'Solo') text += ', travelling solo';
  else if (who) text += ` for ${WHO[who] || who}`;
  if (focus?.activity) text += `, with ${focus.activity}${a.experience ? ` (${String(a.experience).toLowerCase()})` : ''}`;
  if (a.when && a.when !== 'Not decided') text += `, in ${a.when}`;
  if (a.budget) text += `, budget ${a.budget} per person`;
  if (Array.isArray(a.interests) && a.interests.length) text += `, interested in ${a.interests.map((i) => i.toLowerCase()).join(', ')}`;
  return text;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortLabel = (opt: string) => (MONTHS.includes(opt) ? opt.slice(0, 3) : opt);
const BEST = 'Best time';
const isSwitch = (q: TripQuestion) => q.id === 'days' && !q.multi && q.options.length <= 4;

export default function TripChoicesCard({ data, isDark, onSubmit }: {
  data: TripChoicesData;
  isDark: boolean;
  onSubmit: (text: string) => void;
}) {
  const c = inkColors(isDark);
  const questions = data?.questions || [];
  const destination = data?.destination || '';
  // What the user changed; anything else is the question's default (null: cleared)
  const [chosen, setChosen] = useState<Answers>({});
  const [typedCity, setTypedCity] = useState('');
  const [sent, setSent] = useState(false);

  const valueOf = (q: TripQuestion): string | string[] | null => {
    if (q.id in chosen) return chosen[q.id];
    return (q.default as string | string[] | undefined) ?? (q.multi ? [] : null);
  };
  const answers: Answers = Object.fromEntries(questions.map((q) => [q.id, valueOf(q)]));
  const missing = questions.filter((q) => !q.optional && !(q.multi ? (answers[q.id] as string[] | null)?.length : answers[q.id]));
  const ready = !missing.length && !sent;

  const pick = (q: TripQuestion, option: string) => {
    if (q.type === 'place') setTypedCity('');
    setChosen((prev) => {
      const current = q.id in prev ? prev[q.id] : valueOf(q);
      if (q.multi) {
        const list = (current as string[] | null) || [];
        return { ...prev, [q.id]: list.includes(option) ? list.filter((x) => x !== option) : [...list, option] };
      }
      // The switch always has a pick; other choices clear on a second tap
      return { ...prev, [q.id]: current === option && !isSwitch(q) ? null : option };
    });
  };

  const summary = [answers.days, answers.when !== 'Not decided' && answers.when, answers.who || answers.people, answers.from && `from ${answers.from}`]
    .filter(Boolean)
    .join(' · ');

  const submit = () => {
    if (!ready) return;
    setSent(true);
    onSubmit(tripRequest(destination, answers, data.focus));
  };

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]} accessibilityLabel={`Shape your ${destination} trip`}>
      {questions.map((q) => {
        const hints = q.hints || {};
        const hasBest = q.options.some((o) => hints[o] === BEST);
        const value = answers[q.id];
        return (
          <View key={q.id} style={styles.question}>
            <Text style={[styles.qLabel, { color: c.label }]}>
              {q.label}
              {q.optional && <Text style={{ color: c.muted, fontWeight: fontWeight.normal }}> · optional{q.multi ? ', pick any' : ''}</Text>}
            </Text>
            {!!q.note && (
              <View style={styles.noteRow}>
                <Ionicons name="pricetag-outline" size={12} color={c.label} />
                <Text style={[styles.note, { color: c.label }]}>{q.note}</Text>
              </View>
            )}

            {isSwitch(q) ? (
              <>
                <View style={[styles.track, { backgroundColor: c.track }]} accessibilityRole="radiogroup">
                  {q.options.map((opt) => {
                    const on = value === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        disabled={sent}
                        onPress={() => pick(q, opt)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on, disabled: sent }}
                        style={[styles.segment, on && { backgroundColor: c.ink }]}
                      >
                        <Text style={[styles.segmentText, { color: on ? c.onInk : c.muted, fontWeight: on ? fontWeight.semibold : fontWeight.medium }]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {typeof value === 'string' && !!hints[value] && (
                  <Text style={[styles.caption, { color: c.muted }]}>{value} · {hints[value]}</Text>
                )}
              </>
            ) : (
              <View style={styles.pills}>
                {q.options.map((opt) => {
                  const on = q.multi ? ((value as string[] | null) || []).includes(opt) : value === opt;
                  const best = hints[opt] === BEST;
                  return (
                    <TouchableOpacity
                      key={opt}
                      disabled={sent}
                      onPress={() => pick(q, opt)}
                      accessibilityRole={q.multi ? 'checkbox' : 'radio'}
                      accessibilityState={{ checked: on, disabled: sent }}
                      accessibilityLabel={best ? `${opt}, best time to go` : opt}
                      style={[styles.pill, { borderColor: on ? c.ink : c.optionBorder, backgroundColor: on ? c.ink : c.surface }]}
                    >
                      {q.multi && on && <Ionicons name="checkmark" size={13} color={c.onInk} />}
                      {best && <View style={[styles.dot, { backgroundColor: c.best }]} />}
                      <Text style={[styles.pillText, { color: on ? c.onInk : c.text, fontWeight: on ? fontWeight.medium : fontWeight.normal }]}>{shortLabel(opt)}</Text>
                    </TouchableOpacity>
                  );
                })}
                {q.type === 'place' && (
                  <TextInput
                    value={typedCity}
                    editable={!sent}
                    maxLength={60}
                    placeholder="Other city"
                    placeholderTextColor={c.muted}
                    accessibilityLabel="Type your starting city"
                    onChangeText={(v) => {
                      setTypedCity(v);
                      setChosen((prev) => ({ ...prev, [q.id]: v.trim() || null }));
                    }}
                    style={[styles.cityInput, { color: c.text, borderColor: typedCity.trim() ? c.ink : c.inputBorder, borderStyle: typedCity.trim() ? 'solid' : 'dashed' }]}
                  />
                )}
              </View>
            )}

            {hasBest && (
              <View style={styles.legend}>
                <View style={[styles.dot, { backgroundColor: c.best }]} />
                <Text style={[styles.caption, { color: c.muted, marginTop: 0 }]}>Best time to visit {destination}</Text>
              </View>
            )}
          </View>
        );
      })}

      <View style={[styles.footer, { borderTopColor: c.border }]}>
        <Text style={[styles.summary, { color: c.muted }]}>
          {sent ? 'Planning your trip…' : ready ? summary : `Pick ${missing.map((q) => q.label.replace(/\?$/, '').toLowerCase()).join(', ')}`}
        </Text>
        <TouchableOpacity
          onPress={submit}
          disabled={!ready}
          accessibilityRole="button"
          accessibilityState={{ disabled: !ready }}
          style={[styles.cta, { backgroundColor: ready ? c.ink : c.track }]}
        >
          <Text style={[styles.ctaText, { color: ready ? c.onInk : c.muted }]}>{sent ? 'Planning…' : `Plan my ${destination} trip`}</Text>
          {!sent && <Ionicons name="arrow-forward" size={17} color={ready ? c.onInk : c.muted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 16 },
  question: { gap: 8 },
  qLabel: { fontSize: 12.5, fontWeight: fontWeight.semibold },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 },
  note: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },
  track: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segment: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 13.5 },
  caption: { fontSize: 12, marginTop: -2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14 },
  pillText: { fontSize: fontSize.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  cityInput: { minHeight: 36, minWidth: 120, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, fontSize: fontSize.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footer: { borderTopWidth: 1, paddingTop: 12, gap: 10 },
  summary: { fontSize: 12.5 },
  cta: { height: 50, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
});
