import Link from "next/link";
import { sql } from "@/lib/db";
import { euros, fmtDateShort } from "@/lib/time";
import { ContactLinks, PageTitle } from "@/components/ui";

type Row = {
  id: number;
  name: string;
  phone: string;
  visits: number;
  no_shows: number;
  spent: number;
  last_visit: Date | null;
  next_visit: Date | null;
};

const FILTERS = {
  todos: "Todos",
  regulares: "Regulares",
  inativos: "Não vêm há +45 dias",
  faltosos: "Com faltas",
} as const;

export default async function ClientesPage(props: PageProps<"/admin/clientes">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const filter = (typeof sp.f === "string" && sp.f in FILTERS ? sp.f : "todos") as keyof typeof FILTERS;
  const digits = q.replace(/\D/g, "");

  const having = {
    todos: sql``,
    regulares: sql`having count(*) filter (where a.status in ('booked','completed') and a.starts_at < now()) >= 3`,
    inativos: sql`having max(a.starts_at) filter (where a.status in ('booked','completed')) < now() - interval '45 days'
                  and count(*) filter (where a.status = 'booked' and a.starts_at > now()) = 0`,
    faltosos: sql`having count(*) filter (where a.status = 'no_show') > 0`,
  }[filter];

  const rows = await sql<Row[]>`
    select c.id, c.name, c.phone,
      count(*) filter (where a.status in ('booked','completed') and a.starts_at < now())::int as visits,
      count(*) filter (where a.status = 'no_show')::int as no_shows,
      coalesce(sum(a.price_cents) filter (where a.status in ('booked','completed') and a.starts_at < now()), 0)::int as spent,
      max(a.starts_at) filter (where a.status in ('booked','completed') and a.starts_at < now()) as last_visit,
      min(a.starts_at) filter (where a.status = 'booked' and a.starts_at >= now()) as next_visit
    from customers c left join appointments a on a.customer_id = c.id
    ${q ? sql`where c.name ilike ${"%" + q + "%"} ${digits.length >= 3 ? sql`or c.phone like ${"%" + digits + "%"}` : sql``}` : sql``}
    group by c.id
    ${having}
    order by max(a.starts_at) desc nulls last
    limit 200`;

  const [{ total }] = await sql<{ total: number }[]>`select count(*)::int as total from customers`;

  return (
    <>
      <PageTitle>Clientes <span className="text-base text-muted">({total})</span></PageTitle>

      <form className="mb-3">
        {filter !== "todos" && <input type="hidden" name="f" value={filter} />}
        <input name="q" defaultValue={q} placeholder="Procurar por nome ou telemóvel…" className="input" />
      </form>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {Object.entries(FILTERS).map(([key, label]) => (
          <Link
            key={key}
            href={`/admin/clientes?f=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${
              filter === key ? "border-accent bg-accent/15 text-accent" : "border-line text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>
      {filter === "inativos" && (
        <p className="mb-4 text-sm text-muted">
          Clientes que já vieram mas não aparecem há mais de 45 dias e não têm marcação. Uma mensagem pelo 💬
          WhatsApp pode trazê-los de volta.
        </p>
      )}

      <div className="card divide-y divide-line">
        {rows.length === 0 && <p className="p-6 text-center text-muted">Nenhum cliente encontrado.</p>}
        {rows.map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3.5">
            <Link href={`/admin/clientes/${c.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{c.name}</span>
                {c.no_shows > 0 && (
                  <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[11px] text-danger">
                    {c.no_shows} falta{c.no_shows > 1 && "s"}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted">
                {c.visits} visita{c.visits !== 1 && "s"} · {euros(c.spent)}
                {c.last_visit && <> · última {fmtDateShort(c.last_visit)}</>}
                {c.next_visit && <span className="text-accent"> · próxima {fmtDateShort(c.next_visit)}</span>}
              </div>
            </Link>
            <ContactLinks phone={c.phone} name={c.name} />
          </div>
        ))}
      </div>
    </>
  );
}
