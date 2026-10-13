import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { roundCount, useInvalidate, useOptions, useUsers } from "../hooks";
import { KIND_ICON, KIND_LABEL, fmtDate, fmtTime, money, outcomeTone } from "../lib";
import type { Call } from "../types";
import CallForm from "../components/CallForm";
import { TagList, TagPicker } from "../components/Tags";
import { Badge, Card, Empty, Input, PageHeader, Select } from "../components/ui";
import type { Teacher } from "../types";

export default function Calls() {
  const { opts, maxRounds } = useOptions();
  const users = useUsers();
  const invalidate = useInvalidate();
  const [sp, setSp] = useSearchParams();
  const f = {
    q: sp.get("q") ?? "", kind: sp.get("kind") ?? "", round: sp.get("round") ?? "", outcome: sp.get("outcome") ?? "", user_id: sp.get("user_id") ?? "",
    date_from: sp.get("date_from") ?? "", date_to: sp.get("date_to") ?? "", tag_ids: sp.getAll("tag_ids"),
  };
  const setTags = (ids: number[]) => setSp((p) => { const n = new URLSearchParams(p); n.delete("tag_ids"); ids.forEach((i) => n.append("tag_ids", String(i))); return n; }, { replace: true });
  const teachers = useQuery({ queryKey: ["teachers", "all"], queryFn: () => api.get<Teacher[]>("/teachers"), staleTime: 30_000 });
  const mostRounds = Math.max(maxRounds, ...(teachers.data ?? []).map((t) => roundCount(t, maxRounds)));
  const setF = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n; }, { replace: true });
  const [editing, setEditing] = useState<Call | null>(null);

  const q = useQuery({ queryKey: ["calls", f], queryFn: () => api.get<Call[]>("/calls", f), placeholderData: (p) => p });
  const del = useMutation({ mutationFn: (id: number) => api.del(`/calls/${id}`), onSuccess: invalidate });
  const rows = q.data ?? [];

  return (
    <>
      <PageHeader title="Calls & meetings" subtitle={`${rows.length} entr${rows.length === 1 ? "y" : "ies"}`} />
      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <Select aria-label="Type" value={f.kind} onChange={(e) => setF("kind", e.target.value)}
            options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label: `${KIND_ICON[value]} ${label}` }))} placeholder="Calls & meetings" />
          <Input className="col-span-2 sm:col-span-1" type="search" placeholder="Search teacher or notes…" value={f.q} onChange={(e) => setF("q", e.target.value)} />
          <Select aria-label="Round" value={f.round} onChange={(e) => setF("round", e.target.value)} options={Array.from({ length: mostRounds }, (_, i) => ({ value: i + 1, label: `Round ${i + 1}` }))} placeholder="All rounds" />
          <Select aria-label="Outcome" value={f.outcome} onChange={(e) => setF("outcome", e.target.value)} options={[...new Set([...(opts.outcome ?? []), ...(opts.meeting_outcome ?? [])])]} placeholder="All outcomes" />
          <Select aria-label="Logged by" value={f.user_id} onChange={(e) => setF("user_id", e.target.value)} options={users.map((u) => ({ value: u.id, label: u.display_name }))} placeholder="Anyone" />
          <Input aria-label="From date" type="date" value={f.date_from} onChange={(e) => setF("date_from", e.target.value)} />
          <Input aria-label="To date" type="date" value={f.date_to} onChange={(e) => setF("date_to", e.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-slate-500">Tags (on the call or the teacher):</span>
          <TagPicker value={f.tag_ids.map(Number)} onChange={setTags} /></div>
      </Card>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{["Date", "Teacher", "Type", "Outcome", "Spoke to", "Price", "Interest", "Next action", "Tags", "Notes", "By", ""].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id} className="align-top hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(c.called_date, true)}<div className="text-xs text-slate-400">{fmtTime(c.called_time)}</div></td>
                  <td className="px-3 py-2"><Link to={`/teachers/${c.teacher_id}`} className="font-medium text-slate-900 hover:text-indigo-600">{c.teacher_name}</Link><div className="text-xs text-slate-400">{c.subject}</div></td>
                  <td className="whitespace-nowrap px-3 py-2">{c.kind === "call"
                    ? <>📞 R{c.round}{c.attempt > 1 && <span className="text-xs text-slate-400"> #{c.attempt}</span>}</>
                    : <><span title={KIND_LABEL[c.kind]}>{KIND_ICON[c.kind]}</span> <span className="text-xs text-slate-500">{c.kind === "online_meeting" ? "Online" : "In person"}</span>{c.location && <div className="max-w-[10rem] truncate text-xs text-slate-400" title={c.location}>{c.location}</div>}</>}</td>
                  <td className="px-3 py-2"><Badge className={outcomeTone(c.kind === "call" ? c.outcome : c.outcome === "Held" ? "Answered" : "No answer")}>{c.outcome}</Badge></td>
                  <td className="px-3 py-2 text-slate-600">{c.spoke_to}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{money(c.price_proposed)}{c.counter_offer != null && <div className="text-xs text-slate-400">counter {money(c.counter_offer)}</div>}</td>
                  <td className="px-3 py-2 text-slate-600">{c.interest_level}</td>
                  <td className="px-3 py-2 text-slate-600">{c.next_actions.join(", ")}{c.followup_date && <div className="text-xs text-slate-400">{fmtDate(c.followup_date)}</div>}</td>
                  <td className="px-3 py-2"><TagList tags={c.tags} /></td>
                  <td className="max-w-xs px-3 py-2 text-slate-500">{c.notes}</td>
                  <td className="px-3 py-2 text-slate-500">{c.created_by}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    <button className="mr-2 text-indigo-600 hover:underline" onClick={() => setEditing(c)}>Edit</button>
                    <button className="text-rose-600 hover:underline" onClick={() => confirm("Delete this call?") && del.mutate(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.isLoading && rows.length === 0 && <Empty>Nothing matches. Log calls and meetings from a teacher’s page.</Empty>}
      </Card>
      {editing && <CallForm teacherId={editing.teacher_id} call={editing} kind={editing.kind} onClose={() => setEditing(null)} />}
    </>
  );
}
