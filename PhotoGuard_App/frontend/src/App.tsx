import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { Activity, Camera, Clock3, Shield, Users, Image as ImageIcon, Key, LogOut, Plus, Search, CheckCircle2, Lock, Send, UploadCloud } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiFetch, API_BASE } from './apiClient';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatExpiryCountdown(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return 'No expiry set';
  const seconds = Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  if (seconds === 0) return 'Client access locked';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m ${remainingSeconds}s remaining`;
}



// -------------------------
// Client Gallery Interface
// -------------------------

// -------------------------
// Login Component
// -------------------------
function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  const botName = import.meta.env.VITE_TELEGRAM_BOT_NAME || "Photoguard_alert_bot";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      const user = {
        id: params.get('id'),
        first_name: params.get('name'),
        role: params.get('role'),
        tier: params.get('tier'),
        token: token
      };
      
      window.history.replaceState({}, document.title, window.location.pathname);
      onLogin(user);
      if (user.role === 'admin') {
          navigate('/admin');
      } else {
          navigate('/photographer');
      }
    }
    
    const err = params.get('error');
    if (err) {
      setError(`Authentication Error: ${err}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [navigate, onLogin]);

  const handleTelegramLogin = () => {
    window.location.href = `https://t.me/${botName}?start=auth`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-lg bg-neutral-900 rounded-3xl border border-neutral-800 p-8 sm:p-10 shadow-2xl mb-6">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-20 h-20 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mb-5">
            <Shield size={40} />
          </div>
          <h1 className="text-3xl font-semibold text-white tracking-tight">PhotoGuard Studio</h1>
          <p className="text-neutral-400 mt-3 text-sm max-w-sm">
            The ultimate anti-piracy platform built exclusively for professional photographers.
          </p>
        </div>

        {/* Features / Bullet Points */}
        <div className="space-y-3 mb-10">
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Absolute Anti-Piracy:</strong> 100% screenshot and screen-record prevention on client devices.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Elegant Client Experience:</strong> Deliver photos through a premium, fast-loading mobile gallery that boosts your brand.</span>
          </div>
          <div className="flex items-start space-x-3 text-sm text-neutral-300 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/50">
            <CheckCircle2 size={18} className="text-yellow-500 flex-shrink-0 mt-0.5" />
            <span><strong className="text-white font-medium">Streamlined Workflow:</strong> Track client photo selections instantly and manage access with secure PIN codes.</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && <div className="bg-red-500/10 text-red-400 p-4 rounded-xl text-sm mb-6 border border-red-500/20 text-center">{error}</div>}

        {/* Login Action */}
        <div>
          <button
            type="button"
            onClick={handleTelegramLogin}
            className="w-full flex items-center justify-center gap-3 bg-[#24A1DE] hover:bg-[#1d8dbf] text-white font-medium py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-blue-900/20"
          >
            <Send size={20} />
            <span>Log in with Telegram</span>
          </button>
          <p className="text-center text-neutral-600 text-xs mt-5">Strictly For Authorized Photographers Only</p>
          
          <div className="mt-8 pt-6 border-t border-neutral-800/50">
            <a
              href="/download-apk"
              className="w-full flex items-center justify-center gap-3 bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-3 px-4 rounded-xl transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500"><path d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2Z"/><path d="M12 9v6"/><path d="m9 12 3 3 3-3"/></svg>
              <span>Download Android App (APK)</span>
            </a>
            <p className="text-center text-neutral-500 text-[10px] mt-2">For Clients & Customers</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function ClientAlbumView() {
  const { code } = useParams();
  const [gallery, setGallery] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    apiFetch(`/api/gallery/${code}`, { requireAuth: false })
      .then(async data => {
        setGallery(data);
        if (data.photographerId) {
          const publicBranding = await apiFetch(`/api/photographers/${data.photographerId}/branding`, { requireAuth: false });
          setBranding(publicBranding);
        }
      })
      .catch(() => setError('This album is unavailable or has expired.'));
  }, [code]);

  const brandColor = branding?.brand_color || '#24A1DE';

  if (error) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6"><p className="text-red-300">{error}</p></div>;
  }
  if (!gallery) {
    return <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6"><p className="text-neutral-400">Loading secure gallery...</p></div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white" style={{ '--client-brand': brandColor } as React.CSSProperties}>
      <header className="border-b border-neutral-800 px-6 py-5" style={{ borderColor: `${brandColor}55` }}>
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          {branding?.logo_url ? <img src={branding.logo_url} alt="Photographer logo" className="h-12 w-12 rounded-xl object-contain bg-white p-1" /> : <Shield className="text-[var(--client-brand)]" size={34} />}
          <div>
            <h1 className="text-2xl font-semibold">{gallery.albumName}</h1>
            {branding?.custom_welcome_message && <p className="text-neutral-400 mt-1">{branding.custom_welcome_message}</p>}
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {(gallery.images || []).map((image: any) => (
            <img key={image.id} src={image.url} alt={image.filename} className="aspect-square w-full rounded-xl object-cover border border-neutral-800" />
          ))}
        </div>
      </main>
    </div>
  );
}

function BrandingSettings() {
  const [brandColor, setBrandColor] = useState('#24A1DE');
  const [logoUrl, setLogoUrl] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    apiFetch('/api/photographer/branding')
      .then(data => {
        setBrandColor(data.brand_color || '#24A1DE');
        setLogoUrl(data.logo_url || '');
        setWelcomeMessage(data.custom_welcome_message || '');
      })
      .catch(() => setStatus('Unable to load branding settings.'));
  }, []);

  const saveBranding = async () => {
    setIsSaving(true);
    setStatus('');
    try {
      await apiFetch('/api/photographer/branding', {
        method: 'PUT',
        body: JSON.stringify({ brand_color: brandColor, logo_url: logoUrl, custom_welcome_message: welcomeMessage }),
      });
      setStatus('Branding saved.');
    } catch (error: any) {
      setStatus(error.message || 'Unable to save branding.');
    } finally {
      setIsSaving(false);
    }
  };

  const uploadLogo = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('logo', file);
    try {
      const data = await apiFetch('/api/photographer/branding/logo', { method: 'POST', body: formData });
      setLogoUrl(data.logo_url || '');
      setStatus('Logo uploaded. Save to publish the remaining changes.');
    } catch (error: any) {
      setStatus(error.message || 'Logo upload failed.');
    }
  };

  return (
    <section className="max-w-3xl bg-neutral-900 border border-neutral-800 rounded-xl p-6">
      <div className="flex items-start justify-between gap-6 mb-8">
        <div>
          <h2 className="text-xl font-semibold">Branding & Customization</h2>
          <p className="text-neutral-400 mt-2">Make every client gallery feel like your studio.</p>
        </div>
        <div className="w-12 h-12 rounded-xl border border-neutral-700" style={{ backgroundColor: brandColor }} />
      </div>
      <div className="space-y-6">
        <label className="block text-sm text-neutral-300">Theme color
          <div className="flex items-center gap-3 mt-2">
            <input type="color" value={brandColor} onChange={event => setBrandColor(event.target.value)} className="h-10 w-14 bg-transparent cursor-pointer" />
            <input value={brandColor} onChange={event => setBrandColor(event.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white font-mono" />
          </div>
        </label>
        <label className="block text-sm text-neutral-300">Studio logo
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={uploadLogo} className="block mt-2 text-sm text-neutral-400" />
        </label>
        {logoUrl && <img src={logoUrl} alt="Current studio logo" className="h-16 w-16 rounded-xl object-contain bg-white p-2" />}
        <label className="block text-sm text-neutral-300">Welcome message
          <textarea value={welcomeMessage} onChange={event => setWelcomeMessage(event.target.value)} maxLength={500} rows={3} className="block w-full mt-2 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-white" placeholder="Welcome to my private gallery." />
        </label>
        <div className="flex items-center gap-4">
          <button onClick={saveBranding} disabled={isSaving} className="bg-white text-black px-4 py-2 rounded-lg font-medium disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Branding'}</button>
          {status && <span className="text-sm text-neutral-400">{status}</span>}
        </div>
      </div>
    </section>
  );
}


function PhotographerDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [albums, setAlbums] = useState<any[]>([]);
  const [activeView, setActiveView] = useState<'albums' | 'branding'>('albums');
  const [uploadingTo, setUploadingTo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedAlbumCode, setSelectedAlbumCode] = useState<string | null>(null);
  const [analyticsByAlbum, setAnalyticsByAlbum] = useState<Record<number, any>>({});
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  const [showUpgrade, setShowUpgrade] = useState(false);
  const handleUpgradeRequest = async (plan: string, method: string) => {
    const txnId = prompt(`Enter your ${method} Transaction ID:`);
    if (!txnId) return;
    try {
      const data = await apiFetch(`/api/payments/submit?target_plan=${plan}&payment_method=${method}&transaction_id=${txnId}`, { method: 'POST' });
      if (data.success) {
        alert('Payment submitted! Awaiting Admin approval.');
        setShowUpgrade(false);
      }
    } catch (e: any) {
      alert(`Submission failed: ${e.message}`);
    }
  };


  const fetchAlbums = async () => {
    const data = await apiFetch(`/api/albums`);
    setAlbums(data);
    const analyticsEntries = await Promise.all(data.map(async (album: any) => {
      try {
        const analytics = await apiFetch(`/api/albums/${album.id}/analytics`);
        return [album.id, analytics] as const;
      } catch (error) {
        console.error(`Failed to fetch analytics for album ${album.id}`, error);
        return null;
      }
    }));
    setAnalyticsByAlbum(Object.fromEntries(analyticsEntries.filter(Boolean) as [number, any][]));
  };

  useEffect(() => {
    fetchAlbums();
  }, [user.token]);

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  
  const handleDownloadSelections = async (code: string) => {
    try {
      const data = await apiFetch(`/api/albums/${code}/download_originals`);
      if (data.success && data.downloads) {
        alert(`Found ${data.downloads.length} selected high-res photos. Check console for links.`);
        console.log("High-Res Links:", data.downloads);
      }
    } catch (e: any) {
      alert(`Download restricted: ${e.message}`);
    }
  };

  const handleUploadClick = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAlbumCode(code);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedAlbumCode) return;

    setUploadingTo(selectedAlbumCode);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('photos', files[i]);
    }

    try {
      const data = await apiFetch(`/api/albums/${selectedAlbumCode}/photos`, {
      method: 'POST',
      body: formData
    });
      
      if (data.success) {
        // Refresh albums to show new count
        fetchAlbums();
      } else {
        alert('Upload failed. Please try again.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error during upload.');
    } finally {
      setUploadingTo(null);
      setSelectedAlbumCode(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 p-6 flex flex-col">
        <div className="flex items-center space-x-3 mb-10">
          <Shield className="text-blue-500" />
          <span className="font-semibold text-lg tracking-tight">PhotoGuard</span>
        </div>
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center space-x-3 px-3 py-2 bg-blue-600/10 text-blue-500 rounded-lg transition-colors font-medium">
            <ImageIcon size={18} />
            <span>My Albums</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors">
            <Users size={18} />
            <span>Clients</span>
          </a>
          <button onClick={() => setActiveView('branding')} className={cn("w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors", activeView === 'branding' ? "bg-blue-600/10 text-blue-500" : "text-neutral-400 hover:bg-neutral-900 hover:text-white")}>
            <Camera size={18} />
            <span>Branding & Customization</span>
          </button>
        </nav>
        <div className="mt-auto pt-6 border-t border-neutral-800">
          <div className="flex items-center space-x-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-sm font-medium">
              PH
            </div>
            <div className="text-sm">
              <p className="font-medium">{user.email}</p>
              <p className="text-neutral-500 text-xs capitalize">{user.role}</p>
            </div>
          </div>
          <button onClick={onLogout} className="w-full flex items-center space-x-2 px-3 py-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors">
            <LogOut size={16} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{activeView === 'branding' ? 'Branding & Customization' : 'Client Albums'}</h1>
            <p className="text-neutral-400 mt-1">{activeView === 'branding' ? 'Customize the client experience for your studio.' : 'Manage and securely share your deliverables.'}</p>
          </div>
          <button onClick={() => setActiveView('albums')} className="flex items-center space-x-2 bg-white text-black px-4 py-2 rounded-lg font-medium hover:bg-neutral-200 transition-colors">
            <Plus size={18} />
            <span>New Album</span>
          </button>
        </header>

        {activeView === 'branding' ? <BrandingSettings /> : <>
        {/* Hidden file input for uploading photos */}
        <input 
          type="file" 
          multiple 
          accept="image/*" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileChange} 
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {albums.map(album => {
            const analytics = analyticsByAlbum[album.id];
            const countdown = formatExpiryCountdown(album.expires_at, countdownNow);
            const isLocked = countdown === 'Client access locked';
            return (
            <div key={album.id} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden hover:border-neutral-700 transition-colors group cursor-pointer relative flex flex-col">
              <div className="h-40 bg-neutral-800 flex items-center justify-center relative overflow-hidden">
                <img src={`https://images.unsplash.com/photo-1511895426328-dc8714191300?q=80&w=800&auto=format&fit=crop`} className="w-full h-full object-cover opacity-40" alt="Cover" />
                <div 
                  className="absolute top-3 right-3 bg-neutral-950/80 backdrop-blur-sm px-2.5 py-1 rounded-md flex items-center space-x-1.5 border border-white/10 hover:bg-neutral-900 transition z-10"
                  onClick={(e) => { e.stopPropagation(); window.open(`/client/${album.code}`, '_blank'); }}
                  title="Open Client View"
                >
                  <Key size={12} className="text-blue-400" />
                  <span className="text-xs font-mono text-white tracking-widest">{album.code}</span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-medium text-lg mb-1 truncate">{album.name}</h3>
                <div className="flex items-center justify-between text-sm text-neutral-400 mt-4 mb-4">
                  <span>{album.imageCount} photos</span>
                  <span>Exp: {album.expires === 'Never' ? 'Never' : new Date(album.expires).toLocaleDateString()}</span>
                </div>
                <div className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm mb-4",
                  isLocked ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                )}>
                  <Clock3 size={15} />
                  <span className="font-medium">{countdown}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 px-2 py-2">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-neutral-500"><Activity size={11} /> Views</div>
                    <p className="text-white font-semibold mt-1">{analytics?.total_views ?? '--'}</p>
                  </div>
                  <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">PIN unlocks</div>
                    <p className="text-white font-semibold mt-1">{analytics?.successful_pin_entries ?? '--'}</p>
                  </div>
                  <div className="rounded-lg bg-neutral-950/70 border border-neutral-800 px-2 py-2">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">Last access</div>
                    <p className="text-white font-semibold mt-1 truncate" title={analytics?.last_accessed_at || 'No access'}>
                      {analytics?.last_accessed_at ? new Date(analytics.last_accessed_at).toLocaleDateString() : '--'}
                    </p>
                  </div>
                </div>
                
                {/* Upload Button */}
                <button
                  onClick={(e) => handleUploadClick(album.code, e)}
                  disabled={uploadingTo === album.code}
                  className={cn(
                    "mt-auto w-full flex items-center justify-center space-x-2 py-2 rounded-lg text-sm font-medium transition-colors border",
                    uploadingTo === album.code 
                      ? "bg-neutral-800 border-neutral-700 text-neutral-400 cursor-not-allowed" 
                      : "bg-blue-600/10 border-blue-500/20 text-blue-500 hover:bg-blue-600/20"
                  )}
                >
                  <UploadCloud size={16} />
                  <span>{uploadingTo === album.code ? 'Uploading...' : 'Upload Photos'}</span>
                </button>
              </div>
            </div>
            );
          })}
        </div>
        </>}
      </main>
    </div>
  );
}

// -------------------------
// Super Admin Dashboard
// -------------------------
function AdminDashboard({ user, onLogout }: { user: any, onLogout: () => void }) {
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const data = await apiFetch('/api/admin/payments');
      if (data.success) {
        setPayments(data.payments);
      }
    } catch (e) {
      console.error("Failed to fetch payments", e);
    }
  };

  const approvePayment = async (id: number) => {
    try {
      const data = await apiFetch(`/api/admin/payments/${id}/approve`, { method: 'POST' });
      if (data.success) {
        setPayments(payments.map(p => p.id === id ? { ...p, status: 'APPROVED' } : p));
        alert('Payment Approved. User upgraded!');
      }
    } catch (e: any) {
      alert(`Approval failed: ${e.message}`);
    }
  };

  const rejectPayment = async (id: number) => {
    try {
      const data = await apiFetch(`/api/admin/payments/${id}/reject`, { method: 'POST' });
      if (data.success) {
        setPayments(payments.filter(p => p.id !== id));
        alert('Payment Rejected.');
      }
    } catch (e: any) {
      alert(`Rejection failed: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 p-6 flex flex-col">
        <div className="flex items-center space-x-3 mb-10">
          <Shield className="text-red-500" />
          <span className="font-semibold text-lg tracking-tight">PG Admin</span>
        </div>
        <nav className="flex-1 space-y-2">
          <a href="#" className="flex items-center space-x-3 px-3 py-2 bg-red-600/10 text-red-500 rounded-lg transition-colors font-medium">
            <Users size={18} />
            <span>Photographers</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-3 py-2 text-neutral-400 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors">
            <Search size={18} />
            <span>Audit Logs</span>
          </a>
        </nav>
        <div className="mt-auto pt-6 border-t border-neutral-800">
          <button onClick={onLogout} className="w-full flex items-center space-x-2 px-3 py-2 text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-lg transition-colors">
            <LogOut size={16} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 overflow-y-auto">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">Platform Overview</h1>
        </header>

        <section>
          <h2 className="text-xl font-medium mb-6">Pending Subscriptions</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950 text-neutral-400">
                <tr>
                  <th className="px-6 py-4 font-medium">Photographer</th>
                  <th className="px-6 py-4 font-medium">Plan</th>
                  <th className="px-6 py-4 font-medium">Method</th>
                  <th className="px-6 py-4 font-medium">Txn ID</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-neutral-500">No pending payments.</td>
                  </tr>
                ) : (
                  payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-neutral-800/50 transition-colors">
                    <td className="px-6 py-4">{payment.photographer_name}</td>
                    <td className="px-6 py-4"><span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-md">{payment.target_plan}</span></td>
                    <td className="px-6 py-4">{payment.payment_method}</td>
                    <td className="px-6 py-4 text-neutral-400 font-mono text-xs">{payment.transaction_id}</td>
                    <td className="px-6 py-4">
                      <span className="flex items-center space-x-2 text-yellow-500">
                        <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                        <span>{payment.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => approvePayment(payment.id)} className="bg-white text-black px-3 py-1.5 rounded-lg font-medium text-xs hover:bg-neutral-200 transition-colors">
                          Approve
                        </button>
                        <button onClick={() => rejectPayment(payment.id)} className="border border-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg font-medium text-xs hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 transition-colors">
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
export default function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('photoguard_user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogin = (loggedUser: any) => {
    localStorage.setItem('photoguard_user', JSON.stringify(loggedUser));
    setUser(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('photoguard_user');
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route path="/client/:code" element={<ClientAlbumView />} />
        <Route path="/" element={!user ? <Login onLogin={handleLogin} /> : (user.role === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <PhotographerDashboard user={user} onLogout={handleLogout} />)} />
        <Route path="/photographer" element={user?.role === 'photographer' || user?.role === 'admin' ? <PhotographerDashboard user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
        <Route path="/admin" element={user?.role === 'admin' ? <AdminDashboard user={user} onLogout={handleLogout} /> : <Login onLogin={handleLogin} />} />
        
      </Routes>
    </Router>
  );
}
