"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      if (["ADMIN", "SALESMEN"].includes((session.user as any).role)) {
        router.push("/admin");
      } else if ((session.user as any).role === "BROKERAGE") {
        router.push("/brokerage");
      } else {
        router.push("/dashboard");
      }
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

        if (newSession?.user?.role === "ADMIN") {
          router.push("/admin");
        } else if (newSession?.user?.role === "SALESMEN") {
          router.push("/admin");
        } else if (newSession?.user?.role === "BROKERAGE") {
          router.push("/brokerage");
        } else {
          router.push("/dashboard");
        }
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
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
      } else {
        // Fetch the updated session and redirect based on role
        const response = await fetch("/api/auth/session");
        const newSession = await response.json();
        if (!newSession?.user?.emailVerifiedAt) {
          router.push(`/verify-email?email=${encodeURIComponent(newSession?.user?.email || email)}&pending=1`);
          return;
        }
        if (newSession?.user?.role === "ADMIN") {
          router.push("/admin");
        } else if (newSession?.user?.role === "SALESMEN") {
          router.push("/admin");
        } else if (newSession?.user?.role === "BROKERAGE") {
          router.push("/brokerage");
        } else {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">SignPost Field</h1>
          <p className="text-gray-600">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-primary"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-primary"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:text-primary-dark">
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
