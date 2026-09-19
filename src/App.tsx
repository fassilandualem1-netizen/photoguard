import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import ForceChangePassword from "./pages/ForceChangePassword";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/DashboardHome";
import AlbumDetail from "./pages/AlbumDetail";

// Protected Route Wrapper enforcing Authentication and First-Login Password Change
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsPasswordChange, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Verifying Session...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsPasswordChange) {
    return <Navigate to="/setup-password" replace />;
  }

  return <>{children}</>;
}

// Password Setup Wrapper: Accessible only if authenticated and password change is required
export function SetupPasswordRoute() {
  const { isAuthenticated, needsPasswordChange, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Checking Security Policies...
          </span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!needsPasswordChange) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ForceChangePassword
      onPasswordChanged={() => {
        navigate("/dashboard", { replace: true });
      }}
    />
  );
}

// Public Route Wrapper for Login (Redirects to dashboard if already authenticated)
export function LoginRoute() {
  const { isAuthenticated, needsPasswordChange, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            Loading PhotoGuard...
          </span>
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (needsPasswordChange) {
      return <Navigate to="/setup-password" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Login
      onLoginSuccess={(user: any) => {
        if (user?.needs_password_change) {
          navigate("/setup-password", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Login Route */}
        <Route path="/login" element={<LoginRoute />} />

        {/* Enterprise First-Login Password Change Route */}
        <Route path="/setup-password" element={<SetupPasswordRoute />} />

        {/* Protected Dashboard Route */}
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
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Catch-all Wildcard Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
