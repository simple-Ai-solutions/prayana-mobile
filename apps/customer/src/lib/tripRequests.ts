// Trip changes a traveller asks for on a package page — activities to add or
// swap, and meals to add or drop — carried to checkout and sent with the
// booking for the team to confirm.
//
// Deliberately a REQUEST, not a price: the booking server does not yet price
// customisations itself (it would trust any surcharge a client sent), so the
// app never adds these to what is charged. The team confirms each change and
// any difference in price before travel. A hotel change is not here: it is a
// switch of package option, which the server does price.
import { create } from 'zustand';

export type AddedActivity = { day: number; title: string; city?: string; externalId?: string; fromPrice?: number };
export type SwappedActivity = { day: number; from: string; to: string };
export type MealKey = 'breakfast' | 'lunch' | 'dinner';

type State = {
  packageId: string | null;
  added: AddedActivity[];
  swapped: SwappedActivity[];
  /** day -> meal -> wanted (true = add, false = drop), only where it differs. */
  meals: Record<number, Partial<Record<MealKey, boolean>>>;
  start: (packageId: string) => void;
  addActivity: (a: AddedActivity) => void;
  removeAdded: (day: number, title: string) => void;
  swapActivity: (s: SwappedActivity) => void;
  undoSwap: (day: number, from: string) => void;
  setMeal: (day: number, meal: MealKey, wanted: boolean, original: boolean) => void;
  reset: () => void;
};

const empty = { added: [], swapped: [], meals: {} };

export const useTripRequests = create<State>((set) => ({
  packageId: null,
  ...empty,
  // Requests belong to one package; opening another starts afresh.
  start: (packageId) => set((s) => (s.packageId === packageId ? s : { packageId, ...empty })),
  addActivity: (a) => set((s) => ({
    added: s.added.some((x) => x.day === a.day && x.title === a.title) ? s.added : [...s.added, a],
  })),
  removeAdded: (day, title) => set((s) => ({ added: s.added.filter((x) => !(x.day === day && x.title === title)) })),
  swapActivity: (w) => set((s) => ({
    swapped: [...s.swapped.filter((x) => !(x.day === w.day && x.from === w.from)), w],
  })),
  undoSwap: (day, from) => set((s) => ({ swapped: s.swapped.filter((x) => !(x.day === day && x.from === from)) })),
  setMeal: (day, meal, wanted, original) => set((s) => {
    const dayMeals = { ...(s.meals[day] || {}) };
    if (wanted === original) delete dayMeals[meal];
    else dayMeals[meal] = wanted;
    const meals = { ...s.meals, [day]: dayMeals };
    if (!Object.keys(dayMeals).length) delete meals[day];
    return { meals };
  }),
  reset: () => set({ ...empty }),
}));

/** One line per requested change, in day order, for summaries and the team. */
export function requestLines(s: Pick<State, 'added' | 'swapped' | 'meals'>): string[] {
  const lines: { day: number; text: string }[] = [];
  s.swapped.forEach((w) => lines.push({ day: w.day, text: `Day ${w.day}: swap "${w.from}" for "${w.to}"` }));
  s.added.forEach((a) => lines.push({
    day: a.day,
    text: `Day ${a.day}: add "${a.title}"${a.fromPrice ? ` (listed from ₹${Math.round(a.fromPrice).toLocaleString('en-IN')} per person)` : ''}`,
  }));
  Object.entries(s.meals).forEach(([d, m]) => Object.entries(m).forEach(([meal, wanted]) => {
    lines.push({ day: Number(d), text: `Day ${d}: ${wanted ? 'add' : 'skip'} ${meal}` });
  }));
  return lines.sort((a, b) => a.day - b.day).map((l) => l.text);
}

export const requestCount = (s: Pick<State, 'added' | 'swapped' | 'meals'>) =>
  s.added.length + s.swapped.length + Object.values(s.meals).reduce((n, m) => n + Object.keys(m).length, 0);
