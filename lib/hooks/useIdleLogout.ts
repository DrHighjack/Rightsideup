'use client';

import { useEffect, useRef, useCallback } from 'react';
import { signOut } from 'next-auth/react';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 25 * 60 * 1000; // 25 minutes - show warning at this point

export function useIdleLogout(onWarningShow?: () => void) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timeouts
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    // Set warning timeout (at 25 minutes)
    warningTimeoutRef.current = setTimeout(() => {
      console.log('⚠️  Idle timeout warning: User will be logged out in 5 minutes');
      onWarningShow?.();
    }, WARNING_TIME);

    // Set logout timeout (at 30 minutes)
    timeoutRef.current = setTimeout(() => {
      console.log('🔓 Auto-logging out due to inactivity');
      signOut({ redirect: true, redirectTo: '/login' });
    }, IDLE_TIMEOUT);
  }, [onWarningShow]);

  const stayLoggedIn = useCallback(() => {
    console.log('✓ User stayed logged in, resetting idle timer');
    resetIdleTimer();
  }, [resetIdleTimer]);

  useEffect(() => {
    // Reset timer on initial mount
    resetIdleTimer();

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

    const handleActivity = () => {
      // Only reset if it's been idle for more than 1 second to avoid spam
      if (Date.now() - lastActivityRef.current > 1000) {
        resetIdleTimer();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [resetIdleTimer]);

  return { stayLoggedIn };
}
