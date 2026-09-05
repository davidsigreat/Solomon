"use client";

import { authClient } from "@/lib/auth/client";
import { googleCalendarSignIn } from "@/lib/auth/google";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await authClient.signIn.social(googleCalendarSignIn);
    } catch {
      setError("Sign-in failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center relative overflow-hidden">
      {/* Glow orbs */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full bg-cyan-500/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full bg-violet-500/[0.04] blur-3xl pointer-events-none" />
      <div className="absolute inset-0 opacity-20" style={{
        backgroundImage: "radial-gradient(rgba(6,182,212,0.15) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }} />

      <div className="relative z-10 flex flex-col items-center gap-10">
        {/* Identity */}
        <div className="text-center">
          <p className="text-[10px] font-mono tracking-[0.4em] text-zinc-700 uppercase mb-3">
            Initializing
          </p>
          <div className="flex items-center gap-3 justify-center mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30 border border-white/10 flex items-center justify-center">
              <span className="text-lg font-black text-cyan-300 font-mono">S</span>
            </div>
            <h1 className="text-5xl font-bold tracking-widest text-white font-mono">SOLOMON</h1>
          </div>
          <p className="text-sm text-zinc-600 tracking-widest">Your personal counsel.</p>
        </div>

        {/* Boot lines */}
        <div className="flex flex-col gap-1.5 text-[11px] font-mono w-64">
          {[
            { label: "SYSTEM BOOT",        status: "OK",       c: "text-emerald-400" },
            { label: "DATABASE SYNC",       status: "OK",       c: "text-emerald-400" },
            { label: "NEON AUTH",           status: "READY",    c: "text-emerald-400" },
            { label: "AUTHORIZATION",       status: "REQUIRED", c: "text-cyan-400 animate-pulse" },
          ].map(({ label, status, c }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-zinc-700">› {label}</span>
              <span className={`font-semibold ${c}`}>{status}</span>
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0d1424] border border-white/[0.08] rounded-2xl p-8 w-80 flex flex-col items-center gap-5">
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-200">System Access</p>
            <p className="text-xs text-zinc-600 mt-1">
              Sign in to access your dashboard
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 w-full">
              {error}
            </p>
          )}

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.07] hover:border-cyan-500/30 text-sm font-medium text-zinc-200 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <span className="text-zinc-500">Connecting...</span>
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          <p className="text-[10px] text-zinc-700 text-center leading-relaxed">
            Access is restricted to authorized accounts.<br />
            Contact the admin to request access.
          </p>
        </div>

        <p className="text-[10px] font-mono text-zinc-800 tracking-widest">
          SOLOMON v2.0 · NEON AUTH
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}
