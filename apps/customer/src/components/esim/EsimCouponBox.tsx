// "Have a promo code?" on the eSIM payment step, ported from the web's
// CouponAndBankOffers as used by app/esim/checkout/page.jsx: a code field with
// Apply, a one-tap chip for the promo the admin is currently running, and once
// applied, the code with what it saves and a way to remove it.
//
// What this shows is a preview from /coupons/validate. The server checks the
// code again when the order is created and charges what it works out.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@prayana/shared-ui';
import { esimAPI } from '@prayana/shared-services';
import { ESIM_RED, inr } from './EsimPass';

export type AppliedCoupon = { code: string; discount: number };

export function EsimCouponBox({ orderAmount, productId, userId, applied, onApply, onRemove }: {
  orderAmount: number;
  productId?: string;
  userId?: string;
  applied: AppliedCoupon | null;
  onApply: (c: AppliedCoupon) => void;
  onRemove: () => void;
}) {
  const { themeColors, isDarkMode } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [promo, setPromo] = useState<{ code: string; headline?: string; displayPercent?: number } | null>(null);

  useEffect(() => {
    let alive = true;
    esimAPI.getActivePromo().then((p: any) => { if (alive) setPromo(p); });
    return () => { alive = false; };
  }, []);

  const apply = async (raw: string) => {
    const c = raw.trim().toUpperCase();
    if (!c || busy) return;
    setBusy(true);
    setError('');
    try {
      const res: any = await esimAPI.validateCoupon({ code: c, userId, orderAmount, productId });
      if (res?.success && res.data?.valid) {
        onApply({ code: res.data.code || c, discount: Math.round(res.data.discount || 0) });
        setCode('');
      } else {
        setError(res?.data?.reason || res?.message || "This code can't be applied to this plan.");
      }
    } catch (e: any) {
      setError(e?.data?.data?.reason || e?.data?.message || "This code can't be applied to this plan.");
    } finally {
      setBusy(false);
    }
  };

  const border = isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';

  return (
    <View style={[s.box, { backgroundColor: themeColors.surface, borderColor: border }]}>
      <View style={s.head}>
        <Ionicons name="pricetag-outline" size={16} color={ESIM_RED} />
        <Text style={[s.title, { color: themeColors.text }]}>Have a promo code?</Text>
      </View>

      {applied ? (
        <View style={s.applied}>
          <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
          <View style={{ flex: 1 }}>
            <Text style={s.appliedCode}>{applied.code} applied</Text>
            <Text style={s.appliedSave}>
              {applied.discount > 0 ? `You save ${inr(applied.discount)}` : 'Discount confirmed at payment'}
            </Text>
          </View>
          <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove promo code">
            <Text style={s.remove}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[s.row, { borderColor: error ? ESIM_RED : border }]}>
            <TextInput
              value={code}
              onChangeText={(t) => { setCode(t); if (error) setError(''); }}
              placeholder="Enter code"
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => apply(code)}
              style={[s.input, { color: themeColors.text }]}
            />
            <Pressable
              onPress={() => apply(code)}
              disabled={!code.trim() || busy}
              style={[s.applyBtn, (!code.trim() || busy) && { opacity: 0.5 }]}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.applyText}>Apply</Text>}
            </Pressable>
          </View>
          {error ? <Text style={s.error}>{error}</Text> : null}

          {promo?.code ? (
            <Pressable onPress={() => apply(promo.code)} style={s.suggest} accessibilityRole="button">
              <Ionicons name="gift-outline" size={14} color={ESIM_RED} />
              <Text style={[s.suggestText, { color: themeColors.text }]} numberOfLines={2}>
                {promo.headline || `${promo.displayPercent}% off your first travel eSIM`}
              </Text>
              <View style={s.suggestCode}><Text style={s.suggestCodeText}>{promo.code}</Text></View>
            </Pressable>
          ) : null}
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14.5, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingLeft: 12, overflow: 'hidden' },
  input: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: 1, paddingVertical: 10 },
  applyBtn: { backgroundColor: ESIM_RED, paddingHorizontal: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  applyText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  error: { color: ESIM_RED, fontSize: 12.5 },
  suggest: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(230,20,23,0.45)',
    backgroundColor: 'rgba(230,20,23,0.05)', borderRadius: 12, padding: 10,
  },
  suggestText: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  suggestCode: { backgroundColor: ESIM_RED, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  suggestCodeText: { color: '#fff', fontSize: 11.5, fontWeight: '800', letterSpacing: 0.8 },
  applied: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f0fdf4', borderRadius: 12, padding: 10 },
  appliedCode: { color: '#15803d', fontSize: 14, fontWeight: '800' },
  appliedSave: { color: '#16a34a', fontSize: 12.5, marginTop: 1 },
  remove: { color: ESIM_RED, fontSize: 13, fontWeight: '700' },
});
