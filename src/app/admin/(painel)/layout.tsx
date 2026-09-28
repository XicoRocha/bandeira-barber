import { requireStaff } from "@/lib/auth";
import { logout } from "../actions";
import { AdminNav } from "./nav";

export const metadata = { title: "Gestão — Bandeira Barber", robots: { index: false } };

export default async function PainelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireStaff();
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="display mb-6 px-2 text-lg">Bandeira Barber</div>
        <AdminNav variant="side" />
        <div className="mt-auto border-t border-line px-2 pt-4 text-sm">
          <div className="truncate text-muted">{user.name}</div>
          <form action={logout}>
            <button className="mt-1 text-muted hover:text-fg">Sair</button>
          </form>
        </div>
      </aside>
      <main className="w-full min-w-0 flex-1 px-4 pt-5 pb-28 md:px-8 md:pt-8 md:pb-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <AdminNav variant="bottom" />
    </div>
  );
}
