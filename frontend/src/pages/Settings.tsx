import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useInvalidate, useOptions, useTags } from "../hooks";
import { TAG_COLORS, TagChip } from "../components/Tags";
import { Button, Card, Check, ErrorText, Field, Input, PageHeader, Textarea } from "../components/ui";
import type { Tag } from "../types";
import { useQueryClient } from "@tanstack/react-query";

const LISTS: { key: string; label: string; hint?: string }[] = [
  { key: "outcome", label: "Call outcomes", hint: "Keep names starting with “Answered”, “Switched” etc. – the dashboard groups outcomes by them." },
  { key: "meeting_outcome", label: "Meeting outcomes" },
  { key: "spoke_to", label: "Spoke to / met with" },
  { key: "interest", label: "Interest levels" },
  { key: "channel", label: "Sent via" },
  { key: "status", label: "Overall statuses", hint: "Order = the order of the pipeline. “Contacted” is set automatically after you speak to the teacher or a manager." },
  { key: "subject", label: "Subjects" },
  { key: "next_action", label: "Next actions" },
  { key: "task_type", label: "Task types" },
];

export default function Settings() {
  const { opts, maxRounds, calendarTypes } = useOptions();
  const tags = useTags();
  const qc = useQueryClient();
  const invalidate = useInvalidate();
  const [text, setText] = useState<Record<string, string>>({});
  const [rounds, setRounds] = useState(5);
  const [calTypes, setCalTypes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (Object.keys(opts).length) setText(Object.fromEntries(LISTS.map((l) => [l.key, (opts[l.key] ?? []).join("\n")])));
    setRounds(maxRounds);
    setCalTypes(calendarTypes);
  }, [JSON.stringify(opts), maxRounds, JSON.stringify(calendarTypes)]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveOpts = useMutation({
    mutationFn: () => api.put("/options", {
      options: Object.fromEntries(LISTS.map((l) => [l.key, (text[l.key] ?? "").split("\n").map((x) => x.trim()).filter(Boolean)])),
      max_rounds: rounds,
      calendar_types: calTypes,
    }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["options"] }); await invalidate(); setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });

  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const changePw = useMutation({ mutationFn: () => api.post("/auth/password", pw), onSuccess: () => setPw({ current_password: "", new_password: "" }) });

  const file = useRef<HTMLInputElement>(null);
  const importXlsx = useMutation({
    mutationFn: (f: File) => { const fd = new FormData(); fd.append("file", f); return api.post<{ teachers_created: number; teachers_skipped: number; calls: number; tasks: number }>("/import/excel", fd); },
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Excel import / export" className="lg:col-span-2">
          <div className="space-y-3 p-4 text-sm text-slate-600">
            <p>Import your existing <b>Teacher Call Tracker</b> workbook: teachers and phone numbers from <i>Contacts</i>, and any filled-in rows from <i>Call Log</i> (follow-up dates become tasks). Teachers that already exist (same name) are skipped, so importing twice is safe.</p>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={file} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importXlsx.mutate(f); e.target.value = ""; }} />
              <Button onClick={() => file.current?.click()} disabled={importXlsx.isPending}>{importXlsx.isPending ? "Importing…" : "Import .xlsx"}</Button>
              <a href="/api/export/excel" className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Export to Excel</a>
            </div>
            {importXlsx.data && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">Imported {importXlsx.data.teachers_created} teachers ({importXlsx.data.teachers_skipped} already existed), {importXlsx.data.calls} calls, {importXlsx.data.tasks} tasks.</p>}
            <ErrorText error={importXlsx.error} />
          </div>
        </Card>

        <Card title="Dropdown lists & rounds" className="lg:col-span-2" actions={<>{saved && <span className="text-xs text-emerald-600">Saved ✓</span>}<Button size="sm" variant="primary" onClick={() => saveOpts.mutate()} disabled={saveOpts.isPending}>Save changes</Button></>}>
          <div className="space-y-4 p-4">
            <Field label="Default number of call rounds" className="max-w-xs" hint="Normally 5. A teacher can still be called for more rounds – just pick the next round when logging a call.">
              <Input type="number" min={1} max={10} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} />
            </Field>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-600">Task types shown on the calendar</div>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {(opts.task_type ?? []).map((t) => (
                  <Check key={t} label={t} checked={calTypes.includes(t)} onChange={(v) => setCalTypes((p) => (v ? [...p, t] : p.filter((x) => x !== t)))} />
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">Other task types (e.g. “Send demo video”) still appear in Today and Tasks.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LISTS.map((l) => (
                <Field key={l.key} label={`${l.label} (one per line)`} hint={l.hint}>
                  <Textarea rows={7} value={text[l.key] ?? ""} onChange={(e) => setText((p) => ({ ...p, [l.key]: e.target.value }))} />
                </Field>
              ))}
            </div>
            <ErrorText error={saveOpts.error} />
          </div>
        </Card>

        <TagsCard tags={tags} />

        <Card title="Change my password">
          <form className="space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); changePw.mutate(); }}>
            <Field label="Current password"><Input type="password" autoComplete="current-password" required value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
            <Field label="New password (min 8 characters)"><Input type="password" autoComplete="new-password" minLength={8} required value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
            <ErrorText error={changePw.error} />
            {changePw.isSuccess && <p className="text-sm text-emerald-700">Password updated.</p>}
            <Button type="submit" variant="primary" disabled={changePw.isPending}>Update password</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

function TagsCard({ tags }: { tags: Tag[] }) {
  const qc = useQueryClient();
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["tags"] }), qc.invalidateQueries({ queryKey: ["teachers"] }), qc.invalidateQueries({ queryKey: ["calls"] }), qc.invalidateQueries({ queryKey: ["teacher"] })]);
  const [draft, setDraft] = useState({ name: "", color: TAG_COLORS[0], description: "" });
  const [edit, setEdit] = useState<Tag | null>(null);

  const create = useMutation({ mutationFn: () => api.post("/tags", draft), onSuccess: async () => { await refresh(); setDraft({ name: "", color: TAG_COLORS[0], description: "" }); } });
  const update = useMutation({ mutationFn: (t: Tag) => api.patch(`/tags/${t.id}`, { name: t.name, color: t.color, description: t.description }), onSuccess: async () => { await refresh(); setEdit(null); } });
  const del = useMutation({ mutationFn: (id: number) => api.del(`/tags/${id}`), onSuccess: refresh });

  const swatches = (value: string, on: (c: string) => void) => (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((c) => <button key={c} type="button" aria-label={`Colour ${c}`} onClick={() => on(c)} style={{ background: c }} className={`h-5 w-5 rounded-full ${value === c ? "ring-2 ring-offset-1 ring-slate-700" : ""}`} />)}
    </div>
  );

  return (
    <Card title={`Tags · ${tags.length}`}>
      <div className="space-y-3 p-4">
        <p className="text-xs text-slate-500">Tags label teachers and calls (e.g. “Decision maker”, “Wants discount”). Write what each one means so both of you use it the same way. You can filter the Teachers and Call log pages by tag.</p>
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {tags.length === 0 && <li className="px-3 py-3 text-sm text-slate-400">No tags yet.</li>}
          {tags.map((t) => (
            <li key={t.id} className="px-3 py-2">
              {edit?.id === t.id ? (
                <div className="space-y-2">
                  <Input value={edit.name} maxLength={50} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                  <Input placeholder="What does this tag mean?" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
                  {swatches(edit.color, (c) => setEdit({ ...edit, color: c }))}
                  <div className="flex justify-end gap-2"><Button size="sm" onClick={() => setEdit(null)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => update.mutate(edit)} disabled={!edit.name.trim()}>Save</Button></div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <TagChip tag={t} />
                  <span className="min-w-0 flex-1 text-xs text-slate-500">{t.description || <i className="text-slate-300">no description</i>}</span>
                  <button className="text-xs text-indigo-600 hover:underline" onClick={() => setEdit(t)}>Edit</button>
                  <button className="text-xs text-rose-600 hover:underline" onClick={() => confirm(`Delete the tag “${t.name}”? It is removed from all teachers and calls.`) && del.mutate(t.id)}>Delete</button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
          <div className="flex gap-2">
            <Input placeholder="New tag name" required maxLength={50} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <Button type="submit" variant="primary" disabled={!draft.name.trim() || create.isPending}>Add tag</Button>
          </div>
          <Input placeholder="What does it mean? (optional)" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          {swatches(draft.color, (c) => setDraft({ ...draft, color: c }))}
        </form>
        <ErrorText error={create.error || update.error || del.error} />
      </div>
    </Card>
  );
}
