"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export default function PageTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = container.current?.animate(
      [{ opacity: 0.65 }, { opacity: 1 }],
      { duration: 220, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
    );
    return () => animation?.cancel();
  }, [pathname]);

  return <div ref={container}>{children}</div>;
}