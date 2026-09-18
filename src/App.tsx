/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shield, Database, Server, CheckCircle2 } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 font-sans selection:bg-cyan-500 selection:text-white">
      <header className="flex items-center justify-between border-b border-slate-800 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/30 text-cyan-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">PhotoGuard</h1>
            <p className="text-xs text-slate-400">Master Blueprint v7.0 • Phase 2 Security Layer</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Auth & JWT Active
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-12 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            <span>FastAPI</span>
            <span className="text-slate-600">/</span>
            <span>Bcrypt</span>
            <span className="text-slate-600">/</span>
            <span>HS256 JWT</span>
            <span className="text-slate-600">/</span>
            <span>PostgreSQL Auth</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Unified Authentication & Security Layer
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Phase 2 security infrastructure is complete. Features cryptographically signed JWT issuance, bcrypt password verification, PostgreSQL user lookup, and role enforcement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">JWT & Bcrypt Engine</span>
              <Shield className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              Passlib Bcrypt hashing with configurable expiration and claims signed via HS256.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>app/core/security.py</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">Session Dependencies</span>
              <Database className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              get_current_user extracts bearer tokens and validates user existence in PostgreSQL.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>app/core/dependencies.py</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">Unified Login Route</span>
              <Server className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              POST /api/auth/login validates credentials and issues signed role payloads.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>app/api/auth.py</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>PhotoGuard Anti-Piracy Architecture • Production Target: Render</p>
        <p className="font-mono">v7.0.0-phase2</p>
      </footer>
    </div>
  );
}
