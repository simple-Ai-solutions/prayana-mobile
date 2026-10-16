// Phone fields accept digits only. keyboardType="phone-pad" shows a number pad
// but doesn't stop letters arriving by paste, autofill or a hardware keyboard,
// so every phone input filters its text through this.
//
// `allowPlus` keeps a single leading "+" for fields that take a full
// international number ("+91 98765 43210"); fields with a separate country
// picker pass digits only.

const MAX_DIGITS = 15; // E.164 limit

export function cleanPhone(text: string, { allowPlus = false } = {}): string {
  const plus = allowPlus && text.trimStart().startsWith('+') ? '+' : '';
  return plus + text.replace(/\D/g, '').slice(0, MAX_DIGITS);
}

/** onChangeText handler: `onChangeText={phoneChange(setPhone)}`. */
export const phoneChange =
  (set: (v: string) => void, opts?: { allowPlus?: boolean }) =>
  (text: string) => set(cleanPhone(text, opts));
