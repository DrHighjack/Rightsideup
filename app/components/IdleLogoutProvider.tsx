'use client';

import { ReactNode, useState } from 'react';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';
import { IdleLogoutWarning } from './IdleLogoutWarning';
import { useSession } from 'next-auth/react';

export function IdleLogoutProvider({ children }: { children: ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const { data: session } = useSession();
  const { stayLoggedIn } = useIdleLogout(() => setShowWarning(true));

  // Only enable idle logout for authenticated users
  if (!session?.user) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <IdleLogoutWarning isVisible={showWarning} onStayLoggedIn={() => {
        stayLoggedIn();
        setShowWarning(false);
      }} />
    </>
  );
}
