import "server-only";
import postgres from "postgres";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

// prepare: false é necessário com o "transaction pooler" do Supabase (porta 6543)
export const sql =
  globalForDb.sql ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // A base de dados local (PGlite) só aguenta 1 ligação de cada vez → DATABASE_POOL_MAX=1
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    onnotice: () => {},
  });

if (process.env.NODE_ENV !== "production") globalForDb.sql = sql;

export type Settings = {
  shop_name: string;
  address: string;
  phone: string;
  instagram: string;
  slot_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  cancel_limit_hours: number;
};

export type Barber = { id: number; name: string; active: boolean; sort: number };

export type Service = {
  id: number;
  name: string;
  description: string;
  duration_min: number;
  price_cents: number;
  active: boolean;
  sort: number;
};

export type AppointmentStatus = "booked" | "completed" | "cancelled" | "no_show";

export async function getSettings(): Promise<Settings> {
  const [s] = await sql<Settings[]>`select * from settings where id = 1`;
  return s;
}

export async function getBarbers(onlyActive = true) {
  return sql<Barber[]>`
    select * from barbers ${onlyActive ? sql`where active` : sql``} order by sort, id`;
}

export async function getServices(onlyActive = true) {
  return sql<Service[]>`
    select * from services ${onlyActive ? sql`where active` : sql``} order by sort, id`;
}
