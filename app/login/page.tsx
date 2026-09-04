"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const getPortalPath = (user: { role?: string; accountTitle?: string | null } | null | undefined) => {
  if (user?.role === "ADMIN" || user?.role === "SALESMEN") return "/admin";
  if (user?.role === "BROKERAGE" && user.accountTitle !== "Accountant") return "/brokerage";
  return "/dashboard";
};

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [impersonationTried, setImpersonationTried] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const impersonationToken = searchParams.get("impersonationToken");

  // If already logged in, redirect to appropriate dashboard
  useEffect(() => {
    if (session?.user) {
      router.push(getPortalPath(session.user));
    }
  }, [session, router]);

  useEffect(() => {
    if (!impersonationToken || session?.user || impersonationTried) return;

    const runImpersonationLogin = async () => {
      setError("");
      setLoading(true);
      setImpersonationTried(true);

      try {
        const result = await signIn("credentials", {
          impersonationToken,
          redirect: false,
        });

        if (result?.error) {
          setError("Unable to use admin login-as-client link.");
          return;
        }

        const response = await fetch("/api/auth/session");
        const newSession = await response.json();

        router.push(getPortalPath(newSession?.user));
      } catch {
        setError("Unable to use admin login-as-client link.");
      } finally {
        setLoading(false);
      }
    };

    void runImpersonationLogin();
  }, [impersonationToken, session, router, impersonationTried]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!requiresTwoFactor) {
        const challengeResponse = await fetch("/api/auth/admin-2fa/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!challengeResponse.ok) {
          setError("Invalid email or password");
          setLoading(false);
          return;
        }

        const challengeData = await challengeResponse.json();
        if (challengeData.requiresTwoFactor) {
          setRequiresTwoFactor(true);
          setError("");
          setLoading(false);
          return;
        }
      }

      const credentialPayload: Record<string, string> = {
        email,
        password,
      };

      if (requiresTwoFactor) {
        if (useBackupCode) {
          if (!backupCode.trim()) {
            setError("Enter a backup code");
            setLoading(false);
            return;
          }
          credentialPayload.backupCode = backupCode.trim();
        } else {
          if (!/^\d{6}$/.test(twoFactorCode.trim())) {
            setError("Enter a valid 6-digit authenticator code");
            setLoading(false);
            return;
          }
          credentialPayload.twoFactorCode = twoFactorCode.trim();
        }
      }

      const result = await signIn("credentials", {
        ...credentialPayload,
        redirect: false,
      });

      if (result?.error) {
        setError(requiresTwoFactor ? "Invalid login or verification code" : "Invalid email or password");
      } else {
        // Fetch the updated session and redirect based on role
        const response = await fetch("/api/auth/session");
        const newSession = await response.json();
        if (!newSession?.user?.emailVerifiedAt) {
          router.push(`/verify-email?email=${encodeURIComponent(newSession?.user?.email || email)}&pending=1`);
          return;
        }
        router.push(getPortalPath(newSession?.user));
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink px-4 overflow-hidden">
      {/* Subtle techy backdrop: grid lines + green glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary-500/15 blur-3xl" />

      <div className="relative w-full max-w-md animate-scale-in">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white mb-2">
            SignPost <span className="text-primary-400">Field</span>
          </h1>
          <p className="text-slate-400">Sign in to your account</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-8 shadow-modal">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3.5 text-sm text-red-700 animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <Link href="/forgot-password" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                placeholder="••••••••"
              />
            </div>

            {requiresTwoFactor && (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  This admin account requires two-factor authentication.
                </div>

                {!useBackupCode ? (
                  <div>
                    <label htmlFor="twoFactorCode" className="block text-sm font-medium text-slate-700">
                      Authenticator Code
                    </label>
                    <input
                      type="text"
                      id="twoFactorCode"
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value)}
                      required={requiresTwoFactor && !useBackupCode}
                      inputMode="numeric"
                      maxLength={6}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="123456"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="backupCode" className="block text-sm font-medium text-slate-700">
                      Backup Code
                    </label>
                    <input
                      type="text"
                      id="backupCode"
                      value={backupCode}
                      onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                      required={requiresTwoFactor && useBackupCode}
                      className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                      placeholder="ABCD-EFGH"
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode((prev) => !prev);
                    setError("");
                  }}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  {useBackupCode ? "Use authenticator code instead" : "Use a backup code instead"}
                </button>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-white font-medium hover:bg-primary-dark active:scale-[0.99] disabled:opacity-50 transition"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-primary-400 hover:text-primary-300">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-gray-50 px-4" />}>
      <LoginPageContent />
    </Suspense>
  );
}
