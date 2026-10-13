import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useTags } from "../hooks";
import type { Tag } from "../types";
import { Button, ErrorText, Input } from "./ui";

export const TAG_COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#16a34a", "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6", "#64748b"];

/** Small coloured label; hover shows what the tag means. */
export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span title={tag.description || tag.name}
      style={{ background: tag.color + "1f", color: tag.color, borderColor: tag.color + "55" }}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium">
      {tag.name}
      {onRemove && <button type="button" onClick={onRemove} aria-label={`Remove ${tag.name}`} className="opacity-60 hover:opacity-100">×</button>}
    </span>
  );
}

/** Only the tags that were actually added; renders nothing when there are none. */
export function TagList({ tags }: { tags: Tag[] }) {
  return tags.length ? <span className="flex flex-wrap gap-1">{tags.map((t) => <TagChip key={t.id} tag={t} />)}</span> : null;
}

function toggle(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** FILTER control: shows every existing tag as a toggle (a filter has to list them all). */
export function TagPicker({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const tags = useTags();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => {
        const on = value.includes(t.id);
        return (
          <button key={t.id} type="button" title={t.description || t.name} aria-pressed={on} onClick={() => onChange(toggle(value, t.id))}
            style={on ? { background: t.color, borderColor: t.color, color: "#fff" } : { color: t.color, borderColor: t.color + "66" }}
            className="rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium transition-colors hover:brightness-95">
            {t.name}
          </button>
        );
      })}
      {tags.length === 0 && <span className="text-xs text-slate-400">No tags yet – create them in Settings.</span>}
    </div>
  );
}

function NewTagForm({ onCreated, onCancel }: { onCreated: (t: Tag) => void; onCancel: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ name: "", color: TAG_COLORS[0], description: "" });
  const create = useMutation({
    mutationFn: () => api.post<Tag>("/tags", draft),
    onSuccess: async (tag) => { await qc.invalidateQueries({ queryKey: ["tags"] }); onCreated(tag); },
  });
  return (
    <div className="space-y-2">
      <Input autoFocus placeholder="Tag name, e.g. Decision maker" value={draft.name} maxLength={50}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); draft.name.trim() && create.mutate(); } }} />
      <Input placeholder="What does this tag mean? (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} />
      <div className="flex flex-wrap items-center gap-1.5">
        {TAG_COLORS.map((c) => (
          <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => setDraft({ ...draft, color: c })}
            style={{ background: c }} className={`h-5 w-5 rounded-full ${draft.color === c ? "ring-2 ring-offset-1 ring-slate-700" : ""}`} />
        ))}
        <span className="ml-auto flex gap-2">
          <Button size="sm" onClick={onCancel}>Cancel</Button>
          <Button size="sm" variant="primary" disabled={!draft.name.trim() || create.isPending} onClick={() => create.mutate()}>Create tag</Button>
        </span>
      </div>
      <ErrorText error={create.error} />
    </div>
  );
}

/**
 * ASSIGN control: shows only the tags that were added (with × to remove).
 * Tags that are not added stay hidden until you press “+ Tag”.
 */
export function TagAssign({ value, onChange }: { value: number[]; onChange: (ids: number[]) => void }) {
  const tags = useTags();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const chosen = tags.filter((t) => value.includes(t.id));
  const available = tags.filter((t) => !value.includes(t.id));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((t) => <TagChip key={t.id} tag={t} onRemove={() => onChange(value.filter((x) => x !== t.id))} />)}
        <button type="button" aria-expanded={open} onClick={() => { setOpen(!open); setCreating(false); }}
          className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
          {open ? "Close" : "+ Tag"}
        </button>
      </div>
      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {!creating && (
            <>
              {available.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {available.map((t) => (
                    <button key={t.id} type="button" title={t.description || t.name} onClick={() => onChange([...value, t.id])}
                      style={{ color: t.color, borderColor: t.color + "66" }}
                      className="rounded-full border bg-white px-2.5 py-0.5 text-xs font-medium hover:brightness-95">+ {t.name}</button>
                  ))}
                </div>
              ) : <p className="text-xs text-slate-400">{tags.length ? "Every tag is already added." : "No tags exist yet."}</p>}
              <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setCreating(true)}>Create a new tag…</button>
            </>
          )}
          {creating && (
            <NewTagForm onCancel={() => setCreating(false)} onCreated={(t) => { onChange([...value, t.id]); setCreating(false); setOpen(false); }} />
          )}
        </div>
      )}
    </div>
  );
}
