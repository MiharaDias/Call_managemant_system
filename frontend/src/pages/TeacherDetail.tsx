import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { roundCount, useInvalidate, useOptions, useTeacher, useUsers } from "../hooks";
import { fmtDate, fmtTime, money, toE164, waLink } from "../lib";
import type { Call, Task } from "../types";
import CallForm from "../components/CallForm";
import TaskForm from "../components/TaskForm";
import TaskRow from "../components/TaskRow";
import OptionSelect from "../components/OptionSelect";
import TeacherForm from "../components/TeacherForm";
import { TagList, TagPicker } from "../components/Tags";
import { Badge, Button, Card, Empty, ErrorText, Input, RoundChip, Select, StatusBadge } from "../components/ui";
import { outcomeTone } from "../lib";

export default function TeacherDetail() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const { maxRounds } = useOptions();
  const users = useUsers();
  const invalidate = useInvalidate();
  const { data: t, isLoading, error } = useTeacher(id);
  const tasks = useQuery({ queryKey: ["tasks", { teacher_id: id }], queryFn: () => api.get<Task[]>("/tasks", { teacher_id: id }) });

  const [callForm, setCallForm] = useState<Call | "new" | null>(null);
  const [taskForm, setTaskForm] = useState<Task | "new" | null>(null);
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState({ number: "", label: "Manager" });
  const addPhone = useMutation({
    mutationFn: () => api.post(`/teachers/${id}/phones`, phone),
    onSuccess: async () => { await invalidate(); setPhone({ number: "", label: "Manager" }); },
  });

  const patch = useMutation({ mutationFn: (b: object) => api.patch(`/teachers/${id}`, b), onSuccess: invalidate });
  const delCall = useMutation({ mutationFn: (cid: number) => api.del(`/calls/${cid}`), onSuccess: invalidate });
  const delTeacher = useMutation({ mutationFn: () => api.del(`/teachers/${id}`), onSuccess: async () => { await invalidate(); nav("/teachers"); } });

  if (isLoading) return <p className="text-slate-400">Loading…</p>;
  if (error || !t) return <p className="text-rose-600">Teacher not found. <Link className="underline" to="/teachers">Back to list</Link></p>;

  const calls = t.calls ?? [];
  const byRound = new Map<number, Call[]>();
  calls.forEach((c) => byRound.set(c.round, [...(byRound.get(c.round) ?? []), c]));
  const rounds = [...byRound.keys()].sort((a, b) => b - a);
  const open = (tasks.data ?? []).filter((x) => x.status === "open");
  const done = (tasks.data ?? []).filter((x) => x.status === "done");

  return (
    <>
      <Link to="/teachers" className="mb-3 inline-block text-sm text-slate-500 hover:text-indigo-600">← All teachers</Link>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{t.subject || "No subject"}</span>
            <StatusBadge status={t.status} />
            {t.rounds_exhausted && <Badge className="bg-rose-100 text-rose-700">Rounds exhausted</Badge>}
            <TagList tags={t.tags} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setCallForm("new")}>📞 Log call</Button>
          <Button onClick={() => setTaskForm("new")}>+ Task</Button>
          <Button onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="danger" onClick={() => confirm(`Delete ${t.name} and all their calls and tasks?`) && delTeacher.mutate()}>Delete</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <Card title="Contact">
            <ul className="divide-y divide-slate-100 text-sm">
              {t.phones.length === 0 && <li className="px-4 py-3 text-rose-500">No phone number yet — use Edit to add one.</li>}
              {t.phones.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-medium">{p.number}{p.label && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-500">{p.label}</span>}</span>
                  <span className="flex gap-3 text-xs">
                    <a className="text-indigo-600 hover:underline" href={`tel:${p.e164 || p.number}`}>Call</a>
                    {toE164(p.number) && <a className="text-emerald-600 hover:underline" target="_blank" rel="noreferrer" href={waLink(toE164(p.number))}>WhatsApp</a>}
                  </span>
                </li>
              ))}
            </ul>
            <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={(e) => { e.preventDefault(); phone.number.trim() && addPhone.mutate(); }}>
              <Input type="tel" aria-label="New phone number" placeholder="Add another number…" value={phone.number} onChange={(e) => setPhone({ ...phone, number: e.target.value })} />
              <Input list="phone-labels" aria-label="Label" className="!w-28 shrink-0" value={phone.label} onChange={(e) => setPhone({ ...phone, label: e.target.value })} />
              <datalist id="phone-labels">{["Hotline", "Manager", "Teacher", "Office", "Other"].map((l) => <option key={l} value={l} />)}</datalist>
              <Button type="submit" size="sm" disabled={!phone.number.trim() || addPhone.isPending}>Add</Button>
            </form>
            {addPhone.error && <div className="px-3 pb-3"><ErrorText error={addPhone.error} /></div>}
          </Card>

          <Card title={`Progress · ${t.rounds_attempted} round${t.rounds_attempted === 1 ? "" : "s"} done (default ${maxRounds})`}>
            <div className="space-y-3 p-4">
              <div className="flex gap-1.5">{Array.from({ length: roundCount(t, maxRounds) }, (_, i) => <RoundChip key={i} round={i + 1} outcome={t.rounds[i + 1]?.outcome} attempts={t.rounds[i + 1]?.attempts} />)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Students in a class</dt><dd>{t.students_per_class?.toLocaleString() ?? "—"}</dd>
                <dt className="text-slate-500">Papers per month</dt><dd>{t.papers_per_month?.toLocaleString() ?? "—"}</dd>
                <dt className="text-slate-500">Reached teacher/mgr</dt><dd>{t.reached ? "Yes" : "No"}</dd>
                <dt className="text-slate-500">Manager contacted</dt><dd>{t.manager_contacted ? "Yes" : "No"}</dd>
                <dt className="text-slate-500">Demo video sent</dt><dd>{t.demo_sent ? "Yes" : "No"}</dd>
                <dt className="text-slate-500">Detailed msg sent</dt><dd>{t.detailed_sent ? "Yes" : "No"}</dd>
                <dt className="text-slate-500">Latest price</dt><dd>{t.latest_price ? `LKR ${money(t.latest_price)}` : "—"}</dd>
                <dt className="text-slate-500">Latest interest</dt><dd>{t.latest_interest || "—"}</dd>
              </dl>
            </div>
          </Card>

          <Card title="Status & owner">
            <div className="grid gap-3 p-4">
              <label className="text-xs font-medium text-slate-600">Overall status
                <div className="mt-1"><OptionSelect category="status" noun="status" value={t.status} onChange={(v) => patch.mutate({ status: v })} /></div>
              </label>
              <label className="text-xs font-medium text-slate-600">Assigned to
                <Select className="mt-1" value={t.assigned_to_id ?? ""} onChange={(e) => patch.mutate({ assigned_to_id: e.target.value ? Number(e.target.value) : null })}
                  options={users.map((u) => ({ value: u.id, label: u.display_name }))} placeholder="— anyone —" />
              </label>
              <div className="text-xs font-medium text-slate-600">Tags
                <div className="mt-1"><TagPicker creatable value={t.tags.map((x) => x.id)} onChange={(ids) => patch.mutate({ tag_ids: ids })} /></div>
              </div>
              {t.notes && <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{t.notes}</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <Card title={`Open tasks · ${open.length}`} actions={<Button size="sm" onClick={() => setTaskForm("new")}>+ Add</Button>}>
            {open.length ? <ul className="divide-y divide-slate-100">{open.map((x) => <TaskRow key={x.id} task={x} onEdit={setTaskForm} showDate compact />)}</ul> : <Empty>No open tasks for this teacher.</Empty>}
            {done.length > 0 && (
              <details className="border-t border-slate-100">
                <summary className="cursor-pointer px-4 py-2 text-xs text-slate-500">Completed ({done.length})</summary>
                <ul className="divide-y divide-slate-100">{done.map((x) => <TaskRow key={x.id} task={x} onEdit={setTaskForm} showDate compact />)}</ul>
              </details>
            )}
          </Card>

          <Card title={`Call history · ${calls.length}`} actions={<Button size="sm" variant="primary" onClick={() => setCallForm("new")}>Log call</Button>}>
            {calls.length === 0 && <Empty>No calls logged yet.</Empty>}
            {rounds.map((r) => (
              <div key={r} className="border-b border-slate-100 last:border-0">
                <div className="bg-slate-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Round {r}</div>
                <ul className="divide-y divide-slate-100">
                  {[...byRound.get(r)!].reverse().map((c) => (
                    <li key={c.id} className="px-4 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={outcomeTone(c.outcome)}>{c.outcome}</Badge>
                        <span className="text-slate-500">{fmtDate(c.called_date, true)}{c.called_time && ` · ${fmtTime(c.called_time)}`}</span>
                        {byRound.get(r)!.length > 1 && <span className="text-xs text-slate-400">attempt {c.attempt}</span>}
                        {c.number_dialed && <span className="text-slate-400">· {c.number_dialed}</span>}
                        {c.spoke_to && <span className="text-slate-600">· spoke to {c.spoke_to.toLowerCase()}{c.contact_person && ` (${c.contact_person})`}</span>}
                        <span className="ml-auto flex gap-2 text-xs">
                          <button className="text-indigo-600 hover:underline" onClick={() => setCallForm(c)}>Edit</button>
                          <button className="text-rose-600 hover:underline" onClick={() => confirm("Delete this call?") && delCall.mutate(c.id)}>Delete</button>
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                        {c.manager_contacted && <Badge className="bg-slate-100 text-slate-600">Manager/hotline</Badge>}
                        {c.demo_sent && <Badge className="bg-cyan-50 text-cyan-700">Demo sent{c.sent_via && ` · ${c.sent_via}`}</Badge>}
                        {c.detailed_sent && <Badge className="bg-teal-50 text-teal-700">Details sent</Badge>}
                        {c.price_proposed != null && <Badge className="bg-slate-100 text-slate-700">Price {money(c.price_proposed)}</Badge>}
                        {c.counter_offer != null && <Badge className="bg-slate-100 text-slate-700">Counter {money(c.counter_offer)}</Badge>}
                        {c.interest_level && <Badge className="bg-violet-50 text-violet-700">{c.interest_level}</Badge>}
                        {c.tags.length > 0 && <TagList tags={c.tags} />}
                        {c.next_action && <Badge className="bg-indigo-50 text-indigo-700">Next: {c.next_action}{c.followup_date && ` · ${fmtDate(c.followup_date)}`}</Badge>}
                      </div>
                      {c.notes && <p className="mt-1.5 whitespace-pre-wrap text-slate-600">{c.notes}</p>}
                      {c.created_by && <p className="mt-1 text-xs text-slate-400">by {c.created_by}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {callForm && <CallForm teacherId={id} call={callForm === "new" ? undefined : callForm} onClose={() => setCallForm(null)} />}
      {taskForm && <TaskForm teacherId={id} task={taskForm === "new" ? undefined : taskForm} onClose={() => setTaskForm(null)} />}
      {editing && <TeacherForm teacher={t} onClose={() => setEditing(false)} />}
    </>
  );
}
