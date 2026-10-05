import React, { Component } from "react";
import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";

export class GlobalErrorBoundary extends Component {
  state = {
    hasError: false,
    errorMessage: "",
    isNetworkError: false,
  };

  static getDerivedStateFromError(error) {
    const msg = error?.message || "An unexpected error occurred.";
    const isNetwork =
      msg.toLowerCase().includes("network") ||
      msg.toLowerCase().includes("failed to fetch") ||
      msg.toLowerCase().includes("load chunk");
    return { hasError: true, errorMessage: msg, isNetworkError: isNetwork };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[PhotoGuard ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { isNetworkError, errorMessage } = this.state;
      return (
        <div className="min-h-screen bg-[#F6F7FB] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-lg">
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 border ${
                isNetworkError
                  ? "bg-amber-50 text-amber-500 border-amber-200"
                  : "bg-red-50 text-red-500 border-red-200"
              }`}
            >
              {isNetworkError ? (
                <WifiOff className="w-7 h-7" />
              ) : (
                <AlertTriangle className="w-7 h-7" />
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-900 tracking-tight mb-2">
              {isNetworkError ? "Connection Problem" : "Something went wrong"}
            </h1>

            <p className="text-sm text-slate-500 mb-2">
              {isNetworkError
                ? "Please check your internet connection and try again."
                : "An unexpected error occurred. Refreshing usually fixes this."}
            </p>

            {!isNetworkError && (
              <p className="text-xs text-slate-400 mb-6 font-mono break-words bg-slate-50 p-3 rounded-lg border border-slate-200">
                {errorMessage}
              </p>
            )}

            {isNetworkError && <div className="mb-6" />}

            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              {isNetworkError ? "Try Again" : "Reload Page"}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
