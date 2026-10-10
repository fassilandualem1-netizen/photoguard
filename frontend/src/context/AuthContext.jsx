import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api/axios";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem("user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  // Clear all credentials from memory
  const clearAuth = useCallback(() => {
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  // Synchronously update local user state in memory & localStorage
  const updateUser = useCallback((partialUser) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...partialUser };
      try {
        localStorage.setItem("user", JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to persist updated user to localStorage", e);
      }
      return updated;
    });
  }, []);

  // Verify cookie and re-fetch profile from backend
  const refreshProfile = useCallback(async () => {
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
      try {
        const response = await api.get("/api/auth/me");
        if (isMounted) {
          if (response && response.data && response.data.id) {
            setUser(response.data);
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
      if (user) {
        refreshProfile();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshProfile, user]);

  const login = async (email, password) => {
    const cleanIdentifier = String(email || "").trim();
    const response = await api.post("/api/auth/login", {
      email: cleanIdentifier,
      username: cleanIdentifier,
      password: password,
    });

    const { user: userData } = response.data;

    localStorage.setItem("user", JSON.stringify(userData));

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

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch(err) {
      console.warn("Logout request failed", err);
    }
    clearAuth();
  };

  const roleStr = String(user?.role || "").toLowerCase();
  const isAdmin = roleStr === "admin";
  const isPhotographer = roleStr === "photographer" || (!isAdmin && !!user);

  // Authenticated ONLY when loading is done AND valid user profile exist
  const isAuthenticated = !loading && Boolean(user);

  const value = {
    user,
    loading,
    isAuthenticated,
    needsPasswordChange: Boolean(user?.needs_password_change),
    isAdmin,
    isPhotographer,
    login,
    changePassword,
    logout,
    refreshProfile,
    updateUser,
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
