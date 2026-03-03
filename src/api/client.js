import axios from "axios";

// In dev you can set VITE_API_BASE_URL (e.g. http://localhost:4000).
// In production (served behind Nginx), we default to the current origin.
const baseURL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401 (token expired/invalid)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("accessToken");

      // Avoid redirect loop if already on root/login
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);