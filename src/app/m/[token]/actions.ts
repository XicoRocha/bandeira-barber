"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { sql, getSettings } from "@/lib/db";
import { notifyAppointment } from "@/lib/notify";

export async function cancelByCustomer(token: string) {
  const settings = await getSettings();
  const [a] = await sql<{ id: number }[]>`
    update appointments set status = 'cancelled', cancelled_at = now()
    where token = ${token} and status = 'booked'
      and starts_at > now() + make_interval(hours => ${settings.cancel_limit_hours})
    returning id`;
  if (!a) return { ok: false as const, error: "Já não é possível cancelar esta marcação online." };
  after(() => notifyAppointment(a.id, "cancellation"));
  refresh();
  return { ok: true as const };
}
