import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem("token") || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Clear all credentials from storage and memory
  const clearAuth = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }, []);

  // Verify token and re-fetch profile from backend
  const refreshProfile = useCallback(async () => {
    const storedToken = localStorage.getItem("token");
    if (!storedToken) {
      clearAuth();
      return null;
    }

    try {
      const response = await api.get("/api/auth/me");
      if (response && response.data && response.data.id) {
        setUser(response.data);
        localStorage.setItem("user", JSON.stringify(response.data));
        return response.data;
      } else {
        clearAuth();
        return null;
      }
    } catch (error) {
      // Any error on verification (401, 403, 500, network fail) invalidates credentials
      clearAuth();
      return null;
    }
  }, [clearAuth]);

  // Initial auth verification on page load - strictly blocks routes until complete
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("token");
      if (!storedToken) {
        if (isMounted) {
          clearAuth();
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.get("/api/auth/me");
        if (isMounted) {
          if (response && response.data && response.data.id) {
            setUser(response.data);
            setToken(storedToken);
            localStorage.setItem("user", JSON.stringify(response.data));
          } else {
            clearAuth();
          }
        }
      } catch (err) {
        if (isMounted) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [clearAuth]);

  // Listen for global unauthorized event dispatched by Axios interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAuth();
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, [clearAuth]);

  // Window Focus Listener: Auto-sync user plan upgrades when returning from Admin tab
  useEffect(() => {
    const handleFocus = () => {
      const storedToken = localStorage.getItem("token");
      if (storedToken && user) {
        refreshProfile();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshProfile, user]);

  const login = async (email, password) => {
    const response = await api.post("/api/auth/login", {
      email,
      password,
    });

    const { access_token, user: userData } = response.data;

    localStorage.setItem("token", access_token);
    localStorage.setItem("user", JSON.stringify(userData));

    setToken(access_token);
    setUser(userData);

    return userData;
  };

  const changePassword = async (payloadOrNewPassword, currentPassword = null) => {
    let payload = {};
    if (typeof payloadOrNewPassword === "object" && payloadOrNewPassword !== null) {
      payload = payloadOrNewPassword;
    } else {
      payload = {
        new_password: payloadOrNewPassword,
        ...(currentPassword ? { current_password: currentPassword } : {})
      };
    }

    const response = await api.put("/api/auth/change-password", payload);

    const updatedUser = {
      ...(user || {}),
      ...(response.data && typeof response.data === "object" ? response.data : {}),
      needs_password_change: false,
    };

    setUser(updatedUser);
    localStorage.setItem("user", JSON.stringify(updatedUser));

    return updatedUser;
  };

  const logout = () => {
    clearAuth();
  };

  const roleStr = String(user?.role || "").toLowerCase();
  const isAdmin = roleStr === "admin";
  const isPhotographer = roleStr === "photographer" || (!isAdmin && !!user);

  // Authenticated ONLY when loading is done AND both valid token and user profile exist
  const isAuthenticated = !loading && Boolean(token && user);

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    needsPasswordChange: Boolean(user?.needs_password_change),
    isAdmin,
    isPhotographer,
    login,
    changePassword,
    logout,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthContext;
