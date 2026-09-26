import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: "",
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || "An unexpected error occurred." };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[PhotoGuard Enterprise ErrorBoundary]", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#06080d] flex items-center justify-center p-6 text-white">
          <div className="max-w-md w-full bg-[#0e131f] border border-red-500/30 rounded-2xl p-8 text-center shadow-2xl">
            <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-2">Application Interface Encountered an Error</h1>
            <p className="text-sm text-slate-400 mb-6 font-mono break-words bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              {this.state.errorMessage}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
