// A question in the community feed, the phone layout of the web's
// components/community/QuestionCard.jsx: a thin bar in the category's colour
// down the left edge, the category chip (and Resolved / photo count), the
// title, a two-line preview, tags, then the asker with a stable gradient
// avatar, time, votes, answers and views. A photo shows as a thumbnail on the
// right, and is dropped if it fails to load rather than left as a grey box.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { categoryMeta } from '../../lib/communityCategories';

export type Question = {
  _id: string;
  title: string;
  description?: string;
  category: string;
  tags?: string[];
  answerCount?: number;
  upvotes?: number;
  viewCount?: number;
  isResolved?: boolean;
  isAnonymous?: boolean;
  userName?: string;
  createdAt: string;
  images?: { url: string }[];
};

export function timeAgo(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// A stable gradient per asker, so the same person always gets the same avatar.
const AVATARS: [string, string][] = [
  ['#fb923c', '#f43f5e'], ['#38bdf8', '#6366f1'], ['#34d399', '#0d9488'], ['#a78bfa', '#d946ef'], ['#fbbf24', '#ea580c'],
];
const hashOf = (s = '') => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);

/** The preview as one flowing line: greetings' line breaks collapsed. */
const flat = (t?: string) => (t || '').replace(/\s+/g, ' ').trim();

export function QuestionCard({ q, onPress }: { q: Question; onPress: () => void }) {
  const { themeColors, isDarkMode } = useTheme();
  const [imgOk, setImgOk] = useState(true);
  const cat = categoryMeta(q.category);
  const answers = q.answerCount || 0;
  const resolved = !!q.isResolved;
  const anon = !!q.isAnonymous;
  const name = anon ? 'Anonymous' : q.userName || 'Traveler';
  const grad = anon ? (['#d1d5db', '#9ca3af'] as [string, string]) : AVATARS[Math.abs(hashOf(name)) % AVATARS.length];
  const image = q.images?.[0]?.url;
  const preview = flat(q.description);
  const muted = themeColors.textTertiary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={q.title}
      style={({ pressed }) => [
        s.card,
        { backgroundColor: themeColors.surface, borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
        pressed && { transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={[s.bar, { backgroundColor: cat.color }]} />

      <View style={s.chips}>
        <View style={[s.cat, { backgroundColor: `${cat.color}1A` }]}>
          <Ionicons name={cat.icon} size={12} color={cat.color} />
          <Text style={[s.catText, { color: cat.color }]}>{cat.label}</Text>
        </View>
        {resolved ? (
          <View style={s.resolved}>
            <Ionicons name="checkmark-circle" size={12} color="#047857" />
            <Text style={s.resolvedText}>Resolved</Text>
          </View>
        ) : null}
        {q.images?.length ? (
          <View style={[s.photos, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#f3f4f6' }]}>
            <Ionicons name="image-outline" size={11} color={themeColors.textSecondary} />
            <Text style={[s.photosText, { color: themeColors.textSecondary }]}>{q.images.length}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.body}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.title, { color: themeColors.text }]} numberOfLines={2}>{q.title}</Text>
          {preview ? (
            <Text style={[s.preview, { color: themeColors.textSecondary }]} numberOfLines={2}>{preview}</Text>
          ) : null}
        </View>
        {image && imgOk ? (
          <Image
            source={{ uri: image }}
            style={s.thumb}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setImgOk(false)}
          />
        ) : null}
      </View>

      {q.tags?.length ? (
        <View style={s.tags}>
          {q.tags.slice(0, 3).map((t) => (
            <View key={t} style={[s.tag, { backgroundColor: isDarkMode ? 'rgba(249,115,22,0.12)' : '#fff7ed' }]}>
              <Text style={s.tagText} numberOfLines={1}>#{t}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[s.foot, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#f3f4f6' }]}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatar}>
          {anon ? <Ionicons name="person-outline" size={11} color="#fff" /> : <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>}
        </LinearGradient>
        <Text style={[s.who, { color: themeColors.text }]} numberOfLines={1}>{name}</Text>
        <Text style={[s.when, { color: muted }]}>· {timeAgo(q.createdAt)}</Text>
        <View style={{ flex: 1 }} />
        <View style={s.stat}>
          <Ionicons name="arrow-up" size={13} color="#f97316" />
          <Text style={[s.statText, { color: themeColors.textSecondary }]}>{q.upvotes || 0}</Text>
        </View>
        <View style={[s.stat, answers > 0 && s.statAns, resolved && s.statResolved]}>
          <Ionicons name={resolved ? 'checkmark-circle' : 'chatbubble-outline'} size={12} color={resolved ? '#fff' : answers > 0 ? '#047857' : muted} />
          <Text style={[s.statText, { color: resolved ? '#fff' : answers > 0 ? '#047857' : themeColors.textSecondary }]}>{answers}</Text>
        </View>
        <View style={s.stat}>
          <Ionicons name="eye-outline" size={13} color={muted} />
          <Text style={[s.statText, { color: themeColors.textSecondary }]}>{q.viewCount || 0}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 20, borderWidth: 1, padding: 16, paddingLeft: 18, overflow: 'hidden',
    shadowColor: '#111827', shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2,
  },
  bar: { position: 'absolute', left: 0, top: 18, bottom: 18, width: 3, borderTopRightRadius: 3, borderBottomRightRadius: 3, opacity: 0.8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 9 },
  cat: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  catText: { fontSize: 11.5, fontWeight: '800' },
  resolved: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  resolvedText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  photos: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  photosText: { fontSize: 11, fontWeight: '700' },
  body: { flexDirection: 'row', gap: 12 },
  title: { fontSize: 16.5, fontWeight: '800', lineHeight: 22, letterSpacing: -0.2 },
  preview: { fontSize: 13.5, lineHeight: 19.5, marginTop: 4 },
  thumb: { width: 74, height: 74, borderRadius: 14, backgroundColor: '#f3f4f6' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 150 },
  tagText: { color: '#c2410c', fontSize: 11.5, fontWeight: '700' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  who: { fontSize: 12.5, fontWeight: '700', flexShrink: 1, maxWidth: 120 },
  when: { fontSize: 12 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999 },
  statAns: { backgroundColor: '#ecfdf5' },
  statResolved: { backgroundColor: '#10b981' },
  statText: { fontSize: 12, fontWeight: '700' },
});
