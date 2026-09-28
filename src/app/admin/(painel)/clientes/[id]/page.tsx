import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, type AppointmentStatus } from "@/lib/db";
import { euros, fmt, nowMs } from "@/lib/time";
import { ContactLinks, Kpi, StatusBadge } from "@/components/ui";
import { CustomerForm } from "./customer-form";

export default async function ClientePage(props: PageProps<"/admin/clientes/[id]">) {
  const { id } = await props.params;
  const [customer] = await sql<
    { id: number; name: string; phone: string; email: string | null; notes: string; created_at: Date }[]
  >`select * from customers where id = ${Number(id) || 0}`;
  if (!customer) notFound();

  const history = await sql<
    { id: number; starts_at: Date; status: AppointmentStatus; price_cents: number; service: string; barber: string }[]
  >`
    select a.id, a.starts_at, a.status, a.price_cents, s.name as service, b.name as barber
    from appointments a join services s on s.id = a.service_id join barbers b on b.id = a.barber_id
    where a.customer_id = ${customer.id} order by a.starts_at desc`;

  const now = nowMs();
  const done = history.filter((h) => (h.status === "booked" || h.status === "completed") && h.starts_at.getTime() < now);
  const spent = done.reduce((s, h) => s + h.price_cents, 0);
  const noShows = history.filter((h) => h.status === "no_show").length;

  // Intervalo médio entre visitas → ajuda a perceber de quanto em quanto tempo o cliente vem
  const dates = done.map((h) => h.starts_at.getTime()).sort((a, b) => a - b);
  const gaps = dates.slice(1).map((d, i) => d - dates[i]);
  const avgDays = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length / 86_400_000) : null;

  return (
    <>
      <Link href="/admin/clientes" className="text-sm text-muted hover:text-fg">← Clientes</Link>
      <div className="mt-2 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="display text-2xl">{customer.name}</h1>
          <p className="text-muted">{customer.phone}</p>
        </div>
        <ContactLinks phone={customer.phone} name={customer.name} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Visitas" value={String(done.length)} />
        <Kpi label="Total gasto" value={euros(spent)} />
        <Kpi label="Vem a cada" value={avgDays ? `${avgDays} dias` : "—"} />
        <Kpi label="Faltas" value={String(noShows)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="display mb-3 text-lg">Histórico</h2>
          <div className="card divide-y divide-line">
            {history.length === 0 && <p className="p-4 text-muted">Sem marcações.</p>}
            {history.map((h) => (
              <Link key={h.id} href={`/admin/agenda?d=${fmt(h.starts_at, "yyyy-MM-dd")}`} className="flex items-center justify-between gap-3 p-3.5 hover:bg-surface-2">
                <div>
                  <div className="font-medium first-letter:uppercase">{fmt(h.starts_at, "EEE d MMM yyyy, HH:mm")}</div>
                  <div className="text-sm text-muted">{h.service} · {h.barber}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm">{euros(h.price_cents)}</span>
                  <StatusBadge status={h.status} past={h.starts_at.getTime() < now} />
                </div>
              </Link>
            ))}
          </div>
        </section>
        <aside>
          <h2 className="display mb-3 text-lg">Ficha</h2>
          <CustomerForm customer={{ id: customer.id, name: customer.name, email: customer.email ?? "", notes: customer.notes }} />
          <p className="mt-3 text-xs text-muted">Cliente desde {fmt(customer.created_at, "MMMM yyyy")}</p>
        </aside>
      </div>
    </>
  );
}
