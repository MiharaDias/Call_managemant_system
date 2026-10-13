import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api";
import type { User } from "../types";
import { Button, ErrorText, Field, Input } from "../components/ui";

export default function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () => api.post<User>("/auth/login", { username, password }),
    onSuccess: onLogin,
  });
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form onSubmit={(e) => { e.preventDefault(); login.mutate(); }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Agent Flow</h1>
          <p className="text-sm text-slate-500">Client Call Manager – sign in</p>
        </div>
        <Field label="Username"><Input autoFocus autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
        <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <ErrorText error={login.error} />
        <Button type="submit" variant="primary" className="w-full" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</Button>
      </form>
    </div>
  );
}
