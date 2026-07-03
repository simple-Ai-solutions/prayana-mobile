// QuickItineraryModal — the "Instant Itinerary" generate popup (opens from the
// home "Quick Itinerary" hero tab). Single-form modal matching the web design:
//   Starting Point*, Destination*, Trip Duration*, Travel month,
//   Personalize section -> How will you travel?* + AI-Powered Itinerary,
//   Cancel / Create Guide.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  MapPin, Navigation, Calendar, Sparkles, ChevronDown, ChevronUp, X, Check,
  Users, Wallet, Gauge, Utensils,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTheme } from '@prayana/shared-ui';
import { itineraryAPI } from '@prayana/shared-services';
import { GooglePlacesAutocomplete } from './GooglePlacesAutocomplete';

const TEAL = '#2EC4B6';
const TEAL_DARK = '#14B8A6';

const DURATIONS = [2, 3, 4, 5, 6, 7, 10, 14];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TRANSPORT = [
  { id: 'car_bus', label: 'Car/Bus', emoji: '🚗' },
  { id: 'bike', label: 'Bike/Motorcycle', emoji: '🏍️' },
  { id: 'flight', label: 'Flight', emoji: '✈️' },
];

// Personalization chip groups (single-select each) — matches the web.
const WHO = ['Anyone', 'Solo', 'Couple', 'Family + kids', 'Friends', 'Senior parents'];
const BUDGET = ['Frugal', 'Moderate', 'Premium', 'Luxury'];
const PACE = ['Relaxed', 'Balanced', 'Packed'];
const VIBE = ['No preference', 'Cultural', 'Nature', 'Food', 'Adventure', 'Spiritual', 'Nightlife'];
const DIET = ['Any', 'Vegetarian', 'Vegan', 'Jain', 'Halal', 'Non-veg'];

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Module-level so it isn't recreated each render (which would remount inputs
// and drop keystrokes).
const FieldBlock: React.FC<{ icon?: React.ReactNode; label: string; required?: boolean; labelColor: string; children: React.ReactNode }> = ({ icon, label, required, labelColor, children }) => (
  <View style={styles.fieldBlock}>
    <View style={styles.fieldLabelRow}>
      {icon}
      <Text style={[styles.fieldLabel, { color: labelColor }]}>
        {label}{required ? <Text style={{ color: TEAL }}> *</Text> : null}
      </Text>
    </View>
    {children}
  </View>
);

// Single-select chip group used in the personalization section.
const ChipGroup: React.FC<{
  icon: React.ReactNode; title: string; hint?: string; options: string[];
  value: string; onSelect: (v: string) => void;
  labelColor: string; chipBg: string; chipBorder: string; chipText: string;
}> = ({ icon, title, hint, options, value, onSelect, labelColor, chipBg, chipBorder, chipText }) => (
  <View style={styles.group}>
    <View style={styles.groupHeader}>
      <View style={styles.groupTitleRow}>
        {icon}
        <Text style={[styles.groupTitle, { color: labelColor }]}>{title}</Text>
      </View>
      {hint ? <Text style={styles.groupHint}>{hint}</Text> : null}
    </View>
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.pchip, {
              borderColor: active ? TEAL : chipBorder,
              backgroundColor: active ? 'rgba(46,196,182,0.1)' : chipBg,
            }]}
          >
            {active && <Check size={13} color={TEAL} />}
            <Text style={[styles.pchipText, { color: active ? TEAL_DARK : chipText }]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const QuickItineraryModal: React.FC<Props> = ({ visible, onClose }) => {
  const { isDarkMode } = useTheme();

  const [startingPoint, setStartingPoint] = useState('');
  const [destination, setDestination] = useState('');
  const [duration, setDuration] = useState(5);
  const [month, setMonth] = useState('');
  const [transportMode, setTransportMode] = useState('');
  const [aiPowered, setAiPowered] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Personalization (single-select each), defaults match the web.
  const [showPersonalize, setShowPersonalize] = useState(false);
  const [who, setWho] = useState('Anyone');
  const [budget, setBudget] = useState('Moderate');
  const [pace, setPace] = useState('Balanced');
  const [vibe, setVibe] = useState('No preference');
  const [diet, setDiet] = useState('Any');

  // simple inline pickers
  const [showDuration, setShowDuration] = useState(false);
  const [showMonth, setShowMonth] = useState(false);

  // Palette (web: white card / dark gray-900)
  const cardBg = isDarkMode ? '#111827' : '#FFFFFF';
  const fieldBg = isDarkMode ? '#1F2937' : '#F9FAFB';
  const fieldBorder = isDarkMode ? '#374151' : '#E5E7EB';
  const labelColor = isDarkMode ? '#E5E7EB' : '#374151';
  const titleColor = isDarkMode ? '#FFFFFF' : '#111827';
  const subColor = isDarkMode ? '#9CA3AF' : '#6B7280';
  const valueColor = isDarkMode ? '#FFFFFF' : '#111827';
  const dividerColor = isDarkMode ? '#374151' : '#E5E7EB';

  const reset = useCallback(() => {
    setStartingPoint(''); setDestination(''); setDuration(5); setMonth('');
    setTransportMode(''); setAiPowered(true); setGenerating(false);
    setShowDuration(false); setShowMonth(false); setShowPersonalize(false);
    setWho('Anyone'); setBudget('Moderate'); setPace('Balanced');
    setVibe('No preference'); setDiet('Any');
  }, []);
  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const canCreate = startingPoint.trim() && destination.trim() && transportMode && !generating;

  const handleCreate = useCallback(async () => {
    if (!canCreate) return;
    setGenerating(true);
    try {
      // Map personalization chips -> API preferences.
      const budgetMap: Record<string, string> = {
        Frugal: 'budget', Moderate: 'moderate', Premium: 'premium', Luxury: 'luxury',
      };
      const paceMap: Record<string, string> = {
        Relaxed: 'relaxed', Balanced: 'balanced', Packed: 'packed',
      };
      const groupMap: Record<string, string> = {
        Anyone: 'general', Solo: 'solo', Couple: 'couple', 'Family + kids': 'family',
        Friends: 'friends', 'Senior parents': 'seniors',
      };
      const result: any = await itineraryAPI.generateMarkdown({
        destination: destination.trim(),
        duration,
        startingPoint: startingPoint.trim() || null,
        transportMode,
        travelMonth: month || undefined,
        aiPowered,
        preferences: {
          budget: budgetMap[budget] || 'moderate',
          travelStyle: paceMap[pace] || 'balanced',
          groupType: groupMap[who] || 'general',
          interests: vibe && vibe !== 'No preference' ? [vibe.toLowerCase()] : [],
          dietaryPreference: diet && diet !== 'Any' ? diet.toLowerCase() : undefined,
        },
      });
      const markdown = result?.content || result?.markdown || result?.data?.markdown || '';
      close();
      router.push({
        pathname: '/trip/itinerary',
        params: {
          markdown,
          title: result?.title || `${duration}-Day ${destination.trim()} Trip`,
          destination: destination.trim(),
          duration: String(duration),
          // Pass a VALID transport mode only (API rejects 'mixed'); default car_bus.
          transportMode: transportMode || 'car_bus',
          startingPoint: startingPoint.trim() || '',
          markdownItineraryId: result?.markdownItineraryId || result?._id || '',
        },
      });
    } catch (e: any) {
      console.warn('[QuickItineraryModal] generate failed:', e?.message);
      setGenerating(false);
    }
  }, [canCreate, destination, duration, startingPoint, transportMode, month, aiPowered, who, budget, pace, vibe, diet, close]);


  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        {/* Tap-outside-to-close layer behind the card (doesn't wrap the form) */}
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav} pointerEvents="box-none">
          <View style={[styles.card, { backgroundColor: cardBg }]}>
            {/* Header — teal gradient */}
            <LinearGradient colors={[TEAL, TEAL_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
              <View style={styles.headerTextWrap}>
                <View style={styles.headerTitleRow}>
                  <Sparkles size={20} color="#fff" />
                  <Text style={styles.headerTitle}>Instant Itinerary</Text>
                </View>
                <Text style={styles.headerSub}>Powered by AI • Personalized for you</Text>
              </View>
              <TouchableOpacity onPress={close} style={styles.closeBtn}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Starting Point — Google Places suggestions */}
              <FieldBlock icon={<Navigation size={15} color={TEAL} />} label="Starting Point" required labelColor={labelColor}>
                <GooglePlacesAutocomplete
                  value={startingPoint}
                  onChange={setStartingPoint}
                  placeholder="e.g., Mangalore"
                />
              </FieldBlock>

              {/* Destination — Google Places suggestions */}
              <FieldBlock icon={<MapPin size={15} color={TEAL} />} label="Destination" required labelColor={labelColor}>
                <GooglePlacesAutocomplete
                  value={destination}
                  onChange={setDestination}
                  placeholder="e.g., Bangalore"
                />
              </FieldBlock>

              {/* Two-up: Duration + Month */}
              <View style={styles.twoUp}>
                <View style={styles.half}>
                  <FieldBlock icon={<Calendar size={15} color={TEAL} />} label="Trip Duration" required labelColor={labelColor}>
                    <TouchableOpacity
                      style={[styles.select, { backgroundColor: fieldBg, borderColor: fieldBorder }]}
                      onPress={() => { setShowDuration((v) => !v); setShowMonth(false); }}
                    >
                      <Text style={[styles.selectText, { color: valueColor }]}>{duration} Days</Text>
                      <ChevronDown size={16} color={subColor} />
                    </TouchableOpacity>
                  </FieldBlock>
                </View>
                <View style={styles.half}>
                  <FieldBlock icon={<Calendar size={15} color={subColor} />} label="Travel month" labelColor={labelColor}>
                    <TouchableOpacity
                      style={[styles.select, { backgroundColor: fieldBg, borderColor: fieldBorder }]}
                      onPress={() => { setShowMonth((v) => !v); setShowDuration(false); }}
                    >
                      <Text style={[styles.selectText, { color: month ? valueColor : subColor }]}>{month || 'Any month'}</Text>
                      <ChevronDown size={16} color={subColor} />
                    </TouchableOpacity>
                  </FieldBlock>
                </View>
              </View>

              {/* Inline pickers */}
              {showDuration && (
                <View style={[styles.picker, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
                  {DURATIONS.map((d) => (
                    <TouchableOpacity key={d} style={styles.pickerItem} onPress={() => { setDuration(d); setShowDuration(false); }}>
                      <Text style={[styles.pickerText, { color: d === duration ? TEAL : valueColor }]}>{d} Days</Text>
                      {d === duration && <Check size={16} color={TEAL} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {showMonth && (
                <View style={[styles.picker, { backgroundColor: fieldBg, borderColor: fieldBorder }]}>
                  {MONTHS.map((m) => (
                    <TouchableOpacity key={m} style={styles.pickerItem} onPress={() => { setMonth(m); setShowMonth(false); }}>
                      <Text style={[styles.pickerText, { color: m === month ? TEAL : valueColor }]}>{m}</Text>
                      {m === month && <Check size={16} color={TEAL} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* How will you travel? */}
              <FieldBlock label="How will you travel?" required labelColor={labelColor}>
                <View style={styles.transportGrid}>
                  {TRANSPORT.map((t) => {
                    const active = transportMode === t.id;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setTransportMode(t.id)}
                        style={[styles.transportTile, {
                          borderColor: active ? TEAL : fieldBorder,
                          backgroundColor: active ? 'rgba(46,196,182,0.1)' : fieldBg,
                        }]}
                      >
                        <Text style={styles.transportEmoji}>{t.emoji}</Text>
                        <Text style={[styles.transportText, { color: active ? TEAL_DARK : labelColor }]} numberOfLines={1}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </FieldBlock>

              {/* Show/Hide personalization toggle */}
              <TouchableOpacity
                onPress={() => setShowPersonalize((v) => !v)}
                style={[styles.personalizeToggle, { borderColor: showPersonalize ? TEAL : fieldBorder }]}
                activeOpacity={0.8}
              >
                {showPersonalize ? <ChevronUp size={16} color={TEAL} /> : <ChevronDown size={16} color={TEAL} />}
                <Text style={[styles.personalizeToggleText, { color: TEAL }]}>
                  {showPersonalize ? 'Hide personalization' : 'Personalize this trip (optional)'}
                </Text>
              </TouchableOpacity>

              {showPersonalize && (
                <View style={[styles.personalizeCard, { borderColor: fieldBorder }]}>
                  <ChipGroup icon={<Users size={16} color={TEAL} />} title="Who's traveling?" options={WHO} value={who} onSelect={setWho} labelColor={titleColor} chipBg={fieldBg} chipBorder={fieldBorder} chipText={labelColor} />
                  <View style={[styles.cardDivider, { backgroundColor: dividerColor }]} />
                  <ChipGroup icon={<Wallet size={16} color={TEAL} />} title="Budget" options={BUDGET} value={budget} onSelect={setBudget} labelColor={titleColor} chipBg={fieldBg} chipBorder={fieldBorder} chipText={labelColor} />
                  <ChipGroup icon={<Gauge size={16} color={TEAL} />} title="Pace" options={PACE} value={pace} onSelect={setPace} labelColor={titleColor} chipBg={fieldBg} chipBorder={fieldBorder} chipText={labelColor} />
                  <View style={[styles.cardDivider, { backgroundColor: dividerColor }]} />
                  <ChipGroup icon={<Sparkles size={16} color={TEAL} />} title="Vibe" hint="pick one" options={VIBE} value={vibe} onSelect={setVibe} labelColor={titleColor} chipBg={fieldBg} chipBorder={fieldBorder} chipText={labelColor} />
                  <ChipGroup icon={<Utensils size={16} color={TEAL} />} title="Diet" options={DIET} value={diet} onSelect={setDiet} labelColor={titleColor} chipBg={fieldBg} chipBorder={fieldBorder} chipText={labelColor} />
                </View>
              )}
            </ScrollView>

            {/* Footer: Cancel / Create Guide */}
            <View style={[styles.footer, { borderTopColor: dividerColor }]}>
              <TouchableOpacity onPress={close} disabled={generating} style={[styles.cancelBtn, { borderColor: fieldBorder }]}>
                <Text style={[styles.cancelText, { color: labelColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} disabled={!canCreate} activeOpacity={0.9} style={[styles.createWrap, { opacity: canCreate ? 1 : 0.5 }]}>
                <LinearGradient colors={[TEAL, TEAL_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.createBtn}>
                  {generating ? (
                    <>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.createText}>Creating...</Text>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} color="#fff" />
                      <Text style={styles.createText}>Create Guide</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  kav: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 440, maxHeight: '88%', borderRadius: 20, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18 },
  headerTextWrap: { flex: 1 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 3 },
  closeBtn: { padding: 4 },
  scroll: { paddingHorizontal: 20 },
  fieldBlock: { marginTop: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15 },
  twoUp: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  selectText: { fontSize: 15, fontWeight: '500' },
  picker: { borderWidth: 1, borderRadius: 10, marginTop: 8, maxHeight: 200 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  pickerText: { fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500' },
  transportGrid: { flexDirection: 'row', gap: 10 },
  transportTile: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 2 },
  transportEmoji: { fontSize: 26 },
  transportText: { fontSize: 11, fontWeight: '600' },
  // Personalization
  personalizeToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', marginTop: 18, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1.5 },
  personalizeToggleText: { fontSize: 13, fontWeight: '700' },
  personalizeCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  cardDivider: { height: 1, marginVertical: 12 },
  group: { marginBottom: 14 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  groupTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 14, fontWeight: '700' },
  groupHint: { fontSize: 11, color: '#9CA3AF' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pchip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  pchipText: { fontSize: 13, fontWeight: '600' },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderRadius: 12, padding: 12, marginTop: 16 },
  aiIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(46,196,182,0.15)', alignItems: 'center', justifyContent: 'center' },
  aiTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiTitle: { fontSize: 14, fontWeight: '700' },
  newBadge: { backgroundColor: TEAL, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5 },
  newBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  aiSub: { fontSize: 12, marginTop: 2 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1 },
  cancelBtn: { paddingHorizontal: 22, paddingVertical: 13, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600' },
  createWrap: { flex: 1 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 10 },
  createText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
