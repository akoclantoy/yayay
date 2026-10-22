"use client";

import Image from "next/image";
import { useState } from "react";
import { Download, X } from "lucide-react";

function getDownloadUrl(src: string) {
  return src.replace(
    /^(https:\/\/res\.cloudinary\.com\/[^/]+\/(?:image|video)\/)upload\//,
    "$1upload/fl_attachment/",
  );
}

export function MessageMedia({
  src,
  type,
  alt = "Message attachment",
}: {
  src: string;
  type: string | null;
  alt?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isVideo = type?.startsWith("video/");
  const downloadUrl = getDownloadUrl(src);

  return (
    <>
      <div className="mb-2 w-fit max-w-full">
        {isVideo ? (
          <video
            src={src}
            controls
            preload="metadata"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[360px] max-w-full rounded-2xl border-0 bg-black"
            aria-label={alt}
          />
        ) : (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded(true);
            }}
            className="block max-w-full overflow-hidden rounded-2xl border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`View ${alt.toLowerCase()} full size`}
          >
            <Image
              src={src}
              alt={alt}
              width={640}
              height={480}
              unoptimized
              className="max-h-[360px] w-auto max-w-full object-contain"
            />
          </button>
        )}
        <a
          href={downloadUrl}
          download
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-current/20 bg-black/5 px-2.5 py-1.5 text-xs font-medium text-current transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Download ${isVideo ? "video" : "image"}`}
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>
      {expanded && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          onClick={() => setExpanded(false)}
        >
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setExpanded(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={1200}
            unoptimized
            className="max-h-[90dvh] w-auto max-w-full rounded-2xl border-0 object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
