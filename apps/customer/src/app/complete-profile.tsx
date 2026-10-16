// /complete-profile — the one-time "What's your name?" step.
//
// Phone-OTP signups arrive without a name (and older accounts carry
// placeholders like "User 1234"). The root NameGate, and phone-login for a
// brand-new number, send those users here. Mobile counterpart of the web's
// ProfileSetupModal: mandatory (no back), but the user can log out instead.
//
// Lives outside (auth) on purpose — AuthGuard pushes signed-in users out of
// that group.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { updateProfile } from 'firebase/auth';
import { Button } from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { auth } from '@prayana/shared-services/src/firebase';
import { updateUserProfile } from '@prayana/shared-services';
import { markNameComplete, validateName, MAX_NAME_LENGTH } from '../lib/userName';

export default function CompleteProfileScreen() {
  const { user, logout } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Android hardware back would otherwise drop the user onto the tabs with a
  // nameless account; swallow it while this screen is focused.
  useFocusEffect(
    React.useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, []),
  );

  const handleSave = async () => {
    const check = validateName(name);
    if (!check.valid) {
      setError(check.message || 'Please enter your name.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res: any = await updateUserProfile({ name: check.value });
      if (res && res.success === false) {
        setError(res.message || 'Could not save your name. Please try again.');
        return;
      }
      // Keep Firebase's displayName in step so screens reading user.displayName
      // (header, profile tab) show the new name without a reload.
      if (auth.currentUser) {
        try { await updateProfile(auth.currentUser, { displayName: check.value }); } catch {}
      }
      if (user?.uid) markNameComplete(user.uid);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err?.message || 'Could not save your name. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await logout?.(); } catch {}
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerSection}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>👋</Text>
            </View>
            <Text style={styles.title}>What's your name?</Text>
            <Text style={styles.subtitle}>
              We'll use it on your bookings and tickets, and so guides know who to look for.
            </Text>
          </View>

          <View style={styles.formSection}>
            <Text style={styles.inputLabel}>Full name</Text>
            <View style={[styles.inputWrapper, error ? styles.inputWrapperError : null]}>
              <RNTextInput
                style={styles.input}
                placeholder="e.g. Priya Sharma"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={(t) => { setName(t); if (error) setError(null); }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                autoFocus
                maxLength={MAX_NAME_LENGTH}
                returnKeyType="done"
                onSubmitEditing={() => { void handleSave(); }}
                editable={!saving}
              />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Button
              title="Continue"
              onPress={() => { void handleSave(); }}
              variant="primary"
              size="lg"
              fullWidth
              loading={saving}
              disabled={!name.trim()}
              style={styles.continueButton}
            />

            <TouchableOpacity style={styles.logoutLink} onPress={handleLogout} disabled={saving}>
              <Text style={styles.logoutText}>Not you? Log out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#f0fdfc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#99f6ef',
  },
  iconText: {
    fontSize: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  formSection: {
    marginBottom: 32,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  inputWrapper: {
    borderWidth: 1.5,
    borderColor: '#e5e5e5',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  inputWrapperError: {
    borderColor: '#ef4444',
  },
  input: {
    fontSize: 15,
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    marginTop: 6,
  },
  continueButton: {
    marginTop: 24,
  },
  logoutLink: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
});
