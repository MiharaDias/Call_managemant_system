import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useOptions, useUsers } from "../hooks";
import { todayStr } from "../lib";
import type { Task } from "../types";
import TaskForm from "../components/TaskForm";
import TaskRow from "../components/TaskRow";
import { Button, Card, Empty, Input, PageHeader, Select } from "../components/ui";

export default function Tasks() {
  const { opts } = useOptions();
  const users = useUsers();
  const [sp, setSp] = useSearchParams();
  const f = { q: sp.get("q") ?? "", type: sp.get("type") ?? "", assigned_to_id: sp.get("assigned_to_id") ?? "" };
  const setF = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n; }, { replace: true });
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const q = useQuery({ queryKey: ["tasks", f], queryFn: () => api.get<Task[]>("/tasks", f), placeholderData: (p) => p });
  const all = q.data ?? [];
  const completed = all.filter((t) => t.status === "done").reverse();  // newest first
  const today = todayStr();
  const open = all.filter((t) => t.status === "open");
  const overdue = open.filter((t) => t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const upcoming = open.filter((t) => t.due_date > today);

  const section = (title: string, tasks: Task[], empty: string, opts2: { tone?: string; showDate?: boolean } = {}) => (
    <Card title={<span className={opts2.tone}>{title} · {tasks.length}</span>} className={opts2.tone?.includes("rose") && tasks.length ? "border-rose-200" : undefined}>
      {tasks.length
        ? <ul className="divide-y divide-slate-100">{tasks.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} showDate={opts2.showDate} />)}</ul>
        : <Empty>{empty}</Empty>}
    </Card>
  );

  return (
    <>
      <PageHeader title="Tasks" subtitle="Calls, messages and meetings you planned" actions={<Button variant="primary" onClick={() => setEditing("new")}>+ New task</Button>} />
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Input type="search" placeholder="Search task or teacher…" value={f.q} onChange={(e) => setF("q", e.target.value)} />
          <Select aria-label="Type" value={f.type} onChange={(e) => setF("type", e.target.value)} options={opts.task_type ?? []} placeholder="All types" />
          <Select aria-label="Assigned to" value={f.assigned_to_id} onChange={(e) => setF("assigned_to_id", e.target.value)} options={users.map((u) => ({ value: u.id, label: u.display_name }))} placeholder="Anyone" />
        </div>
      </Card>

      <div className="space-y-4">
        {overdue.length > 0 && section("Overdue", overdue, "", { tone: "text-rose-700", showDate: true })}
        {section("Due today", dueToday, "Nothing due today.")}
        {section("Upcoming", upcoming, "Nothing scheduled for the future.", { showDate: true })}
        {section("Completed", completed, "Nothing completed yet.", { showDate: true })}
      </div>
      {editing && <TaskForm task={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
