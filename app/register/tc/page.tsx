"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface InviteData {
  id: string;
  email: string;
  token: string;
  expiresAt: string;
  invitedByUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

function RegisterTCContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
  });

  // Validate invite token on mount
  useEffect(() => {
    if (!token) {
      setError("Invalid or expired invite");
      setLoading(false);
      return;
    }

    const validateInvite = async () => {
      try {
        const res = await fetch(`/api/tc/invite/${token}`);

        if (!res.ok) {
          if (res.status === 404) {
            setError("Invalid invite token");
          } else if (res.status === 410) {
            setError("This invite has expired or already been used");
          } else {
            setError("Failed to validate invite");
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        setInviteData(data);
        setLoading(false);
      } catch (err) {
        console.error("Error validating invite:", err);
        setError("Failed to validate invite");
        setLoading(false);
      }
    };

    validateInvite();
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and last name are required");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!inviteData?.email) {
      setError("Invalid invite data");
      return;
    }

    setFormLoading(true);

    try {
      const res = await fetch("/api/auth/register-tc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          password: formData.password,
          inviteToken: token,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "Registration failed");
        setFormLoading(false);
        return;
      }

      // Success - redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(inviteData.email)}&sent=1`);
    } catch (err) {
      console.error("Registration error:", err);
      setError("Registration failed. Please try again.");
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 rounded mb-4"></div>
            <div className="h-4 bg-gray-300 rounded mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Invalid Invite</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 font-medium">
            ← Return to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Join SignPost</h1>
        <p className="text-gray-600 text-sm mb-6">
          Complete your TC account registration
        </p>

        {inviteData && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              <strong>Invited by:</strong> {inviteData.invitedByUser.firstName}{" "}
              {inviteData.invitedByUser.lastName}
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <strong>Email:</strong> {inviteData.email}
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="John"
              disabled={formLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Doe"
              disabled={formLoading}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
              disabled={formLoading}
              required
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
              disabled={formLoading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={formLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2 rounded-lg transition-colors mt-6"
          >
            {formLoading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterTCPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <span className="text-gray-600">Loading registration...</span>
        </div>
      </div>
    }>
      <RegisterTCContent />
    </Suspense>
  );
}
