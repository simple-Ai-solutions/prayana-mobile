// The first-launch privacy choice, the app's version of the website's
// CookieBanner. A bottom sheet with three equally weighted buttons — Reject is
// as big and as close as Accept, so refusing takes no more effort than
// agreeing (a choice under DPDP s6 must be freely given) — and a Customise
// view with the same three categories as the web.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Switch, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prayana/shared-ui';
import { openInApp } from '../../lib/openInApp';
import { ALLOW_ALL, Consent, DENY_ALL, POLICY_URL, saveConsent, useConsent } from '../../lib/consent';

const TEAL = '#0d9488';

export const CONSENT_ROWS: { key: keyof Consent | 'necessary'; label: string; body: string; locked?: boolean }[] = [
  { key: 'necessary', label: 'Strictly necessary', body: 'Sign-in, your saved choices and the app working at all.', locked: true },
  { key: 'analytics', label: 'Analytics', body: 'Which screens and features are used, counted together, to make the app better.' },
  { key: 'advertising', label: 'Advertising', body: "The app shows no ads today. If that changes, nothing ad-related runs unless you allow it." },
];

export function ConsentToggles({ value, onChange }: { value: Consent; onChange: (c: Consent) => void }) {
  const { themeColors } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {CONSENT_ROWS.map((r) => {
        const on = r.locked ? true : value[r.key as keyof Consent];
        return (
          <View key={r.key} style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[s.toggleLabel, { color: themeColors.text }]}>
                {r.label}{r.locked ? <Text style={[s.always, { color: themeColors.textTertiary }]}>  Always on</Text> : null}
              </Text>
              <Text style={[s.toggleBody, { color: themeColors.textSecondary }]}>{r.body}</Text>
            </View>
            <Switch
              value={on}
              disabled={r.locked}
              onValueChange={(v) => { if (!r.locked) onChange({ ...value, [r.key]: v }); }}
              trackColor={{ false: '#d1d5db', true: '#5eead4' }}
              thumbColor={on ? TEAL : '#f9fafb'}
              accessibilityLabel={r.label}
            />
          </View>
        );
      })}
    </View>
  );
}

export function ConsentSheet() {
  const { themeColors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { loaded, decided } = useConsent();
  const [customising, setCustomising] = useState(false);
  const [draft, setDraft] = useState<Consent>(DENY_ALL);
  if (!loaded || decided) return null;

  const line = isDarkMode ? 'rgba(255,255,255,0.12)' : '#d1d5db';
  const Btn = ({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, primary ? { backgroundColor: TEAL, borderColor: TEAL } : { borderColor: line }, pressed && { opacity: 0.85 }]}
    >
      <Text style={[s.btnText, { color: primary ? '#fff' : themeColors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <View style={[s.sheet, { backgroundColor: themeColors.surface, paddingBottom: 16 + insets.bottom }]} accessibilityViewIsModal>
          <View style={s.grab} />
          <View style={s.head}>
            <View style={s.icon}><Ionicons name="shield-checkmark" size={20} color={TEAL} /></View>
            <Text style={[s.title, { color: themeColors.text }]}>Your privacy choices</Text>
          </View>

          {!customising ? (
            <>
              <Text style={[s.body, { color: themeColors.textSecondary }]}>
                We use what's strictly necessary to run Prayana. With your permission we'd also use analytics, and
                advertising if we ever show ads.{' '}
                <Text style={s.link} onPress={() => openInApp(POLICY_URL)}>Cookie Policy</Text>
              </Text>
              {/* Same size and the same single tap for Reject as for Accept. */}
              <View style={s.btns}>
                <Btn label="Reject non-essential" onPress={() => saveConsent(DENY_ALL)} />
                <Btn label="Customise" onPress={() => setCustomising(true)} />
                <Btn label="Accept all" onPress={() => saveConsent(ALLOW_ALL)} primary />
              </View>
            </>
          ) : (
            <>
              <ConsentToggles value={draft} onChange={setDraft} />
              <View style={s.btnsRow}>
                <View style={{ flex: 1 }}><Btn label="Back" onPress={() => setCustomising(false)} /></View>
                <View style={{ flex: 1 }}><Btn label="Save choices" onPress={() => saveConsent(draft)} primary /></View>
              </View>
            </>
          )}
          <Text style={[s.foot, { color: themeColors.textTertiary }]}>You can change this any time in Settings → Privacy choices.</Text>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 8, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.5)', marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(13,148,136,0.12)', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20 },
  link: { color: TEAL, textDecorationLine: 'underline', fontWeight: '600' },
  btns: { gap: 10 },
  btnsRow: { flexDirection: 'row', gap: 10 },
  btn: { borderWidth: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  toggleLabel: { fontSize: 14.5, fontWeight: '700' },
  always: { fontSize: 12, fontWeight: '500' },
  toggleBody: { fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  foot: { fontSize: 11.5, textAlign: 'center' },
});
