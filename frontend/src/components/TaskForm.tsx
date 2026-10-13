import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth, useInvalidate, useOptions, useUsers } from "../hooks";
import { todayStr } from "../lib";
import type { Task, Teacher } from "../types";
import { Button, ErrorText, Field, Input, Modal, Select, Textarea } from "./ui";

/** Create (or edit, when `task` is given) a task. `teacherId` pre-selects the teacher. */
export default function TaskForm({ task, teacherId, date, onClose }: { task?: Task; teacherId?: number; date?: string; onClose: () => void }) {
  const { opts, calendarTypes } = useOptions();
  const users = useUsers();
  const { user } = useAuth();
  const invalidate = useInvalidate();
  const teachers = useQuery({ queryKey: ["teachers", "all"], queryFn: () => api.get<Teacher[]>("/teachers"), staleTime: 30_000 });

  const [f, setF] = useState({
    teacher_id: task?.teacher_id ?? teacherId ?? ("" as number | ""),
    type: task?.type ?? "Call back",
    title: task?.title ?? "",
    due_date: task?.due_date ?? date ?? todayStr(),
    due_time: task?.due_time?.slice(0, 5) ?? "",
    notes: task?.notes ?? "",
    assigned_to_id: task?.assigned_to_id ?? user.id,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f, teacher_id: f.teacher_id === "" ? null : f.teacher_id,
        due_time: f.due_time ? `${f.due_time}:00` : null, clear_time: !f.due_time,
      };
      return task ? api.patch(`/tasks/${task.id}`, body) : api.post("/tasks", body);
    },
    onSuccess: async () => { await invalidate(); onClose(); },
  });
  const del = useMutation({
    mutationFn: () => api.del(`/tasks/${task!.id}`),
    onSuccess: async () => { await invalidate(); onClose(); },
  });

  const types = opts.task_type ?? [];
  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={f.type} onChange={(e) => {
              const type = e.target.value;
              setF((p) => ({ ...p, type, title: p.title || type }));
            }} options={types} />
          </Field>
          <Field label="Teacher">
            <Select value={f.teacher_id} onChange={(e) => set("teacher_id", e.target.value ? Number(e.target.value) : "")}
              options={(teachers.data ?? []).map((t) => ({ value: t.id, label: `${t.name} (${t.subject})` }))} placeholder="— none —" />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-slate-500">
          {calendarTypes.includes(f.type) ? "📅 This type appears on the calendar." : "Not shown on the calendar – it will appear in Today and Tasks."}
        </p>
        <Field label="What needs to be done? *">
          <Input required autoFocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Send demo video on WhatsApp" />
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date *"><Input type="date" required value={f.due_date} onChange={(e) => set("due_date", e.target.value)} /></Field>
          <Field label="Time (optional)"><Input type="time" value={f.due_time} onChange={(e) => set("due_time", e.target.value)} /></Field>
          <Field label="Assigned to" className="col-span-2 sm:col-span-1">
            <Select value={f.assigned_to_id ?? ""} onChange={(e) => set("assigned_to_id", Number(e.target.value))}
              options={users.map((u) => ({ value: u.id, label: u.display_name }))} />
          </Field>
        </div>
        <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <ErrorText error={save.error || del.error} />
        <div className="flex items-center justify-between gap-2">
          <div>{task && <Button variant="danger" onClick={() => confirm("Delete this task?") && del.mutate()}>Delete</Button>}</div>
          <div className="flex gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save task"}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
