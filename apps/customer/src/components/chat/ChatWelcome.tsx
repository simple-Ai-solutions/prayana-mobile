import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@prayana/shared-hooks';
import { isPlaceholderName } from '../../lib/userName';
import { ISHA_WAVE } from './IshaAvatar';
import { useIsha } from './ishaTheme';
import { useChatStore } from './useChatStore';
import type { PageEntity } from './types';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const STARTERS: Array<{ icon: IconName; title: string; detail: string; text?: string; form?: boolean }> = [
  { icon: 'airplane-outline', title: 'Plan a trip', detail: 'Day by day, with real prices', form: true },
  { icon: 'phone-portrait-outline', title: 'eSIM for abroad', detail: 'Data that works on landing', text: 'I need an eSIM for my trip abroad' },
  { icon: 'car-outline', title: 'Outstation cab', detail: 'Fixed fares, city to city', text: 'I need an outstation cab' },
  { icon: 'people-outline', title: 'Group trips', detail: 'Join a Captain-led departure', text: 'Show me group trips I can join' },
];

// Questions worth asking about the page the user opened the chat from
function pageQuestions(entity: PageEntity | null) {
  if (!entity?.name) return null;
  switch (entity.kind) {
    case 'package':
    case 'pilgrimage package':
      return ["What's included in the price?", 'Is this good for families?', 'Show me cheaper options like this'];
    case 'activity':
      return ['Is this worth it?', 'What should I bring?', 'What else is there to do nearby?'];
    case 'vehicle':
      return ['How much for three days?', 'Is fuel included?', 'Can I pick it up at the airport?'];
    case 'captain tour':
      return ['Who is this trip for?', 'Which dates still have seats?', "What's included?"];
    case 'destination':
      return [`Plan 3 days in ${entity.name}`, `Best time to visit ${entity.name}`, `Things to do in ${entity.name}`];
    default:
      return null;
  }
}

function greeting(name?: string | null) {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const first = name && !isPlaceholderName(name) ? String(name).trim().split(/\s+/)[0] : null;
  return first ? { lead: `${part}, `, name: first } : { lead: "Hi, I'm ", name: 'Isha' };
}

const ask = (text: string) => useChatStore.getState().sendMessage(text);

/** What the chat shows before the first message. */
export default function ChatWelcome() {
  const t = useIsha();
  const { user, backendProfile, isAuthenticated } = useAuth();
  const pageEntity = useChatStore((s) => s.chatContext.pageEntity);
  const history = useChatStore((s) => s.conversationHistory);
  const currentId = useChatStore((s) => s.currentConversationId);
  const questions = pageQuestions(pageEntity);
  const hello = greeting(isAuthenticated ? backendProfile?.name || user?.displayName : null);
  const last = history.find((c) => c.id !== currentId && c.messages?.length);

  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.hello, { color: t.text }]} accessibilityRole="header">
            {hello.lead}
            {hello.name}.
          </Text>
          <Text style={[styles.lede, { color: t.muted }]}>Where to next? I can plan it, price it and book it with you.</Text>
        </View>
        <Image source={ISHA_WAVE} style={styles.wave} contentFit="contain" cachePolicy="disk" accessibilityIgnoresInvertColors />
      </View>

      {questions && pageEntity && (
        <View style={{ gap: 8 }}>
          <Text style={[styles.label, { color: t.muted }]}>
            About {pageEntity.kind === 'destination' ? pageEntity.name : `this ${pageEntity.kind}`}
          </Text>
          <View style={[styles.list, { borderColor: t.border }]}>
            {questions.map((q, i) => (
              <Pressable
                key={q}
                onPress={() => ask(q)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.question,
                  { borderBottomColor: t.divider, borderBottomWidth: i === questions.length - 1 ? 0 : StyleSheet.hairlineWidth },
                  pressed && { backgroundColor: t.pressed },
                ]}
              >
                <Text style={[styles.questionText, { color: t.text }]}>{q}</Text>
                <Ionicons name="arrow-forward" size={16} color={t.faint} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <Text style={[styles.label, { color: t.muted }]}>Start with</Text>
        <View style={styles.grid}>
          {STARTERS.map((s) => (
            <Pressable
              key={s.title}
              onPress={() => (s.form ? useChatStore.getState().showTripPlannerForm() : s.text && ask(s.text))}
              accessibilityRole="button"
              accessibilityLabel={`${s.title}. ${s.detail}`}
              style={({ pressed }) => [styles.starter, { borderColor: t.border, backgroundColor: pressed ? t.pressed : t.surface }]}
            >
              <View style={[styles.starterIcon, { backgroundColor: t.sunken }]}>
                <Ionicons name={s.icon} size={17} color={t.text} />
              </View>
              <View style={{ gap: 2 }}>
                <Text style={[styles.starterTitle, { color: t.text }]}>{s.title}</Text>
                <Text style={[styles.starterDetail, { color: t.muted }]}>{s.detail}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>

      {last && (
        <Pressable
          onPress={() => useChatStore.getState().loadConversation(last.id)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.resume, pressed && { backgroundColor: t.pressed }]}
        >
          <View style={[styles.resumeIcon, { backgroundColor: t.sunken }]}>
            <Ionicons name="time-outline" size={16} color={t.muted} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.resumeTitle, { color: t.text }]} numberOfLines={1}>
              Continue: {last.title}
            </Text>
            <Text style={[styles.resumeMeta, { color: t.muted }]}>
              {new Date(last.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {last.messages.length} messages
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.faint} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hello: { fontSize: 26, lineHeight: 32, fontWeight: '600', letterSpacing: -0.2 },
  lede: { fontSize: 14, lineHeight: 21, marginTop: 6 },
  wave: { width: 92, height: 92, marginRight: -8 },
  label: { fontSize: 12.5, fontWeight: '600' },
  list: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  question: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  questionText: { flex: 1, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starter: { width: '48.6%', flexGrow: 1, borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  starterIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  starterTitle: { fontSize: 13.5, fontWeight: '600', lineHeight: 18 },
  starterDetail: { fontSize: 12, lineHeight: 16 },
  resume: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 4, paddingVertical: 6, marginHorizontal: -4 },
  resumeIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  resumeTitle: { fontSize: 13.5, fontWeight: '500' },
  resumeMeta: { fontSize: 12 },
});
