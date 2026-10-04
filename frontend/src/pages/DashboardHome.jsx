import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import DashboardOverview from "../components/DashboardOverview";
import AlbumsManagerView from "../components/AlbumsManagerView";
import ClientsDirectoryView from "../components/ClientsDirectoryView";
import ProfileBrandingView from "../components/ProfileBrandingView";
import StudioAssistantsView from "../components/StudioAssistantsView";
import AccountSettingsView from "../components/AccountSettingsView";
import CreateAlbumModal from "../components/CreateAlbumModal";
import api from "../api/axios";

// Clean fallback placeholder component for unmapped views
function PlaceholderView({ title }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
      <div className="p-6 rounded-2xl bg-[#151a23] border border-slate-800 text-center max-w-md mx-auto space-y-2">
        <h2 className="text-xl text-white font-bold capitalize">{title} View</h2>
        <p className="text-xs text-slate-400">This section is currently under development.</p>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Determine current active tab strictly from URL query ?tab=... (defaults to 'dashboard')
  const currentTab = searchParams.get("tab") || "dashboard";

  // Data fetching and UI state
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const fetchAlbums = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get("/api/v1/albums");
      setAlbums(response.data || []);
    } catch (err) {
      const rawDetail = err.response?.data?.detail;
      let msg = "Failed to load client albums. Please try again.";
      if (typeof rawDetail === "string" && rawDetail.trim()) {
        msg = rawDetail;
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        msg = rawDetail.map((d) => (typeof d === "object" ? d.msg || JSON.stringify(d) : String(d))).join("; ");
      } else if (err.response?.status) {
        msg = `Server Error (${err.response.status}): ${err.response.statusText || "Failed to fetch albums"}`;
      } else if (err.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  const handleCreateAlbum = () => {
    setIsCreateModalOpen(true);
  };

  const handleAlbumCreated = () => {
    fetchAlbums();
  };

  const handleDeleteAlbum = async (e, albumId, albumTitle) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }

    if (
      !window.confirm(
        `Are you sure you want to delete "${albumTitle || "Untitled Album"}"? All photos in this gallery will be permanently deleted.`
      )
    ) {
      return;
    }

    try {
      setDeletingId(albumId);
      await api.delete(`/api/v1/albums/${albumId}`);
      setAlbums((prev) => (Array.isArray(prev) ? prev.filter((a) => a?.id !== albumId) : []));
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete album. Please try again.";
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  // Strict Switch Map for Tab Rendering: Every tab renders a 100% distinct component
  const renderTabContent = () => {
    switch (currentTab) {
      case "dashboard":
        return (
          <DashboardOverview
            albums={albums}
            loading={loading}
            onCreateAlbum={handleCreateAlbum}
            onNavigateTab={(tab) => {
              if (tab === "dashboard") {
                navigate("/dashboard");
              } else {
                navigate(`/dashboard?tab=${tab}`);
              }
            }}
          />
        );

      case "albums":
        return (
          <AlbumsManagerView
            albums={albums}
            loading={loading}
            onRefresh={fetchAlbums}
            onDeleteAlbum={handleDeleteAlbum}
            deletingId={deletingId}
          />
        );

      case "clients":
        if (loading) {
          return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin mb-3" />
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">
                Loading client directory...
              </p>
            </div>
          );
        }
        return <ClientsDirectoryView albums={albums} />;

      case "profile":
        return <ProfileBrandingView />;

      case "assistants":
        return <StudioAssistantsView />;

      case "settings":
      case "storage":
      case "password":
        return <AccountSettingsView defaultFocusPassword={currentTab === "password"} />;

      default:
        return <PlaceholderView title={currentTab} />;
    }
  };

  return (
    <>
      {renderTabContent()}
      <CreateAlbumModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onAlbumCreated={handleAlbumCreated}
      />
    </>
  );
}
