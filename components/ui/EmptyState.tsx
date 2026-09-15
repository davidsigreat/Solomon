import type { ReactNode } from "react";

interface EmptyStateProps {
  /** Emoji or small node rendered inside the tile. */
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** `sm` for in-column/panel slots, `md` for full-page states. */
  size?: "sm" | "md";
  className?: string;
}

/**
 * Shared empty state: icon tile, title, one line of guidance, optional action.
 * Keeps every "nothing here yet" moment in the app on the same rhythm.
 */
export default function EmptyState({ icon, title, description, action, size = "md", className = "" }: EmptyStateProps) {
  const sm = size === "sm";
  return (
    <div className={`flex flex-col items-center justify-center text-center ${sm ? "gap-2 py-8" : "gap-3 py-14"} ${className}`}>
      <div
        className={`flex items-center justify-center rounded-2xl bg-white/[0.035] border border-white/[0.07] text-zinc-500 ${
          sm ? "w-10 h-10 text-base" : "w-14 h-14 text-2xl"
        }`}
      >
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <p className={`font-medium text-zinc-300 ${sm ? "text-xs" : "text-sm"}`}>{title}</p>
        {description && (
          <p className={`text-zinc-600 max-w-[22rem] leading-relaxed ${sm ? "text-[11px]" : "text-xs"}`}>{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
