"use client";
import type { ReactNode } from "react";

export const inputCls =
  "font-ui w-full rounded-md border border-stone-700 bg-stone-900/80 px-2.5 py-1.5 text-sm text-stone-100 placeholder:text-stone-500 focus:border-amber-500 focus:outline-none";

export function Btn({ variant = "default", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "danger" | "ghost" }) {
  const v = {
    default: "border-stone-600 bg-stone-800 hover:bg-stone-700 text-stone-100",
    primary: "border-amber-600 bg-amber-700 hover:bg-amber-600 text-white",
    danger: "border-red-800 bg-red-900/60 hover:bg-red-800 text-red-100",
    ghost: "border-transparent bg-transparent hover:bg-stone-800 text-stone-300",
  }[variant];
  return <button {...p} className={`font-ui rounded-md border px-3 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`} />;
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`font-ui block text-sm ${className}`}>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-amber-200/80">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-snug text-stone-400">{hint}</span>}
    </label>
  );
}

export function TextInput(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ""}`} />;
}
export function TextArea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...p} className={`${inputCls} ${p.className ?? ""}`} />;
}
export function NumInput({ value, onChange, min, max, step = 1, className = "" }: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  return <input type="number" className={`${inputCls} ${className}`} value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />;
}
export function Select({ value, onChange, options, className = "" }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string }) {
  return (
    <select className={`${inputCls} ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function Toggle({ value, onChange, label, hint }: { value: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="font-ui flex items-start gap-3 rounded-md px-1 py-1.5 text-sm">
      <button type="button" onClick={() => onChange(!value)} className={`mt-0.5 h-5 w-9 shrink-0 rounded-full border transition ${value ? "border-amber-500 bg-amber-600" : "border-stone-600 bg-stone-800"}`} aria-pressed={value}>
        <span className={`block h-3.5 w-3.5 rounded-full bg-white transition ${value ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
      </button>
      <span>
        <span className="block text-stone-100">{label}</span>
        {hint && <span className="block text-xs leading-snug text-stone-400">{hint}</span>}
      </span>
    </div>
  );
}
export function Slider({ value, onChange, min, max, step = 0.05, label, hint, fmt }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; label: string; hint?: string; fmt?: (n: number) => string }) {
  return (
    <div className="font-ui text-sm">
      <div className="flex justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-amber-200/80">{label}</span>
        <span className="text-stone-200">{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" className="w-full accent-amber-500" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
      {hint && <span className="block text-xs leading-snug text-stone-400">{hint}</span>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`font-ui my-6 w-full ${wide ? "max-w-5xl" : "max-w-xl"} rounded-xl border border-stone-700 bg-stone-950 shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-stone-800 px-4 py-3">
          <h2 className="text-base font-semibold text-amber-100">{title}</h2>
          <button onClick={onClose} className="rounded px-2 text-xl leading-none text-stone-400 hover:text-white" aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-stone-800 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, small }: { tabs: { key: T; label: string }[]; value: T; onChange: (k: T) => void; small?: boolean }) {
  return (
    <div className="font-ui flex flex-wrap gap-1">
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={`rounded-md px-3 ${small ? "py-1 text-xs" : "py-1.5 text-sm"} transition ${value === t.key ? "bg-amber-700 text-white" : "bg-stone-800/70 text-stone-300 hover:bg-stone-700"}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "amber" | "red" | "green" | "blue" }) {
  const c = { stone: "bg-stone-800 text-stone-300", amber: "bg-amber-900/60 text-amber-200", red: "bg-red-900/60 text-red-200", green: "bg-emerald-900/60 text-emerald-200", blue: "bg-sky-900/60 text-sky-200" }[tone];
  return <span className={`font-ui inline-block rounded px-1.5 py-0.5 text-[11px] ${c}`}>{children}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-800 bg-stone-900/60 p-4 ${className}`}>{children}</div>;
}

export function Bar({ value, max, tone = "amber" }: { value: number; max: number; tone?: "amber" | "red" | "green" }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const c = { amber: "bg-amber-500", red: "bg-red-500", green: "bg-emerald-500" }[tone];
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-stone-800">
      <div className={`h-full ${c}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
