'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const sent = searchParams.get('sent') === '1';
  const pending = searchParams.get('pending') === '1';
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

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

        {(sent || pending) && !verified && !error && (
          <div className="rounded-md bg-blue-50 p-4 text-sm text-blue-800">
            {email ? (
              <>
                We sent a verification link to <span className="font-medium">{email}</span>.
              </>
            ) : (
              <>We sent a verification link to your email address.</>
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
