"use client";

import QRCode from "react-qr-code";
import { QrCode, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResidentQrShareDialog({
  open,
  qrCode,
  residentName,
  recipientName,
  audienceText,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  qrCode: string | null | undefined;
  residentName: string;
  recipientName: string;
  audienceText: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resident-qr-share-title"
      aria-describedby="resident-qr-share-description"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.28)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 pb-5 pt-6 text-center">
          <div aria-hidden="true" className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-blue-200/30 blur-2xl" />
          <div className="relative mb-4 flex items-center justify-between">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#0866ff] shadow-sm ring-1 ring-blue-100">
              <QrCode className="h-5 w-5" strokeWidth={2.3} />
            </span>
            <button
              type="button"
              aria-label="Close QR sharing confirmation"
              disabled={busy}
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0866ff] disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 id="resident-qr-share-title" className="relative text-lg font-bold tracking-tight text-slate-950">
            Share your resident QR
          </h2>
          <p id="resident-qr-share-description" className="relative mt-1.5 text-sm leading-5 text-slate-600">
            Review and confirm before sharing it with <span className="font-semibold text-slate-800">{recipientName}</span>.
          </p>
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          {qrCode ? (
            <div className="mx-auto w-fit rounded-[22px] bg-white p-4 shadow-[0_8px_28px_rgba(15,23,42,0.08)] ring-1 ring-slate-100">
              <QRCode value={qrCode} size={200} />
            </div>
          ) : (
            <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              Your resident QR code is unavailable.
            </div>
          )}
          <p className="mt-3 text-sm font-semibold text-slate-800">{residentName}</p>
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-slate-50 p-3 text-left">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-5 text-slate-600">{audienceText}</p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose} className="rounded-xl">
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy || !qrCode}
              onClick={onConfirm}
              className="rounded-xl bg-[#0866ff] text-white hover:bg-[#075ce5]"
            >
              <QrCode className="h-4 w-4" />
              {busy ? "Sharing..." : "Share QR"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
