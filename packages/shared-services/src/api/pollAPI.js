// services/api/pollAPI.js - Voting polls API client
// Adapted for React Native: removed axios and Firebase imports, uses fetch + injected auth
import { API_CONFIG, getAuthToken } from "../apiConfig";

// Create poll
export async function createPoll(pollData) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/polls/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(pollData),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Get trip polls
export async function getTripPolls(tripId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/polls/trip/${tripId}`, {
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

// Vote on poll
export async function voteOnPoll(pollId, optionIndex) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/polls/${pollId}/vote`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ optionIndex }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Close poll
export async function closePoll(pollId) {
  const token = await getAuthToken();

  const response = await fetch(
    `${API_CONFIG.BASE_URL}/polls/${pollId}/close`,
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

// Delete poll
export async function deletePoll(pollId) {
  const token = await getAuthToken();

  const response = await fetch(`${API_CONFIG.BASE_URL}/polls/${pollId}`, {
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
