import Link from "next/link";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  /** Secondary line under the title — context, counts, scope. */
  subtitle?: string;
  /** Where the back chevron goes. Defaults to the dashboard. */
  backHref?: string;
  backLabel?: string;
  /** Right-aligned controls (scope switchers, bulk actions). */
  actions?: ReactNode;
}

/**
 * Sticky page header shared by the secondary surfaces (analytics, admin,
 * notifications) so they all read as the same app: back link, title, actions.
 */
export default function PageHeader({
  title,
  subtitle,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  actions,
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#09090b]/85 backdrop-blur-md">
      <div className="flex items-center gap-4 px-4 md:px-8 h-16 max-w-[80rem] mx-auto">
        <Link
          href={backHref}
          className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-200 transition-colors flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
            <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {backLabel}
        </Link>
        <div className="w-px h-4 bg-white/[0.08]" aria-hidden />
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-zinc-100 leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-zinc-600 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
