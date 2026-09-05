"use client";

import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";

const LOGIN_PATH = "/login";
const SIGN_OUT_TIMEOUT_MS = 8_000;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: Props) {
  const { data: session, refetch } = authClient.useSession() as { data: { user: { name: string; email: string; image: string | null } } | null; refetch?: () => void };
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  type ApiKey = { id: string; name: string; keyPrefix: string; revokedAt: string | null; lastUsedAt: string | null; createdAt: string };
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [mintedKey, setMintedKey] = useState<string | null>(null);

  async function loadKeys() {
    const res = await fetch("/api/keys");
    const data = await res.json();
    setApiKeys(data.keys ?? []);
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName.trim() }),
    });
    const data = await res.json();
    setCreatingKey(false);
    if (data.key) {
      setMintedKey(data.key);
      setNewKeyName("");
      loadKeys();
    }
  }

  async function handleRevokeKey(id: string) {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    loadKeys();
  }

  useEffect(() => {
    if (isOpen && session?.user) {
      setName(session.user.name ?? "");
      setImage(session.user.image ?? "");
      setSaved(false);
      setMintedKey(null);
      loadKeys();
    }
  }, [isOpen, session]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!isOpen || !session?.user) return null;

  const user = session.user;
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || user.email[0].toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || undefined, image: image.trim() || undefined }),
    });
    // Also update via authClient if supported
    try {
      await (authClient as unknown as { updateUser: (data: { name?: string; image?: string }) => Promise<void> })
        .updateUser({ name: name.trim() || undefined, image: image.trim() || undefined });
    } catch {}
    setSaving(false);
    setSaved(true);
    refetch?.();
    setTimeout(() => setSaved(false), 2000);
  }

  async function sessionIsCleared() {
    const me = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
    if (me.ok) return false;
    const sessionRes = await fetch("/api/auth/get-session", { credentials: "include", cache: "no-store" });
    const sessionJson = await sessionRes.json().catch(() => null);
    return !sessionJson?.user && !sessionJson?.session;
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    const timeoutId = window.setTimeout(() => setSigningOut(false), SIGN_OUT_TIMEOUT_MS);

    try {
      // Neon docs: auth.signOut() on the server clears session + session_data cookies.
      // authClient.signOut() alone left those cookies live (QA: /api/auth/me still 200).
      const res = await fetch("/api/logout", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("sign out failed");
      const cleared = await sessionIsCleared();
      if (!cleared) throw new Error("session still live");
      window.clearTimeout(timeoutId);
      onClose();
      window.location.replace(LOGIN_PATH);
    } catch {
      window.clearTimeout(timeoutId);
      setSigningOut(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto bg-black/70 backdrop-blur-xl border border-white/[0.1] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-black/70 backdrop-blur-xl">
          <h2 className="text-sm font-semibold text-zinc-100">Profile</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-white/[0.06] transition-all text-lg">×</button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-6 flex flex-col gap-5">
          {/* Avatar preview */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/[0.08] flex-shrink-0">
              {image ? (
                <img src={image} alt="avatar" className="w-full h-full object-cover"
                  onError={() => setImage("")} />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-cyan-500/40 to-violet-500/40 flex items-center justify-center text-xl font-bold text-white">
                  {initials}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{name || user.email}</p>
              <p className="text-xs text-zinc-600 mt-0.5">{user.email}</p>
              <p className="text-[10px] text-zinc-700 mt-1">Member</p>
            </div>
          </div>

          {/* Display name */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 outline-none transition-colors"
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Avatar URL</label>
            <input type="url" value={image} onChange={e => setImage(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3.5 py-2.5 text-sm text-zinc-300 placeholder-zinc-700 outline-none transition-colors"
            />
            <p className="text-[10px] text-zinc-700 mt-1">Paste any image URL. Leave blank to use initials.</p>
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Email</label>
            <div className="w-full bg-white/[0.02] border border-white/[0.05] rounded-xl px-3.5 py-2.5 text-sm text-zinc-600 select-all">
              {user.email}
            </div>
          </div>

          {/* API keys — for connecting outside applications to this app's API */}
          <div className="pt-1 border-t border-white/[0.06]">
            <label className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider block mt-4 mb-1.5">API Keys</label>
            <p className="text-[10px] text-zinc-700 mb-2.5">
              Use a key as a <code className="text-zinc-500">Bearer</code> token against <code className="text-zinc-500">/api/v1/*</code> to connect external apps to your projects and tasks.
            </p>

            {mintedKey && (
              <div className="mb-2.5 p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06]">
                <p className="text-[10px] text-emerald-400 mb-1">Copy this now — it won&apos;t be shown again:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[11px] text-zinc-200 break-all select-all">{mintedKey}</code>
                  <button type="button" onClick={() => navigator.clipboard.writeText(mintedKey)}
                    className="shrink-0 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg px-2 py-1 transition-colors">
                    Copy
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-2.5">
              {apiKeys.filter(k => !k.revokedAt).map(k => (
                <div key={k.id} className="flex items-center justify-between gap-2 bg-white/[0.02] border border-white/[0.05] rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-300 truncate">{k.name}</p>
                    <p className="text-[10px] text-zinc-700">{k.keyPrefix}… · {k.lastUsedAt ? `used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}</p>
                  </div>
                  <button type="button" onClick={() => handleRevokeKey(k.id)}
                    className="shrink-0 text-[10px] text-red-500 hover:text-red-400 transition-colors">
                    Revoke
                  </button>
                </div>
              ))}
              {apiKeys.filter(k => !k.revokedAt).length === 0 && (
                <p className="text-[10px] text-zinc-700">No active keys.</p>
              )}
            </div>

            <div className="flex gap-2">
              <input type="text" value={newKeyName} onChange={e => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Zapier)"
                className="flex-1 bg-[#111116] border border-white/[0.07] focus:border-cyan-500/30 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-700 outline-none transition-colors"
              />
              <button type="button" disabled={creatingKey || !newKeyName.trim()} onClick={handleCreateKey}
                className="shrink-0 px-3 py-2 text-xs font-semibold text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-40">
                {creatingKey ? "Creating…" : "Create key"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              disabled={signingOut}
              onClick={handleSignOut}
              className="px-4 py-2 text-sm text-red-500 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl transition-all disabled:opacity-40"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onClose}
                className="px-4 py-2 text-sm text-zinc-500 hover:text-zinc-200 border border-white/[0.07] rounded-xl hover:border-white/[0.15] transition-all">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className={`px-5 py-2 text-sm font-semibold rounded-xl border transition-all ${
                  saved
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                    : "text-cyan-400 bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20"
                } disabled:opacity-40`}>
                {saved ? "Saved ✓" : saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
