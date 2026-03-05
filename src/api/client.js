// src/api/client.js
import axios from "axios";

/**
 * Server build (.env):
 *   VITE_API_BASE_URL=/lmisbackend
 * Dev example:
 *   VITE_API_BASE_URL=http://localhost:4000
 *
 * This normalizes relative values (e.g. "lmisbackend") to "/lmisbackend"
 * so the browser does NOT turn it into "/lmis/lmisbackend".
 */
function normalizeBaseUrl(raw) {
  if (!raw) return "/lmisbackend";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

const baseURL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

const api = axios.create({ baseURL });

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

      // Your dashboard is served under /lmis/
      if (window.location.pathname !== "/lmis/") {
        window.location.href = "/lmis/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };