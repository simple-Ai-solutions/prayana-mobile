// services/api/adminAPI.js - Admin-specific API calls
// Adapted for React Native: removed localStorage SSR guards, uses AsyncStorage pattern
import { API_CONFIG } from "../apiConfig";

// Storage adapter - apps must set this via setAdminStorage()
let _storage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

/**
 * Set the storage adapter for admin token persistence.
 * For React Native, pass an AsyncStorage-compatible object.
 * @param {{ getItem: Function, setItem: Function, removeItem: Function }} storage
 */
export const setAdminStorage = (storage) => {
  _storage = storage;
};

class AdminAPI {
  constructor() {
    this.token = null;
  }

  // Set authentication token
  async setToken(token) {
    this.token = token;
    try {
      await _storage.setItem("admin_token", token);
    } catch (e) {
      // storage write failed silently
    }
  }

  // Get authentication headers
  getHeaders() {
    const headers = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Make API request
  async makeRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/admin${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Admin API error (${endpoint}):`, error);
      throw error;
    }
  }

  // Authentication methods
  async login(credentials) {
    const response = await this.makeRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });

    if (response.success && response.data.token) {
      await this.setToken(response.data.token);
    }

    return response;
  }

  async logout() {
    try {
      await this.makeRequest("/auth/logout", {
        method: "POST",
      });
    } catch (error) {
      console.warn("Logout API call failed:", error);
    } finally {
      this.token = null;
      try {
        await _storage.removeItem("admin_token");
      } catch (e) {
        // storage removal failed silently
      }
    }
  }

  async verifyToken(token) {
    await this.setToken(token);
    return this.makeRequest("/auth/verify");
  }

  // Dashboard data methods
  async getDashboardData(tab = "overview", timeRange = "7d") {
    return this.makeRequest(`/dashboard/${tab}?timeRange=${timeRange}`);
  }

  async getRealTimeMetrics() {
    return this.makeRequest("/dashboard/realtime");
  }

  // User analytics
  async getUserAnalytics(timeRange = "7d") {
    return this.makeRequest(`/analytics/users?timeRange=${timeRange}`);
  }

  async getUserDetails(userId) {
    return this.makeRequest(`/users/${userId}`);
  }

  async getUserSessions(userId, limit = 50) {
    return this.makeRequest(`/users/${userId}/sessions?limit=${limit}`);
  }

  // Search analytics
  async getSearchAnalytics(timeRange = "7d") {
    return this.makeRequest(`/analytics/searches?timeRange=${timeRange}`);
  }

  async getPopularSearches(limit = 20, timeRange = "7d") {
    return this.makeRequest(`/analytics/searches/popular?limit=${limit}&timeRange=${timeRange}`);
  }

  async getSearchPerformance(timeRange = "7d") {
    return this.makeRequest(`/analytics/searches/performance?timeRange=${timeRange}`);
  }

  // Geographic analytics
  async getGeographicAnalytics(timeRange = "7d") {
    return this.makeRequest(`/analytics/geographic?timeRange=${timeRange}`);
  }

  async getCountryStats(limit = 20, timeRange = "7d") {
    return this.makeRequest(`/analytics/geographic/countries?limit=${limit}&timeRange=${timeRange}`);
  }

  async getCityStats(limit = 20, timeRange = "7d") {
    return this.makeRequest(`/analytics/geographic/cities?limit=${limit}&timeRange=${timeRange}`);
  }

  // Performance analytics
  async getPerformanceMetrics(timeRange = "7d") {
    return this.makeRequest(`/analytics/performance?timeRange=${timeRange}`);
  }

  async getSystemHealth() {
    return this.makeRequest("/system/health");
  }

  async getErrorLogs(limit = 100, timeRange = "24h") {
    return this.makeRequest(`/system/errors?limit=${limit}&timeRange=${timeRange}`);
  }

  // Data export methods
  async exportAnalyticsData(type, timeRange = "30d", format = "json") {
    return this.makeRequest(`/export/${type}?timeRange=${timeRange}&format=${format}`);
  }

  async exportUserData(format = "csv", timeRange = "30d") {
    return this.makeRequest(`/export/users?format=${format}&timeRange=${timeRange}`);
  }

  // Admin management
  async getAdminUsers() {
    return this.makeRequest("/admins");
  }

  async createAdmin(adminData) {
    return this.makeRequest("/admins", {
      method: "POST",
      body: JSON.stringify(adminData),
    });
  }

  async updateAdmin(adminId, updates) {
    return this.makeRequest(`/admins/${adminId}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteAdmin(adminId) {
    return this.makeRequest(`/admins/${adminId}`, {
      method: "DELETE",
    });
  }

  // Settings management
  async getSettings() {
    return this.makeRequest("/settings");
  }

  async updateSettings(settings) {
    return this.makeRequest("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
  }

  // Reports and insights
  async generateReport(reportType, options = {}) {
    return this.makeRequest("/reports/generate", {
      method: "POST",
      body: JSON.stringify({
        type: reportType,
        options,
      }),
    });
  }

  async getReportHistory(limit = 20) {
    return this.makeRequest(`/reports?limit=${limit}`);
  }

  async downloadReport(reportId) {
    return this.makeRequest(`/reports/${reportId}/download`);
  }

  // Alerts and notifications
  async getAlerts(limit = 50) {
    return this.makeRequest(`/alerts?limit=${limit}`);
  }

  async markAlertAsRead(alertId) {
    return this.makeRequest(`/alerts/${alertId}/read`, {
      method: "PUT",
    });
  }

  async createAlert(alertData) {
    return this.makeRequest("/alerts", {
      method: "POST",
      body: JSON.stringify(alertData),
    });
  }

  // System maintenance
  async clearCache(cacheType = "all") {
    return this.makeRequest("/system/cache/clear", {
      method: "POST",
      body: JSON.stringify({ type: cacheType }),
    });
  }

  async aggregateMetrics(date = null) {
    return this.makeRequest("/system/aggregate", {
      method: "POST",
      body: JSON.stringify({ date }),
    });
  }

  async getSystemStats() {
    return this.makeRequest("/system/stats");
  }

  // Feedback management methods
  async getFeedback(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.category) params.append('category', filters.category);
    if (filters.priority) params.append('priority', filters.priority);
    if (filters.search) params.append('search', filters.search);
    if (filters.sort) params.append('sort', filters.sort);
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);

    const queryString = params.toString();
    // Feedback API is at /api/feedback, not /api/admin
    return this.makeRequestDirect(`${API_CONFIG.BASE_URL}/feedback/admin/all${queryString ? `?${queryString}` : ''}`);
  }

  async getFeedbackStats() {
    return this.makeRequestDirect(`${API_CONFIG.BASE_URL}/feedback/admin/stats`);
  }

  async getFeedbackById(id) {
    return this.makeRequestDirect(`${API_CONFIG.BASE_URL}/feedback/admin/${id}`);
  }

  async updateFeedback(id, updates) {
    return this.makeRequestDirect(`${API_CONFIG.BASE_URL}/feedback/admin/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteFeedback(id) {
    return this.makeRequestDirect(`${API_CONFIG.BASE_URL}/feedback/admin/${id}`, {
      method: 'DELETE'
    });
  }

  // Make direct API request with full URL
  async makeRequestDirect(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`Admin API error (${url}):`, error);
      throw error;
    }
  }

  // Initialize token from storage (call at app startup)
  async initializeToken() {
    try {
      const savedToken = await _storage.getItem("admin_token");
      if (savedToken) {
        this.token = savedToken;
      }
    } catch (e) {
      // storage read failed silently
    }
  }
}

export const adminAPI = new AdminAPI();

export default adminAPI;
