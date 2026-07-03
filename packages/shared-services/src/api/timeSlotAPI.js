// services/api/timeSlotAPI.js - Time slot management API client
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class TimeSlotAPI {
  // ===== Activity Time Slots =====

  async createTimeSlot(activityId, data) {
    return makeAPICall(`/activities/${activityId}/time-slots`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getActivityTimeSlots(activityId) {
    return makeAPICall(`/activities/${activityId}/time-slots`);
  }

  async getTimeSlotsForDate(activityId, date) {
    return makeAPICall(`/activities/${activityId}/time-slots/${date}`);
  }

  async bulkCreateTimeSlots(activityId, { daysOfWeek, slots }) {
    return makeAPICall(`/activities/${activityId}/time-slots/bulk`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ daysOfWeek, slots }),
    });
  }

  async blockDateRange(activityId, { startDate, endDate, reason }) {
    return makeAPICall(`/activities/${activityId}/time-slots/block-range`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ startDate, endDate, reason }),
    });
  }

  // ===== Individual Slot Operations =====

  async updateTimeSlot(slotId, data) {
    return makeAPICall(`/time-slots/${slotId}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteTimeSlot(slotId) {
    return makeAPICall(`/time-slots/${slotId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }

  async blockTimeSlot(slotId, { isBlocked, reason }) {
    return makeAPICall(`/time-slots/${slotId}/block`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ isBlocked, reason }),
    });
  }
}

export const timeSlotAPI = new TimeSlotAPI();
