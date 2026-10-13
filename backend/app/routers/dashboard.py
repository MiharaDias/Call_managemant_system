from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..common import get_max_rounds, task_view, today, user_names
from ..db import get_db
from ..models import Call, Option, Task, Teacher
from ..security import current_user
from ..services.derived import CLOSED_STATUSES, INTERESTED_LEVELS, REACHED, outcome_group, teacher_view

router = APIRouter(prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(current_user)])

METRICS = [
    ("calls_logged", "Calls logged (outcome filled)"),
    ("answered", "Answered"),
    ("no_contact", "No answer / busy / unreachable"),
    ("wrong_number", "Wrong number"),
    ("spoke_teacher", "Spoke to teacher"),
    ("manager_contacted", "Manager / hotline contacted"),
    ("demo_sent", "Demo video sent"),
    ("detailed_sent", "Detailed message sent"),
    ("prices_count", "Prices proposed (count)"),
    ("avg_price", "Average price proposed (LKR)"),
    ("interested", "Interested / negotiating / deal"),
    ("not_interested", "Not interested"),
]


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    now, max_rounds = today(), get_max_rounds(db)
    calls = db.scalars(select(Call)).all()
    teachers = db.scalars(
        select(Teacher).order_by(Teacher.id)
        .options(selectinload(Teacher.phones), selectinload(Teacher.calls), selectinload(Teacher.tasks),
                 selectinload(Teacher.tags))
    ).all()

    # Per-round table (the Excel "Dashboard" sheet)
    rounds = list(range(1, max([max_rounds, *(c.round for c in calls)]) + 1))  # extra rounds get a column
    per_round = {m: {r: 0 for r in rounds} for m, _ in METRICS}
    prices: dict[int, list[float]] = {r: [] for r in rounds}
    for c in calls:
        if (c.kind or "call") != "call" or c.round not in per_round["calls_logged"]:
            continue  # meetings are not part of the call rounds
        r, g = c.round, outcome_group(c.outcome)
        if c.outcome:
            per_round["calls_logged"][r] += 1
        per_round["answered"][r] += g == "answered"
        per_round["no_contact"][r] += g == "no_contact"
        per_round["wrong_number"][r] += g == "wrong_number"
        per_round["spoke_teacher"][r] += c.spoke_to == "Teacher"
        per_round["manager_contacted"][r] += bool(c.manager_contacted)
        per_round["demo_sent"][r] += bool(c.demo_sent)
        per_round["detailed_sent"][r] += bool(c.detailed_sent)
        if c.price_proposed and c.price_proposed > 0:
            per_round["prices_count"][r] += 1
            prices[r].append(float(c.price_proposed))
        per_round["interested"][r] += c.interest_level in INTERESTED_LEVELS
        per_round["not_interested"][r] += c.interest_level == "Not interested"
    for r in rounds:
        per_round["avg_price"][r] = round(sum(prices[r]) / len(prices[r])) if prices[r] else None
    all_prices = [p for v in prices.values() for p in v]
    table = []
    for key, label in METRICS:
        row = {"key": key, "label": label, "rounds": {str(r): per_round[key][r] for r in rounds}}
        if key == "avg_price":
            row["total"] = round(sum(all_prices) / len(all_prices)) if all_prices else None
        else:
            row["total"] = sum(per_round[key].values())
        table.append(row)

    # Teacher-level numbers
    status_order = [o.value for o in db.scalars(select(Option).where(Option.category == "status").order_by(Option.sort))]
    by_status = {s: 0 for s in status_order}
    views = [teacher_view(t, max_rounds, now) for t in teachers]
    for t in teachers:
        by_status[t.status] = by_status.get(t.status, 0) + 1

    # "Next to call": call-backs that are due, then teachers with no pending task who still have rounds left
    due_ids = {x.teacher_id for x in db.scalars(
        select(Task).where(Task.status == "open", Task.due_date <= now, Task.type == "Call back"))}
    queue = []
    for t, v in zip(teachers, views):
        if t.status in CLOSED_STATUSES or not t.phones or v["rounds_exhausted"]:
            continue
        if any(c.outcome == "Wrong number" for c in t.calls):
            continue
        if t.id in due_ids:
            queue.append((0, v["rounds_attempted"], t.id, v, "Call-back due"))
        elif v["open_task_count"] == 0 and v["rounds_attempted"] < max_rounds:
            reason = "Never called" if v["call_count"] == 0 else f"Ready for round {v['next_round']}"
            queue.append((1, v["rounds_attempted"], t.id, v, reason))
    queue.sort(key=lambda x: x[:3])

    names = user_names(db)
    open_today = db.scalars(select(Task).options(selectinload(Task.teacher).selectinload(Teacher.phones))
                            .where(Task.status == "open", Task.due_date <= now)
                            .order_by(Task.due_date, Task.due_time, Task.id)).all()
    return {
        "today": now, "max_rounds": max_rounds, "rounds": rounds, "table": table,
        "by_status": by_status,
        "totals": {
            "teachers": len(teachers),
            "with_phone": sum(1 for t in teachers if t.phones),
            "never_called": sum(1 for v in views if v["call_count"] == 0),
            "reached": sum(1 for v in views if v["reached"]),
            "exhausted": sum(1 for v in views if v["rounds_exhausted"]),
            "meetings": sum(1 for c in calls if (c.kind or "call") != "call"),
        },
        "tasks_due_today": sum(1 for x in open_today if x.due_date == now),
        "tasks_overdue": sum(1 for x in open_today if x.due_date < now),
        "due_tasks": [task_view(x, names, now) for x in open_today[:8]],
        "next_to_call": [{"teacher": {"id": v["id"], "name": v["name"], "subject": v["subject"],
                                      "phones": v["phones"], "rounds_attempted": v["rounds_attempted"]},
                          "reason": reason} for _, _, _, v, reason in queue[:10]],
        "next_to_call_total": len(queue),
    }
