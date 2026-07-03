// hooks/useFieldPresence.js - Emit editing presence for a specific field
import { useCallback, useRef } from "react";
import { socketService } from "@prayana/shared-services";
import { useCreateTripStore } from "@prayana/shared-stores";

/**
 * useFieldPresence - Call onFocus/onBlur on any input to broadcast
 * who is currently editing that field to all collaborators.
 *
 * @param {string} fieldName  - Unique field identifier e.g. "name", "day-0-activity-2"
 * @returns {{ onFocus, onBlur }}  - Spread these onto the input element
 *
 * Usage:
 *   const presence = useFieldPresence("name");
 *   <input {...presence} ... />
 *   <FieldPresenceIndicator fieldName="name" />
 */
export function useFieldPresence(fieldName) {
  const { activeTripId } = useCreateTripStore((s) => ({
    activeTripId: s.tripId || s.tempTripId,
  }));

  const debounceRef = useRef(null);

  const onFocus = useCallback(() => {
    if (!activeTripId || !fieldName) return;
    socketService.notifyEditing(activeTripId, fieldName);
  }, [activeTripId, fieldName]);

  const onBlur = useCallback(() => {
    if (!activeTripId || !fieldName) return;
    // Small debounce so tabbing between fields doesn't flicker
    debounceRef.current = setTimeout(() => {
      socketService.stopEditing(activeTripId);
    }, 300);
  }, [activeTripId, fieldName]);

  // Cancel pending stop-edit if user refocuses quickly
  const onFocusWithCancel = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onFocus();
  }, [onFocus]);

  return { onFocus: onFocusWithCancel, onBlur };
}
