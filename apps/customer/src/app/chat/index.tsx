import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
  Dimensions,
  Animated,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import {
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { makeChatAPICall, makeItineraryAPICall } from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// TYPES
// ============================================================
type MessageType = 'text' | 'trip_planner_form' | 'itinerary_preview';

interface Place {
  id?: string;
  name: string;
  description?: string;
  image?: string;
  images?: Array<{ url?: string; mediumUrl?: string }>;
  rating?: number;
  reviews?: number;
  reviewCount?: number;
  category?: string;
  city?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: MessageType;
  content: string;
  timestamp: Date;
  topPlaces?: Place[];
  images?: string[];
  actions?: Array<{ text: string; action: string }>;
  relatedPlaces?: Array<{ id?: string; name: string }>;
  itineraryData?: { markdown?: string; structured?: any };
  requestData?: {
    destination: string; duration: number;
    transportMode: string; startingPoint?: string;
  };
}

interface TripFormData {
  destination: string;
  duration: number;
  startingPoint: string;
  transportMode: string;
}

// ============================================================
// CONSTANTS
// ============================================================
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAX_CHAR = 500;

const SUGGESTION_CHIPS = [
  { icon: '🌍', text: 'Plan a trip', action: 'plan_trip' },
  { icon: '💡', text: 'Travel tips', placeholder: 'Give me travel tips for ' },
  { icon: '🗺️', text: 'Best destinations', placeholder: 'What are the best destinations for ' },
  { icon: '🏨', text: 'Hotel advice', placeholder: 'Help me find hotels in ' },
];

const TRANSPORT_OPTIONS = [
  { id: 'car_bus', emoji: '🚗', name: 'Car/Bus' },
  { id: 'bike', emoji: '🏍️', name: 'Bike' },
  { id: 'flight', emoji: '✈️', name: 'Flight' },
];

const DURATION_OPTIONS = [3, 5, 7, 10];

// ============================================================
// HELPERS
// ============================================================
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatTime(date: Date): string {
  const h = date.getHours() % 12 || 12;
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${h}:${m} ${ampm}`;
}

function transportLabel(mode: string) {
  return TRANSPORT_OPTIONS.find((t) => t.id === mode) || TRANSPORT_OPTIONS[0];
}

function getPlaceImage(place: Place): string | null {
  if (place.images && place.images.length > 0) {
    const img = place.images[0];
    return img.url || img.mediumUrl || null;
  }
  return place.image || null;
}

// ============================================================
// STAR RATING
// ============================================================
function StarRating({ rating, isDark }: { rating: number; isDark: boolean }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        return (
          <Ionicons
            key={star}
            name={filled ? 'star' : 'star-outline'}
            size={11}
            color={filled ? '#F59E0B' : isDark ? '#4B5563' : '#D1D5DB'}
            style={{ marginRight: 1 }}
          />
        );
      })}
      <Text style={[styles.ratingNum, { color: isDark ? '#FBBF24' : '#D97706' }]}>
        {rating.toFixed(1)}
      </Text>
    </View>
  );
}

// ============================================================
// RICH TEXT RENDERER  (matches web ChatMessage.jsx logic)
// ============================================================
function RichText({ text, isDark, onPlacePress }: {
  text: string;
  isDark: boolean;
  onPlacePress?: (name: string) => void;
}) {
  const textColor = isDark ? '#e2e8f0' : '#1e293b';
  const tealColor = isDark ? '#5eead4' : '#0d9488';
  const placeColor = isDark ? '#f87171' : '#ef4444';

  const lines = text.split('\n');

  return (
    <View style={{ gap: 4 }}>
      {lines.map((line, idx) => {
        if (!line.trim()) return null;

        // Day header: "Day 1: Morning" or "✈️ Day 1:"
        const isDayHeader = /^[✈️🌅🌆🌙⭐🗓️]?\s*(Day\s+\d+[:\s])/i.test(line.trim());
        if (isDayHeader) {
          return (
            <View key={idx} style={[styles.dayHeaderWrap, { backgroundColor: isDark ? 'rgba(46,196,182,0.15)' : '#f0fdfa', borderColor: isDark ? 'rgba(46,196,182,0.3)' : '#99f6e4' }]}>
              <Text style={[styles.dayHeaderText, { color: tealColor }]}>{line.trim()}</Text>
            </View>
          );
        }

        // Bullet / numbered list line
        const isBullet = /^[-•*]\s/.test(line.trim()) || /^\d+\.\s/.test(line.trim());

        // Parse the line into styled segments
        const segments = parseLineSegments(line, isDark, tealColor, placeColor);

        return (
          <View key={idx} style={[styles.textLine, isBullet && styles.bulletLine]}>
            {isBullet && <Text style={[styles.bullet, { color: tealColor }]}>•</Text>}
            <Text style={[styles.lineText, { color: textColor }]}>
              {segments.map((seg, si) => {
                if (seg.type === 'bold') {
                  return <Text key={si} style={[styles.boldText, { color: tealColor }]}>{seg.text}</Text>;
                }
                if (seg.type === 'place') {
                  return (
                    <Text
                      key={si}
                      style={[styles.placeText, { color: placeColor }]}
                      onPress={() => onPlacePress?.(seg.text)}
                    >
                      {seg.text}
                    </Text>
                  );
                }
                if (seg.type === 'day') {
                  return <Text key={si} style={[styles.boldText, { color: tealColor }]}>{seg.text}</Text>;
                }
                if (seg.type === 'time') {
                  return <Text key={si} style={[styles.semiboldText, { color: tealColor }]}>{seg.text}</Text>;
                }
                return <Text key={si} style={{ color: textColor }}>{seg.text}</Text>;
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

type Segment = { type: 'bold' | 'plain' | 'place' | 'day' | 'time'; text: string };

function parseLineSegments(line: string, isDark: boolean, tealColor: string, placeColor: string): Segment[] {
  // Strip leading bullet chars for display
  const cleaned = line.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, '');

  // Tokenize by: **bold**, Day N, time-of-day words, proper noun phrases
  const pattern = /(\*\*[^*]+\*\*|Day\s+\d+|(?:^|\s)(Morning|Afternoon|Evening|Night)(?=\s|$)|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+))/g;

  const segments: Segment[] = [];
  let last = 0;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    const [raw] = match;
    const start = match.index;

    if (start > last) {
      segments.push({ type: 'plain', text: cleaned.slice(last, start) });
    }

    if (raw.startsWith('**') && raw.endsWith('**')) {
      segments.push({ type: 'bold', text: raw.slice(2, -2) });
    } else if (/^Day\s+\d+/i.test(raw)) {
      segments.push({ type: 'day', text: raw });
    } else if (/^(Morning|Afternoon|Evening|Night)$/i.test(raw.trim())) {
      segments.push({ type: 'time', text: raw });
    } else if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/.test(raw)) {
      segments.push({ type: 'place', text: raw });
    } else {
      segments.push({ type: 'plain', text: raw });
    }

    last = start + raw.length;
  }

  if (last < cleaned.length) {
    segments.push({ type: 'plain', text: cleaned.slice(last) });
  }

  return segments.length ? segments : [{ type: 'plain', text: cleaned }];
}

// ============================================================
// PLACE CARD  (matches web vertical card layout)
// ============================================================
function PlaceCard({ place, index, isDark, onPress }: {
  place: Place; index: number; isDark: boolean; onPress: (p: Place) => void;
}) {
  const img = getPlaceImage(place);
  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  return (
    <TouchableOpacity
      onPress={() => onPress(place)}
      activeOpacity={0.85}
      style={[styles.placeCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
    >
      {/* Image */}
      <View style={styles.placeCardImageWrap}>
        {img ? (
          <Image source={{ uri: img }} style={styles.placeCardImage} contentFit="cover" />
        ) : (
          <LinearGradient colors={['#2EC4B6', '#0d9488']} style={[styles.placeCardImage, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 28 }}>🏛️</Text>
          </LinearGradient>
        )}
        {/* Number badge */}
        <View style={styles.placeNumBadge}>
          <Text style={styles.placeNumText}>{index + 1}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.placeCardInfo}>
        <Text style={[styles.placeCardName, { color: textPrimary }]} numberOfLines={1}>
          {place.name}
        </Text>

        {place.rating ? (
          <StarRating rating={place.rating} isDark={isDark} />
        ) : null}

        {place.description ? (
          <Text style={[styles.placeCardDesc, { color: textSecondary }]} numberOfLines={2}>
            {place.description}
          </Text>
        ) : null}

        {place.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>🏷️ {place.category}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// BOT AVATAR
// ============================================================
function BotAvatar({ size = 36, animate = false }: { size?: number; animate?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animate) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [animate, pulse]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <LinearGradient
        colors={['#2EC4B6', '#0d9488', '#0891b2']}
        style={[styles.botAvatarBg, { width: size, height: size, borderRadius: size / 2 }]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <Text style={{ fontSize: size * 0.42 }}>✨</Text>
      </LinearGradient>
    </Animated.View>
  );
}

// ============================================================
// TYPING INDICATOR
// ============================================================
function TypingIndicator({ isDark }: { isDark: boolean }) {
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = (dot: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]));
    const a1 = anim(d1, 0); const a2 = anim(d2, 180); const a3 = anim(d3, 360);
    a1.start(); a2.start(); a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [d1, d2, d3]);

  const ty = (d: Animated.Value) => d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] });
  const cardBg = isDark
    ? 'rgba(30,41,59,0.9)'
    : 'rgba(240,253,250,0.9)';
  const cardBorder = isDark ? 'rgba(46,196,182,0.2)' : 'rgba(46,196,182,0.3)';

  return (
    <View style={styles.typingRow}>
      <BotAvatar size={32} animate />
      <View style={[styles.typingBubble, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.dotsRow}>
          {[d1, d2, d3].map((d, i) => (
            <Animated.View key={i} style={[styles.dot, { transform: [{ translateY: ty(d) }] }]} />
          ))}
        </View>
        <Text style={[styles.typingLabel, { color: isDark ? '#94a3b8' : '#64748b' }]}>
          Isha is thinking…
        </Text>
      </View>
    </View>
  );
}

// ============================================================
// TRIP PLANNER FORM
// ============================================================
function TripPlannerForm({ onSubmit, isGenerating, isDark }: {
  onSubmit: (d: TripFormData) => void;
  isGenerating: boolean;
  isDark: boolean;
}) {
  const [step, setStep] = useState(1);
  const [destination, setDestination] = useState('');
  const [startingPoint, setStartingPoint] = useState('');
  const [days, setDays] = useState(5);
  const [transportMode, setTransportMode] = useState('car_bus');

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#0f172a' : '#f8fafc';

  const handleNext = () => {
    if (step === 1) {
      if (!destination.trim()) return;
      setStep(2);
    } else {
      onSubmit({ destination: destination.trim(), duration: days, startingPoint: startingPoint.trim(), transportMode });
    }
  };

  return (
    <View style={[styles.plannerCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      {/* Progress bar */}
      <View style={styles.progressBar}>
        {[1, 2].map((s) => (
          <View key={s} style={[styles.progressSegment, {
            backgroundColor: s <= step ? '#2EC4B6' : isDark ? '#334155' : '#e2e8f0',
          }]} />
        ))}
      </View>

      <View style={styles.plannerBody}>
        {step === 1 && (
          <View>
            <View style={styles.plannerRow}>
              <Text style={{ fontSize: 18 }}>📍</Text>
              <Text style={[styles.plannerTitle, { color: textPrimary }]}>Where would you like to go?</Text>
            </View>
            <TextInput
              style={[styles.plannerInput, { backgroundColor: inputBg, borderColor: cardBorder, color: textPrimary }]}
              value={destination} onChangeText={setDestination}
              placeholder="e.g. Paris, Tokyo, Bali…"
              placeholderTextColor={textSecondary} autoFocus editable={!isGenerating}
            />
            <Text style={[styles.plannerHint, { color: textSecondary }]}>💡 Start typing any city, country or region</Text>
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={[styles.plannerLabel, { color: textPrimary }]}>📍 Starting from (optional)</Text>
            <TextInput
              style={[styles.plannerInput, { backgroundColor: inputBg, borderColor: cardBorder, color: textPrimary }]}
              value={startingPoint} onChangeText={setStartingPoint}
              placeholder="Your city…" placeholderTextColor={textSecondary} editable={!isGenerating}
            />

            <Text style={[styles.plannerLabel, { color: textPrimary, marginTop: spacing.md }]}>📅 How many days?</Text>
            <View style={styles.durationRow}>
              {DURATION_OPTIONS.map((d) => (
                <TouchableOpacity key={d} onPress={() => setDays(d)} activeOpacity={0.7}
                  style={[styles.durationBtn, days === d
                    ? { backgroundColor: '#2EC4B6', borderColor: '#2EC4B6' }
                    : { backgroundColor: inputBg, borderColor: cardBorder }]}>
                  <Text style={[styles.durationText, { color: days === d ? '#ffffff' : textPrimary }]}>{d}d</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.plannerLabel, { color: textPrimary, marginTop: spacing.md }]}>How will you travel?</Text>
            <View style={styles.transportRow}>
              {TRANSPORT_OPTIONS.map((mode) => {
                const sel = transportMode === mode.id;
                return (
                  <TouchableOpacity key={mode.id} onPress={() => setTransportMode(mode.id)} activeOpacity={0.7}
                    style={[styles.transportBtn, {
                      borderColor: sel ? '#2EC4B6' : cardBorder,
                      backgroundColor: sel ? (isDark ? 'rgba(46,196,182,0.15)' : 'rgba(46,196,182,0.1)') : inputBg,
                    }]}>
                    <Text style={{ fontSize: 22 }}>{mode.emoji}</Text>
                    <Text style={[styles.transportLabel, { color: sel ? '#2EC4B6' : textSecondary }]}>{mode.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.plannerActions}>
          {step > 1 && (
            <TouchableOpacity onPress={() => setStep(1)} disabled={isGenerating}
              style={[styles.backBtn, { backgroundColor: isDark ? '#334155' : '#f1f5f9' }]} activeOpacity={0.7}>
              <Text style={{ color: textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium }}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleNext} activeOpacity={0.8}
            disabled={(step === 1 && !destination.trim()) || isGenerating}
            style={[styles.nextBtn, (step === 1 && !destination.trim()) || isGenerating ? { backgroundColor: '#94a3b8' } : {}]}>
            {isGenerating ? (
              <><ActivityIndicator size="small" color="#fff" style={{ marginRight: 6 }} /><Text style={styles.nextBtnText}>Creating…</Text></>
            ) : step === 2 ? (
              <><Text style={{ fontSize: 14 }}>✨</Text><Text style={styles.nextBtnText}>Generate Trip</Text></>
            ) : (
              <><Text style={styles.nextBtnText}>Next</Text><Ionicons name="chevron-forward" size={14} color="#fff" /></>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ============================================================
// ITINERARY PREVIEW CARD
// ============================================================
function ItineraryPreviewCard({ message, isDark, onViewFull }: {
  message: ChatMessage; isDark: boolean; onViewFull: (m: ChatMessage) => void;
}) {
  const { requestData, itineraryData } = message;
  const destination = requestData?.destination || 'Destination';
  const duration = requestData?.duration || 3;
  const transport = transportLabel(requestData?.transportMode || 'car_bus');
  const hasData = !!itineraryData?.markdown || !!itineraryData?.structured;

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const cardBorder = isDark ? '#334155' : '#e2e8f0';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';

  const images: string[] = [];
  const structured = itineraryData?.structured;
  if (structured) {
    const days = structured?.itinerary?.days || structured?.data?.itinerary?.days || structured?.days || [];
    for (const day of days) {
      for (const place of (day?.mainPlaces || [])) {
        const img = place?.images?.[0]?.url || place?.images?.[0]?.mediumUrl || place?.image;
        if (img) { images.push(img); if (images.length >= 3) break; }
      }
      if (images.length >= 3) break;
    }
  }

  return (
    <TouchableOpacity onPress={() => onViewFull(message)} activeOpacity={0.85}
      style={[styles.itineraryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
      <View style={[styles.itineraryTopStrip, { backgroundColor: '#2EC4B6' }]}>
        <Text style={styles.itineraryStripText}>✨ AI CURATED ITINERARY</Text>
      </View>

      <View style={styles.itineraryContent}>
        {/* Left */}
        <View style={styles.itineraryLeft}>
          <View style={styles.itineraryBadges}>
            <View style={styles.badge}><Text style={styles.badgeText}>📅 {duration} DAYS</Text></View>
            <View style={styles.badge}><Text style={styles.badgeText}>{transport.emoji} {transport.name}</Text></View>
          </View>
          <Text style={[styles.itineraryTitle, { color: textPrimary }]} numberOfLines={2}>
            Trip to {destination}
          </Text>
          <Text style={[styles.itinerarySubtitle, { color: textSecondary }]} numberOfLines={2}>
            An exciting {duration}-day escape tailored for you in {destination}.
          </Text>
          {!hasData && (
            <View style={styles.generatingRow}>
              <ActivityIndicator size="small" color="#2EC4B6" />
              <Text style={{ color: '#2EC4B6', fontSize: fontSize.xs }}>Generating…</Text>
            </View>
          )}
        </View>

        {/* Right: image mosaic */}
        {images.length > 0 && (
          <View style={styles.itineraryImages}>
            <View style={styles.heroImageWrap}>
              <Image source={{ uri: images[0] }} style={styles.heroImage} contentFit="cover" />
            </View>
            {images.length >= 3 && (
              <View style={styles.smallImagesRow}>
                <View style={styles.smallImageWrap}><Image source={{ uri: images[1] }} style={styles.smallImage} contentFit="cover" /></View>
                <View style={styles.smallImageWrap}><Image source={{ uri: images[2] }} style={styles.smallImage} contentFit="cover" /></View>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[styles.itineraryFooter, { borderTopColor: cardBorder }]}>
        <Text style={{ color: '#2EC4B6', fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5 }}>
          VIEW FULL ITINERARY
        </Text>
        <Ionicons name="arrow-forward" size={14} color="#2EC4B6" />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================
// MESSAGE BUBBLE  — full rich rendering
// ============================================================
function MessageBubble({ message, isDark, onPlanTrip, onViewItinerary, onPlacePress, isGenerating }: {
  message: ChatMessage;
  isDark: boolean;
  onPlanTrip: (d: TripFormData) => void;
  onViewItinerary: (m: ChatMessage) => void;
  onPlacePress: (name: string) => void;
  isGenerating: boolean;
}) {
  const isUser = message.role === 'user';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSecondary = isDark ? '#94a3b8' : '#64748b';
  const tealColor = isDark ? '#5eead4' : '#0d9488';

  if (message.type === 'trip_planner_form') {
    return (
      <View style={[styles.msgRow, styles.assistantRow]}>
        <View style={styles.msgAvatar}><BotAvatar size={28} /></View>
        <View style={{ flex: 1, maxWidth: SCREEN_WIDTH - 80 }}>
          <TripPlannerForm onSubmit={onPlanTrip} isGenerating={isGenerating} isDark={isDark} />
        </View>
      </View>
    );
  }

  if (message.type === 'itinerary_preview') {
    return (
      <View style={[styles.msgRow, styles.assistantRow]}>
        <View style={styles.msgAvatar}><BotAvatar size={28} /></View>
        <View style={{ flex: 1, maxWidth: SCREEN_WIDTH - 80 }}>
          <ItineraryPreviewCard message={message} isDark={isDark} onViewFull={onViewItinerary} />
        </View>
      </View>
    );
  }

  // ── USER MESSAGE ─────────────────────────────────────────────
  if (isUser) {
    return (
      <View style={[styles.msgRow, styles.userRow]}>
        <LinearGradient
          colors={['#0d9488', '#0f766e']}
          style={styles.userBubble}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        >
          <Text style={styles.userText}>{message.content}</Text>
          <Text style={styles.userTime}>✓✓ {formatTime(message.timestamp)}</Text>
        </LinearGradient>
        <View style={styles.userDot} />
      </View>
    );
  }

  // ── ASSISTANT MESSAGE ────────────────────────────────────────
  const aiBg = isDark ? '#1e293b' : '#ffffff';
  const aiBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <View style={[styles.msgRow, styles.assistantRow]}>
      <View style={styles.msgAvatar}><BotAvatar size={28} /></View>

      <View style={{ flex: 1, maxWidth: SCREEN_WIDTH - 80, gap: 8 }}>
        {/* Main text bubble */}
        {!!message.content && (
          <View style={[styles.aiBubble, { backgroundColor: aiBg, borderColor: aiBorder }]}>
            <RichText text={message.content} isDark={isDark} onPlacePress={onPlacePress} />
            <Text style={[styles.aiTime, { color: textSecondary }]}>{formatTime(message.timestamp)}</Text>
          </View>
        )}

        {/* Images row — banner-style images */}
        {message.images && message.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
            {message.images.slice(0, 6).map((img, i) => (
              <View key={i} style={styles.bannerImageWrap}>
                <Image source={{ uri: img }} style={styles.bannerImage} contentFit="cover" />
              </View>
            ))}
          </ScrollView>
        )}

        {/* Top places section */}
        {message.topPlaces && message.topPlaces.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#2EC4B6', '#0d9488']} style={styles.sectionIconBg}>
                <Text style={{ fontSize: 16 }}>📍</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Top Places to Visit</Text>
                <Text style={[styles.sectionSub, { color: textSecondary }]}>Discover amazing destinations</Text>
              </View>
            </View>
            {message.topPlaces
              .filter((p, i, arr) => arr.findIndex((q) => q.name?.toLowerCase() === p.name?.toLowerCase()) === i)
              .slice(0, 5)
              .map((place, i) => (
                <PlaceCard key={i} place={place} index={i} isDark={isDark} onPress={(p) => onPlacePress(p.name)} />
              ))}
          </View>
        )}

        {/* Related places chips */}
        {message.relatedPlaces && message.relatedPlaces.length > 0 && (
          <View>
            <View style={styles.relatedRow}>
              <Text style={{ fontSize: 12 }}>🔗</Text>
              <Text style={[styles.relatedLabel, { color: textSecondary }]}>Related places:</Text>
            </View>
            <View style={styles.chipsWrap}>
              {message.relatedPlaces.map((place, i) => (
                <TouchableOpacity key={i} onPress={() => onPlacePress(place.name)} activeOpacity={0.7}
                  style={[styles.relatedChip, { backgroundColor: isDark ? '#334155' : '#f0fdfa', borderColor: isDark ? '#475569' : '#99f6e4' }]}>
                  <Text style={[styles.relatedChipText, { color: isDark ? '#e2e8f0' : '#0d9488' }]}>{place.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Action buttons */}
        {message.actions && message.actions.length > 0 && (
          <View style={styles.actionsWrap}>
            {message.actions.map((action, i) => (
              <TouchableOpacity key={i} onPress={() => onPlacePress(action.action)} activeOpacity={0.85}
                style={[styles.actionBtn, { backgroundColor: isDark ? 'rgba(46,196,182,0.15)' : '#f0fdfa', borderColor: isDark ? 'rgba(46,196,182,0.3)' : '#99f6e4' }]}>
                <Text style={{ fontSize: 12 }}>🎯</Text>
                <Text style={[styles.actionBtnText, { color: isDark ? '#5eead4' : '#0d9488' }]}>{action.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================
// WELCOME SCREEN
// ============================================================
function WelcomeScreen({ isDark, onChipPress }: {
  isDark: boolean;
  onChipPress: (chip: typeof SUGGESTION_CHIPS[number]) => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 2000, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 2000, useNativeDriver: true }),
    ])).start();
  }, [pulse]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.welcomeContainer} bounces={false}>
      <Animated.View style={[styles.welcomeAvatarWrap, { transform: [{ scale: pulse }] }]}>
        <LinearGradient colors={['#2EC4B6', '#0d9488', '#0891b2']} style={styles.welcomeAvatarBg}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.welcomeAvatarEmoji}>✨</Text>
        </LinearGradient>
        <View style={[styles.welcomeOnline, { borderColor: isDark ? '#0f172a' : '#f8fafc' }]} />
      </Animated.View>

      <Text style={[styles.welcomeTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>Welcome! I'm Isha</Text>
      <Text style={[styles.welcomeSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
        Your AI travel assistant ready to help plan your next adventure.
      </Text>

      <View style={styles.chipsWrap}>
        {SUGGESTION_CHIPS.map((chip, i) => (
          <TouchableOpacity key={i} onPress={() => onChipPress(chip)} activeOpacity={0.7}
            style={[styles.chip, { backgroundColor: isDark ? '#1e293b' : '#ffffff', borderColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Text style={styles.chipEmoji}>{chip.icon}</Text>
            <Text style={[styles.chipText, { color: isDark ? '#e2e8f0' : '#334155' }]}>{chip.text}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

// ============================================================
// MAIN CHAT SCREEN
// ============================================================
export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);

  const sessionIdRef = useRef<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const isWelcomeScreen = messages.length === 0;

  // Start session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await makeChatAPICall('/chat/session/start', {
          method: 'POST',
          body: JSON.stringify({ context: { type: 'general' } }),
          timeout: 15000,
        });
        const sid = res?.data?.sessionId;
        if (sid) { sessionIdRef.current = sid; setIsConnected(true); }
      } catch { /* offline */ }
    })();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
  }, []);

  const ensureSession = async () => {
    if (sessionIdRef.current) return;
    const res = await makeChatAPICall('/chat/session/start', {
      method: 'POST', body: JSON.stringify({ context: { type: 'general' } }), timeout: 15000,
    });
    const sid = res?.data?.sessionId;
    if (!sid) throw new Error('Could not start session');
    sessionIdRef.current = sid;
    setIsConnected(true);
  };

  // ── Send regular text message ────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: generateId(), role: 'user', type: 'text', content: trimmed, timestamp: new Date(),
    };
    setMessages((prev) => [userMsg, ...prev]);
    setInputText('');
    setIsTyping(true);
    Keyboard.dismiss();
    scrollToBottom();

    try {
      await ensureSession();
      const response = await makeChatAPICall('/chat/send', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          message: { content: trimmed, context: { type: 'general' } },
        }),
        timeout: 60000,
      });

      const aiMsgData = response?.data?.aiMessage;
      const aiText =
        aiMsgData?.content ||
        response?.data?.response ||
        response?.data?.message ||
        "I'm sorry, I couldn't process your request. Please try again.";

      const aiMsg: ChatMessage = {
        id: generateId(), role: 'assistant', type: 'text',
        content: aiText, timestamp: new Date(),
        topPlaces: aiMsgData?.topPlaces || response?.data?.topPlaces || [],
        images: aiMsgData?.images || response?.data?.images || [],
        actions: aiMsgData?.actions || [],
        relatedPlaces: aiMsgData?.relatedPlaces || [],
      };
      setMessages((prev) => [aiMsg, ...prev]);
    } catch {
      setMessages((prev) => [{
        id: generateId(), role: 'assistant', type: 'text',
        content: 'I encountered an issue connecting to the server. Please check your connection and try again.',
        timestamp: new Date(),
      }, ...prev]);
      Toast.show({ type: 'error', text1: 'Connection error', text2: 'Could not reach Isha.' });
    } finally {
      setIsTyping(false);
      scrollToBottom();
    }
  }, [isTyping, scrollToBottom]);

  // ── Trip planner ─────────────────────────────────────────────
  const showTripPlannerForm = useCallback(() => {
    setMessages((prev) => [{
      id: generateId(), role: 'assistant', type: 'trip_planner_form',
      content: '', timestamp: new Date(),
    }, ...prev]);
    scrollToBottom();
  }, [scrollToBottom]);

  const generateTripItinerary = useCallback(async (formData: TripFormData) => {
    setIsGeneratingTrip(true);

    const userMsg: ChatMessage = {
      id: generateId(), role: 'user', type: 'text',
      content: `Plan a ${formData.duration}-day trip to ${formData.destination} by ${transportLabel(formData.transportMode).name}${formData.startingPoint ? ` from ${formData.startingPoint}` : ''}`,
      timestamp: new Date(),
    };

    const previewId = generateId();
    const previewMsg: ChatMessage = {
      id: previewId, role: 'assistant', type: 'itinerary_preview',
      content: '', timestamp: new Date(),
      requestData: { destination: formData.destination, duration: formData.duration, transportMode: formData.transportMode, startingPoint: formData.startingPoint || undefined },
      itineraryData: {},
    };

    setMessages((prev) => [previewMsg, userMsg, ...prev]);
    scrollToBottom();

    const body = JSON.stringify({
      destination: formData.destination, duration: formData.duration,
      startingPoint: formData.startingPoint || null, transportMode: formData.transportMode,
      preferences: { budget: 'moderate', interests: [], travelStyle: 'relaxed', groupType: 'general' },
    });

    try {
      const [markdownRes, structuredRes] = await Promise.allSettled([
        makeItineraryAPICall('/itinerary/generate-markdown', { method: 'POST', body }),
        makeItineraryAPICall('/itinerary/generate', { method: 'POST', body }),
      ]);

      const markdown = markdownRes.status === 'fulfilled' ? (markdownRes.value?.data?.markdown || '') : '';
      let structured: any = null;
      if (structuredRes.status === 'fulfilled') {
        const sv = structuredRes.value;
        if (sv?.data?.itinerary) structured = sv.data;
      }

      setMessages((prev) => prev.map((m) =>
        m.id === previewId ? { ...m, itineraryData: { markdown, structured } } : m
      ));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== previewId));
      setMessages((prev) => [{
        id: generateId(), role: 'assistant', type: 'text',
        content: `Sorry, I couldn't generate the itinerary for ${formData.destination}. Please try again.`,
        timestamp: new Date(),
      }, ...prev]);
      Toast.show({ type: 'error', text1: 'Generation failed', text2: 'Please try again.' });
    } finally {
      setIsGeneratingTrip(false);
      scrollToBottom();
    }
  }, [scrollToBottom]);

  const handleChipPress = useCallback((chip: typeof SUGGESTION_CHIPS[number]) => {
    if ((chip as any).action === 'plan_trip') {
      showTripPlannerForm();
    } else if ((chip as any).placeholder) {
      setInputText((chip as any).placeholder);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showTripPlannerForm]);

  const handlePlacePress = useCallback((name: string) => {
    sendMessage(`Tell me more about ${name}`);
  }, [sendMessage]);

  const handleViewItinerary = useCallback((message: ChatMessage) => {
    const { requestData, itineraryData } = message;
    router.push({
      pathname: '/trip/itinerary',
      params: {
        markdown: itineraryData?.markdown || '',
        destination: requestData?.destination || '',
        duration: String(requestData?.duration || 3),
        transportMode: requestData?.transportMode || 'car_bus',
        startingPoint: requestData?.startingPoint || '',
        title: `Trip to ${requestData?.destination || 'Destination'}`,
      },
    });
  }, [router]);

  const handleSend = useCallback(() => sendMessage(inputText), [inputText, sendMessage]);

  const handleClearChat = useCallback(() => {
    Alert.alert('Clear conversation', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setMessages([]); setInputText(''); } },
    ]);
  }, []);

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageBubble
      message={item} isDark={isDarkMode}
      onPlanTrip={generateTripItinerary}
      onViewItinerary={handleViewItinerary}
      onPlacePress={handlePlacePress}
      isGenerating={isGeneratingTrip}
    />
  ), [isDarkMode, generateTripItinerary, isGeneratingTrip, handlePlacePress, handleViewItinerary]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);
  const charNearLimit = inputText.length > MAX_CHAR * 0.8;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDarkMode ? '#0f172a' : '#f8fafc' }]} edges={['top']}>
      {/* HEADER */}
      <LinearGradient
        colors={isDarkMode ? ['#0f172a', '#0f172a'] : ['#ffffff', '#f8fafc']}
        style={[styles.header, { borderBottomColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={22} color={isDarkMode ? '#94a3b8' : '#64748b'} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatarWrap}>
            <BotAvatar size={36} animate={isTyping || isGeneratingTrip} />
            <View style={[styles.statusDot, { borderColor: isDarkMode ? '#0f172a' : '#ffffff', backgroundColor: isConnected ? '#22c55e' : '#94a3b8' }]} />
          </View>
          <View>
            <Text style={[styles.headerName, { color: isDarkMode ? '#f1f5f9' : '#0f172a' }]}>Isha</Text>
            <View style={styles.headerStatusRow}>
              {isConnected && <View style={styles.headerStatusDot} />}
              <Text style={[styles.headerStatus, { color: isDarkMode ? '#64748b' : '#94a3b8' }]}>
                {isTyping || isGeneratingTrip ? 'Thinking…' : isConnected ? '✨ Online' : 'Connecting…'}
              </Text>
            </View>
          </View>
        </View>
        {messages.length > 0 ? (
          <TouchableOpacity onPress={handleClearChat} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color={isDarkMode ? '#64748b' : '#94a3b8'} />
          </TouchableOpacity>
        ) : <View style={styles.headerBtn} />}
      </LinearGradient>

      {/* CONTENT */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isWelcomeScreen ? (
          <WelcomeScreen isDark={isDarkMode} onChipPress={handleChipPress} />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={keyExtractor}
            inverted
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.msgList, { backgroundColor: isDarkMode ? '#0f172a' : '#f1f5f9' }]}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={(isTyping || isGeneratingTrip) ? <TypingIndicator isDark={isDarkMode} /> : null}
            initialNumToRender={20} maxToRenderPerBatch={10} windowSize={10}
          />
        )}

        {/* INPUT BAR */}
        <View style={[styles.inputBar, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>
          {charNearLimit && (
            <Text style={[styles.charCount, { color: inputText.length >= MAX_CHAR ? '#ef4444' : '#f59e0b' }]}>
              {MAX_CHAR - inputText.length} left
            </Text>
          )}
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.inputIconBtn} activeOpacity={0.7} onPress={showTripPlannerForm}>
              <Ionicons name="map-outline" size={20} color="#2EC4B6" />
            </TouchableOpacity>
            <View style={[styles.inputWrap, { backgroundColor: isDarkMode ? '#1e293b' : '#f8fafc', borderColor: isDarkMode ? '#334155' : '#e2e8f0' }]}>
              <TextInput
                ref={inputRef}
                style={[styles.textInput, { color: isDarkMode ? '#f1f5f9' : '#0f172a' }]}
                value={inputText}
                onChangeText={(t) => setInputText(t.slice(0, MAX_CHAR))}
                placeholder="Ask Isha anything about travel…"
                placeholderTextColor={isDarkMode ? '#475569' : '#94a3b8'}
                multiline returnKeyType="default" blurOnSubmit={false}
                editable={!isTyping && !isGeneratingTrip}
              />
            </View>
            <TouchableOpacity onPress={handleSend}
              disabled={!inputText.trim() || isTyping || isGeneratingTrip}
              activeOpacity={0.8}
              style={[styles.sendBtn, inputText.trim() && !isTyping && !isGeneratingTrip ? styles.sendBtnActive : styles.sendBtnDisabled]}>
              {isTyping ? (
                <ActivityIndicator size="small" color={isDarkMode ? '#475569' : '#94a3b8'} />
              ) : (
                <Ionicons name="send" size={18} color={inputText.trim() ? '#ffffff' : isDarkMode ? '#475569' : '#cbd5e1'} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={[styles.poweredBy, { color: isDarkMode ? '#1e293b' : '#e2e8f0' }]}>Powered by Prayana AI</Text>
        </View>
      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1 },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.sm, gap: spacing.sm },
  headerAvatarWrap: { position: 'relative' },
  statusDot: { position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  headerName: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, letterSpacing: -0.3 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  headerStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  headerStatus: { fontSize: fontSize.xs },

  // Bot Avatar
  botAvatarBg: { alignItems: 'center', justifyContent: 'center' },

  // Welcome
  welcomeContainer: { flexGrow: 1, alignItems: 'center', paddingTop: spacing.xl * 2, paddingBottom: spacing.xl * 2, paddingHorizontal: spacing.xl },
  welcomeAvatarWrap: { position: 'relative', marginBottom: spacing.lg },
  welcomeAvatarBg: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', ...shadow.lg },
  welcomeAvatarEmoji: { fontSize: 32 },
  welcomeOnline: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22c55e', borderWidth: 2 },
  welcomeTitle: { fontSize: 24, fontWeight: fontWeight.bold, letterSpacing: -0.5, marginBottom: spacing.xs, textAlign: 'center' },
  welcomeSubtitle: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22, maxWidth: 280, marginBottom: spacing.xl },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, width: '100%' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1, ...shadow.sm },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  // Message list
  msgList: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg },

  // Message rows
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.lg },
  userRow: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  assistantRow: { alignSelf: 'flex-start' },
  msgAvatar: { marginRight: spacing.xs, marginBottom: 2, flexShrink: 0 },
  userDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2EC4B6', marginLeft: spacing.xs, marginBottom: 6 },

  // User bubble
  userBubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 18, borderBottomRightRadius: 4, maxWidth: SCREEN_WIDTH * 0.7 },
  userText: { color: '#ffffff', fontSize: fontSize.md, lineHeight: 22 },
  userTime: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4, textAlign: 'right' },

  // AI bubble
  aiBubble: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: 18, borderBottomLeftRadius: 4, borderWidth: 1, ...shadow.sm },
  aiTime: { fontSize: 10, marginTop: 6 },

  // Rich text
  dayHeaderWrap: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, marginBottom: 4, alignSelf: 'flex-start' },
  dayHeaderText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  textLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 2 },
  bulletLine: { paddingLeft: 4 },
  bullet: { fontSize: fontSize.sm, marginRight: 4, lineHeight: 22 },
  lineText: { fontSize: fontSize.md, lineHeight: 22, flex: 1, flexWrap: 'wrap' },
  boldText: { fontWeight: fontWeight.bold },
  semiboldText: { fontWeight: fontWeight.semibold },
  placeText: { fontWeight: fontWeight.semibold, textDecorationLine: 'underline' },

  // Typing indicator
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: spacing.md, alignSelf: 'flex-start', gap: spacing.xs },
  typingBubble: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, borderWidth: 1 },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#2EC4B6' },
  typingLabel: { fontSize: fontSize.xs, fontStyle: 'italic' },

  // Place cards
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, marginTop: spacing.xs },
  sectionIconBg: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', ...shadow.sm },
  sectionTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  sectionSub: { fontSize: fontSize.xs },
  placeCard: { flexDirection: 'row', padding: spacing.md, borderRadius: 16, borderWidth: 1, marginBottom: spacing.sm, ...shadow.sm },
  placeCardImageWrap: { position: 'relative', flexShrink: 0 },
  placeCardImage: { width: 80, height: 80, borderRadius: 12 },
  placeNumBadge: { position: 'absolute', top: -6, left: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#ffffff' },
  placeNumText: { color: '#ffffff', fontSize: 11, fontWeight: fontWeight.bold },
  placeCardInfo: { flex: 1, marginLeft: spacing.md },
  placeCardName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginBottom: 3 },
  placeCardDesc: { fontSize: fontSize.xs, lineHeight: 16, marginTop: 2 },
  starsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  ratingNum: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginLeft: 3 },
  categoryBadge: { marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(46,196,182,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  categoryText: { fontSize: 10, color: '#0d9488' },

  // Images banner
  imagesScroll: { marginBottom: spacing.xs },
  bannerImageWrap: { width: 160, height: 100, borderRadius: 12, overflow: 'hidden', marginRight: spacing.sm },
  bannerImage: { width: '100%', height: '100%' },

  // Related places
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.xs },
  relatedLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  relatedChip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.full, borderWidth: 1, marginRight: spacing.xs, marginBottom: spacing.xs },
  relatedChipText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  // Action buttons
  actionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.full, borderWidth: 1 },
  actionBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Trip planner form
  plannerCard: { borderRadius: 16, borderWidth: 1, ...shadow.md, overflow: 'hidden' },
  progressBar: { flexDirection: 'row', height: 3 },
  progressSegment: { flex: 1 },
  plannerBody: { padding: spacing.md, gap: spacing.sm },
  plannerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  plannerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  plannerLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, marginBottom: spacing.xs },
  plannerHint: { fontSize: fontSize.xs, marginTop: 4 },
  plannerInput: { borderRadius: borderRadius.lg, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, fontSize: fontSize.md },
  durationRow: { flexDirection: 'row', gap: spacing.sm },
  durationBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: borderRadius.md, alignItems: 'center', borderWidth: 1 },
  durationText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  transportRow: { flexDirection: 'row', gap: spacing.sm },
  transportBtn: { flex: 1, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2, gap: 4 },
  transportLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  plannerActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  backBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.lg },
  nextBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm + 4, borderRadius: borderRadius.lg, backgroundColor: '#2EC4B6', ...shadow.sm },
  nextBtnText: { color: '#ffffff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Itinerary preview card
  itineraryCard: { borderRadius: 16, borderWidth: 1, ...shadow.md, overflow: 'hidden' },
  itineraryTopStrip: { paddingHorizontal: spacing.md, paddingVertical: 5, alignItems: 'center' },
  itineraryStripText: { color: '#ffffff', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1 },
  itineraryContent: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  itineraryLeft: { flex: 1 },
  itineraryBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.xs },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: borderRadius.full, borderWidth: 1, backgroundColor: 'rgba(46,196,182,0.12)', borderColor: 'rgba(46,196,182,0.3)' },
  badgeText: { fontSize: 10, fontWeight: fontWeight.bold, color: '#2EC4B6' },
  itineraryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, lineHeight: 22, marginBottom: 4 },
  itinerarySubtitle: { fontSize: fontSize.xs, lineHeight: 16 },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  itineraryImages: { width: 100 },
  heroImageWrap: { borderRadius: 10, overflow: 'hidden', height: 65, marginBottom: 4 },
  heroImage: { width: '100%', height: '100%' },
  smallImagesRow: { flexDirection: 'row', gap: 4, height: 44 },
  smallImageWrap: { flex: 1, borderRadius: 8, overflow: 'hidden' },
  smallImage: { width: '100%', height: '100%' },
  itineraryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderTopWidth: 1 },

  // Input bar
  inputBar: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md, borderTopWidth: 1 },
  charCount: { fontSize: 10, textAlign: 'right', marginBottom: spacing.xs, fontWeight: fontWeight.medium },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs },
  inputIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  inputWrap: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.xs + 2, maxHeight: 110 },
  textInput: { fontSize: fontSize.md, lineHeight: 20, paddingVertical: 0, maxHeight: 90 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sendBtnActive: { backgroundColor: '#2EC4B6' },
  sendBtnDisabled: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#334155' },
  poweredBy: { fontSize: 10, textAlign: 'center', marginTop: spacing.xs, letterSpacing: 0.3 },

});
