import { redirect } from "next/navigation";

interface LegacyResetPasswordPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default function LegacyResetPasswordPage({
  searchParams,
}: LegacyResetPasswordPageProps) {
  const params = new URLSearchParams();

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (Array.isArray(value)) {
        for (const entry of value) {
          params.append(key, entry);
        }
      } else if (typeof value === "string") {
        params.set(key, value);
      }
    }
  }

  const query = params.toString();
  redirect(query ? `/reset-password?${query}` : "/reset-password");
}
