'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function VerifyEmailPageContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const sent = searchParams.get('sent') === '1';
  const pending = searchParams.get('pending') === '1';
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(email);

  async function resendVerification(event: React.FormEvent) {
    event.preventDefault();
    setResending(true);
    setError('');
    setResendMessage('');
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Unable to send verification email. Please try again.');
        return;
      }
      setResendMessage(data.message);
    } catch {
      setError('Unable to send verification email. Please try again.');
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    async function verify() {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Failed to verify email');
          setLoading(false);
          return;
        }

        setVerified(true);
        setLoading(false);
      } catch (_error) {
        setError('Failed to verify email');
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <p className="text-gray-700">Verifying your email...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 shadow-sm space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Verify Email</h1>
          <p className="mt-1 text-sm text-gray-600">Confirm your account before placing orders.</p>
        </div>

        {(sent || pending) && !verified && !error && !resendMessage && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
            {sent && email ? (
              <>
                We sent a verification link to <span className="font-medium">{email}</span>.
              </>
            ) : sent ? (
              <>We sent a verification link to your email address.</>
            ) : (
              <>Your email still needs verification. Request a verification link below.</>
            )}
          </div>
        )}

        {verified && (
          <div className="rounded-md bg-green-50 p-4 text-sm text-green-800">
            Your email has been verified. You can now sign in and place orders.
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {resendMessage && (
          <div role="status" className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
            {resendMessage}
          </div>
        )}

        {!verified && (
          <form onSubmit={resendVerification} className="space-y-3">
            <label htmlFor="verification-email" className="block text-sm font-medium text-gray-700">Email address</label>
            <input
              id="verification-email"
              type="email"
              autoComplete="email"
              required
              value={resendEmail}
              onChange={(event) => setResendEmail(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
            />
            <button type="submit" disabled={resending} className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark disabled:opacity-50">
              {resending ? 'Sending...' : 'Resend verification email'}
            </button>
          </form>
        )}

        <div className="flex gap-3">
          <Link
            href="/login"
            className="flex-1 rounded-md bg-primary px-4 py-2 text-center font-medium text-white hover:bg-primary-dark"
          >
            Go to Login
          </Link>
          <Link
            href="/dashboard"
            className="flex-1 rounded-md border border-gray-300 px-4 py-2 text-center font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-gray-700">Loading verification page...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailPageContent />
    </Suspense>
  );
}
