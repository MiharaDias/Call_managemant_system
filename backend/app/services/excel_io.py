"""Import the original Teacher_Call_Tracker.xlsx and export the data back in the same layout."""
import io
import json
import re
from datetime import date, datetime, time

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..common import ensure_option, get_max_rounds, today
from ..models import Call, Option, Task, Teacher, TeacherPhone
from .derived import status_after_call, teacher_view

CONTACT_HEADERS = [
    "ID", "Teacher Name", "Subject", "Phone 1", "Phone 2", "Phone 3", "Source Checklist (your tick list)",
    "Round 1 Outcome", "Round 2 Outcome", "Round 3 Outcome", "Round 4 Outcome", "Round 5 Outcome",
    "Rounds Attempted", "Reached Teacher / Mgr / Hotline", "Manager / Hotline Contacted?", "Demo Video Sent?",
    "Detailed Msg Sent?", "Latest Price Proposed (LKR)", "Latest Interest Level", "Overall Status",
    "Next Follow-up", "Notes", "Students per Class", "Papers per Month",
]
CALL_HEADERS = [
    "Key", "Teacher ID", "Teacher Name", "Subject", "Round", "Call Date", "Call Time", "Number Dialed",
    "Call Outcome", "Spoke To", "Manager / Hotline Contacted?", "Contact Person Name", "Demo Video Sent?",
    "Detailed Message Sent?", "Sent Via", "Price Proposed (LKR)", "Teacher Counter-Offer (LKR)",
    "Interest Level", "Next Action", "Follow-up Date", "Notes",
]


def _s(v) -> str:
    return "" if v is None else str(v).strip()


def _phone(v) -> str:
    s = _s(v)
    return s[:-2] if re.fullmatch(r"\d+\.0", s) else s


def _date(v) -> date | None:
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = _s(v)
    for fmt in ("%d-%b-%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _time(v) -> time | None:
    if isinstance(v, datetime):
        return v.time().replace(microsecond=0)
    if isinstance(v, time):
        return v.replace(microsecond=0)
    s = _s(v)
    for fmt in ("%I:%M %p", "%H:%M", "%H:%M:%S", "%I:%M:%S %p"):
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            pass
    return None


def _yes(v) -> bool:
    return _s(v).lower() in ("yes", "y", "true", "1")


def _num(v) -> float | None:
    try:
        return float(v) if v not in (None, "") else None
    except (TypeError, ValueError):
        return None


def _int(v) -> int | None:
    n = _num(v)
    return int(n) if n is not None and n >= 0 else None


def _task_type(next_action: str) -> str:
    a = next_action.lower()
    if "meet" in a:
        return "Meeting"
    if "demo" in a or "video" in a:
        return "Send demo video"
    if "message" in a or "detail" in a or "info" in a:
        return "Send details"
    if "call" in a:
        return "Call back"
    return "Other"


def import_workbook(db: Session, data: bytes) -> dict:
    wb = load_workbook(io.BytesIO(data), data_only=False)
    if "Contacts" not in wb.sheetnames:
        raise ValueError("This does not look like the Teacher Call Tracker: no 'Contacts' sheet found.")
    ws = wb["Contacts"]
    existing = {t.name.strip().lower(): t for t in db.scalars(select(Teacher))}
    valid = set(db.scalars(select(Option.value).where(Option.category == "status")))
    id_map: dict[int, Teacher] = {}
    created = skipped = 0
    for row in ws.iter_rows(min_row=5, values_only=True):
        name = _s(row[1]) if len(row) > 1 else ""
        if not name:
            continue
        key = name.lower()
        if key in existing:
            skipped += 1
            teacher = existing[key]
            is_new = False
        else:
            status = _s(row[19]) if len(row) > 19 and not _s(row[19]).startswith("=") else ""
            notes = _s(row[21]) if len(row) > 21 else ""
            teacher = Teacher(name=name, subject=_s(row[2]), source_checklist=_s(row[6]),
                              status=status or "Not started", notes=notes,
                              students_per_class=_int(row[22]) if len(row) > 22 else None,
                              papers_per_month=_int(row[23]) if len(row) > 23 else None)
            teacher.phones = [TeacherPhone(number=p, position=i)
                              for i, p in enumerate(_phone(c) for c in row[3:6]) if p]
            db.add(teacher)
            existing[key] = teacher
            created += 1
            is_new = True
        if isinstance(row[0], (int, float)):
            id_map[int(row[0])] = (teacher, is_new)
    db.flush()

    calls = tasks = 0
    if "Call Log" in wb.sheetnames:
        attempts: dict[tuple[int, int], int] = {}
        for row in wb["Call Log"].iter_rows(min_row=5, values_only=True):
            if len(row) < 21 or not isinstance(row[1], (int, float)) or not _s(row[8]):
                continue  # pre-made empty rows have no outcome
            entry = id_map.get(int(row[1]))
            if not entry or not entry[1]:  # only import calls for teachers created by this import
                continue
            teacher = entry[0]
            rnd = int(row[4]) if isinstance(row[4], (int, float)) else 1
            n = attempts[(teacher.id, rnd)] = attempts.get((teacher.id, rnd), 0) + 1
            call = Call(
                teacher_id=teacher.id, round=rnd, attempt=n,
                called_date=_date(row[5]) or today(), called_time=_time(row[6]),
                number_dialed=_phone(row[7]), outcome=_s(row[8]), spoke_to=_s(row[9]),
                manager_contacted=_yes(row[10]), contact_person=_s(row[11]),
                demo_sent=_yes(row[12]), detailed_sent=_yes(row[13]), sent_via=_s(row[14]),
                price_proposed=_num(row[15]), counter_offer=_num(row[16]), interest_level=_s(row[17]),
                next_action=_s(row[18]), next_actions=json.dumps([_s(row[18])] if _s(row[18]) else []), followup_date=_date(row[19]), notes=_s(row[20]),
            )
            db.add(call)
            db.flush()
            teacher.status = status_after_call(teacher.status, call.interest_level, call.outcome, call.spoke_to, valid)
            calls += 1
            if call.followup_date:
                db.add(Task(teacher_id=teacher.id, type=_task_type(call.next_action),
                            title=call.next_action or "Follow up", due_date=call.followup_date,
                            source_call_id=call.id))
                tasks += 1
    db.flush()
    for subject in {t.subject for t in existing.values()}:
        ensure_option(db, "subject", subject)
    db.commit()
    return {"teachers_created": created, "teachers_skipped": skipped, "calls": calls, "tasks": tasks}


def _style_header(ws, headers: list[str]) -> None:
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True)
        c.fill = PatternFill("solid", fgColor="FFF2CC")
        c.alignment = Alignment(wrap_text=True, vertical="center")
    ws.freeze_panes = "C2"
    for i, h in enumerate(headers, 1):
        ws.column_dimensions[ws.cell(1, i).column_letter].width = max(12, min(30, len(h) + 2))


def export_workbook(db: Session) -> bytes:
    max_rounds, now = get_max_rounds(db), today()
    teachers = db.scalars(
        select(Teacher).order_by(Teacher.id)
        .options(selectinload(Teacher.phones), selectinload(Teacher.calls), selectinload(Teacher.tasks))
    ).all()
    wb = Workbook()
    ws = wb.active
    ws.title = "Contacts"
    _style_header(ws, CONTACT_HEADERS)
    for t in teachers:
        v = teacher_view(t, max_rounds, now)
        phones = [p.number for p in t.phones] + ["", "", ""]
        chips = [v["rounds"].get(str(r), {}).get("outcome", "") for r in range(1, 6)]
        ws.append([
            t.id, t.name, t.subject, phones[0], phones[1], phones[2], t.source_checklist, *chips,
            v["rounds_attempted"], "Yes" if v["reached"] else "No", "Yes" if v["manager_contacted"] else "No",
            "Yes" if v["demo_sent"] else "No", "Yes" if v["detailed_sent"] else "No",
            v["latest_price"], v["latest_interest"], t.status, v["next_followup"], t.notes,
            t.students_per_class, t.papers_per_month,
        ])
    ws = wb.create_sheet("Call Log")
    _style_header(ws, CALL_HEADERS)
    for t in teachers:
        for c in t.calls:
            ws.append([
                f"{t.id}-R{c.round}" + (f"-{c.attempt}" if c.attempt > 1 else ""), t.id, t.name, t.subject,
                c.round, c.called_date, c.called_time, c.number_dialed, c.outcome, c.spoke_to,
                "Yes" if c.manager_contacted else "No", c.contact_person,
                "Yes" if c.demo_sent else "No", "Yes" if c.detailed_sent else "No", c.sent_via,
                float(c.price_proposed) if c.price_proposed is not None else None,
                float(c.counter_offer) if c.counter_offer is not None else None,
                c.interest_level, c.next_action, c.followup_date, c.notes,
            ])
    ws = wb.create_sheet("Tasks")
    _style_header(ws, ["ID", "Teacher", "Type", "Task", "Due Date", "Due Time", "Status", "Notes"])
    for t in db.scalars(select(Task).options(selectinload(Task.teacher)).order_by(Task.due_date, Task.id)):
        ws.append([t.id, t.teacher.name if t.teacher else "", t.type, t.title, t.due_date, t.due_time,
                   t.status, t.notes])
    for sheet in wb:
        for row in sheet.iter_rows(min_row=2):
            for c in row:
                if isinstance(c.value, date) and not isinstance(c.value, datetime):
                    c.number_format = "DD-MMM-YYYY"
                elif isinstance(c.value, time):
                    c.number_format = "hh:mm AM/PM"
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
