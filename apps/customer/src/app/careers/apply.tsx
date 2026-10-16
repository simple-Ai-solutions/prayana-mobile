// Careers → Apply. Port of the web's components/careers/ApplicationModal.jsx.
// Posts multipart/form-data to POST /careers/apply; the server keys the
// application on the Firebase uid, so applying requires a real account.
// Client validation mirrors the server's rather than replacing it.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  TextInputProps,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { makeAPICall } from '@prayana/shared-services';
import { InfoTopBar } from '../../components/common/InfoTopBar';
import { useRequireAuth } from '../../lib/useRequireAuth';
import { findRole } from '../../lib/careers';

const TEAL = '#0d9488';
const MAX_ANSWER = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+?91[-\s]?)?[0]?[6-9]\d{9}$/;

type FormKey =
  | 'fullName'
  | 'email'
  | 'phone'
  | 'location'
  | 'experience'
  | 'availableFrom'
  | 'linkedinUrl'
  | 'portfolioUrl'
  | 'screeningAnswer'
  | 'productAnswer'
  | 'coverNote';

type Form = Record<FormKey, string>;

const EMPTY_FORM: Form = {
  fullName: '',
  email: '',
  phone: '',
  location: '',
  experience: '',
  availableFrom: '',
  linkedinUrl: '',
  portfolioUrl: '',
  screeningAnswer: '',
  productAnswer: '',
  coverNote: '',
};

interface FieldProps extends TextInputProps {
  label: string;
  required?: boolean;
  error?: string;
  multiline?: boolean;
}

function Field({ label, required, error, multiline, ...input }: FieldProps) {
  const { themeColors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[s.label, { color: themeColors.textSecondary }]}>
        {label}
        {required ? <Text style={{ color: '#e11d48' }}> *</Text> : null}
      </Text>
      <TextInput
        {...input}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        placeholderTextColor={themeColors.textTertiary}
        style={[
          s.input,
          multiline && s.textarea,
          {
            color: themeColors.text,
            backgroundColor: themeColors.field,
            borderColor: error ? '#f43f5e' : focused ? TEAL : themeColors.fieldBorder,
          },
        ]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export default function ApplyScreen() {
  const router = useRouter();
  const { role: slug } = useLocalSearchParams<{ role?: string }>();
  const role = useMemo(() => findRole(typeof slug === 'string' ? slug : undefined), [slug]);
  const { themeColors, isDarkMode } = useTheme();
  const { user, backendProfile } = useAuth();
  const requireAuth = useRequireAuth();
  const insets = useSafeAreaInsets();
  const line = isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<FormKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  // Seed from the signed-in account; all stay editable since the account
  // phone/email isn't necessarily the one they want us to reach them on.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      fullName: prev.fullName || user?.displayName || backendProfile?.name || '',
      email: prev.email || user?.email || backendProfile?.email || '',
      phone: prev.phone || (user?.phoneNumber || backendProfile?.phone || '').replace(/^\+91/, ''),
    }));
  }, [user, backendProfile]);

  const setField = useCallback((key: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const validate = useCallback(() => {
    const next: Partial<Record<FormKey, string>> = {};
    if (form.fullName.trim().length < 2) next.fullName = 'Please enter your full name.';
    if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (!PHONE_RE.test(form.phone.replace(/\s/g, ''))) next.phone = 'Enter a valid 10-digit Indian mobile number.';
    if (role?.screeningQuestion && !form.screeningAnswer.trim()) next.screeningAnswer = 'This one matters — please answer it.';
    if (role?.productQuestion && !form.productAnswer.trim()) next.productAnswer = 'Please try the product first — this is how we shortlist.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, role]);

  const submit = useCallback(async () => {
    if (!role) return;
    setServerError('');
    if (!requireAuth({ title: 'Sign in to apply', reason: 'Applications are tied to your Prayana account so you can track or withdraw them later.', redirectAfter: `/careers/apply?role=${role.slug}` })) return;
    if (!validate()) {
      setServerError('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    try {
      const body = new FormData();
      body.append('roleSlug', role.slug);
      body.append('roleTitle', role.title);
      if (role.isOpenApplication) body.append('isOpenApplication', 'true');
      (Object.keys(form) as FormKey[]).forEach((key) => {
        // productAnswer is folded into screeningAnswer below — the server has
        // no separate column for it.
        if (key === 'productAnswer' || key === 'screeningAnswer') return;
        const value = form[key].trim();
        if (value) body.append(key, value);
      });
      const screening = [
        form.screeningAnswer.trim(),
        form.productAnswer.trim() ? `--- ${role.productQuestion}\n${form.productAnswer.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      // JobApplication.screeningAnswer caps at 4000 chars and mongoose rejects
      // rather than truncates, so trim here.
      if (screening) body.append('screeningAnswer', screening.slice(0, MAX_ANSWER));

      // TODO(resume): no document picker is bundled yet. Once expo-document-picker
      // ships in a native build, append the file here under the `resume` key
      // (PDF/DOC/DOCX, max 5MB — keep in sync with middleware/resumeUpload.js):
      //   body.append('resume', { uri, name, type } as any);

      const res: any = await makeAPICall('/careers/apply', { method: 'POST', body, timeout: 30000 });
      if (!res?.success) {
        setServerError(res?.message || 'Something went wrong. Please try again.');
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setServerError(
        err?.status ? err.message || 'Something went wrong. Please try again.' : "Couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, role, requireAuth, validate]);

  if (!role) {
    return (
      <View style={[s.safe, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <InfoTopBar title="Apply" />
        <View style={s.centerBox}>
          <Ionicons name="briefcase-outline" size={34} color={themeColors.textTertiary} />
          <Text style={[s.doneTitle, { color: themeColors.text }]}>This role isn't open</Text>
          <Text style={[s.doneText, { color: themeColors.textSecondary }]}>It may have been filled. Have a look at what's open right now.</Text>
          <Pressable onPress={() => router.replace('/careers' as never)} style={s.primary}>
            <Text style={s.primaryText}>See open roles</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={[s.safe, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
        <InfoTopBar title="Application sent" />
        <View style={s.centerBox}>
          <View style={s.doneIcon}>
            <Ionicons name="checkmark" size={34} color="#fff" />
          </View>
          <Text style={[s.doneTitle, { color: themeColors.text }]}>Thanks, {form.fullName.trim().split(' ')[0] || 'there'}!</Text>
          <Text style={[s.doneText, { color: themeColors.textSecondary }]}>
            Your application for <Text style={{ fontWeight: '800', color: themeColors.text }}>{role.title}</Text> is in. We read every one — if there's a fit, we'll reach out within a week.
          </Text>
          <Pressable onPress={() => router.replace('/careers/my-applications' as never)} style={s.primary}>
            <Ionicons name="documents-outline" size={16} color="#fff" />
            <Text style={s.primaryText}>View my applications</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} style={[s.secondary, { borderColor: line }]}>
            <Text style={[s.secondaryText, { color: themeColors.text }]}>Done</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.safe, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !submitting }} />
      <InfoTopBar title="Apply" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
          <View style={[s.roleCard, { backgroundColor: themeColors.surface, borderColor: line }]}>
            <Text style={s.roleEyebrow}>APPLYING FOR</Text>
            <Text style={[s.roleTitle, { color: themeColors.text }]}>{role.title}</Text>
            {role.team ? (
              <Text style={[s.roleMeta, { color: themeColors.textTertiary }]}>{role.team} · {role.type} · {role.location}</Text>
            ) : (
              <Text style={[s.roleMeta, { color: themeColors.textTertiary }]}>Tell us what you'd want to build at Prayana.</Text>
            )}
          </View>

          {serverError ? (
            <View style={[s.alert, { backgroundColor: isDarkMode ? 'rgba(244,63,94,0.12)' : '#fff1f2', borderColor: isDarkMode ? 'rgba(244,63,94,0.3)' : '#fecdd3' }]}>
              <Ionicons name="alert-circle" size={16} color="#e11d48" />
              <Text style={s.alertText}>{serverError}</Text>
            </View>
          ) : null}

          <Text style={[s.section, { color: themeColors.text }]}>About you</Text>
          <Field label="Full name" required value={form.fullName} onChangeText={(v) => setField('fullName', v)} placeholder="Your name" autoComplete="name" textContentType="name" error={errors.fullName} />
          <Field label="Email" required value={form.email} onChangeText={(v) => setField('email', v)} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" error={errors.email} />
          <Field label="Phone" required value={form.phone} onChangeText={(v) => setField('phone', v)} placeholder="9876543210" keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={16} error={errors.phone} />
          <Field label="Current city" value={form.location} onChangeText={(v) => setField('location', v)} placeholder="Bengaluru" />
          <View style={s.row2}>
            <View style={{ flex: 1 }}>
              <Field label="Experience" value={form.experience} onChangeText={(v) => setField('experience', v)} placeholder="Fresher / 1 year" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Available from" value={form.availableFrom} onChangeText={(v) => setField('availableFrom', v)} placeholder="Immediately" />
            </View>
          </View>
          <Field label="LinkedIn" value={form.linkedinUrl} onChangeText={(v) => setField('linkedinUrl', v)} placeholder="linkedin.com/in/you" keyboardType="url" autoCapitalize="none" autoCorrect={false} />
          <Field label="Portfolio / other link" value={form.portfolioUrl} onChangeText={(v) => setField('portfolioUrl', v)} placeholder="Optional" keyboardType="url" autoCapitalize="none" autoCorrect={false} />

          {role.screeningQuestion || role.productQuestion ? (
            <Text style={[s.section, { color: themeColors.text }]}>A couple of questions</Text>
          ) : null}
          {role.screeningQuestion ? (
            <Field label={role.screeningQuestion} required multiline value={form.screeningAnswer} onChangeText={(v) => setField('screeningAnswer', v)} placeholder="Keep it short and specific." maxLength={MAX_ANSWER} error={errors.screeningAnswer} />
          ) : null}
          {role.productQuestion ? (
            <Field label={role.productQuestion} required multiline value={form.productAnswer} onChangeText={(v) => setField('productAnswer', v)} placeholder="Be specific — vague answers don't make the shortlist." maxLength={MAX_ANSWER} error={errors.productAnswer} />
          ) : null}

          <Field label="Anything else? (optional)" multiline value={form.coverNote} onChangeText={(v) => setField('coverNote', v)} placeholder="Anything you'd want us to know." maxLength={MAX_ANSWER} />

          {/* Resume upload slot — see TODO(resume) in submit(). */}
          <View style={[s.resume, { borderColor: isDarkMode ? '#33333F' : '#d4d4d4' }]}>
            <Ionicons name="document-attach-outline" size={20} color={themeColors.textTertiary} />
            <View style={{ flex: 1 }}>
              <Text style={[s.resumeTitle, { color: themeColors.text }]}>Resume (optional)</Text>
              <Text style={[s.resumeText, { color: themeColors.textTertiary }]}>
                Uploading from the app is coming soon. Add a LinkedIn or portfolio link above, or apply on prayanaai.com/careers to attach a file.
              </Text>
            </View>
          </View>

          <Text style={[s.fine, { color: themeColors.textTertiary }]}>
            We use your details only to assess this application. You can view or withdraw it any time from My applications.
          </Text>
        </ScrollView>

        <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) + 4, backgroundColor: themeColors.background, borderTopColor: line }]}>
          <Pressable
            onPress={submit}
            disabled={submitting}
            style={({ pressed }) => [s.submit, submitting && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            <Text style={s.submitText}>{submitting ? 'Submitting…' : 'Submit application'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  body: { padding: 16, paddingBottom: 32, gap: 14 },
  roleCard: { borderWidth: 1, borderRadius: 18, padding: 16 },
  roleEyebrow: { color: TEAL, fontSize: 10.5, fontWeight: '800', letterSpacing: 1.4 },
  roleTitle: { fontSize: 19, fontWeight: '900', marginTop: 4 },
  roleMeta: { fontSize: 12.5, marginTop: 3 },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 14, padding: 12 },
  alertText: { flex: 1, color: '#e11d48', fontSize: 13.5, lineHeight: 19, fontWeight: '600' },
  section: { fontSize: 16, fontWeight: '900', marginTop: 6 },
  label: { fontSize: 12.5, fontWeight: '700', lineHeight: 18 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 13 : 10, fontSize: 15 },
  textarea: { minHeight: 110, paddingTop: 12 },
  error: { color: '#e11d48', fontSize: 12, fontWeight: '600' },
  row2: { flexDirection: 'row', gap: 10 },
  resume: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 16, padding: 14 },
  resumeTitle: { fontSize: 14, fontWeight: '800' },
  resumeText: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  fine: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15 },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  doneIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  doneTitle: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  doneText: { fontSize: 14.5, lineHeight: 21, textAlign: 'center' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: TEAL, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 13, marginTop: 12 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  secondaryText: { fontSize: 15, fontWeight: '700' },
});
