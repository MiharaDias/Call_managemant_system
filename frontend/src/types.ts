export interface User { id: number; username: string; display_name: string }
export interface Phone { id: number; number: string; label: string; e164: string }
export interface Tag { id: number; name: string; color: string; description: string }

export interface Teacher {
  id: number; name: string; subject: string; source_checklist: string; status: string; notes: string;
  students_per_class: number | null; papers_per_month: number | null;
  assigned_to_id: number | null; phones: Phone[]; tags: Tag[];
  rounds: Record<string, { outcome: string; attempts: number }>;
  rounds_attempted: number; next_round: number; rounds_exhausted: boolean; call_count: number;
  last_call_date: string | null; reached: boolean; manager_contacted: boolean; demo_sent: boolean;
  detailed_sent: boolean; latest_price: number | null; latest_interest: string;
  next_followup: string | null; next_followup_overdue: boolean; open_task_count: number;
  calls?: Call[];
}

export interface Call {
  id: number; teacher_id: number; teacher_name: string; subject: string; round: number; attempt: number;
  called_date: string; called_time: string | null; number_dialed: string; outcome: string; spoke_to: string;
  manager_contacted: boolean; contact_person: string; demo_sent: boolean; detailed_sent: boolean;
  sent_via: string; price_proposed: number | null; counter_offer: number | null; interest_level: string;
  next_action: string; next_actions: string[]; followup_date: string | null; notes: string; created_by: string; tags: Tag[];
}

export interface Task {
  id: number; teacher_id: number | null; teacher_name: string; teacher_phone: string; type: string;
  title: string; due_date: string; due_time: string | null; status: "open" | "done"; notes: string;
  overdue: boolean; completed_at: string | null; completed_by: string; assigned_to_id: number | null;
  assigned_to: string; source_call_id: number | null;
}

export interface OptionsResponse { options: Record<string, string[]>; max_rounds: number; calendar_types: string[] }

export interface Summary {
  today: string; max_rounds: number; rounds: number[];
  table: { key: string; label: string; rounds: Record<string, number | null>; total: number | null }[];
  by_status: Record<string, number>;
  totals: { teachers: number; with_phone: number; never_called: number; reached: number; exhausted: number };
  tasks_due_today: number; tasks_overdue: number; due_tasks: Task[];
  next_to_call: { teacher: { id: number; name: string; subject: string; phones: Phone[]; rounds_attempted: number }; reason: string }[];
  next_to_call_total: number;
}
