'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';
import { IdleLogoutWarning } from './IdleLogoutWarning';
import { useSession } from 'next-auth/react';

function IdleLogoutActive({ children }: { children: ReactNode }) {
  const [showWarning, setShowWarning] = useState(false);
  const { stayLoggedIn } = useIdleLogout(() => setShowWarning(true));

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

export function IdleLogoutProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Field techs use the app hands-off while physically installing signs —
  // a 30-minute idle logout mid-job would dump their in-progress work, so
  // idle logout is disabled on /field/* routes.
  const isFieldRoute = pathname?.startsWith('/field');

  if (!session?.user || isFieldRoute) {
    return <>{children}</>;
  }

  return <IdleLogoutActive>{children}</IdleLogoutActive>;
}
