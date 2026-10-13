import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useInvalidate } from "../hooks";
import { TASK_COLORS, addDays, fmtTime, relDay, toE164, todayStr, waLink } from "../lib";
import type { Task } from "../types";
import { Badge } from "./ui";


/** One task line with a tick box (mark done / undo), quick reschedule and click-to-edit. */
export default function TaskRow({ task, onEdit, showDate, compact }: { task: Task; onEdit: (t: Task) => void; showDate?: boolean; compact?: boolean }) {
  const invalidate = useInvalidate();
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/tasks/${task.id}`, body),
    onSuccess: invalidate,
  });
  const done = task.status === "done";
  const phone = task.teacher_phone;
  const tel = phone.replace(/[^\d+]/g, "");

  return (
    <li className={`group flex items-start gap-3 px-4 py-3 ${done ? "bg-slate-50/60" : ""}`}>
      <input type="checkbox" checked={done} disabled={patch.isPending} aria-label={done ? "Mark as not done" : "Mark as done"}
        onChange={() => patch.mutate({ status: done ? "open" : "done" })}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button onClick={() => onEdit(task)} className={`text-left text-sm font-medium hover:underline ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
            {task.title}
          </button>
          <span style={{ background: TASK_COLORS[task.type] ?? "#64748b" }} className="rounded-full px-2 py-0.5 text-xs font-medium text-white">{task.type}</span>
          {task.overdue && <Badge className="bg-rose-100 text-rose-700">Overdue</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          {task.teacher_id && <Link to={`/teachers/${task.teacher_id}`} className="font-medium text-indigo-600 hover:underline">{task.teacher_name}</Link>}
          {(showDate || task.overdue) && <span className={task.overdue ? "text-rose-600" : ""}>{relDay(task.due_date)}</span>}
          {task.due_time && <span>🕘 {fmtTime(task.due_time)}</span>}
          {phone && !compact && (
            <>
              <a href={`tel:${tel}`} className="hover:text-indigo-600">📞 {phone}</a>
              <a href={waLink(toE164(phone))} target="_blank" rel="noreferrer" className="hover:text-emerald-600">WhatsApp</a>
            </>
          )}
          {task.assigned_to && <span>👤 {task.assigned_to}</span>}
          {done && task.completed_by && <span>✓ {task.completed_by}</span>}
        </div>
        {task.notes && !compact && <p className="mt-1 text-xs text-slate-500">{task.notes}</p>}
      </div>
      {!done && (
        <div className="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <button title="Move to tomorrow" onClick={() => patch.mutate({ due_date: addDays(todayStr(), 1) })}
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100">→ Tomorrow</button>
          <button title="Move +1 week" onClick={() => patch.mutate({ due_date: addDays(task.due_date < todayStr() ? todayStr() : task.due_date, 7) })}
            className="hidden rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 sm:block">+1 wk</button>
        </div>
      )}
    </li>
  );
}
