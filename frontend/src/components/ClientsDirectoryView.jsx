import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Search,
  FolderLock,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  ShieldCheck,
} from "lucide-react";

export default function ClientsDirectoryView({ albums = [] }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedPinId, setCopiedPinId] = useState(null);

  // Group albums by client name
  const clientsList = useMemo(() => {
    const clientMap = new Map();

    albums.forEach((album) => {
      const clientName = (album.client_name || "").trim() || "Unassigned Client";
      if (!clientMap.has(clientName)) {
        clientMap.set(clientName, {
          name: clientName,
          albums: [],
          totalPhotos: 0,
          totalSelected: 0,
          hasSubmitted: false,
          pins: [],
        });
      }

      const clientRecord = clientMap.get(clientName);
      clientRecord.albums.push(album);
      clientRecord.totalPhotos += album.photo_count || album.media_count || 0;
      clientRecord.totalSelected += album.selected_count || 0;
      if (album.status === "submitted" || album.is_locked) {
        clientRecord.hasSubmitted = true;
      }
      const pin = album.pin || album.client_pin;
      if (pin && !clientRecord.pins.includes(pin)) {
        clientRecord.pins.push(pin);
      }
    });

    return Array.from(clientMap.values());
  }, [albums]);

  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clientsList;
    const q = searchQuery.toLowerCase().trim();
    return clientsList.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchAlbums = c.albums.some((a) => (a.title || "").toLowerCase().includes(q));
      const matchPins = c.pins.some((p) => p.toLowerCase().includes(q));
      return matchName || matchAlbums || matchPins;
    });
  }, [clientsList, searchQuery]);

  const handleCopyPin = (e, pinKey, pinCode) => {
    e.stopPropagation();
    if (pinCode) {
      navigator.clipboard.writeText(pinCode);
      setCopiedPinId(pinKey);
      setTimeout(() => setCopiedPinId(null), 2000);
    }
  };

  return (
    <div id="clients-directory-view" className="space-y-6">
      {/* Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Client Directory & Proof Access
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-semibold uppercase tracking-wider">
              {clientsList.length} Total Clients
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Look up client credentials, monitor proofing progress, and distribute secure 6-digit access PINs.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by client name, gallery, or PIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#151a23] border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-orange-500/60 transition-all duration-200"
          />
        </div>
      </div>

      {/* Clients Cards List */}
      {filteredClients.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-slate-800 bg-[#151a23] text-slate-400 text-xs">
          No clients match "{searchQuery}".
        </div>
      ) : (
        <div className="space-y-3">
          {filteredClients.map((client, idx) => (
            <div
              key={client.name + idx}
              className="bg-[#151a23] border border-slate-800/80 hover:border-slate-700 rounded-xl p-4.5 hover:bg-[#181e29] transition-all duration-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-6"
            >
              {/* Left Column: Avatar + Client Name + Galleries */}
              <div className="flex items-center gap-4 min-w-0 flex-1">
                {/* Client Avatar */}
                <div className="w-11 h-11 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center font-bold text-sm shrink-0 shadow-inner">
                  {client.name.charAt(0).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {client.name}
                    </h3>

                    {/* Status Pill */}
                    {client.hasSubmitted ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-[10px] font-medium text-green-400">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        Submitted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] font-medium text-orange-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Proofing Active
                      </span>
                    )}
                  </div>

                  {/* Assigned Galleries Tags */}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-500 font-medium">Galleries:</span>
                    {client.albums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => navigate(`/dashboard/albums/${album.id}`)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <FolderLock className="w-3 h-3 text-orange-400" />
                        <span>{album.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Middle Column: PINs */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <span className="text-[11px] text-slate-500">Access PINs:</span>
                {client.pins.length > 0 ? (
                  client.pins.map((pin) => {
                    const pinKey = `${client.name}_${pin}`;
                    return (
                      <div
                        key={pin}
                        onClick={(e) => handleCopyPin(e, pinKey, pin)}
                        title="Click to copy access PIN"
                        className="group/pin flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-400 font-mono text-xs font-semibold hover:bg-orange-500/20 transition-all duration-200 cursor-pointer select-none"
                      >
                        <span className="text-[9px] uppercase font-sans text-orange-400/70">PIN</span>
                        <span>{pin}</span>
                        {copiedPinId === pinKey ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 opacity-40 group-hover/pin:opacity-100" />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <span className="text-xs text-slate-500 italic">No PIN generated</span>
                )}
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    if (client.albums[0]?.id) {
                      navigate(`/dashboard/albums/${client.albums[0].id}`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/80 bg-slate-800/40 text-gray-400 hover:text-white hover:bg-slate-800 transition-all duration-200 text-xs font-medium cursor-pointer"
                >
                  <span>Open Gallery</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
