// services/api/transportationAPI.js - TRANSPORTATION API SERVICE

import { API_CONFIG, makeAPICall } from "../apiConfig";

// Generate transport options (ONLY transportation allowed to have fallback)
const generateTransportOptions = (type) => {
  const baseOptions = {
    bus: [
      {
        id: 1,
        name: "KSRTC Airavat",
        type: "AC Sleeper",
        rating: 4.3,
        price: "INR 1,200 - 1,800",
        duration: "8-12 hours",
        frequency: "Multiple daily",
        contact: "+91 80 26252525",
        features: ["AC", "Wi-Fi", "Charging Point"],
        bookingUrl: "https://ksrtc.in",
      },
      {
        id: 2,
        name: "SRS Travels",
        type: "Volvo Multi-Axle",
        rating: 4.1,
        price: "INR 1,000 - 1,500",
        duration: "9-13 hours",
        frequency: "Daily",
        contact: "+91 9845012345",
        features: ["AC", "Reclining Seats", "Movie Entertainment"],
        bookingUrl: "https://srstravels.com",
      },
    ],
    train: [
      {
        id: 1,
        name: "Shatabdi Express",
        type: "AC Chair Car",
        rating: 4.5,
        price: "INR 800 - 1,500",
        duration: "6-8 hours",
        frequency: "Daily",
        features: ["AC", "Meals", "Comfortable seating"],
        bookingUrl: "https://irctc.co.in",
      },
      {
        id: 2,
        name: "Rajdhani Express",
        type: "AC 3-Tier",
        rating: 4.4,
        price: "INR 1,200 - 2,500",
        duration: "12-16 hours",
        frequency: "Daily",
        features: ["AC", "Meals", "Bedding"],
        bookingUrl: "https://irctc.co.in",
      },
    ],
    car: [
      {
        id: 1,
        name: "Ola/Uber Intercity",
        type: "Sedan/SUV",
        rating: 4.2,
        price: "INR 2,500 - 4,000",
        duration: "6-10 hours",
        features: ["Door-to-door", "AC", "Professional driver"],
        bookingUrl: "https://olacabs.com",
      },
      {
        id: 2,
        name: "Zoomcar Self-Drive",
        type: "Various Models",
        rating: 4.0,
        price: "INR 2,000 - 3,500/day",
        duration: "Self-drive",
        features: ["Self-drive", "Fuel included", "Insurance"],
        bookingUrl: "https://zoomcar.com",
      },
    ],
    bike: [
      {
        id: 1,
        name: "Royal Enfield Rental",
        type: "Classic 350",
        rating: 4.4,
        price: "INR 1,200 - 1,800/day",
        duration: "Self-drive",
        features: ["Helmet included", "Insurance", "24/7 support"],
        bookingUrl: "https://royalenfield.com",
      },
    ],
  };
  return baseOptions[type] || [];
};

const getFallbackTransportOptions = (transportType) =>
  generateTransportOptions(transportType);

export class TransportationAPI {
  async getOptions(transportRequest) {
    console.log("[Transport] Getting transport options:", transportRequest);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const { transportType } = transportRequest;

    try {
      const transportData = generateTransportOptions(transportType);

      return {
        success: true,
        data: transportData,
        message: `${transportType} options retrieved successfully`,
      };
    } catch (error) {
      console.error("[Transport] API error:", error);
      return {
        success: true,
        data: getFallbackTransportOptions(transportType),
        message: "Transport options retrieved (fallback data)",
      };
    }
  }

  async getVendors(type, location) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRANSPORTATION.VENDORS}/${type}/${location}`
      );
      return response;
    } catch (error) {
      console.warn("Transport vendors API failed:", error);
      return { success: false, data: [] };
    }
  }

  async bookTransport(bookingData) {
    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRANSPORTATION.BOOK,
        {
          method: "POST",
          body: JSON.stringify(bookingData),
        }
      );
      return response;
    } catch (error) {
      console.error("Transport booking failed:", error);
      return { success: false, message: "Booking failed" };
    }
  }

  async trackBooking(bookingId) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRANSPORTATION.TRACK}/${bookingId}`
      );
      return response;
    } catch (error) {
      console.error("Tracking failed:", error);
      return { success: false, message: "Tracking unavailable" };
    }
  }

  async cancelBooking(bookingId, reason) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRANSPORTATION.CANCEL}/${bookingId}`,
        {
          method: "POST",
          body: JSON.stringify({ reason }),
        }
      );
      return response;
    } catch (error) {
      console.error("Cancellation failed:", error);
      return { success: false, message: "Cancellation failed" };
    }
  }

  async getTransportOptions(routeData) {
    try {
      const response = await makeAPICall(
        API_CONFIG.ENDPOINTS.TRIP_PLANNING?.TRANSPORT_OPTIONS || "/trip-planning/transport-options",
        {
          method: "POST",
          body: JSON.stringify(routeData),
        }
      );

      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Transport options API failed:", error);
    }

    return {
      success: true,
      data: generateTransportOptions(routeData.transportType || "bus"),
      message: "Transport options retrieved (offline mode)",
    };
  }

  async getTransportVendors(type, location) {
    try {
      const response = await makeAPICall(
        `${API_CONFIG.ENDPOINTS.TRIP_PLANNING?.TRANSPORT_VENDORS || "/trip-planning/transport-vendors"}/${type}/${location}`
      );
      if (response.success) {
        return response;
      }
    } catch (error) {
      console.warn("Transport vendors API failed:", error);
    }

    return {
      success: true,
      data: generateTransportOptions(type),
      message: "Vendor data retrieved (offline mode)",
    };
  }
}

// Create and export the service instance
export const transportationAPI = new TransportationAPI();
