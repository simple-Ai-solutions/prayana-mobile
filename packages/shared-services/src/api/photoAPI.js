// services/api/photoAPI.js - Photo gallery API client
// Adapted for React Native: removed axios and Firebase imports, uses fetch + injected auth
import { API_CONFIG, getAuthToken } from "../apiConfig";

// Upload photo
export async function uploadPhoto(formData) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/photos/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      // Don't set Content-Type for FormData
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Get trip photos
export async function getTripPhotos(tripId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/photos/trip/${tripId}`, {
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

// Like photo
export async function likePhoto(photoId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/photos/${photoId}/like`,
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

// Add comment
export async function addComment(photoId, text) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/photos/${photoId}/comment`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Delete photo
export async function deletePhoto(photoId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/photos/${photoId}`, {
    method: 'DELETE',
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
