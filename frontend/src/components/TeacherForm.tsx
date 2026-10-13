import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useInvalidate, useUsers } from "../hooks";
import type { Teacher } from "../types";
import OptionSelect from "./OptionSelect";
import { TagPicker } from "./Tags";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "./ui";

export const PHONE_LABELS = ["Hotline", "Manager", "Teacher", "Office", "Other"];

interface PhoneRow { number: string; label: string }

/** Unlimited phone numbers, each with an optional label (Hotline / Manager / Teacher …). */
export function PhonesEditor({ value, onChange }: { value: PhoneRow[]; onChange: (v: PhoneRow[]) => void }) {
  const set = (i: number, patch: Partial<PhoneRow>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2">
      {value.map((p, i) => (
        <div key={i} className="flex gap-2">
          <Input type="tel" aria-label={`Phone ${i + 1}`} placeholder="071 234 5678" value={p.number} onChange={(e) => set(i, { number: e.target.value })} />
          <Input list="phone-labels" aria-label={`Label for phone ${i + 1}`} placeholder="Label (Hotline…)" className="!w-40 shrink-0"
            value={p.label} onChange={(e) => set(i, { label: e.target.value })} />
          <button type="button" aria-label={`Remove phone ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="rounded px-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600">✕</button>
        </div>
      ))}
      <datalist id="phone-labels">{PHONE_LABELS.map((l) => <option key={l} value={l} />)}</datalist>
      <Button size="sm" onClick={() => onChange([...value, { number: "", label: "" }])}>+ Add another number</Button>
    </div>
  );
}

export default function TeacherForm({ teacher, onClose }: { teacher?: Teacher; onClose: () => void }) {
  const users = useUsers();
  const invalidate = useInvalidate();
  const nav = useNavigate();
  const [f, setF] = useState({
    name: teacher?.name ?? "", subject: teacher?.subject ?? "", status: teacher?.status ?? "Not started",
    notes: teacher?.notes ?? "",
    students_per_class: teacher?.students_per_class?.toString() ?? "",
    papers_per_month: teacher?.papers_per_month?.toString() ?? "",
    assigned_to_id: teacher?.assigned_to_id ?? ("" as number | ""),
    phones: teacher?.phones.length ? teacher.phones.map((p) => ({ number: p.number, label: p.label })) : [{ number: "", label: "" }],
    tag_ids: teacher?.tags.map((t) => t.id) ?? ([] as number[]),
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const body = { ...f, students_per_class: num(f.students_per_class), papers_per_month: num(f.papers_per_month),
        assigned_to_id: f.assigned_to_id === "" ? null : f.assigned_to_id, phones: f.phones.filter((p) => p.number.trim()) };
      return teacher ? api.patch<Teacher>(`/teachers/${teacher.id}`, body) : api.post<Teacher>("/teachers", body);
    },
    onSuccess: async (t) => { await invalidate(); onClose(); if (!teacher) nav(`/teachers/${t.id}`); },
  });

  return (
    <Modal title={teacher ? "Edit teacher" : "Add teacher"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name *"><Input required autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Subject">
            <OptionSelect category="subject" noun="subject" value={f.subject} onChange={(v) => set("subject", v)} placeholder="Select subject…" />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Students in a class"><Input type="number" min={0} inputMode="numeric" value={f.students_per_class} onChange={(e) => set("students_per_class", e.target.value)} placeholder="e.g. 40" /></Field>
          <Field label="Papers per month"><Input type="number" min={0} inputMode="numeric" value={f.papers_per_month} onChange={(e) => set("papers_per_month", e.target.value)} placeholder="e.g. 200" /></Field>
        </div>
        <Field label="Phone numbers" hint="Add as many as you need – e.g. the hotline first, then the manager’s or teacher’s own number.">
          <PhonesEditor value={f.phones} onChange={(v) => set("phones", v)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Overall status"><OptionSelect category="status" noun="status" value={f.status} onChange={(v) => set("status", v)} /></Field>
          <Field label="Assigned to">
            <Select value={f.assigned_to_id} onChange={(e) => set("assigned_to_id", e.target.value ? Number(e.target.value) : "")}
              options={users.map((u) => ({ value: u.id, label: u.display_name }))} placeholder="— anyone —" />
          </Field>
        </div>
        <Field label="Tags"><TagPicker creatable value={f.tag_ids} onChange={(v) => set("tag_ids", v)} /></Field>
        <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={save.error} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
