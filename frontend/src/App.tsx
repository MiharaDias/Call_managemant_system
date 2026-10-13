import { useEffect } from "react";
import { Navigate, NavLink, Outlet, Route, Routes } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { AuthContext } from "./hooks";
import type { User } from "./types";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Teachers from "./pages/Teachers";
import TeacherDetail from "./pages/TeacherDetail";
import Calls from "./pages/Calls";
import Tasks from "./pages/Tasks";
import Today from "./pages/Today";
import CalendarPage from "./pages/CalendarPage";
import Settings from "./pages/Settings";

const NAV = [
  { to: "/", label: "Dashboard", icon: "📊", end: true },
  { to: "/today", label: "Today", icon: "✅" },
  { to: "/calendar", label: "Calendar", icon: "📅" },
  { to: "/teachers", label: "Teachers", icon: "👩‍🏫" },
  { to: "/calls", label: "Call log", icon: "📞" },
  { to: "/tasks", label: "Tasks", icon: "📝" },
  { to: "/settings", label: "Settings", icon: "⚙️" },
];

function Layout({ user, logout }: { user: User; logout: () => void }) {
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <AuthContext.Provider value={{ user, logout }}>
      <div className="min-h-screen lg:flex">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="px-5 py-5">
            <div className="text-base font-bold leading-tight text-slate-900">Agent Flow</div>
            <div className="text-xs text-slate-500">Client Call Manager</div>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={link}><span aria-hidden>{n.icon}</span>{n.label}</NavLink>)}
          </nav>
          <div className="border-t border-slate-100 p-4 text-sm">
            <div className="font-medium text-slate-800">{user.display_name}</div>
            <button onClick={logout} className="text-xs text-slate-500 hover:text-indigo-600">Sign out</button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <span className="font-bold text-slate-900">Agent Flow</span>
            <button onClick={logout} className="text-xs text-slate-500">{user.display_name} · Sign out</button>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-8"><Outlet /></main>
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white lg:hidden">
          {NAV.filter((n) => n.to !== "/settings").map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? "font-semibold text-indigo-700" : "text-slate-500"}`}>
              <span className="text-lg" aria-hidden>{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </AuthContext.Provider>
  );
}

export default function App() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => api.get<User>("/auth/me"), retry: false, staleTime: Infinity });

  useEffect(() => {
    const h = () => qc.setQueryData(["me"], null);
    window.addEventListener("auth-expired", h);
    return () => window.removeEventListener("auth-expired", h);
  }, [qc]);

  if (me.isLoading) return <div className="p-10 text-center text-slate-400">Loading…</div>;
  if (me.error && !(me.error instanceof ApiError && me.error.status === 401)) {
    return <div className="p-10 text-center text-rose-600">Cannot reach the server. Is the backend running?</div>;
  }
  const user = me.data;
  if (!user) {
    return <Login onLogin={(u) => qc.setQueryData(["me"], u)} />;
  }
  const logout = async () => { await api.post("/auth/logout"); qc.clear(); qc.setQueryData(["me"], null); };

  return (
    <Routes>
      <Route element={<Layout user={user} logout={logout} />}>
        <Route index element={<Dashboard />} />
        <Route path="today" element={<Today />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="teachers/:id" element={<TeacherDetail />} />
        <Route path="calls" element={<Calls />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
