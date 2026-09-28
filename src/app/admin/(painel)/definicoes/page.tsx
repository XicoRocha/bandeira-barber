import { requireStaff } from "@/lib/auth";
import { getBarbers, getServices, getSettings, sql } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { BarberForm, PasswordForm, ServiceForm, SettingsForm, StaffForm } from "./forms";

export default async function DefinicoesPage() {
  const user = await requireStaff();
  const [settings, services, barbers, hours, staff] = await Promise.all([
    getSettings(),
    getServices(false),
    getBarbers(false),
    sql<{ barber_id: number; weekday: number; start_time: string; end_time: string }[]>`
      select barber_id, weekday, to_char(start_time,'HH24:MI') as start_time, to_char(end_time,'HH24:MI') as end_time
      from working_hours order by start_time`,
    sql<{ id: number; name: string; email: string; role: string }[]>`select id, name, email, role from staff order by id`,
  ]);
  const isOwner = user.role === "owner";
  const publicUrl = process.env.APP_URL ?? "";

  const weekHours = (barberId: number) =>
    Array.from({ length: 7 }, (_, wd) =>
      hours
        .filter((h) => h.barber_id === barberId && h.weekday === wd)
        .map((h) => `${h.start_time}-${h.end_time}`)
        .join(", "),
    );

  return (
    <>
      <PageTitle>Definições</PageTitle>
      <div className="space-y-8">
        {publicUrl && (
          <section className="card p-5">
            <h2 className="display mb-1 text-lg">Link de marcações</h2>
            <p className="mb-3 text-sm text-muted">Coloque este link na bio do Instagram e no Google.</p>
            <code className="block rounded-xl bg-bg px-3 py-2.5 text-sm break-all text-accent">{publicUrl}</code>
          </section>
        )}

        {isOwner && (
          <>
            <Block title="Barbearia e regras de marcação">
              <SettingsForm settings={settings} />
            </Block>

            <Block title="Serviços e preços">
              <div className="space-y-3">
                {services.map((s) => (
                  <ServiceForm key={s.id} service={s} />
                ))}
                <ServiceForm service={null} />
              </div>
            </Block>

            <Block
              title="Barbeiros e horários"
              hint="Um bloco por intervalo, separados por vírgula. Ex.: 09:30-13:00, 14:30-19:30. Vazio = folga."
            >
              <div className="grid gap-4 lg:grid-cols-2">
                {barbers.map((b) => (
                  <BarberForm key={b.id} barber={b} week={weekHours(b.id)} />
                ))}
                <BarberForm barber={null} week={Array(7).fill("")} />
              </div>
            </Block>

            <Block title="Contas de acesso" hint="Crie uma conta para o outro barbeiro ver a agenda e registar marcações.">
              <div className="card mb-3 divide-y divide-line">
                {staff.map((s) => (
                  <div key={s.id} className="flex justify-between p-3 text-sm">
                    <span>{s.name} <span className="text-muted">· {s.email}</span></span>
                    <span className="text-muted">{s.role === "owner" ? "Gestor" : "Barbeiro"}</span>
                  </div>
                ))}
              </div>
              <StaffForm barbers={barbers.map((b) => ({ id: b.id, name: b.name }))} />
            </Block>
          </>
        )}

        <Block title="A minha password">
          <PasswordForm />
        </Block>
      </div>
    </>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="display text-lg">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
