import type { AppointmentStatus } from "@/lib/db";

export function StatusBadge({ status, past }: { status: AppointmentStatus; past?: boolean }) {
  const map: Record<AppointmentStatus, [string, string]> = {
    booked: past ? ["Feita", "bg-ok/15 text-ok"] : ["Marcada", "bg-accent/15 text-accent"],
    completed: ["Feita", "bg-ok/15 text-ok"],
    cancelled: ["Cancelada", "bg-muted/15 text-muted"],
    no_show: ["Faltou", "bg-danger/15 text-danger"],
  };
  const [label, cls] = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function Kpi(props: { label: string; value: string; hint?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-muted">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{props.value}</div>
      {props.hint && <div className="mt-0.5 text-xs text-muted">{props.hint}</div>}
    </div>
  );
}

export function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={up ? "text-ok" : "text-danger"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

export function PageTitle({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="display text-2xl">{children}</h1>
      {actions}
    </div>
  );
}

/** Links para ligar / WhatsApp ao cliente */
export function ContactLinks({ phone, name }: { phone: string; name?: string }) {
  const wa = phone.replace(/\D/g, "");
  const text = name ? `?text=${encodeURIComponent(`Olá ${name.split(" ")[0]}, `)}` : "";
  return (
    <span className="inline-flex gap-1.5">
      <a href={`tel:${phone}`} className="rounded-lg border border-line px-2 py-1 text-xs hover:border-accent" title="Ligar">
        📞
      </a>
      <a href={`https://wa.me/${wa}${text}`} target="_blank" rel="noreferrer" className="rounded-lg border border-line px-2 py-1 text-xs hover:border-accent" title="WhatsApp">
        💬
      </a>
    </span>
  );
}
