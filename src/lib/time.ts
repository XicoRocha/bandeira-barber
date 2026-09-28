import { TZDate, tz } from "@date-fns/tz";
import { addDays, format } from "date-fns";
import { pt } from "date-fns/locale";

export const TZ = "Europe/Lisbon";

/** Hora atual em ms. As páginas são renderizadas a cada pedido, por isso usar a hora atual é seguro. */
export const nowMs = () => Date.now();
const inTz = tz(TZ);

/** "2026-09-25" para a data em Lisboa */
export function dayKey(date: Date = new Date()) {
  return format(date, "yyyy-MM-dd", { in: inTz });
}

export function isDayKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Converte dia + "HH:mm" (hora de Lisboa) num instante */
export function zoned(day: string, time = "00:00") {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, TZ).getTime());
}

export function addDaysKey(day: string, n: number) {
  return dayKey(addDays(zoned(day, "12:00"), n));
}

/** 0 = domingo … 6 = sábado */
export function weekdayOf(day: string) {
  return zoned(day, "12:00").getUTCDay();
}

/** Minutos desde a meia-noite de Lisboa */
export function minutesOfDay(date: Date) {
  const [h, m] = format(date, "HH:mm", { in: inTz }).split(":").map(Number);
  return h * 60 + m;
}

export const hhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const fmt = (date: Date, pattern: string) => format(date, pattern, { locale: pt, in: inTz });
export const fmtTime = (date: Date) => fmt(date, "HH:mm");
export const fmtDateLong = (date: Date) => fmt(date, "EEEE, d 'de' MMMM");
export const fmtDateShort = (date: Date) => fmt(date, "dd/MM/yyyy");

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function euros(cents: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
