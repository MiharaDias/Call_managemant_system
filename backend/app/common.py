import json
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import settings
from .models import Call, Option, Setting, Task, Teacher, User

DEFAULT_OPTIONS: dict[str, list[str]] = {
    "outcome": ["Answered - Spoke", "Answered - Call back later", "No answer", "Busy",
                "Switched off / Unreachable", "Wrong number", "Not interested", "Call declined"],
    "spoke_to": ["Teacher", "Manager", "Hotline", "Receptionist / Other", "Nobody"],
    "interest": ["Interested", "Considering", "Needs more info", "Negotiating",
                 "Not interested", "Confirmed / Deal"],
    "channel": ["WhatsApp", "Email", "SMS", "Other"],
    "status": ["Not started", "Contacted", "In progress", "Interested", "Negotiating", "Won", "Lost / Not interested"],
    "subject": ["Physics", "Chemistry", "Bio", "Agri", "SFT", "ET", "ICT", "Econ", "Logic", "BST"],
    "next_action": ["Call again", "Send demo video", "Send detailed message", "Meeting", "Wait for reply", "Close"],
    "task_type": ["Call back", "Send demo video", "Send details", "Meeting", "Other"],
}
DEFAULT_MAX_ROUNDS = 5
DEFAULT_CALENDAR_TYPES = ["Call back", "Meeting"]  # task types shown on the calendar


def today() -> date:
    return datetime.now(settings.tz).date()


def get_max_rounds(db: Session) -> int:
    s = db.get(Setting, "max_rounds")
    return int(s.value) if s else DEFAULT_MAX_ROUNDS


def get_calendar_types(db: Session) -> list[str]:
    s = db.get(Setting, "calendar_types")
    return json.loads(s.value) if s else list(DEFAULT_CALENDAR_TYPES)


def ensure_option(db: Session, category: str, value: str) -> None:
    """Add a dropdown value (e.g. a new subject typed on the teacher form) if it is not there yet."""
    value = (value or "").strip()
    if not value or db.scalar(select(Option.id).where(Option.category == category, Option.value == value)):
        return
    top = db.scalar(select(func.max(Option.sort)).where(Option.category == category))
    db.add(Option(category=category, value=value, sort=(top if top is not None else -1) + 1))


def seed_options(db: Session) -> None:
    """Fill dropdown lists the first time (taken from the Lists sheet) and apply small upgrades to older databases."""
    present = set(db.scalars(select(Option.category).distinct()))
    fresh = not present
    for cat, values in DEFAULT_OPTIONS.items():
        if cat not in present:
            for i, v in enumerate(values):
                db.add(Option(category=cat, value=v, sort=i))
    if not db.get(Setting, "max_rounds"):
        db.add(Setting(key="max_rounds", value=str(DEFAULT_MAX_ROUNDS)))
    if not db.get(Setting, "calendar_types"):
        db.add(Setting(key="calendar_types", value=json.dumps(DEFAULT_CALENDAR_TYPES)))
    # Upgrade: databases created before 'Contacted' existed get it right after 'Not started'
    if not db.get(Setting, "mig_contacted_status"):
        if not fresh and "status" in present:
            rows = db.scalars(select(Option).where(Option.category == "status").order_by(Option.sort, Option.id)).all()
            if not any(o.value == "Contacted" for o in rows):
                names = [o.value for o in rows]
                at = names.index("Not started") + 1 if "Not started" in names else 0
                for o in rows[at:]:
                    o.sort += 1
                db.add(Option(category="status", value="Contacted", sort=rows[at - 1].sort + 1 if at else 0))
        db.add(Setting(key="mig_contacted_status", value="1"))
    db.flush()
    # every subject already used by a teacher must be selectable
    for subject in db.scalars(select(Teacher.subject).distinct()):
        ensure_option(db, "subject", subject)
    db.commit()


def user_names(db: Session) -> dict[int, str]:
    return {u.id: u.display_name for u in db.scalars(select(User))}


def tag_view(t) -> dict:
    return {"id": t.id, "name": t.name, "color": t.color, "description": t.description}


def call_actions(c) -> list[str]:
    """The call's next actions as a list (older calls only have the single legacy text)."""
    if c.next_actions:
        try:
            return [str(x) for x in json.loads(c.next_actions)]
        except ValueError:
            pass
    return [c.next_action] if c.next_action else []


def set_actions(c, actions: list[str]) -> None:
    clean: list[str] = []
    for a in actions:
        a = a.strip()
        if a and a not in clean:
            clean.append(a)
    c.next_actions = json.dumps(clean, ensure_ascii=False)
    c.next_action = ", ".join(clean)[:120]


def call_view(c: Call, names: dict[int, str]) -> dict:
    return {
        "id": c.id, "teacher_id": c.teacher_id, "teacher_name": c.teacher.name if c.teacher else "",
        "subject": c.teacher.subject if c.teacher else "",
        "round": c.round, "attempt": c.attempt,
        "called_date": c.called_date, "called_time": c.called_time,
        "number_dialed": c.number_dialed, "outcome": c.outcome, "spoke_to": c.spoke_to,
        "manager_contacted": c.manager_contacted, "contact_person": c.contact_person,
        "demo_sent": c.demo_sent, "detailed_sent": c.detailed_sent, "sent_via": c.sent_via,
        "price_proposed": float(c.price_proposed) if c.price_proposed is not None else None,
        "counter_offer": float(c.counter_offer) if c.counter_offer is not None else None,
        "interest_level": c.interest_level, "next_action": ", ".join(call_actions(c)), "next_actions": call_actions(c),
        "followup_date": c.followup_date, "notes": c.notes,
        "created_by": names.get(c.created_by_id, ""),
        "tags": [tag_view(x) for x in c.tags],
    }


def task_view(t: Task, names: dict[int, str], today_: date) -> dict:
    phone = t.teacher.phones[0].number if t.teacher and t.teacher.phones else ""
    return {
        "id": t.id, "teacher_id": t.teacher_id,
        "teacher_name": t.teacher.name if t.teacher else "",
        "teacher_phone": phone,
        "type": t.type, "title": t.title, "due_date": t.due_date, "due_time": t.due_time,
        "status": t.status, "notes": t.notes,
        "overdue": t.status == "open" and t.due_date < today_,
        "completed_at": t.completed_at,
        "completed_by": names.get(t.completed_by_id, ""),
        "assigned_to_id": t.assigned_to_id, "assigned_to": names.get(t.assigned_to_id, ""),
        "source_call_id": t.source_call_id,
    }
