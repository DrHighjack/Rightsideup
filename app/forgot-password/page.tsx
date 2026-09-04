"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.error || "Failed to send reset email.");
        return;
      }

      setSubmitted(true);
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your account email and we'll send you a reset link.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            If that email exists, we've sent a reset link. Check your inbox.
            <div className="mt-3">
              <Link className="font-medium underline" href="/login">
                Back to login
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 px-3 text-slate-900 focus:border-slate-500 focus:outline-none"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="h-11 w-full rounded-md bg-slate-900 px-4 font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Sending..." : "Send Reset Link"}
            </button>

            {message && <p className="text-sm text-red-700">{message}</p>}

            <p className="text-center text-sm text-slate-600">
              <Link className="font-medium underline" href="/login">
                Back to login
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
