/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Shield, Cloud, Image as ImageIcon, HardDrive, CheckCircle2 } from 'lucide-react';

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
            <p className="text-xs text-slate-400">Master Blueprint v7.0 • Phase 5 Multi-Cloud Storage</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-3 py-1.5 rounded-full font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Multi-Cloud Storage Active
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full my-12 space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-400">
            <span>IDrive e2 (S3)</span>
            <span className="text-slate-600">/</span>
            <span>Cloudflare Edge</span>
            <span className="text-slate-600">/</span>
            <span>ImageKit WebP</span>
            <span className="text-slate-600">/</span>
            <span>Virtual Quota</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Multi-Cloud Storage Engine & Upload API
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl">
            Phase 5 is complete. High-resolution originals stream to IDrive e2 S3 origin, cached at Cloudflare edge, while ImageKit delivers on-the-fly WebP compression alongside SaaS Virtual Quota accounting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">IDrive e2 S3 Storage</span>
              <Cloud className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              Boto3 S3 client uploading raw files to IDrive origin storage with UUID prefixing.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>app/core/storage.py</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">Cloudflare & ImageKit</span>
              <ImageIcon className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              Dual CDN pipeline: Cloudflare raw caching and ImageKit on-the-fly WebP optimization.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>generate_cdn_urls()</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-sm font-medium">Virtual Quota Engine</span>
              <HardDrive className="w-4 h-4 text-cyan-400" />
            </div>
            <p className="text-xs text-slate-400">
              Accounts full original file sizes against plan quotas while storing compressed cloud bytes.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>app/api/media.py</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-900 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <p>PhotoGuard Anti-Piracy Architecture • Production Target: Render</p>
        <p className="font-mono">v7.0.0-phase5</p>
      </footer>
    </div>
  );
}
