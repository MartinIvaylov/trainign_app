"use client";

import { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-display text-2xl sm:text-3xl">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "", hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-5 ${hover ? "hover:border-foreground/30 transition" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaKind = "neutral",
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaKind?: "up" | "down" | "neutral";
  accent?: string;
}) {
  return (
    <Card>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{label}</div>
      <div className="mt-3 flex items-baseline gap-1">
        <div className="text-stat text-3xl" style={accent ? { color: accent } : undefined}>
          {value}
        </div>
        {unit && <div className="text-sm text-muted-foreground">{unit}</div>}
      </div>
      {delta && (
        <div
          className={`text-xs mt-2 ${
            deltaKind === "up" ? "text-success" : deltaKind === "down" ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {delta}
        </div>
      )}
    </Card>
  );
}

export function Pill({
  children,
  color,
  active,
  onClick,
}: {
  children: ReactNode;
  color?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-secondary"
      }`}
      style={active && color ? { background: color, borderColor: color } : undefined}
    >
      {color && !active && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      {children}
    </button>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold">{children}</h2>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center">
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground mt-2 max-w-sm mx-auto">{body}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function MiniBar({ value, max, color = "var(--primary)", height = 4 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="w-full bg-secondary rounded-full overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
