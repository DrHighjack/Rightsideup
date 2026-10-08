"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SMS_CONSENT_DISCLOSURE } from "@/lib/sms-consent";

interface InviteData {
  id: string;
  email: string;
  invitedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("inviteToken") || "";

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    brokerageName: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function validateInvite() {
      if (!inviteToken) {
        return;
      }

      try {
        setInviteLoading(true);
        setError("");
        const res = await fetch(`/api/tc/invite/${inviteToken}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Invalid invite token");
          return;
        }

        setInviteData(data);
        setFormData((prev) => ({
          ...prev,
          email: data.email || prev.email,
        }));
      } catch (_err) {
        setError("Failed to validate invite");
      } finally {
        setInviteLoading(false);
      }
    }

    validateInvite();
  }, [inviteToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError("All required fields must be filled");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone || undefined,
          smsOptIn,
          brokerageName: formData.brokerageName || undefined,
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          inviteToken: inviteToken || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Registration failed");
      }

      const data = await response.json();
      const verificationStatus = data.verificationEmailSent ? 'sent=1' : 'pending=1';
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}&${verificationStatus}`);
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-navy-900 mb-2">SignPost Field</h1>
          <p className="text-slate-600">Create your realtor account</p>
        </div>

        {inviteLoading && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">Validating invitation...</div>
        )}

        {inviteData && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p>
              Invited by {inviteData.invitedByUser.firstName} {inviteData.invitedByUser.lastName}
            </p>
            <p className="mt-1">You will be automatically linked after registration.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
                readOnly={Boolean(inviteToken)}
              className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+12065551234"
              required={smsOptIn}
              pattern={smsOptIn ? "\\+[1-9][0-9]{7,14}" : undefined}
              className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
          </div>

          <fieldset id="sms-consent" className="space-y-2">
            <legend className="text-sm font-semibold text-slate-800">SMS notifications (optional)</legend>
            <div className="flex items-start gap-3">
              <input
                id="smsOptIn"
                name="smsOptIn"
                type="checkbox"
                checked={smsOptIn}
                onChange={(event) => setSmsOptIn(event.target.checked)}
                aria-describedby="sms-disclosure sms-policy-links"
                className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
              <label htmlFor="smsOptIn" className="text-sm font-medium leading-6 text-slate-800">Allow NSSC to text you</label>
            </div>
            <p id="sms-disclosure" className="pl-8 text-sm leading-6 text-slate-700">{SMS_CONSENT_DISCLOSURE}</p>
            <p id="sms-policy-links" className="pl-8 text-sm text-slate-700">
              <Link href="/terms#sms-notifications" className="font-medium text-navy-900 underline">SMS Terms &amp; Conditions</Link>
              {" and "}
              <Link href="/privacy#sms-privacy" className="font-medium text-navy-900 underline">Privacy Policy</Link>.
              {" For help, contact billing@northshoresignco.com or (206) 659-6323."}
            </p>
          </fieldset>

          <div>
            <label htmlFor="brokerageName" className="block text-sm font-medium text-slate-700">
              Brokerage Name
            </label>
            <input
              type="text"
              id="brokerageName"
              name="brokerageName"
              value={formData.brokerageName}
              onChange={handleChange}
              className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
            <p className="mt-1 text-xs text-slate-500">At least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="mt-1 block h-12 w-full rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-lg bg-navy-900 px-4 font-medium text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-navy-900 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-navy-50 px-4 py-8">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600 shadow-sm">
            Loading registration form...
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
