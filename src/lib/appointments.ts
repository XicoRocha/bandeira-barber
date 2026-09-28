import "server-only";
import { sql, type AppointmentStatus } from "./db";

export type AppointmentView = {
  id: number;
  token: string;
  starts_at: Date;
  ends_at: Date;
  status: AppointmentStatus;
  price_cents: number;
  source: string;
  notes: string;
  service_id: number;
  service_name: string;
  barber_id: number;
  barber_name: string;
  customer_id: number;
  customer_name: string;
  phone: string;
  email: string | null;
};

const base = sql`
  select a.id, a.token, a.starts_at, a.ends_at, a.status, a.price_cents, a.source, a.notes,
         s.id as service_id, s.name as service_name, b.id as barber_id, b.name as barber_name,
         c.id as customer_id, c.name as customer_name, c.phone, c.email
  from appointments a
  join services s on s.id = a.service_id
  join barbers b on b.id = a.barber_id
  join customers c on c.id = a.customer_id`;

export async function getAppointmentByToken(token: string) {
  const [a] = await sql<AppointmentView[]>`${base} where a.token = ${token}`;
  return a ?? null;
}

export async function getAppointmentsBetween(from: Date, to: Date) {
  return sql<AppointmentView[]>`
    ${base} where a.starts_at >= ${from} and a.starts_at < ${to} order by a.starts_at`;
}
