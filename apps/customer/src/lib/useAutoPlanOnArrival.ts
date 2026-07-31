// useAutoPlanOnArrival — the mobile equivalent of the web's AutoPlanOnArrival.
//
// The web auto-builds EVERY empty day with AI the first time you land on the Day
// Planner (no button). Mobile only had a manual button, which is why it felt
// like the app "wasn't getting AI suggestions like the web". This hook restores
// that behaviour: once, when the planner mounts with days + destinations but
// every day empty, it generates each day in turn (accumulating used names so
// nothing repeats) and writes ~2 picks per time slot into the store.
//
// It is deliberately conservative:
//   • runs at most once per screen mount (guarded by a ref)
//   • only fires when ALL days are empty (never overwrites the user's work)
//   • adds a bounded number of activities per slot, leaving room to add more
//   • reports progress via the callback so the UI can show per-day spinners

import { useEffect, useRef } from 'react';
import { generateAiDay, suggestionToActivity, SLOTS } from './aiDayGenerator';

const PICKS_PER_SLOT = 2;

interface Params {
  enabled: boolean;
  days: any[];
  getDestinationForDay: (index: number) => any;
  tripType?: string;
  budget?: string;
  addActivity: (dayIndex: number, activity: any) => void;
  /** Called as each day starts/finishes so the screen can show spinners. */
  onDayStatus?: (dayIndex: number, status: 'building' | 'done' | 'error') => void;
  onComplete?: () => void;
}

export function useAutoPlanOnArrival({
  enabled,
  days,
  getDestinationForDay,
  tripType,
  budget,
  addActivity,
  onDayStatus,
  onComplete,
}: Params) {
  const ranRef = useRef(false);

  useEffect(() => {
    if (!enabled || ranRef.current) return;
    if (!days?.length) return;

    // Only auto-plan when every day is empty — never clobber existing work.
    const allEmpty = days.every((d) => !(d.activities?.length > 0));
    if (!allEmpty) return;

    // Need at least one destination to plan against.
    const anyDestination = days.some((_, i) => !!getDestinationForDay(i));
    if (!anyDestination) return;

    ranRef.current = true;
    let cancelled = false;

    (async () => {
      const usedNames: string[] = [];
      for (let i = 0; i < days.length; i++) {
        if (cancelled) return;
        const dest = getDestinationForDay(i);
        if (!dest?.name) {
          onDayStatus?.(i, 'done');
          continue;
        }
        onDayStatus?.(i, 'building');
        try {
          const suggestions = await generateAiDay({
            destinationName: dest.name,
            dayNumber: days[i].dayNumber ?? i + 1,
            tripType,
            budget,
            excludeNames: usedNames,
          });
          if (cancelled) return;

          // Take up to PICKS_PER_SLOT per slot so a day is filled but not stuffed.
          for (const slot of SLOTS) {
            const inSlot = suggestions.filter((s) => s.timeSlot === slot).slice(0, PICKS_PER_SLOT);
            for (const s of inSlot) {
              addActivity(i, suggestionToActivity(s));
              usedNames.push(s.name);
            }
          }
          onDayStatus?.(i, 'done');
        } catch {
          if (cancelled) return;
          onDayStatus?.(i, 'error');
          // Keep going — one day's failure shouldn't abort the whole trip.
        }
      }
      if (!cancelled) onComplete?.();
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally run-once: deps captured on the first eligible render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, days?.length]);
}
