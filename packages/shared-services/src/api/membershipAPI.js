// membershipAPI.js - VIP membership / loyalty endpoints (mirrors /api/membership/*).
// Powers the mobile VIP upgrade + checkout + renewal, matching the web
// stores/useMembershipStore.js flow.
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class MembershipAPI {
  // Current membership: tier, isVip, expiry, credits, renewal state, pricing.
  async getStatus() {
    return makeAPICall(`/membership/status`, {
      headers: await getAuthHeaders(),
    });
  }

  // Start a VIP upgrade. `creditsToApply` (0..min(balance,999)) is redeemed
  // first; the rest is charged via Razorpay. If credits cover the full ₹999
  // the server returns { upgraded: true } and no Razorpay is needed.
  async createUpgradeOrder(creditsToApply = 0) {
    return makeAPICall(`/membership/upgrade/create-order`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ creditsToApply }),
    });
  }

  // Verify the Razorpay payment and finalise the upgrade.
  async verifyUpgrade({ orderId, paymentId, signature }) {
    return makeAPICall(`/membership/upgrade/verify`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ orderId, paymentId, signature }),
    });
  }

  // Dismiss the "renewal due" reminder banner.
  async dismissRenewalReminder() {
    return makeAPICall(`/membership/dismiss-renewal-reminder`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
}

export const membershipAPI = new MembershipAPI();
