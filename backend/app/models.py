from datetime import date, datetime, time

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Table, Text, Time, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

teacher_tags = Table(
    "teacher_tags", Base.metadata,
    Column("teacher_id", ForeignKey("teachers.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
call_tags = Table(
    "call_tags", Base.metadata,
    Column("call_id", ForeignKey("calls.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    """A custom label (e.g. 'Decision maker'); the description says what it means."""
    __tablename__ = "tags"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)
    color: Mapped[str] = mapped_column(String(9), default="#6366f1")
    description: Mapped[str] = mapped_column(Text, default="")


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))


class Teacher(Base):
    __tablename__ = "teachers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    subject: Mapped[str] = mapped_column(String(100), default="")
    source_checklist: Mapped[str] = mapped_column(String(20), default="")  # "", "Ticked", "Unticked"
    status: Mapped[str] = mapped_column(String(50), default="Not started")
    notes: Mapped[str] = mapped_column(Text, default="")
    students_per_class: Mapped[int | None] = mapped_column(Integer)  # typical class size
    papers_per_month: Mapped[int | None] = mapped_column(Integer)  # papers the teacher gets each month
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    phones: Mapped[list["TeacherPhone"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan", order_by="TeacherPhone.position"
    )
    calls: Mapped[list["Call"]] = relationship(
        back_populates="teacher", cascade="all, delete-orphan",
        order_by="(Call.called_date, Call.called_time, Call.id)",
    )
    tasks: Mapped[list["Task"]] = relationship(back_populates="teacher", cascade="all, delete-orphan")
    tags: Mapped[list[Tag]] = relationship(secondary=teacher_tags, order_by=Tag.name)


class TeacherPhone(Base):
    __tablename__ = "teacher_phones"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    number: Mapped[str] = mapped_column(String(30))  # as typed, e.g. "071 344 4555"
    label: Mapped[str] = mapped_column(String(50), default="")  # e.g. Hotline, Manager, Teacher
    position: Mapped[int] = mapped_column(Integer, default=0)
    teacher: Mapped[Teacher] = relationship(back_populates="phones")


class Call(Base):
    __tablename__ = "calls"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    round: Mapped[int] = mapped_column(Integer)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    kind: Mapped[str] = mapped_column(String(20), default="call")  # call | online_meeting | physical_meeting
    location: Mapped[str] = mapped_column(String(255), default="")  # meeting address or link
    called_date: Mapped[date] = mapped_column(Date)
    called_time: Mapped[time | None] = mapped_column(Time)
    number_dialed: Mapped[str] = mapped_column(String(30), default="")
    outcome: Mapped[str] = mapped_column(String(80), default="")
    spoke_to: Mapped[str] = mapped_column(String(80), default="")
    manager_contacted: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_person: Mapped[str] = mapped_column(String(200), default="")
    demo_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    detailed_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_via: Mapped[str] = mapped_column(String(50), default="")
    price_proposed: Mapped[float | None] = mapped_column(Numeric(12, 2))
    counter_offer: Mapped[float | None] = mapped_column(Numeric(12, 2))
    interest_level: Mapped[str] = mapped_column(String(80), default="")
    next_action: Mapped[str] = mapped_column(String(120), default="")  # legacy / joined text of next_actions
    next_actions: Mapped[str] = mapped_column(Text, default="")  # JSON list: several next actions per call
    followup_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher: Mapped[Teacher] = relationship(back_populates="calls")
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    tags: Mapped[list[Tag]] = relationship(secondary=call_tags, order_by=Tag.name)


class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(primary_key=True)
    teacher_id: Mapped[int | None] = mapped_column(ForeignKey("teachers.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(50), default="Other")
    title: Mapped[str] = mapped_column(String(255))
    due_date: Mapped[date] = mapped_column(Date, index=True)
    due_time: Mapped[time | None] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)  # open | done
    notes: Mapped[str] = mapped_column(Text, default="")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    source_call_id: Mapped[int | None] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"))
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    teacher: Mapped[Teacher | None] = relationship(back_populates="tasks")


class Option(Base):
    """Editable dropdown values (the 'Lists' sheet)."""
    __tablename__ = "options"
    __table_args__ = (UniqueConstraint("category", "value"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    category: Mapped[str] = mapped_column(String(30), index=True)
    value: Mapped[str] = mapped_column(String(100))
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(255))
