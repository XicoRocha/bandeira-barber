"use client";

export function FormStatus({ state }: { state: { ok: boolean; message?: string; error?: string } | null }) {
  if (!state) return null;
  return state.ok ? (
    state.message ? <p className="text-sm text-ok">{state.message}</p> : null
  ) : (
    <p className="text-sm text-danger">{state.error}</p>
  );
}
