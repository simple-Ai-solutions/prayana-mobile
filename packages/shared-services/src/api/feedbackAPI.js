// services/api/feedbackAPI.js
// Adapted for React Native: removed axios and Firebase imports, uses fetch + injected auth
import { API_CONFIG, getAuthToken } from '../apiConfig';

/**
 * Feedback API service
 */
export const feedbackAPI = {
  /**
   * Submit new feedback with optional image attachments
   * @param {FormData} formData - Form data containing feedback details and images
   */
  async submitFeedback(formData) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/feedback`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Don't set Content-Type for FormData -- fetch/RN sets it with boundary
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  },

  /**
   * Get current user's feedback history
   * @param {Object} filters - Optional filters (status, limit, offset)
   */
  async getUserFeedback(filters = {}) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('User not authenticated');

      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset) params.append('offset', filters.offset);

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/feedback/user?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching user feedback:', error);
      throw error;
    }
  },

  /**
   * Get specific feedback by ID
   * @param {string} feedbackId - Feedback ID
   */
  async getFeedbackById(feedbackId) {
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(
        `${API_CONFIG.BASE_URL}/feedback/${feedbackId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching feedback:', error);
      throw error;
    }
  }
};

export default feedbackAPI;
