"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") {
      return;
    }

    if (!session) {
      router.push("/login");
    } else if ((session.user as any).role === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/dashboard");
    }
  }, [session, status, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-4">SignPost Field</h1>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
