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
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamChatMessage, type StreamHandle } from '../../lib/chatStream';
import * as Clipboard from 'expo-clipboard';
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
import { makeChatAPICall, makeItineraryAPICall, socketService, auth } from '@prayana/shared-services';
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

// Bookable Prayana inventory the agent returns in `inventory[]`. `kind` picks
// the mobile deep-link; `url` is the web path (we map it to a native route).
interface InventoryCard {
  kind: 'activity' | 'package' | 'transport' | 'cab' | 'captain_tour' | 'global_activity' | string;
  id?: string;
  title: string;
  image?: string | null;
  price?: number | null;
  currency?: string;
  priceSuffix?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  url?: string;
}

// One-tap booking prompts the agent returns in `actionCards[]`.
interface ActionCard {
  type: 'confirm_booking' | 'book_cab' | 'buy_esim' | 'save_favorite' | 'view_itinerary' | string;
  label: string;
  requiresAuth?: boolean;
  data?: any;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  type: MessageType;
  content: string;
  timestamp: Date;
  /** True while SSE tokens are still arriving for this bubble. */
  streaming?: boolean;
  topPlaces?: Place[];
  images?: string[];
  actions?: Array<{ text: string; action: string }>;
  relatedPlaces?: Array<{ id?: string; name: string }>;
  inventory?: InventoryCard[];
  actionCards?: ActionCard[];
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
/** Server session id, so a relaunch resumes the same conversation. */
const CHAT_SESSION_KEY = 'prayana.chat.sessionId';

type SuggestionChip = { icon?: string; text: string; action?: string; placeholder?: string };

// Fallback only — the server's /chat/suggestions is context-aware and is
// preferred when it answers. These remain for offline/first paint.
const SUGGESTION_CHIPS: SuggestionChip[] = [
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

// The server sends the destination hero images as [{ url, caption }] objects,
// but they may also arrive as plain URL strings. Normalise to a string[] so the
// <Image uri> renders (an object uri silently shows nothing).
function normalizeImages(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x : x?.url || x?.mediumUrl || x?.imageUrl || null))
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
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

        // Markdown headings (#, ##, ###) — the renderer previously showed the
        // hashes as literal text.
        const heading = /^(#{1,3})\s+(.*)$/.exec(line.trim());
        if (heading) {
          const level = heading[1].length;
          return (
            <Text
              key={idx}
              style={{
                color: textColor,
                fontSize: level === 1 ? 19 : level === 2 ? 17 : 15,
                fontWeight: '700',
                marginTop: idx === 0 ? 0 : 6,
                marginBottom: 2,
              }}
            >
              {heading[2]}
            </Text>
          );
        }

        // Horizontal rule
        if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
          return (
            <View
              key={idx}
              style={{ height: 1, backgroundColor: isDark ? '#334155' : '#e2e8f0', marginVertical: 6 }}
            />
          );
        }

        // Blockquote
        const quote = /^>\s?(.*)$/.exec(line.trim());
        if (quote) {
          return (
            <View
              key={idx}
              style={{
                borderLeftWidth: 3,
                borderLeftColor: tealColor,
                paddingLeft: 8,
                paddingVertical: 2,
                marginVertical: 2,
              }}
            >
              <Text style={{ color: textColor, fontSize: 14, fontStyle: 'italic' }}>{quote[1]}</Text>
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
                if (seg.type === 'link') {
                  return (
                    <Text
                      key={si}
                      style={{ color: tealColor, textDecorationLine: 'underline', fontSize: 14 }}
                      onPress={() => { if (seg.href) Linking.openURL(seg.href).catch(() => {}); }}
                    >
                      {seg.text}
                    </Text>
                  );
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

type Segment = { type: 'bold' | 'plain' | 'place' | 'day' | 'time' | 'link'; text: string; href?: string };

/** Expand link placeholders inside a run of plain text. */
function pushPlain(out: Segment[], text: string, links: { text: string; href: string }[]) {
  if (!text) return;
  if (links.length === 0 || !text.includes('\u0000')) {
    out.push({ type: 'plain', text });
    return;
  }
  const parts = text.split(/\u0000(\d+)\u0000/);
  parts.forEach((part, i) => {
    if (!part) return;
    if (i % 2 === 1) {
      const l = links[Number(part)];
      if (l) out.push({ type: 'link', text: l.text, href: l.href });
    } else {
      out.push({ type: 'plain', text: part });
    }
  });
}

function parseLineSegments(line: string, isDark: boolean, tealColor: string, placeColor: string): Segment[] {
  // Strip leading bullet chars for display
  let cleaned = line.replace(/^[-•*]\s/, '').replace(/^\d+\.\s/, '');

  // Markdown links were rendered as literal "[text](url)". Pull them out
  // before the main tokenizer runs, replacing each with a placeholder so the
  // proper-noun pattern cannot match inside a URL.
  const links: { text: string; href: string }[] = [];
  cleaned = cleaned.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_m, label, href) => {
    links.push({ text: label, href });
    return `\u0000${links.length - 1}\u0000`;
  });

  // Tokenize by: **bold**, Day N, time-of-day words, proper noun phrases
  const pattern = /(\*\*[^*]+\*\*|Day\s+\d+|(?:^|\s)(Morning|Afternoon|Evening|Night)(?=\s|$)|(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+))/g;

  const segments: Segment[] = [];
  let last = 0;
  let match;

  while ((match = pattern.exec(cleaned)) !== null) {
    const [raw] = match;
    const start = match.index;

    if (start > last) {
      pushPlain(segments, cleaned.slice(last, start), links);
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
    pushPlain(segments, cleaned.slice(last), links);
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
// Map an agent inventory card to the native deep-link route. Activity/package
// have per-item detail; cabs/monuments/eSIM land on their search/browse screen.
function inventoryRoute(card: InventoryCard): string {
  const idOrSlug = card.url?.split('/').filter(Boolean).pop() || card.id || '';
  switch (card.kind) {
    case 'activity':
    case 'global_activity':
      return idOrSlug ? `/activity/${encodeURIComponent(idOrSlug)}` : '/activities';
    case 'package':
    case 'captain_tour':
      return idOrSlug ? `/packages/${encodeURIComponent(idOrSlug)}` : '/packages';
    case 'cab':
      return '/outstation-cabs';
    case 'transport':
      return idOrSlug ? `/transport/${encodeURIComponent(idOrSlug)}` : '/transport';
    default:
      return card.url && card.url.startsWith('/') ? card.url.replace('/activities/', '/activity/') : '/activities';
  }
}

const KIND_LABEL: Record<string, string> = {
  activity: 'Activity', global_activity: 'Experience', package: 'Package',
  captain_tour: 'Group tour', cab: 'Cab', transport: 'Ride',
};

function ChatInventoryCard({ card, isDark, onPress }: { card: InventoryCard; isDark: boolean; onPress: () => void }) {
  const bg = isDark ? '#1e293b' : '#ffffff';
  const border = isDark ? '#334155' : '#e2e8f0';
  const text = isDark ? '#f1f5f9' : '#0f172a';
  const sub = isDark ? '#94a3b8' : '#64748b';
  const sym = card.currency === 'USD' ? '$' : '₹';
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[invStyles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={invStyles.imgWrap}>
        {card.image ? (
          <Image source={{ uri: card.image }} style={invStyles.img} contentFit="cover" />
        ) : (
          <View style={[invStyles.img, { backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="pricetag" size={20} color="#F59E0B" />
          </View>
        )}
        <View style={invStyles.kindPill}>
          <Text style={invStyles.kindPillText}>{KIND_LABEL[card.kind] || 'Book'}</Text>
        </View>
      </View>
      <View style={invStyles.body}>
        <Text style={[invStyles.title, { color: text }]} numberOfLines={2}>{card.title}</Text>
        {!!card.location && <Text style={[invStyles.loc, { color: sub }]} numberOfLines={1}>{card.location}</Text>}
        <View style={invStyles.footer}>
          {card.price != null && card.price > 0 ? (
            <Text style={[invStyles.price, { color: text }]}>
              {sym}{Number(card.price).toLocaleString('en-IN')}
              {!!card.priceSuffix && <Text style={[invStyles.priceSuffix, { color: sub }]}> {card.priceSuffix}</Text>}
            </Text>
          ) : <Text style={[invStyles.priceSuffix, { color: sub }]}>View</Text>}
          {!!card.rating && (
            <View style={invStyles.rating}>
              <Ionicons name="star" size={11} color="#F59E0B" />
              <Text style={[invStyles.ratingText, { color: sub }]}>{Number(card.rating).toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const invStyles = StyleSheet.create({
  card: { width: 190, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  imgWrap: { width: '100%', aspectRatio: 16 / 10, backgroundColor: '#FEF3C7' },
  img: { width: '100%', height: '100%' },
  kindPill: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  kindPillText: { color: '#fff', fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  body: { padding: 10, gap: 3 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  loc: { fontSize: 11 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  price: { fontSize: 14, fontWeight: '800' },
  priceSuffix: { fontSize: 11, fontWeight: '400' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ratingText: { fontSize: 11, fontWeight: '600' },
});

function MessageBubble({ message, isDark, onPlanTrip, onViewItinerary, onPlacePress, onInventoryPress, onActionCard, isGenerating, onRegenerate, isLastAssistant }: {
  message: ChatMessage;
  isDark: boolean;
  onPlanTrip: (d: TripFormData) => void;
  onViewItinerary: (m: ChatMessage) => void;
  onPlacePress: (name: string) => void;
  onInventoryPress: (card: InventoryCard) => void;
  onActionCard: (card: ActionCard) => void;
  isGenerating: boolean;
  onRegenerate: () => void;
  /** Only the newest assistant reply offers Regenerate, as on the web. */
  isLastAssistant: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
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

        {/* Action toolbar — hidden while tokens are still arriving. */}
        {!!message.content && !message.streaming && (
          <View style={styles.msgActions}>
            <TouchableOpacity
              onPress={async () => {
                await Clipboard.setStringAsync(message.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.msgActionBtn}
              accessibilityLabel="Copy message"
            >
              <Ionicons
                name={copied ? 'checkmark' : 'copy-outline'}
                size={14}
                color={copied ? '#10b981' : textSecondary}
              />
            </TouchableOpacity>

            {isLastAssistant && (
              <TouchableOpacity
                onPress={onRegenerate}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.msgActionBtn}
                accessibilityLabel="Regenerate reply"
              >
                <Ionicons name="refresh-outline" size={14} color={textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setVote((v) => (v === 'up' ? null : 'up'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.msgActionBtn}
              accessibilityLabel="Good reply"
            >
              <Ionicons
                name={vote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={14}
                color={vote === 'up' ? '#10b981' : textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setVote((v) => (v === 'down' ? null : 'down'))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.msgActionBtn}
              accessibilityLabel="Bad reply"
            >
              <Ionicons
                name={vote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={14}
                color={vote === 'down' ? '#ef4444' : textSecondary}
              />
            </TouchableOpacity>
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

        {/* Bookable Prayana inventory — real listings with prices, tappable to book */}
        {message.inventory && message.inventory.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <LinearGradient colors={['#F59E0B', '#EA580C']} style={styles.sectionIconBg}>
                <Text style={{ fontSize: 16 }}>🎟️</Text>
              </LinearGradient>
              <View>
                <Text style={[styles.sectionTitle, { color: textPrimary }]}>Book on Prayana</Text>
                <Text style={[styles.sectionSub, { color: textSecondary }]}>Handpicked, bookable in-app</Text>
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 4 }}>
              {message.inventory.slice(0, 10).map((card, i) => (
                <ChatInventoryCard key={`${card.kind}-${card.id || i}`} card={card} isDark={isDark} onPress={() => onInventoryPress(card)} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* One-tap booking prompts (confirm booking / book cab / buy eSIM / view itinerary) */}
        {message.actionCards && message.actionCards.length > 0 && (
          <View style={styles.actionsWrap}>
            {message.actionCards.map((card, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onActionCard(card)}
                activeOpacity={0.9}
                style={[styles.bookCta, { backgroundColor: isDark ? 'rgba(245,158,11,0.16)' : '#FFF7ED', borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FED7AA' }]}
              >
                <Ionicons name="flash" size={15} color="#EA580C" />
                <Text style={[styles.bookCtaText, { color: isDark ? '#FBBF24' : '#C2410C' }]}>{card.label}</Text>
                <Ionicons name="chevron-forward" size={15} color="#EA580C" />
              </TouchableOpacity>
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
function WelcomeScreen({ isDark, chips, onChipPress }: {
  isDark: boolean;
  chips: SuggestionChip[];
  onChipPress: (chip: SuggestionChip) => void;
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
        {chips.map((chip, i) => (
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
  // FloatingChatFAB and EmbeddedChatWidget both push /chat with these params,
  // but the screen never read them — so tapping a destination suggestion
  // opened an empty chat and the user's question was silently dropped.
  const params = useLocalSearchParams<{ initialMessage?: string; context?: string }>();
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isGeneratingTrip, setIsGeneratingTrip] = useState(false);

  // ── Human-handoff state (mirrors ChatSession.mode on the server) ───────
  const [handoffMode, setHandoffMode] = useState<'ai' | 'queued' | 'human' | 'resolved'>('ai');
  const [assignedAgent, setAssignedAgent] = useState<{ id: string; name: string } | null>(null);
  const [agentTyping, setAgentTyping] = useState(false);
  const [isEscalating, setIsEscalating] = useState(false);
  // Tracks the active session id reactively (sessionIdRef alone doesn't trigger
  // the handoff socket effect to re-run when the session is created).
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  // Live SSE handle, so a send can be aborted (and so a new send never races
  // an in-flight stream).
  const streamRef = useRef<StreamHandle | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  const isWelcomeScreen = messages.length === 0;

  // Open the /customer-chat socket whenever there's a session. The agent's
  // claim event flips handoffMode and pushes their replies into the message
  // list; meanwhile the existing /chat/send REST flow keeps working untouched.
  useEffect(() => {
    if (!activeSessionId) return undefined;
    let cancelled = false;
    let cleanup: (() => void) | null = null;
    // socketService is untyped JS; its connect* methods return a teardown fn typed as `Function`.
    const asCleanup = (fn: unknown): (() => void) => fn as () => void;

    (async () => {
      let token: string | null = null;
      try {
        token = (await auth.currentUser?.getIdToken()) || null;
      } catch {
        token = null;
      }
      if (cancelled) return;

      cleanup = asCleanup(socketService.connectCustomerChat(token, activeSessionId, {
        onModeChanged: (payload: any) => {
          if (cancelled) return;
          setHandoffMode((payload?.mode as any) || 'ai');
          if (payload?.assignedAgent) setAssignedAgent(payload.assignedAgent);
          if (payload?.mode !== 'human') setAgentTyping(false);
        },
        onAgentMessage: (payload: any) => {
          if (cancelled) return;
          const msg: ChatMessage = {
            id: payload.messageId || `agent-${Date.now()}`,
            role: 'assistant',
            type: 'text',
            content: payload.content,
            timestamp: new Date(payload.timestamp || Date.now()),
          };
          // FlatList is `inverted` — newest items go to the front.
          setMessages((prev) => [msg, ...prev]);
          setAgentTyping(false);
        },
        onAgentTyping: (payload: any) => {
          if (cancelled) return;
          setAgentTyping(!!payload?.isTyping);
        },
        onAgentsAllBusy: () => {
          if (cancelled) return;
          Toast.show({
            type: 'info',
            text1: 'All agents are busy',
            text2: "We've notified the team. Keep typing — they'll reply via push.",
            visibilityTime: 6000,
          });
        },
      }));
    })();

    return () => {
      cancelled = true;
      try {
        cleanup && cleanup();
      } catch {}
    };
  }, [activeSessionId]);

  const escalateToHuman = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (!sid || isEscalating) return;
    setIsEscalating(true);
    try {
      await makeChatAPICall('/chat/escalate', {
        method: 'POST',
        body: JSON.stringify({ sessionId: sid, reason: 'explicit' }),
        timeout: 15000,
      });
      setHandoffMode('queued');
    } catch {
      Toast.show({ type: 'error', text1: 'Could not connect to support', text2: 'Try again in a moment.' });
    } finally {
      setIsEscalating(false);
    }
  }, [isEscalating]);

  // Start session on mount — reusing the previous one when there is one.
  //
  // Chat used to issue a brand-new session on every mount and keep messages in
  // useState only, so closing the app (or even leaving the screen) discarded
  // the whole conversation, including any itinerary generated in it. The server
  // already stores the transcript, so persist the id and rehydrate from
  // /chat/history instead of starting over.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await AsyncStorage.getItem(CHAT_SESSION_KEY).catch(() => null);

      if (saved) {
        try {
          const res = await makeChatAPICall(`/chat/history/${saved}?limit=50`, { timeout: 15000 });
          const rows: any[] = Array.isArray(res?.data) ? res.data : [];
          if (!cancelled && rows.length > 0) {
            // The list is inverted, and history arrives oldest-first.
            const restored: ChatMessage[] = rows
              .filter((r) => r?.content)
              .map((r): ChatMessage => ({
                id: r.messageId || r._id || generateId(),
                role: r.role === 'user' ? 'user' : 'assistant',
                type: 'text',
                content: String(r.content),
                timestamp: r.timestamp ? new Date(r.timestamp) : new Date(),
              }))
              .reverse();
            setMessages(restored);
            sessionIdRef.current = saved;
            setActiveSessionId(saved);
            setIsConnected(true);
            return;
          }
        } catch {
          // Session expired or unreachable — fall through and start a fresh one.
        }
      }

      try {
        const res = await makeChatAPICall('/chat/session/start', {
          method: 'POST',
          body: JSON.stringify({ context: { type: 'general' } }),
          timeout: 15000,
        });
        const sid = res?.data?.sessionId;
        if (sid && !cancelled) {
          sessionIdRef.current = sid;
          setActiveSessionId(sid);
          setIsConnected(true);
          AsyncStorage.setItem(CHAT_SESSION_KEY, sid).catch(() => {});
        }
      } catch { /* offline */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Context-aware chips from the server, falling back to the hardcoded set.
  // GET, not POST — the POST form 404s.
  const [chips, setChips] = useState<SuggestionChip[]>(SUGGESTION_CHIPS);
  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await makeChatAPICall(
          `/chat/suggestions?sessionId=${encodeURIComponent(activeSessionId)}`,
          { timeout: 10000 },
        );
        const list = res?.data?.suggestions;
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setChips(
            list.slice(0, 6).map((x: any) => ({
              icon: x.icon,
              text: x.text,
              action: x.action,
            })),
          );
        }
      } catch { /* keep the fallback chips */ }
    })();
    return () => { cancelled = true; };
  }, [activeSessionId]);

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
    setActiveSessionId(sid);
    setIsConnected(true);
    // Persist here too: a session created on first send must survive a
    // relaunch exactly like one created on mount.
    AsyncStorage.setItem(CHAT_SESSION_KEY, sid).catch(() => {});
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

    const reqBody = {
      sessionId: sessionIdRef.current,
      message: { content: trimmed, context: { type: 'general' } },
    };

    try {
      await ensureSession();
      reqBody.sessionId = sessionIdRef.current;

      // Prefer SSE so text appears as it is generated; a 60s blocking POST is
      // what made the mobile chat feel slower than the web. Any transport
      // failure falls through to the original /chat/send path below.
      const streamed = await new Promise<any | null>((resolve) => {
        const liveId = generateId();
        let buffer = '';
        let opened = false;

        const handle: StreamHandle = streamChatMessage(reqBody, {
          onToken: (chunk) => {
            buffer += chunk;
            if (!opened) {
              opened = true;
              setIsTyping(false); // the bubble itself is now the indicator
              setMessages((prev) => [{
                id: liveId, role: 'assistant', type: 'text',
                content: buffer, timestamp: new Date(), streaming: true,
              } as ChatMessage, ...prev]);
            } else {
              setMessages((prev) =>
                prev.map((m) => (m.id === liveId ? { ...m, content: buffer } : m)),
              );
            }
          },
          onDone: (payload) => {
            streamRef.current = null;
            if (!opened) { resolve(null); return; }
            // Replace the live bubble with the final one, which carries the
            // cards the token stream cannot.
            const ai = payload?.aiMessage;
            setMessages((prev) =>
              prev.map((m) => (m.id === liveId ? {
                ...m,
                content: ai?.content || buffer,
                streaming: false,
                topPlaces: ai?.topPlaces || [],
                images: normalizeImages(ai?.images),
                actions: ai?.actions || [],
                relatedPlaces: ai?.relatedPlaces || [],
                inventory: ai?.inventory || [],
                actionCards: ai?.actionCards || [],
              } as ChatMessage : m)),
            );
            resolve(payload || { ok: true });
          },
          onError: () => {
            streamRef.current = null;
            if (opened) {
              // Partial text already shown — keep it rather than erroring.
              setMessages((prev) =>
                prev.map((m) => (m.id === liveId ? { ...m, streaming: false } : m)),
              );
              resolve({ ok: true });
            } else {
              resolve(null); // nothing rendered — fall back to POST
            }
          },
        });
        streamRef.current = handle;
        setIsStreaming(true);
      });

      setIsStreaming(false);
      if (streamed) { setIsTyping(false); return; }

      const response = await makeChatAPICall('/chat/send', {
        method: 'POST',
        body: JSON.stringify(reqBody),
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
        images: normalizeImages(aiMsgData?.images || response?.data?.images),
        actions: aiMsgData?.actions || [],
        relatedPlaces: aiMsgData?.relatedPlaces || [],
        // Bookable Prayana inventory + one-tap booking prompts the agent returns.
        inventory: aiMsgData?.inventory || response?.data?.inventory || [],
        actionCards: aiMsgData?.actionCards || response?.data?.actionCards || [],
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

  const handleChipPress = useCallback((chip: SuggestionChip) => {
    if (chip.action === 'plan_trip') {
      showTripPlannerForm();
      return;
    }
    if (chip.placeholder) {
      setInputText(chip.placeholder);
      setTimeout(() => inputRef.current?.focus(), 100);
      return;
    }
    // Server chips carry an action but no placeholder — send the label as the
    // question, which is what the web does for its action pills.
    if (chip.text) sendMessage(chip.text);
  }, [showTripPlannerForm, sendMessage]);

  const handlePlacePress = useCallback((name: string) => {
    sendMessage(`Tell me more about ${name}`);
  }, [sendMessage]);

  // Tap a bookable inventory card → deep-link into the right booking flow.
  const handleInventoryPress = useCallback((card: InventoryCard) => {
    router.push(inventoryRoute(card) as any);
  }, [router]);

  // One-tap action cards (confirm booking / book cab / buy eSIM / view itinerary).
  const handleActionCard = useCallback((card: ActionCard) => {
    const d = card.data || {};
    switch (card.type) {
      case 'confirm_booking':
        router.push((d.activityId || d.listingId ? `/activity/book/${d.activityId || d.listingId}` : '/activities') as any);
        break;
      case 'book_cab':
        router.push('/outstation-cabs' as any);
        break;
      case 'buy_esim':
        router.push((d.country ? `/esim?country=${encodeURIComponent(d.country)}` : '/esim') as any);
        break;
      case 'save_favorite':
        Toast.show({ type: 'success', text1: 'Saved' });
        break;
      case 'view_itinerary':
        router.push('/quick-itinerary' as any);
        break;
      default:
        if (d.url) router.push(String(d.url) as any);
    }
  }, [router]);

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

  /** Abort an in-flight stream, keeping whatever text already arrived. */
  const handleStopStreaming = useCallback(() => {
    streamRef.current?.abort();
    streamRef.current = null;
    setIsStreaming(false);
    setIsTyping(false);
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }, []);

  // Send the message the caller arrived with, once — and only after the
  // session exists, otherwise ensureSession races the mount effect.
  const initialSentRef = useRef(false);
  useEffect(() => {
    const initial = (params.initialMessage || '').trim();
    if (!initial || initialSentRef.current || !activeSessionId) return;
    initialSentRef.current = true;
    sendMessage(initial);
  }, [params.initialMessage, activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps


  const handleClearChat = useCallback(() => {
    Alert.alert('Clear conversation', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setMessages([]);
          setInputText('');
          // Drop the stored session too, or the next launch would rehydrate
          // the very transcript the user just cleared.
          await AsyncStorage.removeItem(CHAT_SESSION_KEY).catch(() => {});
          try {
            const res = await makeChatAPICall('/chat/session/start', {
              method: 'POST',
              body: JSON.stringify({ context: { type: 'general' } }),
              timeout: 15000,
            });
            const sid = res?.data?.sessionId;
            if (sid) {
              sessionIdRef.current = sid;
              setActiveSessionId(sid);
              AsyncStorage.setItem(CHAT_SESSION_KEY, sid).catch(() => {});
            }
          } catch { /* offline — ensureSession will retry on next send */ }
        },
      },
    ]);
  }, []);

  /**
   * Re-ask the question that produced the newest assistant reply. messages is
   * newest-first, so the last user message is the first one found walking
   * forward past the assistant bubble.
   */
  const handleRegenerate = useCallback(() => {
    if (isTyping) return;
    const lastUser = messages.find((m) => m.role === 'user' && !!m.content);
    if (!lastUser) return;
    // Remove the stale reply so the new one takes its place.
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.role === 'assistant');
      return idx === -1 ? prev : prev.filter((_, i) => i !== idx);
    });
    sendMessage(lastUser.content);
  }, [messages, isTyping, sendMessage]);

  // The newest assistant bubble is the only one offering Regenerate.
  const lastAssistantId = messages.find((m) => m.role === 'assistant')?.id;

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => (
    <MessageBubble
      message={item} isDark={isDarkMode}
      onPlanTrip={generateTripItinerary}
      onViewItinerary={handleViewItinerary}
      onPlacePress={handlePlacePress}
      onInventoryPress={handleInventoryPress}
      onActionCard={handleActionCard}
      isGenerating={isGeneratingTrip}
      onRegenerate={handleRegenerate}
      isLastAssistant={item.id === lastAssistantId}
    />
  ), [isDarkMode, generateTripItinerary, isGeneratingTrip, handlePlacePress, handleViewItinerary, handleInventoryPress, handleActionCard, handleRegenerate, lastAssistantId]);

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isWelcomeScreen ? (
          <WelcomeScreen isDark={isDarkMode} chips={chips} onChipPress={handleChipPress} />
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

        {/* HANDOFF BANNER — shown whenever a human is in the loop */}
        {(handoffMode === 'queued' || handoffMode === 'human' || handoffMode === 'resolved') && (
          <View
            style={[
              styles.handoffBanner,
              handoffMode === 'human'
                ? { backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5', borderColor: isDarkMode ? '#065f46' : '#a7f3d0' }
                : handoffMode === 'queued'
                  ? { backgroundColor: isDarkMode ? '#451a03' : '#fffbeb', borderColor: isDarkMode ? '#78350f' : '#fde68a' }
                  : { backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9', borderColor: isDarkMode ? '#334155' : '#cbd5e1' },
            ]}
            accessibilityLiveRegion="polite"
          >
            <Ionicons
              name="headset-outline"
              size={16}
              color={handoffMode === 'human' ? '#10b981' : handoffMode === 'queued' ? '#f59e0b' : '#64748b'}
            />
            <Text style={[styles.handoffBannerText, { color: isDarkMode ? '#f1f5f9' : '#0f172a' }]}>
              {handoffMode === 'human'
                ? `Connected to ${assignedAgent?.name || 'support'}${agentTyping ? ' — typing…' : ''}`
                : handoffMode === 'queued'
                  ? 'Waiting for the next available agent…'
                  : 'This conversation has been resolved.'}
            </Text>
          </View>
        )}

        {/* INPUT BAR */}
        <View style={[styles.inputBar, { backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', borderTopColor: isDarkMode ? '#1e293b' : '#e2e8f0', paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          {charNearLimit && (
            <Text style={[styles.charCount, { color: inputText.length >= MAX_CHAR ? '#ef4444' : '#f59e0b' }]}>
              {MAX_CHAR - inputText.length} left
            </Text>
          )}
          <View style={styles.inputRow}>
            {/* Talk-to-a-human icon: only visible while still talking to the AI */}
            {handoffMode === 'ai' && (
              <TouchableOpacity
                style={styles.inputIconBtn}
                activeOpacity={0.7}
                onPress={escalateToHuman}
                disabled={isEscalating}
                accessibilityLabel="Talk to a human"
              >
                <Ionicons name="headset-outline" size={20} color={isEscalating ? '#94a3b8' : '#f97316'} />
              </TouchableOpacity>
            )}
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
            {/* While a stream is live the send button becomes Stop — with
                token streaming there is now something worth interrupting. */}
            {isStreaming ? (
              <TouchableOpacity
                onPress={handleStopStreaming}
                activeOpacity={0.8}
                accessibilityLabel="Stop generating"
                style={[styles.sendBtn, styles.sendBtnActive]}
              >
                <Ionicons name="stop" size={16} color="#ffffff" />
              </TouchableOpacity>
            ) : (
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
            )}
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
  msgActions: { flexDirection: 'row', gap: 2, marginTop: 4, marginLeft: 4 },
  msgActionBtn: { padding: 6, borderRadius: 6 },
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
  bookCta: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderRadius: borderRadius.full, borderWidth: 1 },
  bookCtaText: { flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

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
  handoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  handoffBannerText: { fontSize: 13, fontWeight: fontWeight.medium, flex: 1 },
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
