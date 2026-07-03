/**
 * Route Optimization API
 * AI-powered route optimization using traveling salesman algorithm
 */

import { makeAPICall } from "../apiConfig";

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLon = toRad(coord2.lng - coord1.lng);
  const lat1 = toRad(coord1.lat);
  const lat2 = toRad(coord2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculate total distance for a route
 */
function calculateTotalDistance(activities) {
  if (activities.length < 2) return 0;

  let total = 0;
  for (let i = 0; i < activities.length - 1; i++) {
    if (activities[i].coordinates && activities[i + 1].coordinates) {
      total += calculateDistance(activities[i].coordinates, activities[i + 1].coordinates);
    }
  }
  return total;
}

/**
 * Nearest neighbor algorithm for route optimization
 * Time complexity: O(n^2)
 */
function nearestNeighborOptimization(activities, startIndex = 0) {
  if (activities.length <= 2) return activities;

  const unvisited = [...activities];
  const optimized = [];

  // Start with the specified activity
  let current = unvisited.splice(startIndex, 1)[0];
  optimized.push(current);

  // Visit nearest unvisited activity
  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      if (current.coordinates && unvisited[i].coordinates) {
        const distance = calculateDistance(current.coordinates, unvisited[i].coordinates);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }
    }

    current = unvisited.splice(nearestIndex, 1)[0];
    optimized.push(current);
  }

  return optimized;
}

/**
 * 2-opt algorithm for further optimization
 * Improves route by eliminating crossing paths
 */
function twoOptOptimization(activities, maxIterations = 100) {
  if (activities.length <= 3) return activities;

  let route = [...activities];
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length - 1; j++) {
        // Check if swapping improves the route
        const currentDist =
          calculateDistance(route[i - 1].coordinates, route[i].coordinates) +
          calculateDistance(route[j].coordinates, route[j + 1].coordinates);

        const newDist =
          calculateDistance(route[i - 1].coordinates, route[j].coordinates) +
          calculateDistance(route[i].coordinates, route[j + 1].coordinates);

        if (newDist < currentDist) {
          // Reverse the segment between i and j
          route = [
            ...route.slice(0, i),
            ...route.slice(i, j + 1).reverse(),
            ...route.slice(j + 1)
          ];
          improved = true;
        }
      }
    }
  }

  return route;
}

/**
 * Time-based optimization (consider opening hours, time slots)
 */
function timeBasedOptimization(activities) {
  // Group activities by time slot
  const grouped = activities.reduce((acc, activity) => {
    const slot = activity.timeSlot || 'afternoon';
    if (!acc[slot]) acc[slot] = [];
    acc[slot].push(activity);
    return acc;
  }, {});

  // Optimize within each time slot
  const optimized = [];
  ['morning', 'afternoon', 'evening', 'night'].forEach(slot => {
    if (grouped[slot]) {
      const slotActivities = nearestNeighborOptimization(grouped[slot]);
      optimized.push(...slotActivities);
    }
  });

  return optimized;
}

/**
 * Smart route optimization with multiple strategies
 */
export async function optimizeRoute(activities, options = {}) {
  const {
    strategy = 'hybrid', // 'distance' | 'time' | 'hybrid'
    preserveFirst = false,
    preserveLast = false,
    considerTimeSlots = true,
  } = options;

  // Filter activities with coordinates
  const validActivities = activities.filter(
    a => a.coordinates?.lat && a.coordinates?.lng
  );

  if (validActivities.length <= 2) {
    return {
      success: true,
      data: {
        originalRoute: activities,
        optimizedRoute: activities,
        improvement: {
          distanceSaved: 0,
          percentageImprovement: 0,
          originalDistance: 0,
          optimizedDistance: 0,
        },
        message: 'Not enough activities to optimize',
      },
    };
  }

  const originalDistance = calculateTotalDistance(validActivities);
  let optimizedActivities = [];

  try {
    // Choose optimization strategy
    switch (strategy) {
      case 'distance':
        optimizedActivities = nearestNeighborOptimization(validActivities);
        optimizedActivities = twoOptOptimization(optimizedActivities);
        break;

      case 'time':
        optimizedActivities = timeBasedOptimization(validActivities);
        break;

      case 'hybrid':
        // First optimize by time slots, then by distance within slots
        if (considerTimeSlots) {
          optimizedActivities = timeBasedOptimization(validActivities);
        } else {
          optimizedActivities = nearestNeighborOptimization(validActivities);
          optimizedActivities = twoOptOptimization(optimizedActivities);
        }
        break;

      default:
        optimizedActivities = validActivities;
    }

    // Preserve first/last if requested
    if (preserveFirst && validActivities.length > 0) {
      const firstActivity = validActivities[0];
      optimizedActivities = optimizedActivities.filter(a => a !== firstActivity);
      optimizedActivities.unshift(firstActivity);
    }

    if (preserveLast && validActivities.length > 0) {
      const lastActivity = validActivities[validActivities.length - 1];
      optimizedActivities = optimizedActivities.filter(a => a !== lastActivity);
      optimizedActivities.push(lastActivity);
    }

    const optimizedDistance = calculateTotalDistance(optimizedActivities);
    const distanceSaved = originalDistance - optimizedDistance;
    const percentageImprovement = originalDistance > 0
      ? ((distanceSaved / originalDistance) * 100).toFixed(1)
      : 0;

    return {
      success: true,
      data: {
        originalRoute: validActivities,
        optimizedRoute: optimizedActivities,
        improvement: {
          distanceSaved: distanceSaved.toFixed(2),
          percentageImprovement,
          originalDistance: originalDistance.toFixed(2),
          optimizedDistance: optimizedDistance.toFixed(2),
        },
        strategy,
        message: distanceSaved > 0.1
          ? `Route optimized! You'll save ${distanceSaved.toFixed(1)} km (${percentageImprovement}% shorter)`
          : 'Route is already optimal',
      },
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    return {
      success: false,
      error: 'Failed to optimize route',
      data: {
        originalRoute: validActivities,
        optimizedRoute: validActivities,
      },
    };
  }
}

/**
 * Server-side route optimization (using Google Directions API or AI)
 */
export async function optimizeRouteWithAI(dayActivities, destination) {
  try {
    const response = await makeAPICall('/trip/optimize-route', {
      method: 'POST',
      body: JSON.stringify({
        activities: dayActivities,
        destination,
        considerTraffic: true,
        considerOpeningHours: true,
      }),
    });

    if (response?.success) {
      return response;
    }

    // Fallback to client-side optimization
    return await optimizeRoute(dayActivities, { strategy: 'hybrid' });
  } catch (error) {
    console.error('AI route optimization failed, using fallback:', error);
    return await optimizeRoute(dayActivities, { strategy: 'hybrid' });
  }
}

/**
 * Optimize all days in a trip
 */
export async function optimizeAllDays(days) {
  const optimizedDays = [];

  for (const day of days) {
    const result = await optimizeRoute(day.activities || [], {
      strategy: 'hybrid',
      considerTimeSlots: true,
    });

    if (result.success) {
      optimizedDays.push({
        ...day,
        activities: result.data.optimizedRoute,
        optimizationStats: result.data.improvement,
      });
    } else {
      optimizedDays.push(day);
    }
  }

  return {
    success: true,
    data: optimizedDays,
  };
}

/**
 * Calculate estimated travel time between activities
 */
export function calculateTravelTime(coord1, coord2, mode = 'driving') {
  const distance = calculateDistance(coord1, coord2);

  // Average speeds in km/h
  const speeds = {
    driving: 40,
    walking: 5,
    transit: 25,
    bicycling: 15,
  };

  const speed = speeds[mode] || speeds.driving;
  const hours = distance / speed;
  const minutes = Math.round(hours * 60);

  return {
    distance: distance.toFixed(2),
    duration: minutes,
    durationFormatted: minutes < 60
      ? `${minutes} min`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`,
    mode,
  };
}

export const routeOptimizationAPI = {
  optimizeRoute,
  optimizeRouteWithAI,
  optimizeAllDays,
  calculateTravelTime,
  calculateDistance,
  calculateTotalDistance,
};
