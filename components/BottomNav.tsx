"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, CheckCircle2, Archive, MoreHorizontal } from "lucide-react";
import clsx from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/visitors/active", label: "Active", icon: Calendar },
  { href: "/visitors/settled", label: "Settled", icon: CheckCircle2 },
  { href: "/visitors/archived", label: "Archived", icon: Archive },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border z-40"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex justify-around max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center justify-center gap-1 py-2.5 flex-1 min-h-[56px]"
            >
              <Icon
                className={clsx("w-5 h-5", isActive ? "text-primary" : "text-textSecondary")}
                strokeWidth={2}
              />
              <span
                className={clsx(
                  "text-caption",
                  isActive ? "text-primary font-semibold" : "text-textSecondary"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
