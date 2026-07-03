// services/api/packingAPI.js - Packing list API client
// Adapted for React Native: removed axios and Firebase imports, uses fetch + injected auth
import { API_CONFIG, getAuthToken } from "../apiConfig";

// Get packing list
export async function getPackingList(tripId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/packing/${tripId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Update packing list
export async function updatePackingList(tripId, items) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/packing/${tripId}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Toggle item
export async function togglePackingItem(tripId, itemId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/packing/${tripId}/toggle/${itemId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}
