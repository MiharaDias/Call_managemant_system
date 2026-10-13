"""Values the Excel sheet calculated with formulas; here they are computed from the call log."""
from datetime import date, time

from ..models import Teacher
from .phones import normalize_phone

REACHED = {"Teacher", "Manager", "Hotline"}
CLOSED_STATUSES = {"Won", "Lost / Not interested"}
INTERESTED_LEVELS = {"Interested", "Negotiating", "Confirmed / Deal"}

# Interest level on a call -> overall teacher status
STATUS_FROM_INTEREST = {
    "Interested": "Interested",
    "Negotiating": "Negotiating",
    "Not interested": "Lost / Not interested",
    "Confirmed / Deal": "Won",
}


def outcome_group(outcome: str) -> str:
    o = (outcome or "").strip()
    if not o:
        return ""
    if o.startswith("Answered"):
        return "answered"
    if o in ("No answer", "Busy", "Call declined") or o.startswith("Switched"):
        return "no_contact"
    if o == "Wrong number":
        return "wrong_number"
    if o == "Not interested":
        return "not_interested"
    return "other"


def teacher_view(t: Teacher, max_rounds: int, today: date) -> dict:
    everything = list(t.calls)  # calls and meetings, ordered by date/time/id
    calls = [c for c in everything if (c.kind or "call") == "call"]  # only calls count towards the rounds
    meetings = [c for c in everything if (c.kind or "call") != "call"]
    rounds: dict[int, dict] = {}
    for c in calls:
        r = rounds.setdefault(c.round, {"outcome": "", "attempts": 0})
        r["outcome"] = c.outcome  # the last attempt in a round is what the chip shows
        r["attempts"] += 1

    def latest(attr: str):
        for c in reversed(everything):
            v = getattr(c, attr)
            if v not in (None, ""):
                return v
        return None

    open_tasks = [x for x in t.tasks if x.status == "open"]
    next_task = min(open_tasks, key=lambda x: (x.due_date, x.due_time or time.max), default=None)
    reached = any(c.spoke_to in REACHED for c in everything)
    rounds_attempted = len(rounds)
    last = calls[-1] if calls else None
    price = latest("price_proposed")
    return {
        "id": t.id,
        "name": t.name,
        "subject": t.subject,
        "source_checklist": t.source_checklist,
        "status": t.status,
        "notes": t.notes,
        "students_per_class": t.students_per_class,
        "papers_per_month": t.papers_per_month,
        "assigned_to_id": t.assigned_to_id,
        "phones": [{"id": p.id, "number": p.number, "label": p.label or "", "e164": normalize_phone(p.number)}
                   for p in t.phones],
        "tags": [{"id": g.id, "name": g.name, "color": g.color, "description": g.description} for g in t.tags],
        "rounds": {str(k): v for k, v in sorted(rounds.items())},
        "rounds_attempted": rounds_attempted,
        "next_round": max(rounds, default=0) + 1,  # no upper limit: extra rounds beyond the default are allowed
        "rounds_exhausted": rounds_attempted >= max_rounds and not reached,
        "call_count": len(calls),
        "meeting_count": len(meetings),
        "last_meeting_date": meetings[-1].called_date if meetings else None,
        "last_call_date": last.called_date if last else None,
        "reached": reached,
        "manager_contacted": any(c.manager_contacted for c in everything),
        "demo_sent": any(c.demo_sent for c in everything),
        "detailed_sent": any(c.detailed_sent for c in everything),
        "latest_price": float(price) if price is not None else None,
        "latest_interest": latest("interest_level") or "",
        "next_followup": next_task.due_date if next_task else None,
        "next_followup_overdue": bool(next_task and next_task.due_date < today),
        "open_task_count": len(open_tasks),
    }


def status_after_call(current: str, interest: str, outcome: str, spoke_to: str, valid: set[str]) -> str:
    """Auto-update the overall status after a call; the user can still change it by hand.

    Contacted = we actually spoke to the teacher or a manager (a hotline only gives us a number).
    A status that no longer exists in the Settings list is never applied.
    """
    new = current
    if interest in STATUS_FROM_INTEREST:
        new = STATUS_FROM_INTEREST[interest]
    elif outcome == "Not interested":
        new = "Lost / Not interested"
    elif spoke_to in ("Teacher", "Manager") and current in ("", "Not started", "In progress"):
        new = "Contacted"
    elif current in ("", "Not started"):
        new = "In progress"
    return new if new in valid else current
