export async function sendAdminPasswordReset(email: string) {
  const response = await fetch("/api/auth/password-reset", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to send password reset email");
  }

  return data;
}