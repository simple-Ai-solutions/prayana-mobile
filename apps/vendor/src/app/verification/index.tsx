import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ui';
import { fontSize, fontWeight, spacing } from '../../theme/vendorColors';
import { VerifyIdentity, VerifyIdentityHandle } from '../../components/VerifyIdentity';

// The standalone identity/KYC screen (reached from the More menu). It supplies
// the top bar + pull-to-refresh; VerifyIdentity renders the full body and is the
// same component the onboarding wizard's final step uses.
export default function VerificationScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();

  const identityRef = useRef<VerifyIdentityHandle>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await identityRef.current?.reload();
    setRefreshing(false);
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <View style={[styles.topBar, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.topBarTitle, { color: themeColors.text }]}>Verify identity</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <VerifyIdentity ref={identityRef} variant="standalone" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  topBarTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold },
  scrollContent: { paddingBottom: spacing['3xl'] },
});
