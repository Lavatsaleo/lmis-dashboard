// src/api/client.js
import axios from "axios";

// Dev example: VITE_API_BASE_URL=http://localhost:4000
// Prod (behind your domain + Nginx): /lmisbackend/api
const baseURL = import.meta.env.VITE_API_BASE_URL || "/lmisbackend/api";

export const api = axios.create({
  baseURL,
});

// Attach JWT if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Auto-logout on 401 (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("accessToken");

      // Redirect back to LMIS login route (your app is served under /lmis/)
      if (window.location.pathname !== "/lmis/") {
        window.location.href = "/lmis/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;