"use client";

import { useEffect } from "react";
import Script from "next/script";
import { ADSENSE_CLIENT, ADSENSE_SLOT, isAdsenseConfigured, isAdSlotConfigured } from "@/lib/env";

// Google AdSense, kept deliberately quiet and off the felt. Everything is gated
// on a real publisher id being present, so dev/demo/preview render nothing at all
// - no empty gray boxes, no third-party script. Plug in NEXT_PUBLIC_ADSENSE_CLIENT
// (and _SLOT) to switch it on. See README → "Ads & support".

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** Loads the AdSense library once, in <body>, only when configured. */
export function AdSenseScript() {
  if (!isAdsenseConfigured()) return null;
  return (
    <Script
      id="adsbygoogle-init"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}

/**
 * A single responsive ad unit. Reserves its height whether or not it fills, so
 * there's never a layout jump. Wrapped in a slim, labelled frame that reads as
 * part of the table trim rather than a bolted-on banner.
 */
export function AdSlot({ className = "" }: { className?: string }) {
  useEffect(() => {
    if (!isAdSlotConfigured()) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense not ready / blocked - leave the reserved space empty.
    }
  }, []);

  if (!isAdSlotConfigured()) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`mx-auto w-full max-w-2xl overflow-hidden rounded-xl border border-brass/15 bg-felt-dark/40 ${className}`}
    >
      <p className="px-3 pt-2 text-center text-[10px] uppercase tracking-[0.25em] text-cream/25">
        Advertisement
      </p>
      <div className="min-h-24 px-3 pb-3 pt-1">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={ADSENSE_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </aside>
  );
}
