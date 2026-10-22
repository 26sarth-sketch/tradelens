"use client";

import clsx from "clsx";
import { Aperture, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { APP_NAME } from "@/config/brand";
import { NAV_ITEMS, type NavItem, SECONDARY_NAV } from "./nav";
import { PrivacyToggle } from "./PrivacyToggle";

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active =
    item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active ? "bg-accent/15 text-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={18} className={active ? "text-accent" : undefined} />
      {item.label}
    </Link>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-3 font-semibold tracking-tight">
      <Aperture size={22} className="text-accent" />
      {APP_NAME}
    </Link>
  );
}

function NavBody({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link
        href="/trades/new"
        onClick={onNavigate}
        className="mx-1 flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-fg hover:opacity-90"
      >
        <Plus size={16} /> Add trades
      </Link>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
      <nav className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        <PrivacyToggle />
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} onNavigate={onNavigate} />
        ))}
      </nav>
    </>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-5 border-r border-border bg-surface px-3 py-5 md:flex">
        <Brand />
        <NavBody />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Brand />
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-md p-1 text-muted">
          <Menu size={22} />
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-5 bg-surface px-3 py-5">
            <div className="flex items-center justify-between">
              <Brand />
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="p-1 text-muted">
                <X size={20} />
              </button>
            </div>
            <NavBody onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
