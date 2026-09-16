"use client";

import QRCode from "react-qr-code";

export function ResidentQRDisplay({ value }: { value: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-inner">
      <QRCode value={value} size={200} />
    </div>
  );
}
