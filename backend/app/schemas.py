from datetime import date, time
from typing import Optional

from pydantic import BaseModel, Field


class LoginIn(BaseModel):
    username: str
    password: str


class PasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UserOut(BaseModel):
    id: int
    username: str
    display_name: str
    model_config = {"from_attributes": True}


class PhoneIn(BaseModel):
    number: str = Field(min_length=1, max_length=30)
    label: str = Field(default="", max_length=50)  # Hotline / Manager / Teacher …


class TagIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#6366f1", pattern="^#[0-9a-fA-F]{6}$")
    description: str = ""


class TagPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    color: Optional[str] = Field(default=None, pattern="^#[0-9a-fA-F]{6}$")
    description: Optional[str] = None


class OptionAdd(BaseModel):
    value: str = Field(min_length=1, max_length=100)


class TeacherIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    subject: str = ""
    source_checklist: str = ""
    status: str = "Not started"
    notes: str = ""
    students_per_class: Optional[int] = Field(default=None, ge=0, le=100000)
    papers_per_month: Optional[int] = Field(default=None, ge=0, le=10000000)
    assigned_to_id: Optional[int] = None
    phones: list[PhoneIn] = []
    tag_ids: list[int] = []


class TeacherPatch(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    subject: Optional[str] = None
    source_checklist: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    students_per_class: Optional[int] = Field(default=None, ge=0, le=100000)
    papers_per_month: Optional[int] = Field(default=None, ge=0, le=10000000)
    assigned_to_id: Optional[int] = None
    phones: Optional[list[PhoneIn]] = None
    tag_ids: Optional[list[int]] = None


class TaskIn(BaseModel):
    teacher_id: Optional[int] = None
    type: str = "Other"
    title: str = Field(min_length=1, max_length=255)
    due_date: date
    due_time: Optional[time] = None
    notes: str = ""
    assigned_to_id: Optional[int] = None


class TaskPatch(BaseModel):
    teacher_id: Optional[int] = None
    type: Optional[str] = None
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    due_date: Optional[date] = None
    due_time: Optional[time] = None
    clear_time: bool = False
    notes: Optional[str] = None
    assigned_to_id: Optional[int] = None
    status: Optional[str] = Field(default=None, pattern="^(open|done)$")


class CallIn(BaseModel):
    teacher_id: int
    round: int = Field(ge=1, le=20)
    called_date: date
    called_time: Optional[time] = None
    number_dialed: str = ""
    outcome: str = ""
    spoke_to: str = ""
    manager_contacted: bool = False
    contact_person: str = ""
    demo_sent: bool = False
    detailed_sent: bool = False
    sent_via: str = ""
    price_proposed: Optional[float] = Field(default=None, ge=0)
    counter_offer: Optional[float] = Field(default=None, ge=0)
    interest_level: str = ""
    next_action: str = ""
    next_actions: list[str] = []
    followup_date: Optional[date] = None
    notes: str = ""
    tag_ids: list[int] = []
    new_phone: Optional[PhoneIn] = None  # a number we were given during the call (e.g. the manager's)
    create_tasks: list[TaskIn] = []  # follow-up tasks (one per next action) created together with the call


class CallPatch(BaseModel):
    round: Optional[int] = Field(default=None, ge=1, le=20)
    called_date: Optional[date] = None
    called_time: Optional[time] = None
    number_dialed: Optional[str] = None
    outcome: Optional[str] = None
    spoke_to: Optional[str] = None
    manager_contacted: Optional[bool] = None
    contact_person: Optional[str] = None
    demo_sent: Optional[bool] = None
    detailed_sent: Optional[bool] = None
    sent_via: Optional[str] = None
    price_proposed: Optional[float] = Field(default=None, ge=0)
    counter_offer: Optional[float] = Field(default=None, ge=0)
    interest_level: Optional[str] = None
    next_action: Optional[str] = None
    next_actions: Optional[list[str]] = None
    followup_date: Optional[date] = None
    notes: Optional[str] = None
    tag_ids: Optional[list[int]] = None


class OptionsIn(BaseModel):
    options: dict[str, list[str]]
    max_rounds: Optional[int] = Field(default=None, ge=1, le=10)
    calendar_types: Optional[list[str]] = None
