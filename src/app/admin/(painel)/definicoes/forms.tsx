"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-status";
import type { Barber, Service, Settings } from "@/lib/db";
import { WEEKDAYS } from "@/lib/time";
import { addStaff, changePassword, saveBarber, saveService, saveSettings } from "../../actions";

function Field(props: { label: string; name: string; defaultValue?: string | number; type?: string; suffix?: string; placeholder?: string }) {
  return (
    <div>
      <label className="label">{props.label}</label>
      <div className="flex items-center gap-2">
        <input
          name={props.name}
          type={props.type ?? "text"}
          defaultValue={props.defaultValue}
          placeholder={props.placeholder}
          className="input"
        />
        {props.suffix && <span className="shrink-0 text-sm text-muted">{props.suffix}</span>}
      </div>
    </div>
  );
}

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  return (
    <form action={action} className="card space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" name="shop_name" defaultValue={settings.shop_name} />
        <Field label="Telefone" name="phone" defaultValue={settings.phone} />
        <Field label="Morada" name="address" defaultValue={settings.address} />
        <Field label="Instagram" name="instagram" defaultValue={settings.instagram} placeholder="@bandeirabarber" />
      </div>
      <div className="grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
        <Field label="Intervalo entre horários" name="slot_minutes" type="number" defaultValue={settings.slot_minutes} suffix="min" />
        <Field label="Antecedência mínima" name="min_notice_minutes" type="number" defaultValue={settings.min_notice_minutes} suffix="min" />
        <Field label="Marcar até" name="max_days_ahead" type="number" defaultValue={settings.max_days_ahead} suffix="dias" />
        <Field label="Cancelar até" name="cancel_limit_hours" type="number" defaultValue={settings.cancel_limit_hours} suffix="h antes" />
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "A guardar…" : "Guardar"}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function ServiceForm({ service }: { service: Service | null }) {
  const [state, action, pending] = useActionState(saveService, null);
  return (
    <form action={action} className={`card grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-[1fr_110px_110px_auto_auto] ${service && !service.active ? "opacity-60" : ""}`}>
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="col-span-2 sm:col-span-1">
        <Field label={service ? "Serviço" : "Novo serviço"} name="name" defaultValue={service?.name} placeholder="ex.: Corte criança" />
      </div>
      <Field label="Duração" name="duration_min" type="number" defaultValue={service?.duration_min ?? 30} suffix="min" />
      <Field label="Preço" name="price" defaultValue={service ? (service.price_cents / 100).toString() : ""} suffix="€" />
      {service ? (
        <label className="flex items-center gap-2 pb-3 text-sm text-muted">
          <input type="checkbox" name="active" defaultChecked={service.active} className="accent-[var(--accent)]" /> Ativo
        </label>
      ) : (
        <input type="hidden" name="active" value="on" />
      )}
      <div className="col-span-2 flex items-center gap-2 sm:col-span-1">
        <button disabled={pending} className={service ? "btn-ghost" : "btn-primary"}>
          {pending ? "…" : service ? "Guardar" : "Adicionar"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function BarberForm({ barber, week }: { barber: Barber | null; week: string[] }) {
  const [state, action, pending] = useActionState(saveBarber, null);
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <form action={action} className={`card space-y-3 p-5 ${barber && !barber.active ? "opacity-60" : ""}`}>
      {barber && <input type="hidden" name="id" value={barber.id} />}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label={barber ? "Nome" : "Novo barbeiro"} name="name" defaultValue={barber?.name} />
        </div>
        {barber ? (
          <label className="flex items-center gap-2 pb-3 text-sm text-muted">
            <input type="checkbox" name="active" defaultChecked={barber.active} className="accent-[var(--accent)]" /> Ativo
          </label>
        ) : (
          <input type="hidden" name="active" value="on" />
        )}
      </div>
      <div className="space-y-2">
        {order.map((wd) => (
          <div key={wd} className="grid grid-cols-[72px_1fr] items-center gap-2">
            <span className="text-sm text-muted">{WEEKDAYS[wd]}</span>
            <input name={`wd${wd}`} defaultValue={week[wd]} placeholder="folga" className="input py-2 text-sm" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button disabled={pending} className={barber ? "btn-ghost" : "btn-primary"}>
          {pending ? "A guardar…" : barber ? "Guardar" : "Adicionar barbeiro"}
        </button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field label="Password atual" name="current" type="password" />
      <Field label="Nova password" name="next" type="password" />
      <button disabled={pending} className="btn-ghost">{pending ? "…" : "Alterar"}</button>
      <div className="sm:col-span-3"><FormStatus state={state} /></div>
    </form>
  );
}

export function StaffForm({ barbers }: { barbers: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState(addStaff, null);
  return (
    <form action={action} className="card grid gap-3 p-5 sm:grid-cols-2">
      <Field label="Nome" name="name" />
      <Field label="Email" name="email" type="email" />
      <Field label="Password inicial" name="password" type="password" />
      <div>
        <label className="label">É o barbeiro</label>
        <select name="barberId" className="input">
          <option value="">—</option>
          {barbers.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="btn-ghost">{pending ? "…" : "Criar conta"}</button>
        <FormStatus state={state} />
      </div>
    </form>
  );
}
