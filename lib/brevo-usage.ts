type BrevoPlan = {
  credits?: number;
  creditsType?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
};

type BrevoAccount = {
  plan?: BrevoPlan[];
};

type BrevoReport = {
  requests?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  blocked?: number;
  invalid?: number;
  spamReports?: number;
};

function pacificDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getBrevoJson<T>(path: string): Promise<T> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

  const response = await fetch(`https://api.brevo.com/v3${path}`, {
    headers: { accept: "application/json", "api-key": apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Brevo API returned ${response.status} for ${path}`);
  return response.json() as Promise<T>;
}

export async function sendBrevoUsageReport() {
  const date = pacificDate();
  const [account, report] = await Promise.all([
    getBrevoJson<BrevoAccount>("/account"),
    getBrevoJson<BrevoReport>(`/smtp/statistics/aggregatedReport?startDate=${date}&endDate=${date}`),
  ]);
  const emailPlans = (account.plan || []).filter(
    (plan) => plan.creditsType === "sendLimit" && plan.type !== "sms"
  );
  const creditsRemaining = emailPlans.reduce((total, plan) => total + Number(plan.credits || 0), 0);
  const requests = Number(report.requests || 0);
  const delivered = Number(report.delivered || 0);
  const failed = Number(report.hardBounces || 0) + Number(report.softBounces || 0) +
    Number(report.blocked || 0) + Number(report.invalid || 0);
  const webhookUrl = process.env.BREVO_USAGE_WEBHOOK_URL ||
    process.env.DISCORD_ACTIVITY_WEBHOOK_URL ||
    process.env.DISCORD_ORDER_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("No Brevo usage or Discord webhook is configured");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(5000),
    body: JSON.stringify({
      username: "North Shore Email Monitor",
      allowed_mentions: { parse: [] },
      embeds: [{
        title: "Brevo Daily Email Usage",
        description: `Usage for ${date} (Pacific Time)`,
        color: creditsRemaining <= 25 ? 0xdc2626 : creditsRemaining <= 75 ? 0xf59e0b : 0x047857,
        fields: [
          { name: "Requested Today", value: requests.toLocaleString(), inline: true },
          { name: "Delivered", value: delivered.toLocaleString(), inline: true },
          { name: "Credits Remaining", value: creditsRemaining.toLocaleString(), inline: true },
          { name: "Failed / Blocked", value: failed.toLocaleString(), inline: true },
          { name: "Spam Reports", value: Number(report.spamReports || 0).toLocaleString(), inline: true },
          { name: "Plan", value: emailPlans.map((plan) => plan.type || "unknown").join(", ") || "Unknown", inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!response.ok) throw new Error(`Brevo usage webhook returned ${response.status}`);

  return { date, requests, delivered, creditsRemaining, failed };
}