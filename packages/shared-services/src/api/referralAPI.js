// referralAPI.js - Refer & Earn endpoints. Mirrors the web's
// components/profile/ReferAndEarnCard.jsx data source.
//
// GET /referral/me returns:
//   { referralCode, shareUrl, shareMessage,
//     rewards: { signupReferee, bookingReferrer, bookingReferee },
//     stats: { totalReferrals, signupOnly, completed,
//              travelEarned, plannerEarned, recent[] } }

import { makeAPICall, getAuthHeaders } from '../apiConfig';

class ReferralAPI {
  /** The signed-in user's referral code, share link and earning stats. */
  async getMe() {
    return makeAPICall('/referral/me', {
      headers: await getAuthHeaders(),
    });
  }
}

export const referralAPI = new ReferralAPI();
export default referralAPI;
