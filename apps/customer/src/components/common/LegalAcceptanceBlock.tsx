// LegalAcceptanceBlock — RN port of components/checkout/LegalAcceptanceBlock.jsx.
//
// The server REJECTS a booking whose payload lacks acceptedLegalDocs covering
// the registry's required set at current versions ("Required legal acceptances
// are missing"). Mobile never collected them, so every activity booking 400'd
// before payment could start — the actual reason "no payment" on activities.
//
// Same UX as the web: ONE checkbox accepts the bundled docs (each linked), plus
// a separate explicit checkbox when the listing requires a safety waiver.
import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Linking } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, colors, spacing, fontSize, fontWeight, borderRadius } from '@prayana/shared-ui';
import {
  AcceptedLegalDoc,
  RequiredLegalDoc,
  requiredDocsFor,
} from '../../lib/legalRegistry';

const LEGAL_BASE = 'https://prayanaai.com';

interface Props {
  /** Registry context, e.g. "booking:activity". */
  vertical: 'activity' | 'package' | 'transport_self_drive' | 'transport_chauffeur';
  waiverRequired?: boolean;
  value: AcceptedLegalDoc[];
  onChange: (docs: AcceptedLegalDoc[]) => void;
}

export function isAcceptanceComplete(
  value: AcceptedLegalDoc[],
  vertical: Props['vertical'],
  flags: { waiverRequired?: boolean } = {},
): boolean {
  const required = requiredDocsFor(`booking:${vertical}`, flags);
  const have = new Map(value.map((d) => [d.slug, d.version]));
  return required.every((r) => have.get(r.slug) === r.version);
}

export const LegalAcceptanceBlock: React.FC<Props> = ({
  vertical,
  waiverRequired = false,
  value,
  onChange,
}) => {
  const { themeColors } = useTheme();

  const docs = useMemo(
    () => requiredDocsFor(`booking:${vertical}`, { waiverRequired }),
    [vertical, waiverRequired],
  );
  const bundled = docs.filter((d) => !d.isWaiver);
  const waiver = docs.find((d) => d.isWaiver);

  // Prune acceptances that are no longer required (mirrors the web).
  useEffect(() => {
    const required = new Set(docs.map((d) => d.slug));
    const pruned = value.filter((d) => required.has(d.slug));
    if (pruned.length !== value.length) onChange(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs.map((d) => d.slug).join(',')]);

  const accepted = useMemo(() => new Set(value.map((d) => d.slug)), [value]);
  const bundleChecked = bundled.length > 0 && bundled.every((d) => accepted.has(d.slug));
  const waiverChecked = !!waiver && accepted.has(waiver.slug);

  const toggleBundle = () => {
    const bundledSlugs = new Set(bundled.map((d) => d.slug));
    if (bundleChecked) {
      onChange(value.filter((d) => !bundledSlugs.has(d.slug)));
    } else {
      const have = new Set(value.map((d) => d.slug));
      onChange([
        ...value,
        ...bundled.filter((d) => !have.has(d.slug)).map((d) => ({ slug: d.slug, version: d.version })),
      ]);
    }
  };

  const toggleWaiver = () => {
    if (!waiver) return;
    onChange(
      waiverChecked
        ? value.filter((d) => d.slug !== waiver.slug)
        : [...value, { slug: waiver.slug, version: waiver.version }],
    );
  };

  const openDoc = (d: RequiredLegalDoc) => {
    Linking.openURL(`${LEGAL_BASE}${d.href}`).catch(() => {});
  };

  const CheckRow = ({
    checked,
    onPress,
    children,
  }: {
    checked: boolean;
    onPress: () => void;
    children: React.ReactNode;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      style={styles.row}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.box,
          {
            borderColor: checked ? colors.primary[500] : themeColors.border,
            backgroundColor: checked ? colors.primary[500] : 'transparent',
          },
        ]}
      >
        {checked && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
      </View>
      <View style={styles.rowBody}>{children}</View>
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
    >
      <CheckRow checked={bundleChecked} onPress={toggleBundle}>
        <Text style={[styles.text, { color: themeColors.textSecondary }]}>
          I agree to the{' '}
          {bundled.map((d, i) => (
            <Text key={d.slug}>
              <Text style={styles.link} onPress={() => openDoc(d)}>
                {d.title}
              </Text>
              {i < bundled.length - 2 ? ', ' : i === bundled.length - 2 ? ' and ' : ''}
            </Text>
          ))}
          .
        </Text>
      </CheckRow>

      {!!waiver && (
        <CheckRow checked={waiverChecked} onPress={toggleWaiver}>
          <Text style={[styles.text, { color: themeColors.textSecondary }]}>
            I have read and accept the{' '}
            <Text style={styles.link} onPress={() => openDoc(waiver)}>
              {waiver.title}
            </Text>{' '}
            for this activity.
          </Text>
        </CheckRow>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  box: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowBody: { flex: 1 },
  text: { fontSize: fontSize.xs, lineHeight: 18 },
  link: { color: colors.primary[500], fontWeight: fontWeight.semibold },
});

export default LegalAcceptanceBlock;
