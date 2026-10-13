import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../hooks";
import { addDays, fmtLongDate, todayStr } from "../lib";
import type { Task } from "../types";
import TaskForm from "../components/TaskForm";
import TaskRow from "../components/TaskRow";
import { Button, Card, Empty, PageHeader } from "../components/ui";

interface Agenda { date: string; today: string; overdue: Task[]; tasks: Task[] }

export default function Today() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const date = params.get("date") || todayStr();
  const mine = params.get("who") === "me";
  const [editing, setEditing] = useState<Task | "new" | null>(null);

  const q = useQuery({
    queryKey: ["agenda", date, mine],
    queryFn: () => api.get<Agenda>("/tasks/agenda", { date, assigned_to_id: mine ? user.id : undefined }),
  });
  const go = (d: string) => setParams((p) => { const n = new URLSearchParams(p); d === todayStr() ? n.delete("date") : n.set("date", d); return n; }, { replace: true });
  const setMine = (v: boolean) => setParams((p) => { const n = new URLSearchParams(p); v ? n.set("who", "me") : n.delete("who"); return n; }, { replace: true });

  const open = q.data?.tasks.filter((t) => t.status === "open") ?? [];
  const done = q.data?.tasks.filter((t) => t.status === "done") ?? [];
  const isToday = date === todayStr();

  return (
    <>
      <PageHeader title={isToday ? "Today" : "Daily agenda"} subtitle={fmtLongDate(date)}
        actions={<Button variant="primary" onClick={() => setEditing("new")}>+ New task</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button onClick={() => go(addDays(date, -1))} aria-label="Previous day">‹</Button>
        <Button onClick={() => go(todayStr())} disabled={isToday}>Today</Button>
        <Button onClick={() => go(addDays(date, 1))} aria-label="Next day">›</Button>
        <input type="date" value={date} onChange={(e) => e.target.value && go(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Pick a date" />
        <div className="ml-auto inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
          <button onClick={() => setMine(false)} className={`px-3 py-1.5 ${!mine ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>Everyone</button>
          <button onClick={() => setMine(true)} className={`px-3 py-1.5 ${mine ? "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>Mine</button>
        </div>
      </div>

      {q.isLoading ? <p className="text-slate-400">Loading…</p> : (
        <div className="space-y-4">
          {q.data!.overdue.length > 0 && (
            <Card title={<span className="text-rose-700">Overdue · {q.data!.overdue.length}</span>} className="border-rose-200">
              <ul className="divide-y divide-slate-100">{q.data!.overdue.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} showDate />)}</ul>
            </Card>
          )}
          <Card title={`${isToday ? "Today's" : "Scheduled"} tasks · ${open.length}`}>
            {open.length ? <ul className="divide-y divide-slate-100">{open.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} />)}</ul>
              : <Empty>{done.length ? "All done for this day 🎉" : "Nothing scheduled for this day."}</Empty>}
          </Card>
          {done.length > 0 && (
            <Card title={`Completed · ${done.length}`}>
              <ul className="divide-y divide-slate-100">{done.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} />)}</ul>
            </Card>
          )}
        </div>
      )}
      {editing && <TaskForm task={editing === "new" ? undefined : editing} date={date} onClose={() => setEditing(null)} />}
    </>
  );
}
