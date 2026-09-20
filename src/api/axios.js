import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor: attach bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401 unauthorized gracefully without infinite reload loops
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // Globally notify application of authorization invalidation
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));

        const currentPath = window.location.pathname;
        const requestUrl = error.config?.url || "";
        const isAuthEndpoint =
          requestUrl.includes("/api/auth/login") ||
          requestUrl.includes("/api/auth/me") ||
          requestUrl.includes("/api/auth/emergency-login");

        // Only redirect via window.location if not on login, not in public gallery (/c/),
        // and not during an internal auth verification check
        if (
          currentPath !== "/login" &&
          !currentPath.startsWith("/c/") &&
          !isAuthEndpoint
        ) {
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
