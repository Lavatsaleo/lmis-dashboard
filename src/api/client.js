// src/api/client.js
import axios from "axios";

/**
 * Dev: VITE_API_BASE_URL=http://localhost:4000
 * Prod: VITE_API_BASE_URL=/lmisbackend
 */
const baseURL = import.meta.env.VITE_API_BASE_URL || "/lmisbackend";

const api = axios.create({ baseURL });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("accessToken");

      // Your dashboard lives under /lmis/
      if (window.location.pathname !== "/lmis/") {
        window.location.href = "/lmis/";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };