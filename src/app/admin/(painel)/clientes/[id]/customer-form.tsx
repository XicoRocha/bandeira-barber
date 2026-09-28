"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-status";
import { updateCustomer } from "../../../actions";

export function CustomerForm({ customer }: { customer: { id: number; name: string; email: string; notes: string } }) {
  const [state, action, pending] = useActionState(updateCustomer.bind(null, customer.id), null);
  return (
    <form action={action} className="card space-y-3 p-4">
      <div>
        <label className="label">Nome</label>
        <input name="name" defaultValue={customer.name} className="input" required />
      </div>
      <div>
        <label className="label">Email</label>
        <input name="email" type="email" defaultValue={customer.email} className="input" />
      </div>
      <div>
        <label className="label">Notas (só a equipa vê)</label>
        <textarea
          name="notes"
          defaultValue={customer.notes}
          rows={4}
          className="input"
          placeholder="ex.: máquina 1.5 dos lados, tesoura em cima, não gosta de conversa"
        />
      </div>
      <FormStatus state={state} />
      <button disabled={pending} className="btn-ghost w-full">{pending ? "A guardar…" : "Guardar"}</button>
    </form>
  );
}
