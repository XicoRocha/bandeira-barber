"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ContactLinks, StatusBadge } from "@/components/ui";
import type { AppointmentStatus } from "@/lib/db";
import { euros } from "@/lib/time";
import { setAppointmentStatus } from "../actions";

export type CardAppointment = {
  id: number;
  time: string;
  endTime: string;
  past: boolean;
  status: AppointmentStatus;
  price_cents: number;
  service_name: string;
  barber_id: number;
  barber_name: string;
  customer_id: number;
  customer_name: string;
  phone: string;
  notes: string;
  source: string;
  visits: number;
};

export function AppointmentCard({ a, showBarber }: { a: CardAppointment; showBarber?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const inactive = a.status === "cancelled" || a.status === "no_show";

  const act = (status: AppointmentStatus, notify = false) =>
    start(async () => {
      await setAppointmentStatus(a.id, status, notify);
      setOpen(false);
    });

  return (
    <div className={`card p-3.5 ${inactive ? "opacity-55" : ""} ${pending ? "animate-pulse" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0 text-center">
          <div className="text-lg font-semibold tabular-nums">{a.time}</div>
          <div className="text-xs text-muted tabular-nums">{a.endTime}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/clientes/${a.customer_id}`} className="truncate font-medium hover:text-accent">
              {a.customer_name}
            </Link>
            {a.visits <= 1 && !inactive && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] text-accent">Novo</span>
            )}
            <StatusBadge status={a.status} past={a.past} />
          </div>
          <div className="mt-0.5 text-sm text-muted">
            {a.service_name} · {euros(a.price_cents)}
            {showBarber && <> · {a.barber_name}</>}
          </div>
          {a.notes && <div className="mt-1 text-sm text-muted italic">“{a.notes}”</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <ContactLinks phone={a.phone} name={a.customer_name} />
          <button onClick={() => setOpen(!open)} className="text-xs text-muted hover:text-fg">
            {open ? "Fechar" : "Opções ▾"}
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {a.status === "booked" && (
            <>
              {a.past && (
                <button onClick={() => act("no_show")} className="btn-danger px-3 py-1.5 text-xs">
                  Faltou
                </button>
              )}
              {!a.past && (
                <button onClick={() => act("cancelled", true)} className="btn-danger px-3 py-1.5 text-xs">
                  Cancelar e avisar cliente
                </button>
              )}
              <button onClick={() => act("cancelled")} className="btn-ghost px-3 py-1.5 text-xs">
                Cancelar sem avisar
              </button>
            </>
          )}
          {inactive && (
            <button onClick={() => act("booked")} className="btn-ghost px-3 py-1.5 text-xs">
              Repor marcação
            </button>
          )}
        </div>
      )}
    </div>
  );
}
