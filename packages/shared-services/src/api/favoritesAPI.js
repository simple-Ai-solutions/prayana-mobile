// services/api/favoritesAPI.js - Favorites API Service
// Adapted for React Native: uses injected auth token provider
import { API_CONFIG, getAuthToken } from '../apiConfig';

class FavoritesAPI {
  /**
   * Get authentication headers with injected auth token
   */
  async getAuthHeaders() {
    const token = await getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Get all user's favorites
   */
  async getFavorites() {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/favorites`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch favorites');
      }

      const data = await response.json();
      return {
        success: true,
        favorites: data.data.favorites,
        count: data.data.count,
      };
    } catch (error) {
      console.error('Get favorites error:', error);
      return {
        success: false,
        error: error.message,
        favorites: [],
        count: 0,
      };
    }
  }

  /**
   * Add place to favorites
   */
  async addFavorite({ placeId, placeName, placeImage, placeLocation, placeData }) {
    try {
      console.log('[Favorites] Adding favorite:', { placeId, placeName });
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${API_CONFIG.BASE_URL}/auth/favorites`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          placeId,
          placeName,
          placeImage,
          placeLocation,
          placeData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle already favorited case
        if (response.status === 409) {
          return {
            success: false,
            error: 'Already in favorites',
            code: 'ALREADY_FAVORITED',
          };
        }
        console.error('[Favorites] Server error:', data);
        return {
          success: false,
          error: data.message || data.error || 'Failed to add to favorites',
        };
      }

      return {
        success: true,
        message: data.message,
        favorites: data.data.favorites,
        count: data.data.count,
      };
    } catch (error) {
      console.error('[Favorites] Add favorite error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Remove place from favorites
   */
  async removeFavorite(placeId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/auth/favorites/${encodeURIComponent(placeId)}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to remove from favorites');
      }

      return {
        success: true,
        message: data.message,
        favorites: data.data.favorites,
        count: data.data.count,
      };
    } catch (error) {
      console.error('Remove favorite error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if place is favorited
   */
  async checkFavorite(placeId) {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(
        `${API_CONFIG.BASE_URL}/auth/favorites/check/${encodeURIComponent(placeId)}`,
        {
          method: 'GET',
          headers,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to check favorite status');
      }

      const data = await response.json();
      return {
        success: true,
        isFavorited: data.data.isFavorited,
      };
    } catch (error) {
      console.error('Check favorite error:', error);
      return {
        success: false,
        error: error.message,
        isFavorited: false,
      };
    }
  }

  /**
   * Toggle favorite status (add if not favorited, remove if favorited)
   */
  async toggleFavorite({ placeId, placeName, placeImage, placeLocation, placeData }) {
    try {
      // First check if it's already favorited
      const checkResult = await this.checkFavorite(placeId);

      if (checkResult.isFavorited) {
        // Remove from favorites
        return await this.removeFavorite(placeId);
      } else {
        // Add to favorites
        return await this.addFavorite({
          placeId,
          placeName,
          placeImage,
          placeLocation,
          placeData,
        });
      }
    } catch (error) {
      console.error('Toggle favorite error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// Export a singleton instance
const favoritesAPI = new FavoritesAPI();
export default favoritesAPI;
