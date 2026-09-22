import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import ForceChangePassword from "./pages/ForceChangePassword";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import AlbumDetail from "./pages/AlbumDetail";
import AdminDashboard from "./pages/AdminDashboard";

// Shared Loading Spinner Screen
function LoadingScreen({ message = "Verifying Session..." }) {
  return (
    <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
        <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
          {message}
        </span>
      </div>
    </div>
  );
}

// Protected Route Wrapper for Photographers (Redirects Admins to /admin)
export function ProtectedRoute({ children }) {
  const { isAuthenticated, needsPasswordChange, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Verifying Session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsPasswordChange) {
    return <Navigate to="/setup-password" replace />;
  }

  return children;
}

// Admin Route Wrapper strictly enforcing Admin role
export function AdminRoute({ children }) {
  const { isAuthenticated, needsPasswordChange, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Verifying Admin Authorization..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsPasswordChange) {
    return <Navigate to="/setup-password" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// Password Setup Wrapper: Accessible only if authenticated and password change is required
export function SetupPasswordRoute() {
  const { isAuthenticated, needsPasswordChange, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen message="Checking Security Policies..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!needsPasswordChange) {
    return <Navigate to={isAdmin ? "/admin" : "/dashboard"} replace />;
  }

  return (
    <ForceChangePassword
      onPasswordChanged={() => {
        navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
      }}
    />
  );
}

// Public Route Wrapper for Login (Redirects authenticated users away from /login)
export function LoginRoute() {
  const { isAuthenticated, needsPasswordChange, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingScreen message="Loading PhotoGuard..." />;
  }

  if (isAuthenticated) {
    if (needsPasswordChange) {
      return <Navigate to="/setup-password" replace />;
    }
    if (isAdmin) {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Login
      onLoginSuccess={(user) => {
        if (user?.needs_password_change) {
          navigate("/setup-password", { replace: true });
        } else if (String(user?.role || "").toLowerCase() === "admin") {
          navigate("/admin", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }}
    />
  );
}

// Root Route Fallback: Forcefully directs unauthenticated visitors to /login
export function RootRoute() {
  const { isAuthenticated, needsPasswordChange, isAdmin, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Initializing PhotoGuard..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsPasswordChange) {
    return <Navigate to="/setup-password" replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Enterprise First-Login Password Change Route */}
        <Route path="/setup-password" element={<SetupPasswordRoute />} />

        {/* Super Admin Command Center Route */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />

        {/* Protected Photographer Dashboard Route */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardHome />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Protected Album Detail Route */}
        <Route
          path="/dashboard/albums/:id"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <AlbumDetail />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Root Redirect Fallback */}
        <Route path="/" element={<RootRoute />} />

        {/* Catch-all Wildcard Route */}
        <Route path="*" element={<RootRoute />} />
      </Routes>
    </BrowserRouter>
  );
}
