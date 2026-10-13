import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import { useInvalidate, useOptions, useTeacher } from "../hooks";
import { addDays, taskTypeFor, todayStr, pad } from "../lib";
import { KIND_ICON, KIND_LABEL } from "../lib";
import type { Call, Kind } from "../types";
import OptionChips from "./OptionChips";
import { TagAssign } from "./Tags";
import { Button, Check, ErrorText, Field, Input, Modal, Select, Textarea } from "./ui";

const NO_CONTACT = (o: string) => ["No answer", "Busy", "Call declined"].includes(o) || o.startsWith("Switched");

function nowTime() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Log a call or a physical / online meeting for a teacher, or edit an existing entry (pass `call`). */
export default function CallForm({ teacherId, call, kind: initialKind, onClose }: { teacherId: number; call?: Call; kind?: Kind; onClose: () => void }) {
  const { opts, maxRounds } = useOptions();
  const { data: teacher } = useTeacher(teacherId);
  const invalidate = useInvalidate();
  const editing = !!call;
  const [kind, setKind] = useState<Kind>(call?.kind ?? initialKind ?? "call");
  const isCall = kind === "call";

  const [f, setF] = useState({
    round: call?.round ?? 0,
    called_date: call?.called_date ?? todayStr(),
    called_time: call?.called_time?.slice(0, 5) ?? nowTime(),
    number_dialed: call?.number_dialed ?? "",
    location: call?.location ?? "",
    outcome: call?.outcome ?? "",
    spoke_to: call?.spoke_to ?? "",
    manager_contacted: call?.manager_contacted ?? false,
    contact_person: call?.contact_person ?? "",
    demo_sent: call?.demo_sent ?? false,
    detailed_sent: call?.detailed_sent ?? false,
    sent_via: call?.sent_via ?? "",
    price_proposed: call?.price_proposed?.toString() ?? "",
    counter_offer: call?.counter_offer?.toString() ?? "",
    interest_level: call?.interest_level ?? "",
    next_actions: call?.next_actions ?? ([] as string[]),
    followup_date: call?.followup_date ?? "",
    notes: call?.notes ?? "",
    tag_ids: call?.tags?.map((t) => t.id) ?? ([] as number[]),
  });
  const [newPhone, setNewPhone] = useState({ number: "", label: "Manager" });
  // One follow-up task per chosen next action (only when logging a new call)
  interface Plan { action: string; type: string; date: string; time: string }
  const [plan, setPlan] = useState<Plan[]>([]);
  const taskTypes = opts.task_type ?? [];
  const planFor = (action: string, date = addDays(todayStr(), 1)): Plan => ({ action, type: taskTypeFor(action, taskTypes), date, time: "" });
  const setPlanRow = (action: string, patch: Partial<Plan>) => setPlan((p) => p.map((r) => (r.action === action ? { ...r, ...patch } : r)));
  function setActions(actions: string[]) {
    setF((p) => ({ ...p, next_actions: actions }));
    if (!editing) setPlan((p) => actions.map((a) => p.find((r) => r.action === a) ?? planFor(a, p[0]?.date)));
  }
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  // Pre-fill round and the number to dial once the teacher has loaded.
  useEffect(() => {
    if (!teacher || editing) return;
    setF((p) => ({ ...p, round: p.round || teacher.next_round, number_dialed: p.number_dialed || teacher.phones[0]?.number || "" }));
  }, [teacher, editing]);

  const answered = f.outcome.startsWith("Answered");
  const reached = isCall ? answered || ["Teacher", "Manager", "Hotline"].includes(f.spoke_to) : f.outcome === "Held";

  function changeKind(k: Kind) {
    setKind(k);
    setF((p) => ({ ...p, outcome: "" }));  // outcome lists differ between calls and meetings
  }

  function onOutcome(outcome: string) {
    setF((p) => {
      const n = { ...p, outcome };
      // Automation: nobody picked up -> suggest calling again tomorrow
      if (!editing && isCall && NO_CONTACT(outcome) && p.next_actions.length === 0) {
        n.next_actions = ["Call again"];
        setPlan([planFor("Call again")]);
      }
      if (isCall && NO_CONTACT(outcome)) n.spoke_to = p.spoke_to || "Nobody";
      return n;
    });
  }

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => (s === "" ? null : Number(s));
      const { round, ...rest } = f;  // meetings are not part of the numbered call rounds
      const body = {
        ...rest, ...(isCall ? { round } : {}), kind,
        number_dialed: isCall ? f.number_dialed : "", location: isCall ? "" : f.location,
        called_time: f.called_time || null,
        price_proposed: num(f.price_proposed),
        counter_offer: num(f.counter_offer),
        followup_date: (editing ? f.followup_date : plan.map((r) => r.date).sort()[0]) || null,  // earliest follow-up
      };
      if (editing) return api.patch(`/calls/${call!.id}`, body);
      return api.post("/calls", {
        ...body, teacher_id: teacherId,
        new_phone: isCall && newPhone.number.trim() ? newPhone : null,
        create_tasks: plan.map((r) => ({
          teacher_id: teacherId, type: r.type, title: r.action, due_date: r.date, due_time: r.time ? `${r.time}:00` : null,
        })),
      });
    },
    onSuccess: async () => { await invalidate(); onClose(); },
  });

  const phones = teacher?.phones ?? [];
  const dialOptions = [
    ...phones.map((p) => ({ value: p.number, label: p.label ? `${p.number} (${p.label})` : p.number })),
    ...(f.number_dialed && !phones.some((p) => p.number === f.number_dialed) ? [{ value: f.number_dialed, label: f.number_dialed }] : []),
  ];
  // rounds: the default 5, plus any further round this teacher has reached (and always one more)
  const roundMax = Math.max(maxRounds, f.round, teacher?.next_round ?? 0);

  return (
    <Modal title={`${editing ? "Edit" : "Log"} ${KIND_LABEL[kind].toLowerCase()} – ${teacher?.name ?? call?.teacher_name ?? ""}`} onClose={onClose} wide>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        {!editing && (
          <div role="tablist" aria-label="Type" className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
            {(["call", "online_meeting", "physical_meeting"] as Kind[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => changeKind(k)}
                className={`px-3 py-1.5 ${kind === k ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {KIND_ICON[k]} {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isCall && (
            <Field label="Round">
              <Select value={f.round || ""} onChange={(e) => set("round", Number(e.target.value))}
                options={Array.from({ length: roundMax }, (_, i) => ({ value: i + 1, label: `Round ${i + 1}${i + 1 > maxRounds ? " (extra)" : ""}` }))} />
            </Field>
          )}
          <Field label="Date"><Input type="date" required value={f.called_date} onChange={(e) => set("called_date", e.target.value)} /></Field>
          <Field label="Time"><Input type="time" value={f.called_time} onChange={(e) => set("called_time", e.target.value)} /></Field>
          {isCall ? (
            <Field label="Number dialed">
              {dialOptions.length > 0
                ? <Select value={f.number_dialed} onChange={(e) => set("number_dialed", e.target.value)} options={dialOptions} placeholder="—" />
                : <Input value={f.number_dialed} onChange={(e) => set("number_dialed", e.target.value)} />}
            </Field>
          ) : (
            <Field label={kind === "online_meeting" ? "Meeting link / platform" : "Location / address"} className="col-span-2">
              <Input value={f.location} onChange={(e) => set("location", e.target.value)}
                placeholder={kind === "online_meeting" ? "e.g. Zoom, https://meet.google.com/…" : "e.g. School staff room, Colombo office"} />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={isCall ? "Call outcome *" : "Meeting outcome *"}>
            <Select required autoFocus value={f.outcome} onChange={(e) => onOutcome(e.target.value)}
              options={(isCall ? opts.outcome : opts.meeting_outcome) ?? []} placeholder="Select…" />
          </Field>
          <Field label={isCall ? "Spoke to" : "Met with"}>
            <Select value={f.spoke_to} onChange={(e) => set("spoke_to", e.target.value)} options={opts.spoke_to ?? []} placeholder="—" />
          </Field>
          <Field label={isCall ? "Contact person name" : "Others who attended"}>
            <Input value={f.contact_person} onChange={(e) => set("contact_person", e.target.value)} placeholder="e.g. Mr. Perera" />
          </Field>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Check label="Manager / hotline contacted" checked={f.manager_contacted} onChange={(v) => set("manager_contacted", v)} />
          <Check label="Demo video sent" checked={f.demo_sent} onChange={(v) => set("demo_sent", v)} />
          <Check label="Detailed message sent" checked={f.detailed_sent} onChange={(v) => set("detailed_sent", v)} />
        </div>
        {(f.demo_sent || f.detailed_sent) && (
          <Field label="Sent via" className="sm:w-1/3">
            <Select value={f.sent_via} onChange={(e) => set("sent_via", e.target.value)} options={opts.channel ?? []} placeholder="—" />
          </Field>
        )}

        {reached && (
          <div className="grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-3">
            <Field label="Price proposed (LKR)"><Input type="number" min="0" inputMode="numeric" value={f.price_proposed} onChange={(e) => set("price_proposed", e.target.value)} /></Field>
            <Field label="Teacher counter-offer (LKR)"><Input type="number" min="0" inputMode="numeric" value={f.counter_offer} onChange={(e) => set("counter_offer", e.target.value)} /></Field>
            <Field label="Interest level">
              <Select value={f.interest_level} onChange={(e) => set("interest_level", e.target.value)} options={opts.interest ?? []} placeholder="—" />
            </Field>
          </div>
        )}

        <Field label="Next actions" hint="Pick as many as you need, or add your own.">
          <OptionChips category="next_action" noun="action" value={f.next_actions} onChange={setActions} />
        </Field>
        {editing && (
          <Field label="Follow-up date" className="sm:w-1/2"><Input type="date" value={f.followup_date} onChange={(e) => set("followup_date", e.target.value)} /></Field>
        )}
        {!editing && plan.length > 0 && (
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-indigo-50 p-3">
            <div className="text-xs font-medium text-indigo-900">These will be added to your tasks – set when each should happen:</div>
            {plan.map((r) => (
              <div key={r.action} className="grid grid-cols-2 items-center gap-2 sm:grid-cols-[1fr_9rem_9rem_7rem]">
                <span className="col-span-2 text-sm font-medium text-slate-800 sm:col-span-1">{r.action}</span>
                <Select aria-label={`Type for ${r.action}`} value={r.type} onChange={(e) => setPlanRow(r.action, { type: e.target.value })} options={taskTypes} />
                <Input aria-label={`Date for ${r.action}`} type="date" required value={r.date} onChange={(e) => setPlanRow(r.action, { date: e.target.value })} />
                <Input aria-label={`Time for ${r.action}`} type="time" value={r.time} onChange={(e) => setPlanRow(r.action, { time: e.target.value })} />
              </div>
            ))}
          </div>
        )}

        {!editing && isCall && (
          <div className="rounded-lg border border-dashed border-slate-300 p-3">
            <div className="mb-2 text-xs font-medium text-slate-600">Were you given another number? <span className="font-normal text-slate-400">(e.g. the hotline gave you the manager’s) – it is saved to this teacher</span></div>
            <div className="flex gap-2">
              <Input type="tel" aria-label="New number" placeholder="077 123 4567" value={newPhone.number} onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })} />
              <Input list="phone-labels" aria-label="New number label" className="!w-40 shrink-0" value={newPhone.label} onChange={(e) => setNewPhone({ ...newPhone, label: e.target.value })} />
              <datalist id="phone-labels">{["Hotline", "Manager", "Teacher", "Office", "Other"].map((l) => <option key={l} value={l} />)}</datalist>
            </div>
          </div>
        )}

        <Field label="Tags"><TagAssign value={f.tag_ids} onChange={(v) => set("tag_ids", v)} /></Field>
        <Field label="Notes"><Textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="What was discussed?" /></Field>

        <ErrorText error={save.error} />
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={save.isPending || (isCall && !f.round) || !f.outcome}>
            {save.isPending ? "Saving…" : editing ? "Save changes" : isCall ? "Save call" : "Save meeting"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
