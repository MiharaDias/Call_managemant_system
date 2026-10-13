import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useOptions } from "../hooks";
import { Button, ErrorText, Input } from "./ui";

/** Pick several values from an editable list (toggle chips) and add custom ones on the spot. */
export default function OptionChips({ category, value, onChange, noun }:
  { category: string; value: string[]; onChange: (v: string[]) => void; noun: string }) {
  const { opts } = useOptions();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const add = useMutation({
    mutationFn: () => api.post(`/options/${category}`, { value: draft.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["options"] });
      const v = draft.trim();
      if (!value.includes(v)) onChange([...value, v]);
      setDraft("");
      setAdding(false);
    },
  });

  const list = opts[category] ?? [];
  const all = [...list, ...value.filter((v) => !list.includes(v))];
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {all.map((v) => {
          const on = value.includes(v);
          return (
            <button key={v} type="button" aria-pressed={on} onClick={() => toggle(v)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-600 hover:border-indigo-400"}`}>
              {on && "✓ "}{v}
            </button>
          );
        })}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)}
            className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
            ＋ Add new {noun}
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-2">
          <Input autoFocus placeholder={`New ${noun}, e.g. Send brochure`} value={draft} maxLength={100} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); draft.trim() && add.mutate(); }
              if (e.key === "Escape") { e.stopPropagation(); setAdding(false); }
            }} />
          <Button variant="primary" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
          <Button onClick={() => setAdding(false)}>✕</Button>
        </div>
      )}
      <ErrorText error={add.error} />
    </div>
  );
}
