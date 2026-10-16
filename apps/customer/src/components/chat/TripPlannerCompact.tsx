// The step-by-step planner ("Plan a trip" on the welcome screen): where to,
// then where from, how long and how. Builds the plan with the itinerary API.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsha } from './ishaTheme';
import { InkButton } from './ui';
import type { TripFormData } from './types';

const TRANSPORT = [
  { id: 'car_bus', icon: 'car-outline' as const, name: 'Car / Bus' },
  { id: 'bike', icon: 'bicycle-outline' as const, name: 'Bike' },
  { id: 'flight', icon: 'airplane-outline' as const, name: 'Flight' },
];
const DURATIONS = [3, 5, 7, 10];

export default function TripPlannerCompact({ onSubmit, isGenerating }: { onSubmit: (d: TripFormData) => void; isGenerating: boolean }) {
  const t = useIsha();
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [days, setDays] = useState(5);
  const [transportMode, setTransportMode] = useState('');
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [step, fade]);

  const next = () => {
    if (step === 1) {
      if (!destination.trim()) return;
      setStep(2);
      return;
    }
    onSubmit({
      destination: destination.trim(),
      duration: days,
      startingPoint: startingPoint.trim() || null,
      transportMode: transportMode || 'car_bus',
      preferences: { budget: 'moderate', interests: [], travelStyle: 'relaxed', groupType: 'general' },
    });
  };

  const input = [styles.input, { borderColor: t.border, backgroundColor: t.surfaceMuted, color: t.text }];

  return (
    <View style={[styles.card, { borderColor: t.border, backgroundColor: t.surface }]}>
      <View style={styles.progress}>
        {[1, 2].map((s) => (
          <View key={s} style={[styles.progressSeg, { backgroundColor: s <= step ? t.ink : t.border }]} />
        ))}
      </View>
      <Animated.View style={[styles.body, { opacity: fade }]}>
        {step === 1 ? (
          <View style={{ gap: 10 }}>
            <View style={styles.labelRow}>
              <Ionicons name="location-outline" size={18} color={t.body} />
              <Text style={[styles.title, { color: t.text }]}>Where would you like to go?</Text>
            </View>
            <TextInput
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. Manali, Goa, Bali…"
              placeholderTextColor={t.placeholder}
              editable={!isGenerating}
              returnKeyType="next"
              onSubmitEditing={next}
              autoCapitalize="words"
              style={input}
            />
            <Text style={[styles.hint, { color: t.muted }]}>Any city, country or region</Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: t.text }]}>Starting from (optional)</Text>
              <TextInput
                value={startingPoint}
                onChangeText={setStartingPoint}
                placeholder="Your city"
                placeholderTextColor={t.placeholder}
                editable={!isGenerating}
                autoCapitalize="words"
                style={input}
              />
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: t.text }]}>How many days?</Text>
              <View style={[styles.switch, { backgroundColor: t.sunken }]}>
                {DURATIONS.map((d) => {
                  const on = days === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setDays(d)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.seg, on && { backgroundColor: t.ink }]}
                    >
                      <Text style={[styles.segText, { color: on ? t.onInk : t.muted }]}>{d} days</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={{ gap: 8 }}>
              <Text style={[styles.label, { color: t.text }]}>How will you travel?</Text>
              <View style={styles.modes}>
                {TRANSPORT.map((m) => {
                  const on = transportMode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setTransportMode(m.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      style={[styles.mode, on ? { backgroundColor: t.ink, borderColor: t.ink } : { borderColor: t.border, backgroundColor: t.surface }]}
                    >
                      <Ionicons name={m.icon} size={20} color={on ? t.onInk : t.body} />
                      <Text style={[styles.modeText, { color: on ? t.onInk : t.body }]}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          {step > 1 && (
            <Pressable
              onPress={() => setStep(1)}
              disabled={isGenerating}
              style={({ pressed }) => [styles.back, { backgroundColor: pressed ? t.border : t.sunken }]}
            >
              <Text style={[styles.backText, { color: t.body }]}>Back</Text>
            </Pressable>
          )}
          <InkButton
            label={isGenerating ? 'Creating…' : step === 2 ? 'Generate trip' : 'Next'}
            icon={step === 2 && !isGenerating ? 'sparkles-outline' : undefined}
            iconRight={step === 1 ? 'chevron-forward' : undefined}
            busy={isGenerating}
            disabled={step === 1 && !destination.trim()}
            onPress={next}
            style={{ flex: 1 }}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  progress: { flexDirection: 'row', height: 3 },
  progressSeg: { flex: 1 },
  body: { padding: 16, gap: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '600' },
  label: { fontSize: 13.5, fontWeight: '600' },
  hint: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  switch: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  seg: { flex: 1, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13, fontWeight: '600' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center', gap: 6 },
  modeText: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8 },
  back: { height: 44, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backText: { fontSize: 14, fontWeight: '500' },
});
