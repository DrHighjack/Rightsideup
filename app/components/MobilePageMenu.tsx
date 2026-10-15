"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { LogoutIcon } from "@/app/components/icons";

type MenuItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type MenuSection = { title?: string; items: MenuItem[] };

export function MobilePageMenu({
  brand,
  sections,
  onSignOut,
}: {
  brand: string;
  sections: MenuSection[];
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeMenu = () => setClosing(true);
  const pathname = usePathname() || "";
  const items = sections.flatMap((section) => section.items);
  const activeHref = items
    .filter(({ href }) => {
      const path = href.split("?")[0];
      return pathname === path || pathname.startsWith(`${path}/`);
    })
    .sort((a, b) => b.href.split("?")[0].length - a.href.split("?")[0].length)[0]?.href;

  useEffect(() => {
    setOpen(false);
    setClosing(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close page menu" : "Open page menu"}
        aria-expanded={open}
        onClick={() => {
          if (open) closeMenu();
          else {
            setClosing(false);
            setOpen(true);
          }
        }}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 md:hidden"
      >
        <span aria-hidden="true" className="flex w-5 flex-col gap-1">
          <span className="h-0.5 w-full bg-current" />
          <span className="h-0.5 w-full bg-current" />
          <span className="h-0.5 w-full bg-current" />
        </span>
        Menu
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label={`${brand} navigation`}>
          <button type="button" aria-label="Close page menu" onClick={closeMenu} className={`menu-backdrop absolute inset-0 h-full w-full bg-slate-950/50 ${closing ? "is-closing" : ""}`} />
          <nav
            className={`menu-panel absolute inset-y-0 left-0 flex w-[min(88vw,24rem)] flex-col overflow-hidden bg-ink text-white shadow-2xl ${closing ? "is-closing" : ""}`}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && closing) {
                setOpen(false);
                setClosing(false);
              }
            }}
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-border px-5">
              <span className="text-base font-semibold">{brand}</span>
              <button type="button" aria-label="Close page menu" onClick={closeMenu} className="min-h-11 px-3 text-sm font-medium text-ink-muted">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {sections.map((section, index) => (
                <div key={section.title || `section-${index}`} className="pb-4">
                  {section.title && <p className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{section.title}</p>}
                  <div className="space-y-1">
                    {section.items.map(({ href, label, icon: Icon }) => {
                      const active = href === activeHref;
                      return (
                        <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={closeMenu} className={`flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium ${active ? "bg-primary-500/15 text-white" : "text-ink-muted hover:bg-ink-hover hover:text-white"}`}>
                          <Icon className={`h-5 w-5 shrink-0 ${active ? "text-primary-400" : ""}`} />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="shrink-0 border-t border-ink-border p-3">
              <button type="button" onClick={onSignOut} className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink-muted hover:bg-ink-hover hover:text-white">
                <LogoutIcon className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </nav>
        </div>,
        document.body
      )}
    </>
  );
}