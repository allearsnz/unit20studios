"use client";

import { useState, useTransition } from "react";
import { saveInternalNote } from "@/app/admin/actions";

export function InternalNote({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const onBlur = () =>
    start(async () => {
      await saveInternalNote(id, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        onBlur={onBlur}
        rows={4}
        className="input resize-none"
        placeholder="Internal notes — autosaves when you click away"
      />
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-meta text-text-dim">
        {pending ? "Saving…" : saved ? "Saved" : "Autosaves on blur"}
      </p>
    </div>
  );
}
