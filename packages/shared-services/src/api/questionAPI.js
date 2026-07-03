// services/api/questionAPI.js - Pre-booking question management API client
import { makeAPICall, getAuthHeaders } from "../apiConfig";

class QuestionAPI {
  // ===== Templates =====

  async getTemplates() {
    return makeAPICall("/questions/templates");
  }

  // ===== Activity Questions =====

  async createQuestion(activityId, data) {
    return makeAPICall(`/activities/${activityId}/questions`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async getActivityQuestions(activityId) {
    return makeAPICall(`/activities/${activityId}/questions`);
  }

  async reorderQuestions(activityId, questionOrder) {
    return makeAPICall(`/activities/${activityId}/questions/reorder`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ questionOrder }),
    });
  }

  async validateAnswers(activityId, answers) {
    return makeAPICall(`/activities/${activityId}/questions/validate`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ answers }),
    });
  }

  async cloneFromTemplate(activityId, sourceActivityId) {
    return makeAPICall(`/activities/${activityId}/questions/clone`, {
      method: "POST",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ sourceActivityId }),
    });
  }

  // ===== Individual Question Operations =====

  async getQuestion(questionId) {
    return makeAPICall(`/questions/${questionId}`);
  }

  async updateQuestion(questionId, data) {
    return makeAPICall(`/questions/${questionId}`, {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify(data),
    });
  }

  async deleteQuestion(questionId) {
    return makeAPICall(`/questions/${questionId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
  }
}

export const questionAPI = new QuestionAPI();
