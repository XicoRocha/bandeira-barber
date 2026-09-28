"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { euros, fmt, zoned } from "@/lib/time";
import { bookAppointment } from "./actions";

type Service = { id: number; name: string; duration_min: number; price_cents: number };
type Barber = { id: number; name: string };
type Slot = { time: string; barberIds: number[] };

const STORAGE_KEY = "bb_cliente";

export function BookingWizard(props: {
  services: Service[];
  barbers: Barber[];
  days: string[];
  initialServiceId: number | null;
}) {
  const router = useRouter();
  const skipBarber = props.barbers.length === 1;

  const [serviceId, setServiceId] = useState<number | null>(
    props.services.some((s) => s.id === props.initialServiceId) ? props.initialServiceId : null,
  );
  const [barberId, setBarberId] = useState<string | null>(
    skipBarber ? String(props.barbers[0].id) : null,
  );
  const [pickedDay, setDay] = useState<string | null>(null);
  const day = pickedDay ?? props.days[0] ?? null; // por defeito, o primeiro dia disponível
  const [time, setTime] = useState<string | null>(null);

  // Horários guardados com a consulta a que pertencem: se a consulta mudou, ainda estão a carregar
  const [slotResult, setSlotResult] = useState<{ key: string; slots: Slot[] } | null>(null);
  const [reloadSlots, setReloadSlots] = useState(0);
  const slotKey = `${serviceId}|${barberId}|${day}|${reloadSlots}`;
  const slots = slotResult?.key === slotKey ? slotResult.slots : null;
  const loadingSlots = !!serviceId && !!barberId && !!day && !slots;

  // Os dados do cliente ficam guardados neste dispositivo (só por conveniência).
  // O formulário só aparece depois de o cliente escolher, por isso ler aqui não causa diferenças na hidratação.
  const [form, setForm] = useState(() => {
    const empty = { name: "", phone: "", email: "", website: "" };
    if (typeof window === "undefined") return empty;
    try {
      return { ...empty, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
    } catch {
      return empty;
    }
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const service = props.services.find((s) => s.id === serviceId);
  const barberName =
    barberId === "any" ? "Qualquer barbeiro" : props.barbers.find((b) => String(b.id) === barberId)?.name;

  const step = !service ? 1 : !barberId ? 2 : !day || !time ? 3 : 4;

  useEffect(() => {
    if (!serviceId || !barberId || !day) return;
    let cancelled = false;
    const key = slotKey;
    fetch(`/api/slots?service=${serviceId}&barber=${barberId}&day=${day}`)
      .then((r) => r.json())
      .then((data) => data.slots ?? [])
      .catch(() => [])
      .then((list: Slot[]) => !cancelled && setSlotResult({ key, slots: list }));
    return () => {
      cancelled = true;
    };
  }, [serviceId, barberId, day, slotKey]);

  const slotGroups = useMemo(() => {
    const groups: { label: string; slots: Slot[] }[] = [
      { label: "Manhã", slots: [] },
      { label: "Tarde", slots: [] },
      { label: "Noite", slots: [] },
    ];
    for (const s of slots ?? []) {
      const h = Number(s.time.slice(0, 2));
      groups[h < 13 ? 0 : h < 19 ? 1 : 2].slots.push(s);
    }
    return groups.filter((g) => g.slots.length);
  }, [slots]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !barberId || !day || !time) return;
    setError(null);
    startTransition(async () => {
      const res = await bookAppointment({
        serviceId: service.id,
        barberId,
        day,
        time,
        ...form,
      });
      if (res.ok) {
        try {
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ name: form.name, phone: form.phone, email: form.email }),
          );
        } catch {}
        router.push(`/m/${res.token}?nova=1`);
      } else {
        setError(res.error);
        if (res.error.includes("horário")) {
          setTime(null);
          setReloadSlots((n) => n + 1);
        }
      }
    });
  }

  return (
    <div className="space-y-4">
      <Progress step={step} />

      {/* 1. Serviço */}
      <Section
        n={1}
        title="Serviço"
        done={service ? `${service.name} · ${euros(service.price_cents)}` : null}
        onEdit={() => {
          setServiceId(null);
          setTime(null);
        }}
      >
        <div className="grid gap-2">
          {props.services.map((s) => (
            <button
              key={s.id}
              onClick={() => setServiceId(s.id)}
              className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-3.5 text-left transition-colors hover:border-accent"
            >
              <span>
                <span className="block font-medium">{s.name}</span>
                <span className="text-sm text-muted">{s.duration_min} min</span>
              </span>
              <span className="font-semibold text-accent">{euros(s.price_cents)}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* 2. Barbeiro */}
      {service && !skipBarber && (
        <Section
          n={2}
          title="Barbeiro"
          done={barberId ? barberName! : null}
          onEdit={() => {
            setBarberId(null);
            setTime(null);
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {props.barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => setBarberId(String(b.id))}
                className="flex flex-col items-center gap-2 rounded-xl border border-line bg-bg px-3 py-4 transition-colors hover:border-accent"
              >
                <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-lg font-semibold text-accent">
                  {b.name[0]}
                </span>
                <span className="font-medium">{b.name}</span>
              </button>
            ))}
            <button
              onClick={() => setBarberId("any")}
              className="col-span-2 rounded-xl border border-dashed border-line bg-bg px-3 py-3 text-sm text-muted transition-colors hover:border-accent hover:text-fg"
            >
              Tanto faz — o primeiro disponível
            </button>
          </div>
        </Section>
      )}

      {/* 3. Dia e hora */}
      {service && barberId && (
        <Section
          n={skipBarber ? 2 : 3}
          title="Dia e hora"
          done={day && time ? `${fmt(zoned(day, time), "EEEE, d MMM")} · ${time}` : null}
          onEdit={() => setTime(null)}
        >
          {props.days.length === 0 ? (
            <p className="text-muted">Sem dias disponíveis de momento.</p>
          ) : (
            <>
              <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
                {props.days.map((d) => {
                  const date = zoned(d, "12:00");
                  const active = d === day;
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDay(d);
                        setTime(null);
                      }}
                      className={`flex w-16 shrink-0 snap-start flex-col items-center rounded-xl border py-2.5 transition-colors ${
                        active
                          ? "border-accent bg-accent text-accent-fg"
                          : "border-line bg-bg hover:border-accent"
                      }`}
                    >
                      <span className={`text-xs uppercase ${active ? "" : "text-muted"}`}>
                        {fmt(date, "EEE").replace(".", "")}
                      </span>
                      <span className="text-xl font-semibold">{fmt(date, "d")}</span>
                      <span className={`text-xs ${active ? "" : "text-muted"}`}>
                        {fmt(date, "MMM").replace(".", "")}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 min-h-24">
                {loadingSlots && <p className="py-6 text-center text-muted">A procurar horários…</p>}
                {slots && slots.length === 0 && (
                  <div className="py-6 text-center text-muted">
                    <p>Sem horários livres neste dia.</p>
                    {day && props.days.indexOf(day) < props.days.length - 1 && (
                      <button
                        onClick={() => setDay(props.days[props.days.indexOf(day) + 1])}
                        className="btn-ghost mt-3"
                      >
                        Ver dia seguinte →
                      </button>
                    )}
                  </div>
                )}
                {slotGroups.map((g) => (
                  <div key={g.label} className="mb-4">
                    <div className="mb-2 text-xs font-medium tracking-wide text-muted uppercase">
                      {g.label}
                    </div>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {g.slots.map((s) => (
                        <button
                          key={s.time}
                          onClick={() => setTime(s.time)}
                          className={`rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                            s.time === time
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-line bg-bg hover:border-accent"
                          }`}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      {/* 4. Dados */}
      {step === 4 && service && day && time && (
        <Section n={skipBarber ? 3 : 4} title="Os seus dados" done={null}>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Nome
              </label>
              <input
                id="name"
                className="input"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Telemóvel
              </label>
              <input
                id="phone"
                className="input"
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="912 345 678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted">Recebe a confirmação e um lembrete por SMS.</p>
            </div>
            <div>
              <label className="label" htmlFor="email">
                Email <span className="font-normal">(opcional)</span>
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            {/* armadilha para bots — invisível para pessoas */}
            <input
              tabIndex={-1}
              autoComplete="off"
              className="hidden"
              name="website"
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
            />

            <div className="rounded-xl bg-bg p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">{service.name}</span>
                <span>{euros(service.price_cents)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted">{barberName}</span>
                <span>
                  {fmt(zoned(day, time), "d MMM")} · {time}
                </span>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
                {error}
              </p>
            )}

            <button type="submit" disabled={pending} className="btn-primary w-full py-3.5 text-base">
              {pending ? "A confirmar…" : "Confirmar marcação"}
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

function Section(props: {
  n: number;
  title: string;
  done: string | null;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  if (props.done) {
    return (
      <div className="card flex items-center justify-between px-5 py-4">
        <div className="min-w-0">
          <div className="text-xs text-muted">{props.title}</div>
          <div className="truncate font-medium first-letter:uppercase">{props.done}</div>
        </div>
        {props.onEdit && (
          <button onClick={props.onEdit} className="ml-3 shrink-0 text-sm text-accent hover:underline">
            Alterar
          </button>
        )}
      </div>
    );
  }
  return (
    <section className="card p-5">
      <h2 className="display mb-4 flex items-center gap-2 text-lg">
        <span className="grid size-6 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">
          {props.n}
        </span>
        {props.title}
      </h2>
      {props.children}
    </section>
  );
}
