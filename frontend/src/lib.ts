export const pad = (n: number) => String(n).padStart(2, "0");

/** Local date -> "YYYY-MM-DD" */
export function ymd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const todayStr = () => ymd(new Date());

export function parseYmd(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(s: string, n: number) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function fmtDate(s: string | null | undefined, withYear = false) {
  if (!s) return "";
  return parseYmd(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}
export function fmtLongDate(s: string) {
  return parseYmd(s).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
export function fmtTime(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}
export function relDay(s: string, today = todayStr()) {
  if (s === today) return "Today";
  if (s === addDays(today, 1)) return "Tomorrow";
  if (s === addDays(today, -1)) return "Yesterday";
  return fmtDate(s);
}

export const money = (n: number | null | undefined) => (n == null ? "" : n.toLocaleString("en-LK"));

/** "071 344 4555" -> "+94713444555" (same rules as the server) */
export function toE164(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+") && digits) return "+" + digits;
  if (digits.startsWith("94") && digits.length === 11) return "+" + digits;
  if (digits.startsWith("0") && digits.length === 10) return "+94" + digits.slice(1);
  if (digits.length === 9) return "+94" + digits;
  return "";
}

/** wa.me click-to-chat link */
export function waLink(e164: string) {
  return e164 ? `https://wa.me/${e164.replace(/\D/g, "")}` : "";
}

export function outcomeTone(outcome: string): string {
  if (!outcome) return "bg-slate-100 text-slate-400";
  if (outcome.startsWith("Answered")) return "bg-emerald-100 text-emerald-800";
  if (outcome === "Wrong number" || outcome === "Not interested") return "bg-rose-100 text-rose-800";
  return "bg-amber-100 text-amber-800"; // no answer, busy, switched off, declined
}

export const STATUS_TONE: Record<string, string> = {
  "Not started": "bg-slate-100 text-slate-700",
  "In progress": "bg-sky-100 text-sky-800",
  Interested: "bg-emerald-100 text-emerald-800",
  Negotiating: "bg-violet-100 text-violet-800",
  Won: "bg-green-600 text-white",
  "Lost / Not interested": "bg-rose-100 text-rose-800",
};

export const TASK_COLORS: Record<string, string> = {
  "Call back": "#4f46e5",
  "Send demo video": "#0891b2",
  "Send details": "#0d9488",
  Meeting: "#d97706",
  Other: "#64748b",
};

/** Task type to suggest for a call's "next action" */
export function taskTypeFor(nextAction: string): string {
  const a = nextAction.toLowerCase();
  if (a.includes("meet")) return "Meeting";
  if (a.includes("demo") || a.includes("video")) return "Send demo video";
  if (a.includes("message") || a.includes("detail") || a.includes("info")) return "Send details";
  if (a.includes("call")) return "Call back";
  return "Other";
}
