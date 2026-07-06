import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  Button,
  EmptyState,
  LoadingSpinner,
  colors,
  spacing,
  fontSize,
  fontWeight,
  useTheme,
} from '@prayana/shared-ui';
import { packageAPI } from '@prayana/shared-services';
import PackageForm, {
  packageToFormValues,
  PackageFormValues,
} from './_components/PackageForm';

export default function EditPackageScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<PackageFormValues | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setError('Missing package id');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await packageAPI.getMyPackageById(String(id));
      const pkg = res?.data ?? res?.package ?? res;
      if (!pkg || (!pkg._id && !pkg.id && !pkg.title)) {
        setError('Package not found');
      } else {
        setValues(packageToFormValues(pkg));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load package');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Package</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <LoadingSpinner message="Loading package..." />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !values) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Edit Package</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.center}>
          <EmptyState
            icon={<Ionicons name="alert-circle-outline" size={56} color={colors.gray[300]} />}
            title="Couldn't load package"
            description={error || 'Please try again.'}
          />
          <Button title="Retry" onPress={load} variant="outline" size="md" style={styles.retryBtn} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <PackageForm
      mode="edit"
      initialValues={values}
      headerTitle="Edit Package"
      packageId={String(id)}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: { width: 36 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  retryBtn: { marginTop: spacing.lg, minWidth: 140 },
});
