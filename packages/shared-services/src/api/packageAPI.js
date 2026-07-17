// services/api/packageAPI.js
import { makeAPICall, getAuthHeaders, getAuthToken } from "../apiConfig";

class PackageAPI {
  // ===== VENDOR PACKAGES =====

  async getMyPackages(status) {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    const qs = params.toString();
    return makeAPICall(`/packages/my${qs ? `?${qs}` : ""}`, {
      headers: await getAuthHeaders(),
    });
  }

  async getVendorPackageDashboard() {
    return makeAPICall("/packages/my/dashboard", {
      headers: await getAuthHeaders(),
    });
  }

  async getMyPackageById(id) {
    return makeAPICall(`/packages/my/${id}`, {
      headers: await getAuthHeaders(),
    });
  }

  async createPackage(data) {
    return makeAPICall("/packages", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async updatePackage(id, data) {
    return makeAPICall(`/packages/${id}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deletePackage(id) {
    return makeAPICall(`/packages/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async toggleStatus(id, status) {
    return makeAPICall(`/packages/${id}/status`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
  }

  async submitForApproval(id) {
    return makeAPICall(`/packages/${id}/submit-for-approval`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  // Vendor-facing package bookings (powers the package bookings calendar).
  // Mirrors the web partner portal's PackageBookingsCalendar data source.
  async getBusinessBookings(status = "all", page = 1) {
    const params = new URLSearchParams();
    if (status && status !== "all") params.append("status", status);
    params.append("page", String(page));
    return makeAPICall(`/package-bookings/business?${params.toString()}`, {
      headers: await getAuthHeaders(),
    });
  }
}

export const packageAPI = new PackageAPI();
