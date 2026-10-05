import React, { useState } from "react";
import {
  Send,
  ExternalLink,
  Check,
  AlertCircle,
  Loader2,
  RefreshCw,
  Unlink,
  ShieldCheck,
  BellRing
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

export default function TelegramAlertsView() {
  const { user, refreshProfile } = useAuth();
  
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);
  const [isDisconnectingTelegram, setIsDisconnectingTelegram] = useState(false);
  const [telegramStatusMsg, setTelegramStatusMsg] = useState(null);
  const [telegramErrorMsg, setTelegramErrorMsg] = useState(null);

  const telegramDeepLink = `https://t.me/PhotoGuardBot?start=${user?.id}`;

  const handleCheckConnection = async () => {
    setIsCheckingConnection(true);
    setTelegramStatusMsg(null);
    setTelegramErrorMsg(null);
    try {
      if (refreshProfile) await refreshProfile();
      setTelegramStatusMsg("Connection checked. If linked, your chat ID will appear above.");
    } catch (err) {
      setTelegramErrorMsg("Failed to verify Telegram connection.");
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!window.confirm("Are you sure you want to stop receiving Telegram alerts?")) return;
    
    setIsDisconnectingTelegram(true);
    setTelegramStatusMsg(null);
    setTelegramErrorMsg(null);
    try {
      await api.put("/api/auth/profile", { telegram_chat_id: null });
      if (refreshProfile) await refreshProfile();
      setTelegramStatusMsg("Telegram account disconnected successfully.");
    } catch (err) {
      setTelegramErrorMsg("Failed to disconnect Telegram.");
    } finally {
      setIsDisconnectingTelegram(false);
    }
  };

  return (
    <div className="max-w-4xl w-full mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="pb-5 border-b border-slate-200 dark:border-slate-800">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Telegram Alerts</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Receive real-time push alerts the moment a client finalizes their album selection.</p>
      </div>

      <div className="max-w-md p-6 rounded-2xl bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-sky-500 font-semibold text-sm">
            <BellRing className="w-4 h-4" />
            <span>Alerts Configuration</span>
          </div>
          {user?.telegram_chat_id && (
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
            </span>
          )}
        </div>

        <div>
          {user?.telegram_chat_id ? (
            <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#111620] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">Actively Linked</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Chat ID: <span className="font-mono bg-white dark:bg-[#0b0e14] px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">{user.telegram_chat_id}</span></p>
              </div>
              
              <button
                type="button"
                onClick={handleDisconnectTelegram}
                disabled={isDisconnectingTelegram}
                className="w-full py-2.5 rounded-xl bg-white dark:bg-[#0b0e14] hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 dark:text-slate-300 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {isDisconnectingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
                <span>Disconnect Telegram</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-100 space-y-2">
                <div className="text-sm font-semibold text-sky-700 flex items-center gap-2">
                  <Send className="w-4 h-4" /> 1-Click Deep Link
                </div>
                <p className="text-sm text-sky-600 leading-relaxed">
                  Click the button below to open Telegram and tap <b>Start</b>. We will automatically link your account for push notifications.
                </p>
              </div>
              
              <a
                href={telegramDeepLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 group"
              >
                <Send className="w-4 h-4 fill-current" />
                <span>Connect with Telegram</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              
              <button
                type="button"
                onClick={handleCheckConnection}
                disabled={isCheckingConnection}
                className="w-full py-3 rounded-xl bg-white dark:bg-[#0b0e14] hover:bg-slate-50 dark:hover:bg-[#111620] dark:bg-[#111620] dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 dark:text-slate-300 font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isCheckingConnection ? (
                  <><Loader2 className="w-4 h-4 animate-spin text-sky-500" /><span>Checking Connection...</span></>
                ) : (
                  <><RefreshCw className="w-4 h-4 text-sky-500" /><span>Verify Connection</span></>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status Messages */}
        <div className="pt-2">
          {telegramStatusMsg && (
            <div className={`p-3 rounded-xl text-sm flex items-center gap-2 shadow-sm ${
              user?.telegram_chat_id ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-sky-50 border border-sky-200 text-sky-700"
            }`}>
              {user?.telegram_chat_id ? <Check className="w-5 h-5 shrink-0" /> : <RefreshCw className="w-5 h-5 animate-spin shrink-0" />}
              <span className="font-medium">{telegramStatusMsg}</span>
            </div>
          )}
          {telegramErrorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2 shadow-sm mt-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="font-medium">{telegramErrorMsg}</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
