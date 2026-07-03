// services/api/index.js - CENTRALIZED API EXPORTS

// Import all API services
import { destinationAPI } from "./destinationAPI";
import { tripPlanningAPI } from "./tripPlanningAPI";
import { userAPI } from "./userAPI";
import communityAPI from "./communityAPI";

// Export individual services
export { destinationAPI, tripPlanningAPI, userAPI, communityAPI };

// Create the default export object for backward compatibility
const apiServices = {
  destinationAPI,
  tripPlanningAPI,
  userAPI,
  communityAPI,
};

export default apiServices;
