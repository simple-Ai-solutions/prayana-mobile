import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Avatar,
  Card,
  colors,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
  shadow,
  useTheme,
} from '@prayana/shared-ui';
import { useAuth } from '@prayana/shared-hooks';
import { updateUserProfile } from '@prayana/shared-services';
import Toast from 'react-native-toast-message';

// ============================================================
// FORM FIELD COMPONENT
// ============================================================
function FormField({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  helperText,
  error,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  helperText?: string;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  const { themeColors } = useTheme();

  return (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{label}</Text>
      <View
        style={[
          styles.fieldInputContainer,
          { backgroundColor: themeColors.inputBackground, borderColor: themeColors.border },
          focused && [styles.fieldInputFocused, { backgroundColor: themeColors.card }],
          !editable && [styles.fieldInputDisabled, { backgroundColor: themeColors.backgroundSecondary }],
          error ? styles.fieldInputError : null,
        ]}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            error
              ? '#ef4444'
              : focused
                ? colors.primary[500]
                : themeColors.textTertiary
          }
        />
        <TextInput
          style={[styles.fieldInput, { color: themeColors.text }, !editable && [styles.fieldInputTextDisabled, { color: themeColors.textSecondary }]]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {!editable && (
          <Ionicons name="lock-closed-outline" size={16} color={themeColors.textTertiary} />
        )}
      </View>
      {error ? (
        <Text style={styles.fieldError}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.fieldHelper, { color: themeColors.textTertiary }]}>{helperText}</Text>
      ) : null}
    </View>
  );
}

// ============================================================
// EDIT PROFILE SCREEN
// ============================================================
export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { themeColors } = useTheme();

  // --- State ---
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // --- Initial values (to track changes) ---
  const [initialValues, setInitialValues] = useState({
    displayName: '',
    phone: '',
  });

  // ============================================================
  // LOAD USER DATA
  // ============================================================
  useEffect(() => {
    if (user) {
      const name = user.displayName || '';
      const mail = user.email || '';
      const ph = user.phoneNumber || '';

      setDisplayName(name);
      setEmail(mail);
      setPhone(ph);
      setInitialValues({ displayName: name, phone: ph });
    }
  }, [user]);

  // ============================================================
  // TRACK CHANGES
  // ============================================================
  useEffect(() => {
    const changed =
      displayName !== initialValues.displayName ||
      phone !== initialValues.phone;
    setHasChanges(changed);
  }, [displayName, phone, initialValues]);

  // ============================================================
  // VALIDATE
  // ============================================================
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Name must be at least 2 characters';
    } else if (displayName.trim().length > 50) {
      newErrors.displayName = 'Name must be under 50 characters';
    }

    if (phone.trim()) {
      const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
      if (phoneClean.length < 10) {
        newErrors.phone = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [displayName, phone]);

  // ============================================================
  // HANDLE SAVE
  // ============================================================
  const handleSave = useCallback(async () => {
    Keyboard.dismiss();

    if (!validate()) return;

    if (!user?.uid) {
      Toast.show({
        type: 'error',
        text1: 'Not signed in',
        text2: 'Please sign in to update your profile.',
      });
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        phoneNumber: phone.trim() || undefined,
      });

      setInitialValues({
        displayName: displayName.trim(),
        phone: phone.trim(),
      });
      setHasChanges(false);

      Toast.show({
        type: 'success',
        text1: 'Profile updated',
        text2: 'Your changes have been saved successfully.',
      });

      // Navigate back after a brief delay
      setTimeout(() => {
        router.back();
      }, 1200);
    } catch (err: any) {
      console.warn('[EditProfile] Save failed:', err.message);
      Toast.show({
        type: 'error',
        text1: 'Update failed',
        text2: err.message || 'Could not save your profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  }, [user?.uid, displayName, phone, validate, router]);

  // ============================================================
  // DISPLAY VALUES
  // ============================================================
  const avatarName = displayName || user?.displayName || 'User';
  const avatarPhoto = user?.photoURL || undefined;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ====== AVATAR SECTION ====== */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Avatar
              name={avatarName}
              uri={avatarPhoto}
              size={96}
            />
            <View style={[styles.cameraIconOverlay, { borderColor: themeColors.background }]}>
              <LinearGradient
                colors={[colors.primary[500], colors.primary[600]]}
                style={styles.cameraIconBg}
              >
                <Ionicons name="camera" size={16} color="#ffffff" />
              </LinearGradient>
            </View>
          </View>
          <Text style={[styles.avatarHint, { color: themeColors.textSecondary }]}>Tap to change photo</Text>
        </View>

        {/* ====== FORM FIELDS ====== */}
        <Card style={[styles.formCard, { backgroundColor: themeColors.card }]}>
          <FormField
            label="Display Name"
            icon="person-outline"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              if (errors.displayName) {
                setErrors((prev) => ({ ...prev, displayName: '' }));
              }
            }}
            placeholder="Enter your name"
            autoCapitalize="words"
            maxLength={50}
            error={errors.displayName}
          />

          <FormField
            label="Email"
            icon="mail-outline"
            value={email}
            editable={false}
            placeholder="No email linked"
            helperText="Email cannot be changed here. Contact support for assistance."
          />

          <FormField
            label="Phone Number"
            icon="call-outline"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              if (errors.phone) {
                setErrors((prev) => ({ ...prev, phone: '' }));
              }
            }}
            placeholder="Enter your phone number"
            keyboardType="phone-pad"
            maxLength={15}
            error={errors.phone}
            helperText="Used for booking confirmations and trip alerts."
          />
        </Card>

        {/* ====== SAVE BUTTON ====== */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges || saving) && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                hasChanges && !saving
                  ? [colors.primary[500], colors.primary[600]]
                  : [colors.gray[300], colors.gray[400]]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveButtonGradient}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              )}
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          {!hasChanges && (
            <Text style={[styles.noChangesText, { color: themeColors.textTertiary }]}>No changes to save</Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// STYLES
// ============================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollContent: {
    paddingBottom: spacing['3xl'],
  },

  // --- Avatar Section ---
  avatarSection: {
    alignItems: 'center',
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
  },
  cameraIconOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.backgroundSecondary,
  },
  cameraIconBg: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHint: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },

  // --- Form Card ---
  formCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },

  // --- Form Field ---
  fieldContainer: {
    marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  fieldInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    height: 52,
    gap: spacing.sm,
  },
  fieldInputFocused: {
    borderColor: colors.primary[500],
    backgroundColor: colors.surface,
  },
  fieldInputDisabled: {
    backgroundColor: colors.gray[50],
    opacity: 0.8,
  },
  fieldInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  fieldInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    paddingVertical: 0,
  },
  fieldInputTextDisabled: {
    color: colors.textSecondary,
  },
  fieldHelper: {
    fontSize: fontSize.xs,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
  fieldError: {
    fontSize: fontSize.xs,
    color: '#ef4444',
    marginTop: spacing.xs,
    fontWeight: fontWeight.medium,
  },

  // --- Save Section ---
  saveSection: {
    marginHorizontal: spacing.xl,
    alignItems: 'center',
  },
  saveButton: {
    width: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadow.md,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#ffffff',
  },
  noChangesText: {
    fontSize: fontSize.sm,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});
