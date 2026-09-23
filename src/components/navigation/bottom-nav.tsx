"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LineChart, CandlestickChart, Layers, User } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/trade", label: "Trade", icon: CandlestickChart },
  { href: "/positions", label: "Positions", icon: Layers },
  { href: "/account", label: "Account", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="xl:hidden fixed bottom-0 inset-x-0 z-40 bg-navy flex border-t border-white/10">
      {ITEMS.map((i) => {
        const active = pathname.startsWith(i.href);
        const Icon = i.icon;
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold ${
              active ? "text-white bg-navy2" : "text-white/70"
            }`}
          >
            <Icon size={18} className={active ? "text-white" : "text-icred"} />
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
