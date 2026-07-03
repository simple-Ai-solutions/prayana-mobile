// services/api/invoiceAPI.js - Invoice management API client
import { makeAPICall, getAuthHeaders, API_CONFIG } from "../apiConfig";

class InvoiceAPI {
  async generateInvoice(bookingId) {
    return makeAPICall(`/bookings/${bookingId}/invoice/generate`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  async getInvoiceByBooking(bookingId) {
    return makeAPICall(`/bookings/${bookingId}/invoice`, {
      headers: await getAuthHeaders(),
    });
  }

  async downloadInvoicePDF(invoiceId) {
    // Returns the URL for download -- caller handles the actual download
    return `${API_CONFIG.BASE_URL}/invoices/${invoiceId}/download`;
  }

  async viewInvoicePDF(invoiceId) {
    return `${API_CONFIG.BASE_URL}/invoices/${invoiceId}/view`;
  }

  async emailInvoice(invoiceId) {
    return makeAPICall(`/invoices/${invoiceId}/email`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
}

export const invoiceAPI = new InvoiceAPI();
