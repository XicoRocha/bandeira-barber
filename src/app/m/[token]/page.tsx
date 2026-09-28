import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointmentByToken } from "@/lib/appointments";
import { getSettings } from "@/lib/db";
import { euros, fmtDateLong, fmtTime, nowMs } from "@/lib/time";
import { CancelButton } from "./cancel-button";

export const metadata = { title: "A sua marcação — Bandeira Barber", robots: { index: false } };

export default async function AppointmentPage(props: PageProps<"/m/[token]">) {
  const { token } = await props.params;
  const { nova } = await props.searchParams;
  const [a, settings] = await Promise.all([getAppointmentByToken(token), getSettings()]);
  if (!a) notFound();

  const isFuture = a.starts_at.getTime() > nowMs();
  const canCancel =
    a.status === "booked" &&
    a.starts_at.getTime() - nowMs() > settings.cancel_limit_hours * 3_600_000;

  const statusLabel = {
    booked: isFuture ? "Confirmada" : "Concluída",
    completed: "Concluída",
    cancelled: "Cancelada",
    no_show: "Falta",
  }[a.status];

  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      {nova && a.status === "booked" && (
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-ok/15 text-2xl text-ok">
            ✓
          </div>
          <h1 className="display text-2xl">Marcação confirmada</h1>
          <p className="mt-1 text-muted">Vai receber a confirmação por SMS.</p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="display text-lg">{settings.shop_name}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              a.status === "cancelled" || a.status === "no_show"
                ? "bg-danger/15 text-danger"
                : "bg-ok/15 text-ok"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        <dl className="space-y-3 px-5 py-5">
          <Row label="Quando">
            <span className="first-letter:uppercase">{fmtDateLong(a.starts_at)}</span>
            <span className="block text-2xl font-semibold">{fmtTime(a.starts_at)}</span>
          </Row>
          <Row label="Serviço">
            {a.service_name} · {euros(a.price_cents)}
          </Row>
          <Row label="Barbeiro">{a.barber_name}</Row>
          <Row label="Nome">{a.customer_name}</Row>
          {settings.address && <Row label="Onde">{settings.address}</Row>}
        </dl>
      </div>

      <div className="mt-4 grid gap-2">
        {a.status === "booked" && isFuture && (
          <a href={`/m/${a.token}/ics`} className="btn-ghost w-full">
            📅 Adicionar ao calendário
          </a>
        )}
        {canCancel && <CancelButton token={a.token} />}
        {a.status === "booked" && isFuture && !canCancel && (
          <p className="text-center text-sm text-muted">
            Já não é possível cancelar online (menos de {settings.cancel_limit_hours}h).
            {settings.phone && (
              <>
                {" "}
                Ligue para{" "}
                <a className="text-accent" href={`tel:${settings.phone}`}>
                  {settings.phone}
                </a>
                .
              </>
            )}
          </p>
        )}
        <Link href="/marcar" className="btn-ghost w-full">
          Fazer outra marcação
        </Link>
      </div>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
