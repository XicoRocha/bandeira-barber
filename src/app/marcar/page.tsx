import Link from "next/link";
import { getOpenDays } from "@/lib/availability";
import { getBarbers, getServices, getSettings } from "@/lib/db";
import { BookingWizard } from "./booking-wizard";

export const metadata = { title: "Marcar — Bandeira Barber" };

export default async function MarcarPage(props: PageProps<"/marcar">) {
  const { servico } = await props.searchParams;
  const settings = await getSettings();
  const [services, barbers, days] = await Promise.all([
    getServices(),
    getBarbers(),
    getOpenDays(null, settings),
  ]);

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <Link href="/" className="display text-lg font-semibold">
          {settings.shop_name}
        </Link>
        <Link href="/" className="text-sm text-muted hover:text-fg">
          Sair
        </Link>
      </header>
      <BookingWizard
        services={services.map(({ id, name, duration_min, price_cents }) => ({
          id,
          name,
          duration_min,
          price_cents,
        }))}
        barbers={barbers.map(({ id, name }) => ({ id, name }))}
        days={days}
        initialServiceId={Number(servico) || null}
      />
    </main>
  );
}
