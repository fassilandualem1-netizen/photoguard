import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl p-8 max-w-lg w-full text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-bold">Something went wrong</h2>
            <p className="text-xs text-slate-400">
              {this.state.error?.message || "An unexpected error occurred while rendering the dashboard."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-xs shadow-lg transition"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import {
  Smartphone, Download, CheckCircle2, Lock, Sparkles, RefreshCw,
  ExternalLink, Heart, MessageSquare, AlertTriangle, ArrowLeft,
  Terminal, X, Database, Sliders, Film, Scissors, Copy, FileText,
  CheckCheck, Layers, Camera, Palette, Wand2, Eye
} from 'lucide-react';

interface MediaItem {
  id: number;
  album_id: number;
  filename: string;
  url: string;
  thumbnail_url?: string | null;
  is_selected: boolean;
  client_notes?: string | null;
}

interface AlbumDetail {
  id: number;
  title: string;
  client_name: string;
  pin: string;
  photographer_id: number;
  is_locked: boolean;
  allow_download: boolean;
  view_count: number;
  media_items: MediaItem[];
  creator_name?: string;
  photographer_name?: string;
  contact_phone?: string | null;
  telegram_url?: string | null;
}

interface DatabaseAlbum {
  id: number;
  title: string;
  pin: string;
  client_name: string;
  is_locked: boolean;
  allow_download: boolean;
  media_count: number;
  selected_count: number;
}

interface NetworkLog {
  id: string;
  timestamp: string;
  method: string;
  endpoint: string;
  status: number;
  durationMs: number;
  response: string;
  error?: boolean;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'exportSuite' | 'simulator' | 'albums' | 'diagnostics' | 'download'>('simulator');

  // Client app state inside the simulator
  const [screen, setScreen] = useState<'login' | 'gallery' | 'delivery'>('login');
  const [pin, setPin] = useState('998976');
  const [isAmharic, setIsAmharic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{ en: string; am: string } | null>(null);
  const [currentAlbum, setCurrentAlbum] = useState<AlbumDetail | null>(null);

  // 2-Step Review State: 1 = All Proofs, 2 = Review Selected Only
  const [simulatorStep, setSimulatorStep] = useState<1 | 2>(1);

  // Full-screen Instagram/Google Photos lightbox swipe state
  const [fullScreenIndex, setFullScreenIndex] = useState<number | null>(null);
  const fullScreenPhoto = fullScreenIndex !== null && currentAlbum ? currentAlbum.media_items[fullScreenIndex] || null : null;

  const handlePrevPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (fullScreenIndex !== null && fullScreenIndex > 0) {
      setFullScreenIndex(fullScreenIndex - 1);
    }
  };

  const handleNextPhoto = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (fullScreenIndex !== null && currentAlbum && fullScreenIndex < (currentAlbum?.media_items || []).length - 1) {
      setFullScreenIndex(fullScreenIndex + 1);
    }
  };

  // Note dialog state
  const [activeNotePhoto, setActiveNotePhoto] = useState<MediaItem | null>(null);
  // Job Sheet / Retouch Order Card Drawer State (Opens side-by-side with photo)
  const [activeJobSheetPhoto, setActiveJobSheetPhoto] = useState<MediaItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'jobsheet'>('jobsheet');
  const [tempNote, setTempNote] = useState('');

  // 100% Real Live Database Albums (Zero Mock Data)
  const [dbAlbums, setDbAlbums] = useState<DatabaseAlbum[]>([]);
  const [, setIsFetchingAlbums] = useState(false);

  // Real Network telemetry
  const [logs, setLogs] = useState<NetworkLog[]>([]);

  // Selected Album for Export Suite
  const [, setSelectedExportAlbumId] = useState<number>(7);
  const [copiedState, setCopiedState] = useState<string | null>(null);

  const addLog = (method: string, endpoint: string, status: number, durationMs: number, response: any, error = false) => {
    const newLog: NetworkLog = {
      id: Math.random().toString(36).substring(7),
      timestamp: new Date().toLocaleTimeString(),
      method,
      endpoint,
      status,
      durationMs,
      response: typeof response === 'string' ? response : JSON.stringify(response).substring(0, 160),
      error
    };
    setLogs(prev => [newLog, ...prev.slice(0, 39)]);
  };

  // Fetch real albums directly from PostgreSQL via live backend
  const fetchDbAlbums = async () => {
    setIsFetchingAlbums(true);
    try {
      const res = await fetch('/api/live/albums');
      if (res.ok) {
        const data = await res.json();
        setDbAlbums(data);
        if (data.length > 0) {
          setSelectedExportAlbumId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingAlbums(false);
    }
  };

  useEffect(() => {
    fetchDbAlbums();
    // Default load album 998976 for instant review
    executeVerify('998976');
  }, []);

  // PIN input logic
  const handleDigitPress = (digit: string) => {
    if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMessage(null);
      if (newPin.length === 6) {
        executeVerify(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMessage(null);
  };

  // Real call to Render FastAPI endpoint: /api/v1/client/verify
  const executeVerify = async (pinToVerify: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    const start = performance.now();
    try {
      const res = await fetch('/api/v1/client/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinToVerify })
      });
      const duration = Math.round(performance.now() - start);
      const data = await res.json();

      addLog('POST', '/api/v1/client/verify', res.status, duration, data, !res.ok);

      if (res.ok) {
        setCurrentAlbum(data);
        setSelectedExportAlbumId(data.id);
        setSimulatorStep(1);
        if (data.is_locked) {
          setScreen('delivery');
        } else {
          setScreen('gallery');
        }
      } else {
        const detail = data.detail || 'Album not found';
        setErrorMessage({
          en: `Error ${res.status}: ${detail}`,
          am: res.status === 404
            ? `ያስገቡት ፒን (${pinToVerify}) አልበም አልተገኘለትም። እባክዎ ከላይ ያሉትን ትክክለኛ ፒኖች ይጠቀሙ።`
            : `ስህተት ተከስቷል (${res.status}): ${detail}`
        });
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - start);
      addLog('POST', '/api/v1/client/verify', 0, duration, err.message, true);
      setErrorMessage({
        en: `Network error: ${err.message}`,
        am: 'የኔትዎርክ ግንኙነት ስህተት ተከስቷል።'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Real call to update photo selection
  const handleToggleSelect = async (photoId: number) => {
    if (!currentAlbum || currentAlbum.is_locked) return;
    const target = (currentAlbum?.media_items || []).find(m => m.id === photoId);
    if (!target) return;
    const nextSelected = !target.is_selected;

    // Optimistic UI update
    setCurrentAlbum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        media_items: prev.media_items.map(m => m.id === photoId ? { ...m, is_selected: nextSelected } : m)
      };
    });

    if (fullScreenPhoto && fullScreenPhoto.id === photoId) {
      setFullScreenPhoto(prev => prev ? { ...prev, is_selected: nextSelected } : null);
    }

    const start = performance.now();
    try {
      const res = await fetch(`/api/v1/client/media/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: currentAlbum.pin,
          is_selected: nextSelected
        })
      });
      const data = await res.json();
      addLog('PATCH', `/api/v1/client/media/${photoId}`, res.status, Math.round(performance.now() - start), data, !res.ok);
    } catch (err: any) {
      addLog('PATCH', `/api/v1/client/media/${photoId}`, 0, Math.round(performance.now() - start), err.message, true);
    }
  };

  // Real call to save retouching feedback note
  const handleSaveNote = async () => {
    if (!activeNotePhoto || !currentAlbum) return;
    const photoId = activeNotePhoto.id;
    const noteText = tempNote.trim();

    setCurrentAlbum(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        media_items: prev.media_items.map(m => m.id === photoId ? { ...m, client_notes: noteText } : m)
      };
    });

    if (fullScreenPhoto && fullScreenPhoto.id === photoId) {
      setFullScreenPhoto(prev => prev ? { ...prev, client_notes: noteText } : null);
    }

    setActiveNotePhoto(null);

    const start = performance.now();
    try {
      const res = await fetch(`/api/v1/client/media/${photoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: currentAlbum.pin,
          client_notes: noteText
        })
      });
      const data = await res.json();
      addLog('PATCH', `/api/v1/client/media/${photoId}`, res.status, Math.round(performance.now() - start), data, !res.ok);
    } catch (err: any) {
      addLog('PATCH', `/api/v1/client/media/${photoId}`, 0, Math.round(performance.now() - start), err.message, true);
    }
  };

  // Direct Ingest Generator for Professional Editing Suites
  const getSelectedItems = () => {
    if (!currentAlbum) return [];
    const selected = (currentAlbum?.media_items || []).filter(m => m.is_selected);
    return selected.length > 0 ? selected : currentAlbum.media_items;
  };

  // Print / Export Job Sheet Function
  const handlePrintJobSheet = () => {
    window.print();
  };

  // 1. Copy Filenames for Lightroom / Photoshop / Capture One Library Search
  const copyFilenamesSearch = (suiteName: string) => {
    const items = getSelectedItems();
    // Clean camera filenames without extension for instant Lightroom/Capture One Library Search
    const text = items.map(i => i.filename.replace(/\.[^/.]+$/, "")).join(" ");
    navigator.clipboard.writeText(text);
    setCopiedState(suiteName);
    setTimeout(() => setCopiedState(null), 3000);
  };

  // 2. Direct Open in Photoshop / Browser Tabs
  const openDirectInEditor = () => {
    const items = getSelectedItems();
    items.slice(0, 10).forEach(item => {
      window.open(item.url, '_blank');
    });
  };

  // 3. Generate Multi-Editor Ingest Manifest (CapCut, Premiere Pro, DaVinci Resolve)
  const downloadVideoIngestManifest = () => {
    const items = getSelectedItems();
    let csv = "Index,Camera_Filename,Shoot_Proof_URL,Client_Retouch_Notes\n";
    items.forEach((item, idx) => {
      csv += `${idx + 1},"${item.filename}","${item.url}","${(item.client_notes || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentAlbum?.title || 'album').replace(/[^a-zA-Z0-9_-]/g, '_')}_editor_manifest.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 4. Download Adobe Bridge, Capture One & Lightroom Filenames List (.txt)
  const downloadShootProofsManifest = () => {
    const items = getSelectedItems();
    const filenames = items.map(i => i.filename).join("\n");
    const blob = new Blob([filenames], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentAlbum?.title || 'album').replace(/[^a-zA-Z0-9_-]/g, '_')}_shoot_proofs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header with App-matching PhotoGuard Shield Favicon */}
      <header className="w-full bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1 shadow-md">
              <img src="/favicon.svg" alt="PhotoGuard Logo" className="w-8 h-8 select-none" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight">PhotoGuard</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live PostgreSQL & Render
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  Favicon Synced 🛡️
                </span>
              </div>
              <p className="text-xs text-slate-400">Direct Ingest Suite for Lightroom, Photoshop, Capture One, CapCut & Premiere</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('exportSuite')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'exportSuite' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-amber-300" />
              <span>Direct Editor Export Suite</span>
            </button>
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'simulator' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile Client App</span>
            </button>
            <button
              onClick={() => setActiveTab('albums')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'albums' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Live Database ({dbAlbums.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('diagnostics')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'diagnostics' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Telemetry</span>
            </button>
            <button
              onClick={() => setActiveTab('download')}
              className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 ${
                activeTab === 'download' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download APK</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main View Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col justify-start items-center">
        {/* TAB 1: Direct Editor Export Suite (Zero-ZIP, Direct to Lightroom/Photoshop/Capture One/CapCut) */}
        {activeTab === 'exportSuite' && (
          <div className="w-full max-w-5xl space-y-6">
            {/* Header info */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold">
                      Zero-ZIP Direct Ingest Architecture
                    </span>
                    <span className="text-xs text-slate-400">Pure professional workflow • No extraction hassle</span>
                  </div>
                  <h2 className="text-2xl font-black text-white tracking-tight">
                    Direct Export to Lightroom, Photoshop, Capture One, CapCut & Premiere
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    ፎቶግራፈሮች ዚፕ ፋይል ኤክስትራክት ሳያደርጉ ካሜራቸው ላይ ከነበሩት ፎቶዎች መካከል በደንበኛው የተመረጡትን በ 1 ሰከንድ ውስጥ በቀጥታ ወደ ላይትሩም፣ ፎቶሾፕ፣ ካፕቸር ዋን ወይም ቪዲዮ ኤዲተሮች እንዲያስገቡ የተዘጋጀ ፕሮፌሽናል ሲስተም።
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 bg-slate-950/80 p-2 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 pl-2">Active Shoot:</span>
                  <select
                    value={currentAlbum?.pin || '998976'}
                    onChange={e => {
                      setPin(e.target.value);
                      executeVerify(e.target.value);
                    }}
                    className="bg-slate-900 text-white border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                  >
                    {dbAlbums.map(a => (
                      <option key={a.id} value={a.pin}>
                        PIN {a.pin} — {a.title} ({a.media_count} proofs)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Ingest Tools Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Option 1: Adobe Lightroom Classic */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-xl group">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 group-hover:scale-105 transition">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>Adobe Lightroom</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    ካሜራው ላይ የነበሩትን ፎቶዎች በደንበኛው የተመረጡትን ስሞች (Filenames) ኮፒ አድርገው <strong>Library Filter</strong> ላይ Paste ሲያደርጉ ወዲያው ይለያል።
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={() => copyFilenamesSearch('lightroom')}
                    className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-sky-600/30 transition active:scale-98"
                  >
                    {copiedState === 'lightroom' ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-300" />
                        <span>Copied! ✓</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Lightroom Filter</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadShootProofsManifest}
                    className="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] flex items-center justify-center gap-1 border border-slate-700 transition"
                  >
                    <FileText className="w-3 h-3 text-slate-400" />
                    <span>Export Proofs List (.txt)</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Adobe Photoshop */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-xl group">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-105 transition">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>Adobe Photoshop</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    የተመረጡትን ፎቶዎች ያለምንም ዚፕ መክፈቻ በቀጥታ በብራውዘር ታቦች በመክፈት ወደ Photoshop Drag & Drop ለማድረግ ወይም በቀጥታ Save ለማድረግ ያስችላል።
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={openDirectInEditor}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 transition active:scale-98"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open in Photoshop / Edit</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-500">Opens proofs directly for retouching</p>
                </div>
              </div>

              {/* Option 3: Capture One Pro */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-xl group">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 group-hover:scale-105 transition">
                    <Camera className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>Capture One Pro</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    ለ Capture One ተጠቃሚዎች የፎቶዎቹን ስም ወደ Filter Collection Search በመላክ የተመረጡትን ፎቶዎች ነጥሎ ለማውጣት ያገለግላል።
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={() => copyFilenamesSearch('captureOne')}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-amber-600/30 transition active:scale-98"
                  >
                    {copiedState === 'captureOne' ? (
                      <>
                        <CheckCheck className="w-4 h-4 text-emerald-300" />
                        <span>Copied! ✓</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Capture One Filter</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-slate-500">Paste in Capture One Filter Bar</p>
                </div>
              </div>

              {/* Option 4: CapCut, Premiere Pro & DaVinci Resolve */}
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between hover:border-indigo-500/50 transition-all shadow-xl group">
                <div>
                  <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 group-hover:scale-105 transition">
                    <Scissors className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
                    <span>CapCut & Premiere</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    ለቲክቶክ እና ሪልስ የቪዲዮ ስላይድሾው፣ የፎቶዎቹን የካሜራ ስም እና የደንበኛውን ኖት የያዘ <strong>Ingest Manifest (.csv)</strong> ያወርዳል።
                  </p>
                </div>

                <div className="pt-4 space-y-2">
                  <button
                    onClick={downloadVideoIngestManifest}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/30 transition active:scale-98"
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Download Video Ingest (.csv)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-500">Includes notes & filenames</p>
                </div>
              </div>
            </div>

            {/* Retouch Order Cards & Studio Job Sheet (All Editors: Lightroom, Photoshop, Premiere, CapCut, Capture One) */}
            {currentAlbum && (
              <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 space-y-6 shadow-2xl">
                {/* Header with Switcher between Interactive Job Sheet & Compact Grid */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Retouch Order Sheet & Studio Job Cards</span>
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-mono font-bold">
                          {(currentAlbum?.media_items || []).filter(m => m.is_selected).length} Selected for Edit
                        </span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Shoot: <span className="text-white font-semibold">{currentAlbum.title}</span> (PIN: {currentAlbum.pin}) • Client: <span className="text-slate-300 font-medium">{currentAlbum.client_name}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs">
                      <button
                        onClick={() => setViewMode('jobsheet')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                          viewMode === 'jobsheet' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Job Cards</span>
                      </button>
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center gap-1.5 ${
                          viewMode === 'grid' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Compact Grid</span>
                      </button>
                    </div>

                    <button
                      onClick={handlePrintJobSheet}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 shadow transition"
                      title="Print or Save Job Sheet as PDF"
                    >
                      <span>🖨️ Print Job Sheet</span>
                    </button>
                  </div>
                </div>

                {/* VIEW 1: Retouch Order Cards (Camera Filename + Instruction Card side-by-side) */}
                {viewMode === 'jobsheet' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400">
                      እያንዳንዱ ፎቶ ከነ ካሜራ ስሙ (Filename) እና ደንበኛው ከሰጠው የማስተካከያ ትዕዛዝ (Frame size, retouching, cropping) ጋር ጎን ለጎን ተደርድሯል። ፎቶውን ሲነኩት በትልቁ ይከፈታል።
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentAlbum.media_items
                        .filter(m => m.is_selected)
                        .map((photo, index) => (
                          <div
                            key={photo.id}
                            onClick={() => setActiveJobSheetPhoto(photo)}
                            className="bg-slate-950/80 hover:bg-slate-950 border border-slate-800 hover:border-indigo-500/60 rounded-2xl p-3.5 flex gap-3.5 cursor-pointer transition shadow-lg group relative"
                          >
                            {/* Photo Thumbnail */}
                            <div className="relative w-28 h-28 rounded-xl overflow-hidden shrink-0 border border-slate-800 group-hover:border-indigo-500/40">
                              <img
                                src={photo.thumbnail_url || photo.url}
                                alt={photo.filename}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-white font-bold">
                                #{index + 1}
                              </div>
                            </div>

                            {/* Job Sheet Sidecar Card */}
                            <div className="flex-1 flex flex-col justify-between overflow-hidden">
                              <div>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-xs font-bold text-white truncate max-w-[170px]" title={photo.filename}>
                                    {photo.filename}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold shrink-0">
                                    Selected ✓
                                  </span>
                                </div>

                                {/* Retouch Instruction Callout Box */}
                                <div className="mt-2 p-2 rounded-xl bg-slate-900 border border-slate-800/80 text-xs">
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    <MessageSquare className="w-3 h-3 text-emerald-400" />
                                    <span>Client Retouch Order:</span>
                                  </div>
                                  <p className="text-slate-200 text-xs leading-relaxed italic line-clamp-2">
                                    {photo.client_notes ? `"${photo.client_notes}"` : "Standard beauty retouching & color grading"}
                                  </p>
                                </div>
                              </div>

                              {/* Action Footer for this specific photo */}
                              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                                <span className="text-[10px] text-indigo-400 font-medium">Click to inspect ➔</span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(photo.filename.replace(/\.[^/.]+$/, ""));
                                    }}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition"
                                    title="Copy raw filename"
                                  >
                                    Copy Name
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(photo.url, '_blank');
                                    }}
                                    className="px-2 py-0.5 rounded bg-blue-600/80 hover:bg-blue-600 text-white text-[10px] font-medium transition"
                                  >
                                    Open
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* VIEW 2: Compact Proofs Grid */}
                {viewMode === 'grid' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {(currentAlbum?.media_items || []).map(photo => (
                      <div
                        key={photo.id}
                        onClick={() => setActiveJobSheetPhoto(photo)}
                        className={`relative rounded-2xl overflow-hidden border cursor-pointer group transition-all ${
                          photo.is_selected
                            ? 'border-indigo-500 ring-2 ring-indigo-500/40'
                            : 'border-slate-800 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={photo.thumbnail_url || photo.url}
                          alt={photo.filename}
                          className="w-full h-28 object-cover group-hover:scale-105 transition"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>

                        <div className="absolute top-1.5 right-1.5">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                            photo.is_selected ? 'bg-indigo-600 text-white' : 'bg-black/60 text-slate-400'
                          }`}>
                            <Heart className={`w-3.5 h-3.5 ${photo.is_selected ? 'fill-current' : ''}`} />
                          </div>
                        </div>

                        <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] text-white truncate font-mono">
                          {photo.filename}
                        </div>

                        {photo.client_notes && (
                          <div className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-emerald-600 text-[8px] text-white font-sans font-bold">
                            NOTE
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SIDE-BY-SIDE RETOUCH ORDER INSPECTOR MODAL (Shows photo on Left, Client Instructions on Right) */}
            {activeJobSheetPhoto && (
              <div 
                className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
                onClick={() => setActiveJobSheetPhoto(null)}
              >
                <div 
                  className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col md:flex-row max-h-[85vh]"
                  onClick={e => e.stopPropagation()}
                >
                  {/* Left: 4K Crisp Photo Preview */}
                  <div className="md:w-3/5 bg-black flex items-center justify-center p-4 relative min-h-[300px]">
                    <img
                      src={activeJobSheetPhoto.url}
                      alt={activeJobSheetPhoto.filename}
                      className="max-h-[60vh] max-w-full object-contain rounded-lg"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/70 font-mono text-xs text-white">
                      {activeJobSheetPhoto.filename}
                    </div>
                  </div>

                  {/* Right: Client Retouch Order Card */}
                  <div className="md:w-2/5 p-6 flex flex-col justify-between bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div>
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                            Studio Job Order Card
                          </span>
                          <h4 className="text-base font-bold text-white mt-0.5">
                            {activeJobSheetPhoto.filename}
                          </h4>
                        </div>
                        <button
                          onClick={() => setActiveJobSheetPhoto(null)}
                          className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Client Order Instruction Box */}
                      <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                          <MessageSquare className="w-4 h-4" />
                          <span>Client Feedback & Retouching Order:</span>
                        </div>
                        <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                          {activeJobSheetPhoto.client_notes || "ደንበኛው ምንም አይነት ለየት ያለ ኖት አላስቀመጠም። መደበኛውን የፎቶ ኤዲቲንግ እና የከለር ግሬዲንግ ስራ ያካሂዱ።"}
                        </p>
                      </div>

                      {/* Photo details */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1.5 text-slate-400">
                        <div className="flex justify-between">
                          <span>Status:</span>
                          <span className="text-emerald-400 font-semibold">Selected for Editing</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Shoot Name:</span>
                          <span className="text-slate-200 font-medium">{currentAlbum?.title}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Client:</span>
                          <span className="text-slate-200 font-medium">{currentAlbum?.client_name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons for Lightroom, Photoshop, Premiere, CapCut */}
                    <div className="pt-4 space-y-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(activeJobSheetPhoto.filename.replace(/\.[^/.]+$/, ""));
                          alert(`Copied "${activeJobSheetPhoto.filename}" for Lightroom/Capture One/Premiere search!`);
                        }}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Camera Name for Filter</span>
                      </button>

                      <button
                        onClick={() => window.open(activeJobSheetPhoto.url, '_blank')}
                        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center justify-center gap-2 transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open in Photoshop / Direct Tab</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
{/* TAB 2: Mobile Client Simulator (With Instagram Lightbox) */}
        {activeTab === 'simulator' && (
          <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
            <div className="max-w-md w-full space-y-4 text-left">
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
                <div className="flex items-center gap-2 text-indigo-400 text-sm font-semibold mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Real-Time Client App Preview</span>
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Perceptual Lossless 4K Display & Client Retouching
                </h3>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  Every selection and retouching note is saved live to Neon PostgreSQL and synchronized to the photographer:
                </p>

                <ul className="mt-4 space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Perceptual Lossless 4K Rendering</strong>: GPU Hardware Acceleration ensures razor-sharp text and zero moiré glitches.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Full-Screen Lightbox View</strong>: View proofs in full-screen with double-tap zoom support.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>Dedicated Retouch Notes</strong>: Specify skin retouching, color grading, or background preferences per photo.</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Smartphone Frame */}
            <div className="relative w-full max-w-[390px] h-[780px] bg-slate-950 rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col">
              {/* Notch */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-800 rounded-full z-40 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-950 mr-2"></div>
                <div className="w-8 h-1 bg-slate-900 rounded-full"></div>
              </div>

              {/* Full-Screen Instagram/Google Photos Swipe Lightbox Modal */}
              {fullScreenPhoto && fullScreenIndex !== null && currentAlbum && (
                <div 
                  className="absolute inset-0 z-50 bg-black flex flex-col justify-between animate-fadeIn select-none"
                  onTouchStart={(e) => {
                    (window as any).__touchStartX = e.touches[0].clientX;
                  }}
                  onTouchEnd={(e) => {
                    const startX = (window as any).__touchStartX;
                    if (startX !== undefined) {
                      const diff = e.changedTouches[0].clientX - startX;
                      if (diff > 50) handlePrevPhoto(); // Swiped right -> prev
                      if (diff < -50) handleNextPhoto(); // Swiped left -> next
                    }
                  }}
                >
                  {/* Top Bar with Position Counter & Filename */}
                  <div className="p-3.5 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/60 to-transparent z-10">
                    <button
                      onClick={() => setFullScreenIndex(null)}
                      className="p-2 rounded-full bg-black/60 text-white hover:bg-black/90 transition"
                      title="Close"
                    >
                      <X className="w-4 h-4" />
                    </button>

                    {/* Counter & Filename */}
                    <div className="text-center">
                      <span className="text-xs font-bold text-white block">
                        {fullScreenIndex + 1} of {(currentAlbum?.media_items || []).length}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[140px] block">
                        {fullScreenPhoto.filename}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleSelect(fullScreenPhoto.id)}
                      className={`p-2 rounded-full transition ${
                        fullScreenPhoto.is_selected
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/50'
                          : 'bg-black/60 text-white/80 hover:text-white'
                      }`}
                      title="Select"
                    >
                      <Heart className={`w-4 h-4 ${fullScreenPhoto.is_selected ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  {/* Image Display with Left/Right Navigation Chevron Controls */}
                  <div className="flex-1 relative flex items-center justify-center p-2 overflow-hidden">
                    {/* Previous Photo Button */}
                    {fullScreenIndex > 0 && (
                      <button
                        onClick={handlePrevPhoto}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 z-20 transition"
                        title="Previous photo"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                    )}

                    <img
                      src={fullScreenPhoto.url}
                      alt={fullScreenPhoto.filename}
                      className="max-h-full max-w-full object-contain select-none transition-all duration-200"
                    />

                    {/* Next Photo Button */}
                    {fullScreenIndex < (currentAlbum?.media_items || []).length - 1 && (
                      <button
                        onClick={handleNextPhoto}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/80 z-20 transition"
                        title="Next photo"
                      >
                        <ArrowLeft className="w-5 h-5 rotate-180" />
                      </button>
                    )}
                  </div>

                  {/* Bottom Bar: Client Notes & Selection Toggle */}
                  <div className="p-3.5 bg-gradient-to-t from-black/95 via-black/80 to-transparent space-y-2.5 z-10">
                    {fullScreenPhoto.client_notes && (
                      <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-emerald-300 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="truncate">
                          <span className="font-semibold block text-[9px] text-slate-400">Retouching Note:</span>
                          <span className="text-[11px]">{fullScreenPhoto.client_notes}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setActiveNotePhoto(fullScreenPhoto);
                          setTempNote(fullScreenPhoto.client_notes || '');
                        }}
                        className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>{fullScreenPhoto.client_notes ? 'Edit Note' : 'Add Note'}</span>
                      </button>

                      <button
                        onClick={() => handleToggleSelect(fullScreenPhoto.id)}
                        className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                          fullScreenPhoto.is_selected
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${fullScreenPhoto.is_selected ? 'fill-current' : ''}`} />
                        <span>{fullScreenPhoto.is_selected ? 'Selected' : 'Select Photo'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {/* Note Dialog Modal inside Simulator */}
              {activeNotePhoto && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="w-full bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 shadow-2xl">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-400" />
                        <span>Retouching Feedback</span>
                      </h4>
                      <button
                        onClick={() => setActiveNotePhoto(null)}
                        className="p-1 rounded-lg text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Write instructions for photo <span className="font-mono text-slate-200">#{activeNotePhoto.id}</span>:
                    </p>

                    <textarea
                      value={tempNote}
                      onChange={e => setTempNote(e.target.value)}
                      placeholder="e.g. Please soften lighting, remove background reflection, or adjust contrast"
                      rows={3}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => setActiveNotePhoto(null)}
                        className="flex-1 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveNote}
                        className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Screen Content */}
              <div className="w-full h-full pt-6 flex flex-col bg-slate-950 text-slate-100 select-none overflow-y-auto">
                {/* 1. Login Screen */}
                {screen === 'login' && (
                  <div className="flex-1 flex flex-col justify-between p-6 text-center">
                    <div className="flex justify-end">
                      <button
                        onClick={() => setIsAmharic(!isAmharic)}
                        className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded-lg bg-indigo-500/10"
                      >
                        {isAmharic ? 'English' : 'አማርኛ'}
                      </button>
                    </div>

                    <div className="my-auto space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-full bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center p-2 shadow-lg shadow-indigo-600/10">
                        <img src="/favicon.svg" alt="PhotoGuard Logo" className="w-10 h-10 select-none" />
                      </div>
                      <h2 className="text-2xl font-black tracking-tight text-white">PhotoGuard</h2>
                      <p className="text-xs text-slate-400 max-w-[260px] mx-auto leading-relaxed">
                        {isAmharic
                          ? 'ፎቶዎችን ለመምረጥ ባለ 6 አሃዝ ሚስጥር ቁጥር ያስገቡ'
                          : 'Enter your 6-digit access PIN to unlock your shoot proofs'}
                      </p>

                      <div className="pt-4 flex justify-center gap-2">
                        {Array.from({ length: 6 }).map((_, idx) => {
                          const char = pin[idx];
                          const isFocused = pin.length === idx;
                          return (
                            <div
                              key={idx}
                              className={`w-11 h-12 rounded-xl flex items-center justify-center text-xl font-bold font-mono transition-all ${
                                isFocused
                                  ? 'border-2 border-indigo-500 bg-indigo-500/10 text-white scale-105'
                                  : char
                                  ? 'border border-indigo-500/50 bg-indigo-500/5 text-white'
                                  : 'border border-slate-800 bg-slate-900/60 text-slate-600'
                              }`}
                            >
                              {char || ''}
                            </div>
                          );
                        })}
                      </div>

                      {errorMessage && (
                        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                          <span>{isAmharic ? errorMessage.am : errorMessage.en}</span>
                        </div>
                      )}
                    </div>

                    {/* Numeric Keypad */}
                    <div className="mt-auto space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                          <button
                            key={num}
                            onClick={() => handleDigitPress(num)}
                            disabled={isLoading}
                            className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-800 active:bg-indigo-600/40 text-lg font-semibold text-slate-200 border border-slate-800/80 transition"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          onClick={() => setPin('')}
                          disabled={isLoading || pin.length === 0}
                          className="h-12 rounded-xl bg-slate-900/40 hover:bg-slate-800 text-xs font-medium text-slate-400 border border-slate-800/60 transition"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => handleDigitPress('0')}
                          disabled={isLoading}
                          className="h-12 rounded-xl bg-slate-900/80 hover:bg-slate-800 active:bg-indigo-600/40 text-lg font-semibold text-slate-200 border border-slate-800/80 transition"
                        >
                          0
                        </button>
                        <button
                          onClick={handleBackspace}
                          disabled={isLoading || pin.length === 0}
                          className="h-12 rounded-xl bg-slate-900/40 hover:bg-slate-800 text-sm font-semibold text-slate-300 border border-slate-800/60 transition flex items-center justify-center"
                        >
                          ⌫
                        </button>
                      </div>

                      <button
                        onClick={() => executeVerify(pin)}
                        disabled={isLoading || pin.length !== 6}
                        className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition ${
                          pin.length === 6 && !isLoading
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                        }`}
                      >
                        {isLoading ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Lock className="w-4 h-4" />
                            <span>{isAmharic ? 'አልበም ክፈት' : 'Unlock Proofs'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Gallery Screen */}
                {screen === 'gallery' && currentAlbum && (
                  <div className="flex-1 flex flex-col h-full bg-slate-950">
                    {/* Top Bar with Studio Logo, Name, Verified Badge & Sign Out */}
                    <div className="px-3.5 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2.5">
                        {simulatorStep === 2 ? (
                          <button
                            onClick={() => setSimulatorStep(1)}
                            className="p-1 rounded-lg bg-slate-800 text-white hover:bg-slate-700 transition"
                            title="Back to All Proofs"
                          >
                            <ArrowLeft className="w-4 h-4" />
                          </button>
                        ) : null}

                        {/* Studio Logo / Avatar */}
                        <div className="w-8 h-8 rounded-full border border-indigo-500/60 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                          <span className="text-xs font-black text-indigo-400">
                            {(currentAlbum.photographer_name || currentAlbum.creator_name || 'PG').substring(0, 2).toUpperCase()}
                          </span>
                        </div>

                        <div>
                          <div className="flex items-center gap-1">
                            <h4 className="text-xs font-bold text-white truncate max-w-[130px]">
                              {currentAlbum.photographer_name || currentAlbum.creator_name || 'PhotoGuard Studio'}
                            </h4>
                            <span className="w-3 h-3 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[8px] font-bold">
                              ✓
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 block -mt-0.5">
                            {simulatorStep === 1
                              ? `Proofs (${(currentAlbum?.media_items || []).length})`
                              : `Review Selected (${(currentAlbum?.media_items || []).filter(m => m.is_selected).length})`}
                          </span>
                        </div>
                      </div>

                      {/* Sign Out / Exit Icon Button */}
                      <button
                        onClick={() => {
                          setScreen('login');
                          setPin('');
                          setCurrentAlbum(null);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                        title="Sign Out of Album"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* STEP 1: All Proofs Grid */}
                    {simulatorStep === 1 && (
                      <div className="flex-1 p-3 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2.5 pb-20">
                          {(currentAlbum?.media_items || []).map((photo, idx) => (
                            <div
                              key={photo.id}
                              onClick={() => setFullScreenIndex(idx)}
                              className={`group relative rounded-xl overflow-hidden cursor-pointer border transition-all ${
                                photo.is_selected
                                  ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                                  : 'border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <img
                                src={photo.thumbnail_url || photo.url}
                                alt={photo.filename}
                                className="w-full h-36 object-cover bg-slate-900 group-hover:scale-105 transition duration-300"
                                loading="lazy"
                              />

                              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80"></div>

                              {/* Retouch Note Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveNotePhoto(photo);
                                  setTempNote(photo.client_notes || '');
                                }}
                                className={`absolute top-2 left-2 p-1.5 rounded-full backdrop-blur transition ${
                                  photo.client_notes
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-black/50 text-white/90 hover:bg-black/80'
                                }`}
                                title="Add Retouching Note"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>

                              {/* Heart Selection Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelect(photo.id);
                                }}
                                className={`absolute top-2 right-2 p-1.5 rounded-full backdrop-blur transition ${
                                  photo.is_selected
                                    ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/40'
                                    : 'bg-black/50 text-white/80 hover:text-white'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${photo.is_selected ? 'fill-current' : ''}`} />
                              </button>

                              {photo.client_notes && (
                                <div className="absolute bottom-2 left-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-emerald-300 truncate">
                                  📝 {photo.client_notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Dedicated "Review Selected Only" Page */}
                    {simulatorStep === 2 && (
                      <div className="flex-1 p-3 overflow-y-auto">
                        <div className="mb-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
                          <span>Reviewing chosen photos before submit</span>
                          <span className="font-bold text-indigo-400 font-mono">
                            {(currentAlbum?.media_items || []).filter(m => m.is_selected).length} Selected
                          </span>
                        </div>

                        {(currentAlbum?.media_items || []).filter(m => m.is_selected).length === 0 ? (
                          <div className="py-16 text-center space-y-3">
                            <p className="text-xs text-slate-500">No photos selected yet.</p>
                            <button
                              onClick={() => setSimulatorStep(1)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
                            >
                              Choose Photos
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2.5 pb-20">
                            {(currentAlbum?.media_items || []).filter(m => m.is_selected).map((photo) => (
                              <div
                                key={photo.id}
                                className="group relative rounded-xl overflow-hidden border border-indigo-500/60 bg-slate-900 shadow-md"
                              >
                                <img
                                  src={photo.thumbnail_url || photo.url}
                                  alt={photo.filename}
                                  onClick={() => setFullScreenIndex(idx)}
                                  className="w-full h-32 object-cover cursor-pointer"
                                />

                                {/* Remove Button */}
                                <button
                                  onClick={() => handleToggleSelect(photo.id)}
                                  className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600/90 text-white hover:bg-rose-500 transition shadow"
                                  title="Remove from selection"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>

                                <div className="p-2 space-y-1">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-bold text-slate-300 truncate max-w-[90px]">{photo.filename}</span>
                                    <button
                                      onClick={() => {
                                        setActiveNotePhoto(photo);
                                        setTempNote(photo.client_notes || '');
                                      }}
                                      className="text-indigo-400 hover:text-indigo-300 font-medium"
                                    >
                                      Edit Note
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-emerald-300/90 truncate">
                                    {photo.client_notes ? `📝 ${photo.client_notes}` : 'No note added'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bottom Action Bar */}
                    <div className="p-3 bg-slate-900/95 border-t border-slate-800 shrink-0">
                      {simulatorStep === 1 ? (
                        <button
                          onClick={() => setSimulatorStep(2)}
                          disabled={(currentAlbum?.media_items || []).filter(m => m.is_selected).length === 0}
                          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                        >
                          <span>Review Selected ({(currentAlbum?.media_items || []).filter(m => m.is_selected).length})</span>
                          <span className="text-sm">➔</span>
                        </button>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSimulatorStep(1)}
                            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white border border-slate-700 transition"
                          >
                            Add More
                          </button>
                          <button
                            onClick={() => {
                              setScreen('delivery');
                            }}
                            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Final Submit to Studio 🔒</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* 3. Delivery Screen with Studio Contacts & Social Links */}
                {screen === 'delivery' && currentAlbum && (
                  <div className="flex-1 flex flex-col justify-between p-5 text-center overflow-y-auto">
                    <div className="space-y-4 my-auto">
                      <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Lock className="w-7 h-7" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Selections Finalized!</h3>
                        <p className="text-[11px] text-slate-400 max-w-[260px] mx-auto leading-relaxed mt-1">
                          Your photo choices have been transmitted directly to the studio. Your photographer is now working on high-end color grading and retouching.
                        </p>
                      </div>

                      {/* Shoot Summary Box */}
                      <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-left space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Studio:</span>
                          <span className="text-white font-medium">
                            {currentAlbum.photographer_name || currentAlbum.creator_name || 'PhotoGuard Studio'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Selected Proofs:</span>
                          <span className="text-emerald-400 font-bold">
                            {(currentAlbum?.media_items || []).filter(m => m.is_selected).length}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Workflow Status:</span>
                          <span className="text-amber-400 font-semibold">In Studio Retouching</span>
                        </div>
                      </div>

                      {/* Studio Official Contacts & Social Channels */}
                      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-2.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Official Studio Contacts & Channels
                        </span>

                        <div className="space-y-1.5">
                          {/* Direct Phone Call */}
                          <a
                            href={currentAlbum.contact_phone ? `tel:${currentAlbum.contact_phone}` : 'tel:+251911234567'}
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 transition text-xs group"
                          >
                            <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                              <span className="text-emerald-400">📞</span>
                              <span className="font-medium">Direct Phone Call</span>
                            </div>
                            <span className="text-[11px] text-indigo-400 font-mono">
                              {currentAlbum.contact_phone || '+251 91 123 4567'}
                            </span>
                          </a>

                          {/* Telegram Channel / Direct Chat */}
                          <a
                            href={currentAlbum.telegram_url || 'https://t.me/photoguard'}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 transition text-xs group"
                          >
                            <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                              <span className="text-sky-400">✈️</span>
                              <span className="font-medium">Telegram Channel</span>
                            </div>
                            <span className="text-[11px] text-sky-400">Chat ➔</span>
                          </a>

                          {/* Instagram Portfolio */}
                          <a
                            href="https://instagram.com"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 transition text-xs group"
                          >
                            <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                              <span className="text-pink-400">📸</span>
                              <span className="font-medium">Instagram Portfolio</span>
                            </div>
                            <span className="text-[11px] text-pink-400">Follow ➔</span>
                          </a>

                          {/* TikTok Studio Channel */}
                          <a
                            href="https://tiktok.com"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 transition text-xs group"
                          >
                            <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                              <span className="text-cyan-400">🎵</span>
                              <span className="font-medium">TikTok Behind-the-Scenes</span>
                            </div>
                            <span className="text-[11px] text-cyan-400">Watch ➔</span>
                          </a>

                          {/* YouTube Channel */}
                          <a
                            href="https://youtube.com"
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between p-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/80 transition text-xs group"
                          >
                            <div className="flex items-center gap-2 text-slate-300 group-hover:text-white">
                              <span className="text-red-400">▶️</span>
                              <span className="font-medium">YouTube Channel</span>
                            </div>
                            <span className="text-[11px] text-red-400">Subscribe ➔</span>
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 space-y-2">
                      <button
                        onClick={() => {
                          setScreen('gallery');
                          setSimulatorStep(2);
                        }}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-800 transition"
                      >
                        Review My Selections
                      </button>

                      <button
                        onClick={() => {
                          setScreen('login');
                          setPin('');
                          setCurrentAlbum(null);
                        }}
                        className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-medium border border-rose-500/20 transition"
                      >
                        Sign Out of Album
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Live Database Albums */}
        {activeTab === 'albums' && (
          <div className="w-full max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Neon PostgreSQL Live Albums</h3>
                <p className="text-xs text-slate-400">Connected to your Render FastAPI backend</p>
              </div>
              <button
                onClick={fetchDbAlbums}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dbAlbums.map(album => (
                <div
                  key={album.id}
                  className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-white">{album.title}</h4>
                      <p className="text-xs text-slate-400">Client: {album.client_name}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-xs">
                      PIN {album.pin}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <span>Proofs: {album.media_count}</span>
                    <span>Selected: {album.selected_count}</span>
                    <button
                      onClick={() => {
                        setPin(album.pin);
                        executeVerify(album.pin);
                        setActiveTab('exportSuite');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition"
                    >
                      Ingest Selections ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: Telemetry Logs */}
        {activeTab === 'diagnostics' && (
          <div className="w-full max-w-4xl space-y-4">
            <h3 className="text-lg font-bold text-white">Live Network Telemetry</h3>
            <div className="bg-slate-950 rounded-2xl border border-slate-800 p-4 font-mono text-xs max-h-96 overflow-y-auto space-y-2">
              {logs.length === 0 ? (
                <p className="text-slate-500">No requests sent yet. Interact with the app or export suite to see live telemetry.</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="flex items-center gap-2 border-b border-slate-900 pb-1.5">
                    <span className="text-slate-500">[{log.timestamp}]</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      log.method === 'POST' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {log.method}
                    </span>
                    <span className="text-slate-300">{log.endpoint}</span>
                    <span className={`font-bold ${log.error ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {log.status || 'ERR'}
                    </span>
                    <span className="text-slate-500 text-[10px]">{log.durationMs}ms</span>
                    <span className="text-slate-400 truncate max-w-xs">{log.response}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Download Android APK */}
        {activeTab === 'download' && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center p-2 shadow-lg">
              <img src="/favicon.svg" alt="PhotoGuard Logo" className="w-12 h-12 select-none" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white">Download PhotoGuard Android Client</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Clean, production Kotlin APK with Hardware Accelerated 4K display, FLAG_SECURE protection, and RAM-only zero-leak rendering.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-left space-y-2">
              <div className="flex justify-between text-slate-400">
                <span>Version:</span>
                <span className="text-white font-mono font-bold">v1.0.3 (Lossless 4K & Ingest Engine)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Footprint:</span>
                <span className="text-emerald-400 font-bold">&lt; 5MB (ProGuard R8 Compressed)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Security:</span>
                <span className="text-indigo-400 font-semibold">FLAG_SECURE Anti-Piracy Active</span>
              </div>
            </div>

            <a
              href="https://github.com/fassilandualem1-netizen/photoguard/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white shadow-xl shadow-indigo-600/30 transition"
            >
              <Download className="w-4 h-4" />
              <span>Get APK from GitHub Releases</span>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
