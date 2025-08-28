import { apiRequest } from "./queryClient";

// Store API
export const storeApi = {
  getAll: () => fetch("/api/stores").then(res => res.json()),
  create: (data: any) => apiRequest("POST", "/api/stores", data),
  update: (id: string, data: any) => apiRequest("PUT", `/api/stores/${id}`, data),
  delete: (id: string) => apiRequest("DELETE", `/api/stores/${id}`),
  verifyShopify: (id: string, data: any) => apiRequest("POST", `/api/stores/${id}/verify-shopify`, data),
};

// Popup Configuration API
export const popupApi = {
  getConfig: (storeId: string) => fetch(`/api/stores/${storeId}/popup-config`).then(res => res.json()),
  updateConfig: (storeId: string, data: any) => apiRequest("PUT", `/api/stores/${storeId}/popup-config`, data),
  getScript: (storeId: string) => fetch(`/api/stores/${storeId}/integration-script`).then(res => res.text()),
};

// Subscriber API
export const subscriberApi = {
  getAll: (storeId: string) => fetch(`/api/stores/${storeId}/subscribers`).then(res => res.json()),
  subscribe: (data: any) => apiRequest("POST", "/api/subscribe", data),
};

// Settings API
export const settingsApi = {
  getEmailSettings: () => fetch("/api/email-settings").then(res => res.json()),
  saveEmailSettings: (data: any) => apiRequest("POST", "/api/email-settings", data),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => fetch("/api/dashboard/stats").then(res => res.json()),
};

// Integration API
export const integrationApi = {
  downloadFile: () => fetch("/api/integration-file").then(res => res.blob()),
};
