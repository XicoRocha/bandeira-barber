"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormStatus } from "@/components/form-status";
import { addTimeOff, adminCreateBooking, adminSlots, deleteTimeOff } from "../../actions";

type Service = { id: number; name: string; duration_min: number };
type Barber = { id: number; name: string };

export function DatePicker({ day }: { day: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      value={day}
      onChange={(e) => e.target.value && router.push(`/admin/agenda?d=${e.target.value}`)}
      className="input w-auto py-2 text-sm"
    />
  );
}

export function RemoveTimeOff({ id }: { id: number }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => deleteTimeOff(id))}
      className="text-xs text-muted hover:text-danger"
    >
      {pending ? "…" : "Remover"}
    </button>
  );
}

export function AgendaTools(props: { day: string; services: Service[]; barbers: Barber[] }) {
  const [open, setOpen] = useState<"book" | "block" | null>(null);
  return (
    <div className="w-full sm:w-auto">
      <div className="flex gap-2">
        <button onClick={() => setOpen(open === "book" ? null : "book")} className="btn-primary flex-1 sm:flex-none">
          + Marcação
        </button>
        <button onClick={() => setOpen(open === "block" ? null : "block")} className="btn-ghost flex-1 sm:flex-none">
          Bloquear horas / férias
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setOpen(null)}>
          <div
            className="card max-h-[90vh] w-full max-w-md overflow-y-auto rounded-b-none p-5 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="display text-lg">{open === "book" ? "Nova marcação" : "Bloquear horário"}</h2>
              <button onClick={() => setOpen(null)} className="text-muted hover:text-fg">✕</button>
            </div>
            {open === "book" ? (
              <BookForm {...props} onDone={() => setOpen(null)} />
            ) : (
              <BlockForm {...props} onDone={() => setOpen(null)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BookForm(props: { day: string; services: Service[]; barbers: Barber[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(adminCreateBooking, null);
  const [serviceId, setServiceId] = useState(props.services[0]?.id ?? 0);
  const [barberId, setBarberId] = useState(props.barbers[0]?.id ?? 0);
  const [day, setDay] = useState(props.day);
  // Controlados para não se perderem se a marcação falhar (o React limpa o formulário ao enviar)
  const [client, setClient] = useState({ name: "", phone: "", notes: "" });
  const slotKey = `${serviceId}|${barberId}|${day}`;
  const [slotResult, setSlotResult] = useState<{ key: string; slots: string[] } | null>(null);
  const slots = slotResult?.key === slotKey ? slotResult.slots : null;

  useEffect(() => {
    let cancelled = false;
    adminSlots(serviceId, barberId, day).then((s) => !cancelled && setSlotResult({ key: slotKey, slots: s }));
    return () => {
      cancelled = true;
    };
  }, [serviceId, barberId, day, slotKey]);

  useEffect(() => {
    if (state?.ok) props.onDone();
  }, [state, props]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Serviço</label>
          <select name="serviceId" className="input" value={serviceId} onChange={(e) => setServiceId(Number(e.target.value))}>
            {props.services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Barbeiro</label>
          <select name="barberId" className="input" value={barberId} onChange={(e) => setBarberId(Number(e.target.value))}>
            {props.barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Dia</label>
          <input type="date" name="day" className="input" value={day} onChange={(e) => setDay(e.target.value)} required />
        </div>
        <div>
          <label className="label">Hora</label>
          <select name="time" className="input" required disabled={!slots}>
            {!slots && <option>A carregar…</option>}
            {slots?.length === 0 && <option value="">Sem vagas</option>}
            {slots?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Nome do cliente</label>
        <input name="name" className="input" required value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
      </div>
      <div>
        <label className="label">Telemóvel</label>
        <input name="phone" type="tel" inputMode="tel" className="input" required placeholder="912 345 678" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
      </div>
      <div>
        <label className="label">Nota (opcional)</label>
        <input name="notes" className="input" placeholder="ex.: degradé baixo" value={client.notes} onChange={(e) => setClient({ ...client, notes: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted">
        <input type="checkbox" name="notify" defaultChecked className="accent-[var(--accent)]" />
        Enviar confirmação por SMS ao cliente
      </label>
      <FormStatus state={state} />
      <button disabled={pending || !slots?.length} className="btn-primary w-full">
        {pending ? "A guardar…" : "Criar marcação"}
      </button>
    </form>
  );
}

function BlockForm(props: { day: string; barbers: Barber[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(addTimeOff, null);
  const [allDay, setAllDay] = useState(false);

  return (
    <form action={action} className="space-y-3">
      <div>
        <label className="label">Barbeiro</label>
        <select name="barberId" className="input">
          {props.barbers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-[var(--accent)]" />
        Dia(s) inteiro(s) — folga / férias
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className={allDay ? "" : "col-span-2"}>
          <label className="label">{allDay ? "De" : "Dia"}</label>
          <input type="date" name="day" defaultValue={props.day} className="input" required />
        </div>
        {allDay ? (
          <div>
            <label className="label">Até (inclusive)</label>
            <input type="date" name="dayTo" defaultValue={props.day} className="input" />
          </div>
        ) : (
          <>
            <div>
              <label className="label">Das</label>
              <input type="time" name="from" defaultValue="13:00" className="input" required />
            </div>
            <div>
              <label className="label">Às</label>
              <input type="time" name="to" defaultValue="14:00" className="input" required />
            </div>
          </>
        )}
      </div>
      <div>
        <label className="label">Motivo (opcional, só para si)</label>
        <input name="reason" className="input" placeholder="ex.: almoço, médico, férias" />
      </div>
      <FormStatus state={state} />
      {state?.ok ? (
        <button type="button" onClick={props.onDone} className="btn-ghost w-full">Fechar</button>
      ) : (
        <button disabled={pending} className="btn-primary w-full">
          {pending ? "A guardar…" : "Bloquear"}
        </button>
      )}
    </form>
  );
}
