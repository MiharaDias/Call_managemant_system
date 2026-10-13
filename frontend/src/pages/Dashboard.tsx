import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { useAuth } from "../hooks";
import { STATUS_TONE, fmtLongDate, money } from "../lib";
import type { Summary, Task } from "../types";
import CallForm from "../components/CallForm";
import TaskForm from "../components/TaskForm";
import TaskRow from "../components/TaskRow";
import { Button, Card, Empty, PageHeader } from "../components/ui";

function Stat({ label, value, to, tone }: { label: string; value: number | string; to?: string; tone?: string }) {
  const body = (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow">
      <div className={`text-3xl font-bold tabular-nums ${tone ?? "text-slate-900"}`}>{value}</div>
      <div className="mt-1 text-xs font-medium text-slate-500">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["summary"], queryFn: () => api.get<Summary>("/dashboard/summary") });
  const [calling, setCalling] = useState<number | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const s = q.data;
  if (!s) return <p className="text-slate-400">Loading…</p>;
  const maxStatus = Math.max(1, ...Object.values(s.by_status));

  return (
    <>
      <PageHeader title={`Hello, ${user.display_name}`} subtitle={fmtLongDate(s.today)} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Tasks due today" value={s.tasks_due_today} to="/today" tone="text-indigo-700" />
        <Stat label="Overdue tasks" value={s.tasks_overdue} to="/tasks" tone={s.tasks_overdue ? "text-rose-600" : undefined} />
        <Stat label="Teachers" value={s.totals.teachers} to="/teachers" />
        <Stat label="Never called" value={s.totals.never_called} to="/teachers?rounds=0" />
        <Stat label="Reached teacher / manager" value={s.totals.reached} />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Due & overdue tasks" actions={<Link to="/today" className="text-xs text-indigo-600 hover:underline">Open today →</Link>}>
          {s.due_tasks.length ? <ul className="divide-y divide-slate-100">{s.due_tasks.map((t) => <TaskRow key={t.id} task={t} onEdit={setEditing} showDate compact />)}</ul>
            : <Empty>Nothing due. Nice work!</Empty>}
        </Card>
        <Card title={`Next to call · ${s.next_to_call_total}`} actions={<Link to="/teachers" className="text-xs text-indigo-600 hover:underline">All teachers →</Link>}>
          {s.next_to_call.length ? (
            <ul className="divide-y divide-slate-100">
              {s.next_to_call.map(({ teacher, reason }) => (
                <li key={teacher.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={`/teachers/${teacher.id}`} className="text-sm font-medium text-slate-900 hover:text-indigo-600">{teacher.name}</Link>
                    <div className="text-xs text-slate-500">{teacher.subject} · {teacher.phones[0]?.number} · <span className={reason === "Call-back due" ? "font-medium text-rose-600" : ""}>{reason}</span></div>
                  </div>
                  <Button size="sm" onClick={() => setCalling(teacher.id)}>Log call</Button>
                </li>
              ))}
            </ul>
          ) : <Empty>No teachers waiting for a call.</Empty>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Calls by round" className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2 text-left font-medium">Metric</th>{s.rounds.map((r) => <th key={r} className="px-3 py-2 text-right font-medium">R{r}</th>)}<th className="px-4 py-2 text-right font-medium">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {s.table.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-2 text-slate-700">{row.label}</td>
                    {s.rounds.map((r) => <td key={r} className="px-3 py-2 text-right tabular-nums text-slate-600">{row.key === "avg_price" ? money(row.rounds[r]) || "–" : row.rounds[r]}</td>)}
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-900">{row.key === "avg_price" ? money(row.total) || "–" : row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Teachers by status">
          <ul className="space-y-3 p-4">
            {Object.entries(s.by_status).map(([status, n]) => (
              <li key={status}>
                <Link to={`/teachers?status=${encodeURIComponent(status)}`} className="block">
                  <div className="mb-1 flex justify-between text-sm"><span className="text-slate-700">{status}</span><span className="font-semibold tabular-nums">{n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${(STATUS_TONE[status] ?? "").includes("bg-green-600") ? "bg-green-600" : "bg-indigo-500"}`} style={{ width: `${(n / maxStatus) * 100}%` }} />
                  </div>
                </Link>
              </li>
            ))}
            <li className="border-t border-slate-100 pt-3 text-xs text-slate-500">
              {s.totals.with_phone} of {s.totals.teachers} teachers have a phone number · {s.totals.exhausted} with all rounds used
            </li>
          </ul>
        </Card>
      </div>

      {calling && <CallForm teacherId={calling} onClose={() => setCalling(null)} />}
      {editing && <TaskForm task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
