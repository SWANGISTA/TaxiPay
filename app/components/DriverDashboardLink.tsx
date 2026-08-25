"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Sequence: click -> robot (traffic light) shows red, taxi parked at the
// start point -> after a short wait, light turns green and the taxi drives
// to the end point -> navigate once it arrives. Purely decorative — real
// navigation is a normal Next.js <Link> underneath (so hover-prefetch still
// works), just delayed until the sequence finishes. `prefers-reduced-motion`
// skips straight to navigation.
const RED_MS = 800;
const DRIVE_MS = 3000;

type Phase = "idle" | "red" | "driving";

export default function DriverDashboardLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");

  function handleClick(e: React.MouseEvent) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return; // let the Link navigate immediately, as normal

    e.preventDefault();
    setPhase("red");
    setTimeout(() => setPhase("driving"), RED_MS);
    setTimeout(() => router.push(href), RED_MS + DRIVE_MS);
  }

  return (
    <>
      <Link href={href} onClick={handleClick} className={className}>
        {children}
      </Link>

      {phase !== "idle" && (
        <div className="taxi-crossing-overlay" aria-hidden="true">
          <div className="road-line" />

          <div className="traffic-light">
            <span className={`light-red ${phase === "red" ? "lit" : ""}`} />
            <span className="light-yellow" />
            <span className={`light-green ${phase === "driving" ? "lit" : ""}`} />
          </div>

          <svg
            className={`taxi-icon ${phase === "driving" ? "driving" : ""}`}
            viewBox="0 0 64 32"
            width="160"
            height="80"
          >
            <rect x="2" y="10" width="46" height="16" rx="3" fill="#2563eb" />
            <path d="M42 10 L52 10 L58 18 L58 26 L48 26 L48 10 Z" fill="#2563eb" />
            <rect x="8" y="13" width="10" height="8" rx="1" fill="#bfdbfe" />
            <rect x="20" y="13" width="10" height="8" rx="1" fill="#bfdbfe" />
            <rect x="44" y="13" width="10" height="8" rx="1" fill="#bfdbfe" />
            <circle cx="14" cy="27" r="4" fill="#171717" />
            <circle cx="14" cy="27" r="1.6" fill="#d4d4d4" />
            <circle cx="46" cy="27" r="4" fill="#171717" />
            <circle cx="46" cy="27" r="1.6" fill="#d4d4d4" />
            <rect x="56" y="19" width="3" height="3" rx="0.5" fill="#facc15" />
          </svg>
        </div>
      )}
    </>
  );
}
