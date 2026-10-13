import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { roundCount, useOptions } from "../hooks";
import { fmtDate, money, toE164, waLink } from "../lib";
import type { Teacher } from "../types";
import CallForm from "../components/CallForm";
import TeacherForm from "../components/TeacherForm";
import { TagList, TagPicker } from "../components/Tags";
import { Badge, Button, Card, Empty, Input, PageHeader, RoundChip, Select, StatusBadge } from "../components/ui";

type SortKey = "id" | "name" | "subject" | "status" | "rounds_attempted" | "next_followup" | "latest_price" | "students_per_class" | "papers_per_month";

export default function Teachers() {
  const { opts, maxRounds } = useOptions();
  const [sp, setSp] = useSearchParams();
  const f = {
    q: sp.get("q") ?? "", subject: sp.get("subject") ?? "", status: sp.get("status") ?? "", interest: sp.get("interest") ?? "",
    rounds: sp.get("rounds") ?? "", tag_ids: sp.getAll("tag_ids"), has_phone: sp.get("has_phone") ?? "", has_open_task: sp.get("has_open_task") ?? "",
  };
  const setTags = (ids: number[]) => setSp((p) => { const n = new URLSearchParams(p); n.delete("tag_ids"); ids.forEach((i) => n.append("tag_ids", String(i))); return n; }, { replace: true });
  const setF = (k: string, v: string) => setSp((p) => { const n = new URLSearchParams(p); v ? n.set(k, v) : n.delete(k); return n; }, { replace: true });
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "id", dir: 1 });
  const [adding, setAdding] = useState(false);
  const [calling, setCalling] = useState<number | null>(null);

  const all = useQuery({ queryKey: ["teachers", "all"], queryFn: () => api.get<Teacher[]>("/teachers") });
  const mostRounds = Math.max(maxRounds, ...(all.data ?? []).map((t) => roundCount(t, maxRounds)));

  const q = useQuery({
    queryKey: ["teachers", f],
    queryFn: () => api.get<Teacher[]>("/teachers", f),
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(() => {
    const r = [...(q.data ?? [])];
    r.sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x == null || x === "") return 1;  // blanks always last
      if (y == null || y === "") return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
    return r;
  }, [q.data, sort]);

  const th = (key: SortKey, label: string) => (
    <th scope="col" className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left font-medium hover:text-slate-900"
      onClick={() => setSort((s) => ({ key, dir: s.key === key ? (-s.dir as 1 | -1) : 1 }))}>
      {label}{sort.key === key && (sort.dir === 1 ? " ↑" : " ↓")}
    </th>
  );
  const filtered = Object.values(f).some((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v)));

  return (
    <>
      <PageHeader title="Teachers" subtitle={`${rows.length} of ${all.data?.length ?? 0} shown`}
        actions={<Button variant="primary" onClick={() => setAdding(true)}>+ Add teacher</Button>} />

      <Card className="mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <Input className="col-span-2 lg:col-span-2" type="search" placeholder="Search name, subject or phone…" value={f.q} onChange={(e) => setF("q", e.target.value)} />
          <Select aria-label="Subject" value={f.subject} onChange={(e) => setF("subject", e.target.value)} options={opts.subject ?? []} placeholder="All subjects" />
          <Select aria-label="Status" value={f.status} onChange={(e) => setF("status", e.target.value)} options={opts.status ?? []} placeholder="All statuses" />
          <Select aria-label="Rounds attempted" value={f.rounds} onChange={(e) => setF("rounds", e.target.value)}
            options={Array.from({ length: mostRounds + 1 }, (_, i) => ({ value: i, label: i === 0 ? "Never called" : `${i} round${i > 1 ? "s" : ""} done` }))} placeholder="Any rounds" />
          <Select aria-label="Interest" value={f.interest} onChange={(e) => setF("interest", e.target.value)} options={opts.interest ?? []} placeholder="Any interest" />
          <Select aria-label="Phone" value={f.has_phone} onChange={(e) => setF("has_phone", e.target.value)}
            options={[{ value: "true", label: "Has phone" }, { value: "false", label: "No phone" }]} placeholder="Phone: any" />
          <Select aria-label="Tasks" value={f.has_open_task} onChange={(e) => setF("has_open_task", e.target.value)}
            options={[{ value: "true", label: "Has open task" }, { value: "false", label: "No open task" }]} placeholder="Tasks: any" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-xs font-medium text-slate-500">Tags:</span>
          <TagPicker value={f.tag_ids.map(Number)} onChange={setTags} /></div>
        {filtered && <button className="mt-2 text-xs text-indigo-600 hover:underline" onClick={() => setSp({}, { replace: true })}>Clear filters</button>}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{th("id", "#")}{th("name", "Teacher")}{th("subject", "Subject")}{th("students_per_class", "Students")}{th("papers_per_month", "Papers/mo")}<th className="px-3 py-2 text-left font-medium">Phone</th>
                <th className="px-3 py-2 text-left font-medium">Rounds</th>{th("status", "Status")}<th className="px-3 py-2 text-left font-medium">Interest</th>
                {th("latest_price", "Price")}{th("next_followup", "Next follow-up")}<th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-400">{t.id}</td>
                  <td className="px-3 py-2">
                    <Link to={`/teachers/${t.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{t.name}</Link>
                    {t.rounds_exhausted && <Badge className="ml-2 bg-rose-100 text-rose-700">Rounds exhausted</Badge>}
                    {t.tags.length > 0 && <div className="mt-1"><TagList tags={t.tags} /></div>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.subject}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.students_per_class?.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{t.papers_per_month?.toLocaleString()}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {t.phones[0] ? <a href={`tel:${t.phones[0].e164 || t.phones[0].number}`} className="text-slate-700 hover:text-indigo-600" title={t.phones.map((p) => `${p.number}${p.label ? ` (${p.label})` : ""}`).join(", ")}>{t.phones[0].number}</a> : <span className="text-xs text-rose-500">no number</span>}
                    {t.phones.length > 1 && <span className="ml-1 text-xs text-slate-400">+{t.phones.length - 1}</span>}
                  </td>
                  <td className="px-3 py-2"><div className="flex gap-1">{Array.from({ length: roundCount(t, maxRounds) }, (_, i) => <RoundChip key={i} round={i + 1} outcome={t.rounds[i + 1]?.outcome} attempts={t.rounds[i + 1]?.attempts} />)}</div></td>
                  <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                  <td className="px-3 py-2 text-slate-600">{t.latest_interest}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-slate-600">{money(t.latest_price)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${t.next_followup_overdue ? "font-medium text-rose-600" : "text-slate-600"}`}>{fmtDate(t.next_followup)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {t.phones[0] && <a href={waLink(toE164(t.phones[0].number))} target="_blank" rel="noreferrer" title="WhatsApp" className="mr-1 text-emerald-600 hover:underline">WA</a>}
                    <Button size="sm" onClick={() => setCalling(t.id)}>Log call</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!q.isLoading && rows.length === 0 && <Empty>No teachers match these filters.</Empty>}
      </Card>

      {adding && <TeacherForm onClose={() => setAdding(false)} />}
      {calling && <CallForm teacherId={calling} onClose={() => setCalling(null)} />}
    </>
  );
}
