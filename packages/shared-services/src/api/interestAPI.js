// services/api/interestAPI.js
import { API_CONFIG } from "../apiConfig";

export const interestAPI = {
  getCategory: async (slug) => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/interests/${slug}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load interest');
      }

      return data;
    } catch (error) {
      console.error(`Interest API error for ${slug}:`, error);
      throw error;
    }
  },

  getAllCategories: async () => {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/interests`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to load interests');
      }

      return data;
    } catch (error) {
      console.error('Interest API error:', error);
      throw error;
    }
  }
};
