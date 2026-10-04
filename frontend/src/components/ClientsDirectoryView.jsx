import React, { useState, useEffect, useMemo } from "react";
import { Users, Search, FolderOpen, Image as ImageIcon, KeyRound, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function ClientsDirectoryView() {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        // We fetch albums, because clients are derived from albums in the current architecture.
        const response = await api.get("/api/v1/albums");
        setAlbums(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Failed to load albums for client directory:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  // Process albums into a unique list of clients
  const clients = useMemo(() => {
    const clientMap = new Map();

    albums.forEach((album) => {
      if (!album.client_name) return;
      
      const name = album.client_name.trim();
      const nameLower = name.toLowerCase();

      if (!clientMap.has(nameLower)) {
        clientMap.set(nameLower, {
          name: name,
          totalAlbums: 0,
          totalPhotos: 0,
          pins: new Set(),
          recentDate: new Date(0),
        });
      }

      const clientInfo = clientMap.get(nameLower);
      clientInfo.totalAlbums += 1;
      clientInfo.totalPhotos += (album.photos ? album.photos.length : 0) || (album.photo_count || 0);
      
      if (album.client_pin || album.pin) {
        clientInfo.pins.add(album.client_pin || album.pin);
      }

      const albumDate = new Date(album.created_at);
      if (albumDate > clientInfo.recentDate) {
        clientInfo.recentDate = albumDate;
      }
    });

    return Array.from(clientMap.values()).sort((a, b) => b.recentDate - a.recentDate);
  }, [albums]);

  // Filter clients based on search query
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase().trim();
    return clients.filter((c) => c.name.toLowerCase().includes(q));
  }, [clients, searchQuery]);

  return (
    <div className="max-w-5xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Clients Directory</h2>
            <p className="text-sm text-slate-500 mt-1">Read-only overview of all clients and their associated galleries.</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-xs font-medium tracking-wide">Loading client directory...</p>
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-200 bg-white text-slate-500 text-sm shadow-sm">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          {searchQuery ? "No clients match your search." : "No clients found. Client profiles are automatically generated from your albums."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.map((client, idx) => (
            <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 uppercase shrink-0">
                    {client.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900 truncate" title={client.name}>
                      {client.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Last active: {client.recentDate.getTime() > 0 ? client.recentDate.toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Galleries</p>
                    <p className="text-sm font-bold text-slate-900">{client.totalAlbums}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500">Photos</p>
                    <p className="text-sm font-bold text-slate-900">{client.totalPhotos}</p>
                  </div>
                </div>
              </div>

              {client.pins.size > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <KeyRound className="w-3 h-3" /> Access PINs
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(client.pins).map((pin, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs font-mono text-slate-600">
                        {pin}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="pt-3 border-t border-slate-100 mt-auto">
                <button
                  onClick={() => navigate(`/dashboard?tab=albums&search=${encodeURIComponent(client.name)}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white hover:bg-indigo-50 text-indigo-600 font-semibold text-sm border border-slate-200 transition-colors group-hover:border-indigo-200"
                >
                  <span>View All Galleries</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
