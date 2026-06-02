'use client';

import { useState, useEffect } from 'react';

interface IdleLogoutWarningProps {
  isVisible: boolean;
  onStayLoggedIn: () => void;
}

export function IdleLogoutWarning({ isVisible, onStayLoggedIn }: IdleLogoutWarningProps) {
  const [timeLeft, setTimeLeft] = useState(5); // 5 minutes remaining

  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 animate-in">
        <div className="flex items-start gap-4">
          <div className="text-yellow-600 text-3xl">⚠️</div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              Your session is about to expire
            </h2>
            <p className="text-gray-600 text-sm mb-4">
              You've been inactive for 25 minutes. For security, you'll be automatically logged out in:
            </p>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-center">
              <div className="text-3xl font-bold text-yellow-700 font-mono">
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
              <p className="text-xs text-yellow-600 mt-1">Time remaining</p>
            </div>

            <button
              onClick={onStayLoggedIn}
              className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Stay Logged In
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Or the page will auto-logout when time expires
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
