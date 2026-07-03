// services/api/variantAPI.js - Activity variant management API client
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class VariantAPI {
  // ===== Activity Variants =====

  async createVariant(activityId, data) {
    return makeAPICall(`/activities/${activityId}/variants`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getActivityVariants(activityId, includeUnavailable = false) {
    const params = includeUnavailable ? "?includeUnavailable=true" : "";
    return makeAPICall(`/activities/${activityId}/variants${params}`);
  }

  async bulkCreateVariants(activityId, template = "standard_vip_private") {
    return makeAPICall(`/activities/${activityId}/variants/bulk`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ template }),
    });
  }

  async getMostPopularVariant(activityId) {
    return makeAPICall(`/activities/${activityId}/variants/popular`);
  }

  // ===== Individual Variant Operations =====

  async getVariantById(variantId) {
    return makeAPICall(`/variants/${variantId}`);
  }

  async updateVariant(variantId, data) {
    return makeAPICall(`/variants/${variantId}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteVariant(variantId) {
    return makeAPICall(`/variants/${variantId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  // ===== Pricing =====

  async calculatePrice(variantId, data) {
    return makeAPICall(`/variants/${variantId}/calculate-price`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getPricePreview(variantId) {
    return makeAPICall(`/variants/${variantId}/price-preview`);
  }
}

export const variantAPI = new VariantAPI();
