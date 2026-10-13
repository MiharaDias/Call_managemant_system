import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useOptions } from "../hooks";
import { Button, ErrorText, Input, Select } from "./ui";

const ADD = "__add_new__";

/** A dropdown fed by an editable list (subject, status…) with a “+ Add new…” entry for custom values. */
export default function OptionSelect({ category, value, onChange, noun, placeholder }:
  { category: string; value: string; onChange: (v: string) => void; noun: string; placeholder?: string }) {
  const { opts } = useOptions();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const add = useMutation({
    mutationFn: () => api.post(`/options/${category}`, { value: draft.trim() }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["options"] });
      onChange(draft.trim());
      setDraft("");
      setAdding(false);
    },
  });

  const list = opts[category] ?? [];
  const options = [...(value && !list.includes(value) ? [value] : []), ...list, { value: ADD, label: `＋ Add new ${noun}…` }];

  if (adding) {
    return (
      <div>
        <div className="flex gap-2">
          <Input autoFocus placeholder={`New ${noun}`} value={draft} maxLength={100} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); draft.trim() && add.mutate(); }
              if (e.key === "Escape") { e.stopPropagation(); setAdding(false); }
            }} />
          <Button variant="primary" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()}>Add</Button>
          <Button onClick={() => setAdding(false)}>✕</Button>
        </div>
        <ErrorText error={add.error} />
      </div>
    );
  }
  return <Select value={value} placeholder={placeholder} options={options}
    onChange={(e) => (e.target.value === ADD ? setAdding(true) : onChange(e.target.value))} />;
}
