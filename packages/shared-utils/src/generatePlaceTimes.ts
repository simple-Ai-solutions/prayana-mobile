// @ts-nocheck — pure JS utility; types deliberately deferred.
// utils/generatePlaceTimes.js
// Simple utility to assign realistic times to places

/**
 * Assigns hardcoded times to places in a realistic schedule
 * Automatically adds meal breaks at lunch (1 PM) and dinner (7:30 PM)
 *
 * @param {Array} places - Array of place objects from API
 * @returns {Array} - Places with time and mealBreak fields added
 */
export function assignPlaceTimes(places) {
  if (!places || places.length === 0) return [];

  // Hardcoded realistic schedule for a day of sightseeing
  const schedule = [
    { time: "09:00 AM" },
    { time: "11:00 AM" },
    { time: "01:00 PM", meal: { icon: '🍽️', label: 'Lunch Break', hint: 'Time to refuel and try local cuisine!' } },
    { time: "02:30 PM" },
    { time: "04:30 PM" },
    { time: "06:00 PM" },
    { time: "07:30 PM", meal: { icon: '🍴', label: 'Dinner Time', hint: 'Enjoy a relaxing dinner after the day!' } },
    { time: "08:30 PM" },
  ];

  // Assign times sequentially to each place
  return places.map((place, index) => {
    // Use schedule slot if available, otherwise repeat last time
    const slot = schedule[index] || schedule[schedule.length - 1];

    return {
      ...place,
      time: slot.time,
      mealBreak: slot.meal || null
    };
  });
}

/**
 * Alternative: Custom schedule times
 * Use this if you want different start time or intervals
 *
 * @param {Array} places - Array of place objects
 * @param {Array} customTimes - Array of time strings like ["09:00 AM", "11:00 AM", ...]
 * @returns {Array} - Places with times assigned
 */
export function assignCustomTimes(places, customTimes) {
  if (!places || places.length === 0) return [];
  if (!customTimes || customTimes.length === 0) return places;

  return places.map((place, index) => ({
    ...place,
    time: customTimes[index] || customTimes[customTimes.length - 1]
  }));
}
