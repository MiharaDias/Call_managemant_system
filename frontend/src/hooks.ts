import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { OptionsResponse, Tag, Teacher, User } from "./types";

export const AuthContext = createContext<{ user: User; logout: () => void }>(null as never);
export const useAuth = () => useContext(AuthContext);

export function useOptions() {
  const q = useQuery({ queryKey: ["options"], queryFn: () => api.get<OptionsResponse>("/options"), staleTime: 60_000 });
  return { opts: q.data?.options ?? {}, maxRounds: q.data?.max_rounds ?? 5, calendarTypes: q.data?.calendar_types ?? [] };
}

export function useUsers() {
  return useQuery({ queryKey: ["users"], queryFn: () => api.get<User[]>("/auth/users"), staleTime: 300_000 }).data ?? [];
}

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: () => api.get<Tag[]>("/tags"), staleTime: 30_000 }).data ?? [];
}

/** How many round chips to show: the default (5) or more if this teacher has been called further. */
export function roundCount(t: Teacher, maxRounds: number) {
  return Math.max(maxRounds, ...Object.keys(t.rounds).map(Number));
}

export function useTeacher(id: number | undefined) {
  return useQuery({ queryKey: ["teacher", id], queryFn: () => api.get<Teacher>(`/teachers/${id}`), enabled: !!id });
}

/** Refresh everything that depends on calls/tasks/teachers after a change. */
export function useInvalidate() {
  const qc = useQueryClient();
  return () => Promise.all(["teachers", "teacher", "calls", "tasks", "agenda", "calendar", "summary", "tags"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
