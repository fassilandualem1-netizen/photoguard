import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle,
  XCircle,
  X,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building,
  Smartphone,
} from "lucide-react";

export default function PaymentVerificationModal({
  isOpen = false,
  onClose,
  receipt = null,
  onApprove,
  onReject,
  isProcessing = false,
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!isOpen) return null;

  const handleApprove = () => {
    onApprove?.(receipt?.id);
  };

  const handleReject = () => {
    if (!showRejectInput) {
      setShowRejectInput(true);
      return;
    }
    onReject?.(receipt?.id, rejectReason);
  };

  return (
    <div
      id="payment-verification-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#0e121b] border-2 border-indigo-500/40 p-6 shadow-2xl shadow-indigo-950/50 space-y-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-indigo-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Manual Payment Verification
              </h3>
              <p className="text-xs text-slate-400">
                Review and approve Telebirr / Commercial Bank of Ethiopia (CBE) transactions.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {receipt ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block mb-1">Payment Method</span>
                <span className="font-semibold text-white flex items-center gap-1.5 uppercase font-mono">
                  {receipt.payment_method?.toLowerCase() === "telebirr" ? (
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Building className="w-4 h-4 text-sky-400" />
                  )}
                  {receipt.payment_method || "Telebirr"}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-slate-400 block mb-1">Amount</span>
                <span className="font-bold text-amber-400 font-mono text-sm">
                  {receipt.amount ? `${receipt.amount} ETB` : "N/A"}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-black/60 border border-indigo-950/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Transaction Reference:</span>
                <span className="font-mono text-amber-300 font-bold tracking-wider select-all">
                  {receipt.transaction_ref || "TX-UNKNOWN"}
                </span>
              </div>
              {receipt.photographer_name && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Studio / Photographer:</span>
                  <span className="text-white font-medium">{receipt.photographer_name}</span>
                </div>
              )}
              {receipt.created_at && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Submitted At:</span>
                  <span className="text-slate-300 font-mono text-[11px]">
                    {new Date(receipt.created_at).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Reject reason input */}
            {showRejectInput && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-xs text-red-300 font-medium block">
                  Reason for rejection:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transaction ID not found or invalid amount..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-[#080a0f] border border-red-900/60 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-red-500"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Clock className="w-8 h-8 text-slate-600 mx-auto mb-2 animate-pulse" />
            No pending receipt selected for verification.
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-indigo-950/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>

          {receipt && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{showRejectInput ? "Confirm Reject" : "Reject"}</span>
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve & Upgrade</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
