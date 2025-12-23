import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";

/**
 * Priority:
 * 1) VITE_API_URL (if you set it)
 * 2) If frontend is opened via http://<PC_IP>:5173 on phone,
 *    auto use http://<PC_IP>:8080 as backend
 * 3) fallback to localhost for normal PC dev
 */
const DEFAULT_API_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8080"
    : `http://${window.location.hostname}:8080`;

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || DEFAULT_API_URL;

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("agriverse_token");

    if (token) {
      // Axios v1+ safe way (config.headers is AxiosHeaders)
      config.headers.set("Authorization", `Bearer ${token}`);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      localStorage.removeItem("agriverse_token");
      localStorage.removeItem("agriverse_user");

      const path = window.location.pathname;

      const isAuthPage =
        path.includes("/login") ||
        path.includes("/register") ||
        path.includes("/verify-email") ||
        path.includes("/resend-verification") ||
        path.includes("/check-email");

      if (!isAuthPage) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
export { API_URL };
