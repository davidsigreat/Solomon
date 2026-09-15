"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

type UserRole = "VIEWER" | "MEMBER" | "ADMIN";
interface AppUser { id: string; email: string; role: UserRole; note: string | null; createdAt: string; }
interface NeonUser { id: string; name: string | null; email: string | null; image: string | null; }

const ROLE_META: Record<UserRole, { label: string; color: string; desc: string }> = {
  VIEWER: { label: "Viewer",  color: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20", desc: "Read-only access" },
  MEMBER: { label: "Member",  color: "text-blue-400 bg-blue-500/10 border-blue-500/20",  desc: "Full task & project access" },
  ADMIN:  { label: "Admin",   color: "text-violet-400 bg-violet-500/10 border-violet-500/20", desc: "Full access + user management" },
};

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  const initials = name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";
  return image
    ? <img src={image} alt={name ?? ""} className="w-8 h-8 rounded-full object-cover" />
    : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40 flex items-center justify-center text-xs font-bold text-white">{initials}</div>;
}

export default function AdminPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  const [appUsers, setAppUsers]   = useState<AppUser[]>([]);
  const [neonUsers, setNeonUsers] = useState<NeonUser[]>([]);
  const [tab, setTab]             = useState<"users" | "registered">("users");
  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [newEmail, setNewEmail]   = useState("");
  const [newRole, setNewRole]     = useState<UserRole>("MEMBER");
  const [newNote, setNewNote]     = useState("");
  const [adding, setAdding]       = useState(false);
  const [addError, setAddError]   = useState("");

  useEffect(() => { if (!isPending && !session) router.push("/login"); }, [session, isPending, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/auth/me").then(r => r.json()).then(d => {
      setIsAdmin(d.isAdmin ?? false);
      if (!d.isAdmin) router.push("/dashboard");
    });
  }, [session, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/whitelist").then(r => r.json()).then(d => setAppUsers(d.entries ?? []));
    fetch("/api/admin/users").then(r => r.json()).then(d => setNeonUsers(d.users ?? []));
  }, [isAdmin]);

  async function addUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError("");
    setAdding(true);
    const res = await fetch("/api/admin/whitelist", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, role: newRole, note: newNote }),
    });
    const data = await res.json();
    if (!res.ok) { setAddError(data.error ?? "Failed"); setAdding(false); return; }
    setAppUsers(prev => [...prev.filter(u => u.email !== data.entry.email), data.entry]);
    setNewEmail(""); setNewNote(""); setAdding(false);
  }

  async function changeRole(email: string, role: UserRole) {
    const res = await fetch("/api/admin/whitelist", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json();
    if (data.entry) setAppUsers(prev => prev.map(u => u.email === email ? data.entry : u));
  }

  async function removeUser(email: string) {
    if (!confirm(`Remove ${email}? They will lose access.`)) return;
    await fetch("/api/admin/whitelist", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setAppUsers(prev => prev.filter(u => u.email !== email));
  }

  if (isPending || isAdmin === null) return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
      <div className="w-5 h-5 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
    </div>
  );

  const admins  = appUsers.filter(u => u.role === "ADMIN").length + 1; // +1 for owner
  const members = appUsers.filter(u => u.role === "MEMBER").length;
  const viewers = appUsers.filter(u => u.role === "VIEWER").length;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">

      <PageHeader
        title="Admin Panel"
        subtitle="Access control for the Solomon workspace"
        actions={
          <>
            <span className="hidden sm:inline text-[10px] font-mono text-zinc-600 bg-white/[0.04] px-2 py-1 rounded-full border border-white/[0.06] tracking-wider">
              RESTRICTED
            </span>
            <button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 rounded-lg">
              Sign out
            </button>
          </>
        }
      />

      <div className="fade-up px-4 md:px-8 py-7 max-w-[80rem] mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-7">
          {[
            { label: "Admins",  value: admins,  color: "text-violet-400", glow: "rgba(167,139,250,0.14)" },
            { label: "Members", value: members, color: "text-blue-400",   glow: "rgba(96,165,250,0.14)" },
            { label: "Viewers", value: viewers, color: "text-zinc-300",   glow: "rgba(255,255,255,0.05)" },
          ].map(({ label, value, color, glow }) => (
            <div key={label} className="relative overflow-hidden bg-white/[0.03] backdrop-blur-sm border border-white/[0.07] rounded-2xl p-5 md:p-6">
              <div className="absolute inset-0 pointer-events-none" aria-hidden
                style={{ background: `radial-gradient(circle at 25% 40%, ${glow}, transparent 70%)` }} />
              <p className="label-caps relative">{label}</p>
              <p className={`text-[2rem] font-bold tabular-nums leading-none mt-3 relative ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-white/[0.03] rounded-xl border border-white/[0.06] w-fit mb-5">
          {([
            ["users", `Users (${appUsers.length})`],
            ["registered", `Registered (${neonUsers.length})`],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                tab === t ? "bg-white/[0.09] text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
              }`}>{label}</button>
          ))}
        </div>

        {tab === "users" && (
          <div className="flex flex-col gap-4">
            {/* Role info */}
            <div className="flex gap-3 flex-wrap">
              {(["VIEWER", "MEMBER", "ADMIN"] as UserRole[]).map(r => {
                const m = ROLE_META[r];
                return (
                  <div key={r} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${m.color}`}>
                    <span className="font-semibold">{m.label}</span>
                    <span className="opacity-60">—</span>
                    <span className="opacity-70">{m.desc}</span>
                  </div>
                );
              })}
            </div>

            {/* Add user form */}
            <form onSubmit={addUser} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5">
              <p className="label-caps mb-3">Add user</p>
              <div className="flex gap-3 flex-wrap">
                <input type="email" placeholder="email@example.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} required
                  className="flex-1 min-w-[200px] bg-[#09090b] border border-white/[0.08] focus:border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none" />
                <input type="text" placeholder="Note (optional)" value={newNote} onChange={e => setNewNote(e.target.value)}
                  className="flex-1 min-w-[160px] bg-[#09090b] border border-white/[0.08] focus:border-cyan-500/40 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none" />
                <select value={newRole} onChange={e => setNewRole(e.target.value as UserRole)}
                  className="bg-[#09090b] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-sm text-zinc-300 outline-none">
                  <option value="VIEWER">Viewer</option>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <button type="submit" disabled={adding}
                  className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-500/40 transition-colors disabled:opacity-40 whitespace-nowrap">
                  {adding ? "Adding…" : "+ Add"}
                </button>
              </div>
              {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
            </form>

            {/* User table */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.015]">
                    {["Email", "Note", "Role", "Added", ""].map(h => (
                      <th key={h} scope="col" className="text-left px-5 py-3 label-caps">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appUsers.map(u => {
                    const meta = ROLE_META[u.role];
                    return (
                      <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors">
                        <td className="px-5 py-3.5 text-[13px] font-medium text-zinc-200">{u.email}</td>
                        <td className="px-5 py-3.5 text-[13px] text-zinc-600">{u.note ?? "—"}</td>
                        <td className="px-5 py-3.5">
                          <select
                            value={u.role}
                            onChange={e => changeRole(u.email, e.target.value as UserRole)}
                            className={`text-xs font-semibold px-2.5 py-1 rounded-lg border bg-transparent outline-none cursor-pointer ${meta.color}`}
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-zinc-600">
                          {new Date(u.createdAt).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5">
                          <button onClick={() => removeUser(u.email)}
                            aria-label={`Remove ${u.email}`}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-red-500/20 text-red-500/70 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-colors">
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {appUsers.length === 0 && (
                    <tr><td colSpan={5}>
                      <EmptyState size="sm" icon="🔐" title="No users added yet"
                        description="Add an email above to grant someone access to Solomon." />
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "registered" && (
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
            <p className="text-xs text-zinc-500 leading-relaxed border-b border-white/[0.06] bg-white/[0.015] px-5 py-3">
              Users who have signed in via Google OAuth — they still need an entry in the <span className="text-zinc-300">Users</span> tab to access the app.
            </p>
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["User", "Email"].map(h => (
                    <th key={h} scope="col" className="text-left px-5 py-3 label-caps">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {neonUsers.map(u => (
                  <tr key={u.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.025] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.name} image={u.image} />
                        <span className="text-[13px] font-medium text-zinc-200">{u.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-zinc-500">{u.email}</td>
                  </tr>
                ))}
                {neonUsers.length === 0 && (
                  <tr><td colSpan={2}>
                    <EmptyState size="sm" icon="👤" title="No registered users yet"
                      description="Anyone who signs in with Google will show up here." />
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
