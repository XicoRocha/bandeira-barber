"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Hoje", icon: "🏠" },
  { href: "/admin/agenda", label: "Agenda", icon: "📅" },
  { href: "/admin/clientes", label: "Clientes", icon: "👥" },
  { href: "/admin/estatisticas", label: "Números", icon: "📊" },
  { href: "/admin/definicoes", label: "Definições", icon: "⚙️" },
];

export function AdminNav({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname();
  const isActive = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));

  if (variant === "side") {
    return (
      <nav className="space-y-1">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
              isActive(i.href) ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            <span>{i.icon}</span>
            {i.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] ${
            isActive(i.href) ? "text-accent" : "text-muted"
          }`}
        >
          <span className="text-lg leading-none">{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
