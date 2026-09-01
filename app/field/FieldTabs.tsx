"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";

export function FieldTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const pairActive = pathname.startsWith("/field/pair-nfc");

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
  }

  const tabClass = (active: boolean) =>
    `flex min-h-[58px] flex-1 items-center justify-center border-t-4 px-2 text-sm font-semibold ${active ? "border-blue-600 text-blue-700" : "border-transparent text-gray-600 active:bg-gray-50"}`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-gray-200 bg-white" aria-label="Installer navigation">
      <Link href="/field/dashboard" className={tabClass(!pairActive)}>Jobs</Link>
      <Link href="/field/pair-nfc" className={tabClass(pairActive)}>Pair NFC</Link>
      <button type="button" onClick={handleSignOut} className={tabClass(false)}>Sign Out</button>
    </nav>
  );
}