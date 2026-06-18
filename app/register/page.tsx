"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters");
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

      router.push("/login");
    } catch (err: any) {
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary mb-2">SignPost Field</h1>
          <p className="text-gray-600">Create your realtor account</p>
        </div>

        {inviteLoading && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">Validating invitation...</div>
        )}

        {inviteData && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900">
            <p>
              Invited by {inviteData.invitedByUser.firstName} {inviteData.invitedByUser.lastName}
            </p>
            <p className="mt-1">You will be automatically linked after registration.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                First Name *
              </label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                Last Name *
              </label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="brokerageName" className="block text-sm font-medium text-gray-700">
              Brokerage Name
            </label>
            <input
              type="text"
              id="brokerageName"
              name="brokerageName"
              value={formData.brokerageName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
            <p className="mt-1 text-xs text-gray-500">At least 8 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password *
            </label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-primary px-4 py-2 text-white font-medium hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:text-primary-dark">
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
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
          <div className="w-full max-w-md rounded-md bg-white p-6 text-center text-sm text-gray-600 shadow-sm">
            Loading registration form...
          </div>
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
