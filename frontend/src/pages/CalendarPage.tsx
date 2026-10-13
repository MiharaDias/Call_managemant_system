import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventDropArg } from "@fullcalendar/core";
import { api } from "../api";
import { useInvalidate, useOptions } from "../hooks";
import { TASK_COLORS, ymd } from "../lib";
import type { Task } from "../types";
import TaskForm from "../components/TaskForm";
import { Button, PageHeader } from "../components/ui";

export default function CalendarPage() {
  const nav = useNavigate();
  const { calendarTypes } = useOptions();
  const invalidate = useInvalidate();
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const ref = useRef<FullCalendar>(null);

  const q = useQuery({
    queryKey: ["calendar", range?.start, range?.end],
    queryFn: () => api.get<Task[]>("/tasks/calendar", range!),
    enabled: !!range,
    placeholderData: (prev) => prev,
  });

  const move = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) => api.patch(`/tasks/${id}`, body),
    onSuccess: invalidate,
  });

  const events = (q.data ?? []).map((t) => ({
    id: String(t.id),
    title: (t.teacher_name ? `${t.teacher_name} – ` : "") + t.title,
    start: t.due_time ? `${t.due_date}T${t.due_time}` : t.due_date,
    allDay: !t.due_time,
    backgroundColor: t.status === "done" ? "#cbd5e1" : t.overdue ? "#e11d48" : TASK_COLORS[t.type] ?? "#64748b",
    borderColor: "transparent",
    textColor: t.status === "done" ? "#475569" : "#fff",
    classNames: t.status === "done" ? ["line-through", "opacity-70"] : [],
    extendedProps: { task: t },
  }));

  function onDrop(info: EventDropArg) {
    const s = info.event.start!;
    const body: Record<string, unknown> = { due_date: ymd(s) };
    if (!info.event.allDay) body.due_time = `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}:00`;
    move.mutate({ id: Number(info.event.id), body }, { onError: () => info.revert() });
  }

  return (
    <>
      <PageHeader title="Calendar" subtitle={<>Showing: {calendarTypes.join(", ") || "nothing"} · <Link to="/settings" className="text-indigo-600 hover:underline">change</Link> · click a day for its agenda · drag to reschedule</>}
        actions={<Button variant="primary" onClick={() => setEditing("new")}>+ New task</Button>} />
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(TASK_COLORS).filter(([k]) => calendarTypes.includes(k)).map(([k, c]) => <span key={k} className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: c }} />{k}</span>)}
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-rose-600" />Overdue</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full bg-slate-300" />Done</span>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek" }}
          buttonText={{ today: "Today", month: "Month", week: "Week" }}
          height="auto"
          firstDay={1}
          dayMaxEvents={4}
          nowIndicator
          editable
          events={events}
          datesSet={(a) => setRange({ start: ymd(a.start), end: ymd(new Date(a.end.getTime() - 1)) })}
          dateClick={(i) => nav(`/today?date=${ymd(i.date)}`)}
          eventClick={(i) => { i.jsEvent.preventDefault(); setEditing(i.event.extendedProps.task as Task); }}
          eventDrop={onDrop}
        />
      </div>
      {editing && <TaskForm task={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
