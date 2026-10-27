/* eslint-disable @next/next/no-img-element -- LINE profile images come from an external CDN */
"use client";

import { useState } from "react";
import { initials, userHue } from "@/lib/format";

export function Avatar({
  userId,
  name,
  src,
  size = 36,
}: {
  userId: string;
  name: string;
  src?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const hue = userHue(userId);
  const style = {
    width: size,
    height: size,
    // Each user's own hue rings the avatar, so the same person reads the same everywhere.
    boxShadow: `0 0 0 1.5px oklch(0.72 0.12 ${hue})`,
  };
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={style}
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full bg-raised object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...style,
        background: `oklch(0.34 0.07 ${hue})`,
        color: `oklch(0.93 0.04 ${hue})`,
        fontSize: size * 0.38,
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
    >
      {initials(name)}
    </span>
  );
}
