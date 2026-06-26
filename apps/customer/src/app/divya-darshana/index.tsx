// Divya Darshana — pilgrimage packages (helicopter + land tours).
// DEFERRED: the backend package API for this feature is not yet confirmed.
// Shows a "Coming Soon" placeholder so the home "More" sheet doesn't dead-end.
// TODO(backend): wire to /divya-darshana/packages (or equivalent) once available.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius, Button } from '@prayana/shared-ui';

export default function DivyaDarshanaScreen() {
  const { themeColors } = useTheme();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronLeft size={26} color={themeColors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>Divya Darshana</Text>
        <View style={{ width: 26 }} />
      </View>
      <View style={styles.center}>
        <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.iconCircle}>
          <Sparkles size={36} color="#fff" />
        </LinearGradient>
        <Text style={[styles.title, { color: themeColors.text }]}>Pilgrimage Packages</Text>
        <Text style={[styles.text, { color: themeColors.textSecondary }]}>
          Helicopter & land tours to India’s most sacred temples — Kedarnath, Badrinath, Vaishno Devi and more. Coming soon to the app.
        </Text>
        <Button title="Explore Trip Planner" onPress={() => router.push('/quick-itinerary' as any)} variant="primary" style={{ marginTop: spacing.lg }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  iconBtn: { padding: spacing.xs },
  headerTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  iconCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, marginTop: spacing.md },
  text: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
});
