import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || "";

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
});

// Request interceptor: nothing needed for HttpOnly cookies
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: handle 401 Unauthorized & 403 Forbidden (deactivated studio/revoked access)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const detail = String(error.response?.data?.detail || "").toLowerCase();

    // Check for 401 Unauthorized or 403 Forbidden (deactivated/suspended studio or revoked access)
    const isUnauthorized = status === 401;
    const isForbiddenAuth =
      status === 403 &&
      (detail.includes("suspended") ||
        detail.includes("deactivated") ||
        detail.includes("disabled") ||
        detail.includes("revoked") ||
        detail.includes("forbidden") ||
        detail.includes("access denied"));

    if (isUnauthorized || isForbiddenAuth) {
      localStorage.removeItem("user");
      sessionStorage.removeItem("user");

      // Globally notify application of authorization invalidation
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:unauthorized"));
        const currentPath = window.location.pathname;
        const requestUrl = error.config?.url || "";
        const isAuthEndpoint =
          requestUrl.includes("/api/auth/login") ||
          requestUrl.includes("/api/auth/me") ||
          requestUrl.includes("/api/auth/emergency-login");

        // Only redirect if not on login, not in public gallery (/c/),
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
