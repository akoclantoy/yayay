"use client";

import Image from "next/image";
import { useState } from "react";
import { X } from "lucide-react";

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

  return (
    <>
      {isVideo ? (
        <video
          src={src}
          controls
          preload="metadata"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="mb-2 max-h-[360px] max-w-full rounded-2xl border-0 bg-black"
          aria-label={alt}
        />
      ) : (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(true);
          }}
          className="mb-2 block max-w-full overflow-hidden rounded-2xl border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
