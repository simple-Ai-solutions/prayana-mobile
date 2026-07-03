// services/api/messageAPI.js - Booking messaging API client
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class MessageAPI {
  async sendMessage(bookingId, data) {
    return makeAPICall(`/bookings/${bookingId}/messages`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getMessages(bookingId) {
    return makeAPICall(`/bookings/${bookingId}/messages`, {
      headers: await getAuthHeaders(),
    });
  }

  async getUnreadCount(bookingId) {
    return makeAPICall(`/bookings/${bookingId}/messages/unread-count`, {
      headers: await getAuthHeaders(),
    });
  }

  async markAsRead(messageId) {
    return makeAPICall(`/messages/${messageId}/read`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
    });
  }
}

export const messageAPI = new MessageAPI();
