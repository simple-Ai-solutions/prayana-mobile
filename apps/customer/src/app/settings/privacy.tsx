// Settings → Privacy choices: change the first-launch choice any time, the
// app's version of the website's /settings/privacy/cookies page.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useTheme } from '@prayana/shared-ui';
import { ConsentToggles } from '../../components/consent/ConsentSheet';
import { Consent, DENY_ALL, POLICY_URL, saveConsent, useConsent } from '../../lib/consent';
import { openInApp } from '../../lib/openInApp';

const TEAL = '#0d9488';

export default function PrivacyChoicesScreen() {
  const router = useRouter();
  const { themeColors, isDarkMode } = useTheme();
  const { consent, loaded } = useConsent();
  const [draft, setDraft] = useState<Consent>(DENY_ALL);
  useEffect(() => { if (consent) setDraft({ analytics: consent.analytics, advertising: consent.advertising }); }, [consent]);
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
  const changed = !!consent && (consent.analytics !== draft.analytics || consent.advertising !== draft.advertising);

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.top}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[s.round, { backgroundColor: themeColors.surface, borderColor: line }]} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={21} color={themeColors.text} />
        </Pressable>
        <Text style={[s.title, { color: themeColors.text }]}>Privacy choices</Text>
      </View>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={[s.lead, { color: themeColors.textSecondary }]}>
          Choose what Prayana may use beyond what's needed to run the app. Your choice is saved on this phone and recorded with us.
        </Text>
        <View style={[s.card, { backgroundColor: themeColors.surface, borderColor: line }]}>
          {loaded ? <ConsentToggles value={draft} onChange={setDraft} /> : null}
        </View>
        <Pressable
          onPress={async () => { await saveConsent(draft); Toast.show({ type: 'success', text1: 'Privacy choices saved' }); }}
          disabled={!changed && !!consent}
          style={({ pressed }) => [s.save, (!changed && !!consent) && { opacity: 0.5 }, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={s.saveText}>{consent ? 'Save choices' : 'Save my choices'}</Text>
        </Pressable>
        {consent ? (
          <Text style={[s.when, { color: themeColors.textTertiary }]}>
            Last updated {new Date(consent.decidedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        ) : null}
        <Pressable onPress={() => openInApp(POLICY_URL)} style={s.policy} accessibilityRole="link">
          <Ionicons name="document-text-outline" size={16} color={TEAL} />
          <Text style={s.policyText}>Read the Cookie Policy</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  round: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '900' },
  body: { padding: 16, gap: 14 },
  lead: { fontSize: 14, lineHeight: 20 },
  card: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 6 },
  save: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  when: { fontSize: 12, textAlign: 'center' },
  policy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  policyText: { color: TEAL, fontSize: 14, fontWeight: '700' },
});
