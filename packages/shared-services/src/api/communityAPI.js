// packages/shared-services/src/api/communityAPI.js
// Community Q&A API client for the mobile app. Mirrors travel-ai-nextjs/services/api/communityAPI.js
// 1:1 so screens can share the same call shape.

import { makeAPICall, getAuthHeaders } from "../apiConfig";

function qs(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.append(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

class CommunityAPI {
  // ----- Questions -----
  async listQuestions({ category, tag, sort = "newest", page = 1, limit = 20 } = {}) {
    return makeAPICall(`/questions${qs({ category, tag, sort, page, limit })}`, {
      headers: await getAuthHeaders(),
    });
  }
  async getQuestion(id) {
    return makeAPICall(`/questions/${id}`, { headers: await getAuthHeaders() });
  }
  async searchQuestions(q, limit = 20) {
    return makeAPICall(`/questions/search${qs({ q, limit })}`, {
      headers: await getAuthHeaders(),
    });
  }
  async findSimilarQuestions(text) {
    return makeAPICall(`/questions/similar${qs({ q: text })}`, {
      headers: await getAuthHeaders(),
    });
  }
  async questionsByDestination(destination, limit = 6, opts = {}) {
    return makeAPICall(
      `/questions/by-destination${qs({
        destination, limit, startDate: opts.startDate, endDate: opts.endDate,
      })}`,
      { headers: await getAuthHeaders() }
    );
  }
  async createQuestion({ title, description, category, tags, isAnonymous, images }) {
    return makeAPICall("/questions", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ title, description, category, tags, isAnonymous, images }),
    });
  }
  async upvoteQuestion(id) {
    return makeAPICall(`/questions/${id}/upvote`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async flagQuestion(id) {
    return makeAPICall(`/questions/${id}/flag`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }

  // ----- Answers -----
  async createAnswer(questionId, { content, isAnonymous, asPartner, images } = {}) {
    return makeAPICall(`/questions/${questionId}/answers`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ content, isAnonymous, asPartner, images }),
    });
  }
  async upvoteAnswer(id) {
    return makeAPICall(`/answers/${id}/upvote`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async acceptAnswer(id) {
    return makeAPICall(`/answers/${id}/accept`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async flagAnswer(id) {
    return makeAPICall(`/answers/${id}/flag`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async replyToAnswer(id, { content, isAnonymous } = {}) {
    return makeAPICall(`/answers/${id}/replies`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ content, isAnonymous }),
    });
  }

  // ----- Images (multipart upload) -----
  async uploadImages(formData) {
    return makeAPICall("/qa/upload-images", {
      method: "POST",
      headers: await getAuthHeaders(),
      body: formData,
    });
  }

  // ----- AI / Vision / Synth -----
  async aiSuggest(questionId) {
    return makeAPICall(`/questions/${questionId}/ai-suggest`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async visionAnswer(questionId) {
    return makeAPICall(`/questions/${questionId}/vision-answer`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async synthesizeItinerary(questionId) {
    return makeAPICall(`/questions/${questionId}/synthesize-itinerary`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
  }
  async bestMatchedAnswer(questionId) {
    return makeAPICall(`/questions/${questionId}/best-match`, {
      headers: await getAuthHeaders(),
    });
  }
}

const communityAPI = new CommunityAPI();
export default communityAPI;
