"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

interface TCAgent {
  linkId: string;
  tcId: string;
  firstName: string;
  lastName: string;
  email: string;
  grantedBy: string;
}

interface PendingInvite {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
}

export default function AccountPage() {
  const { data: session } = useSession();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [linkedTCs, setLinkedTCs] = useState<TCAgent[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [tcsLoading, setTcsLoading] = useState(true);
  const [revokeLoading, setRevokeLoading] = useState<string>("");
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetMessage, setPasswordResetMessage] = useState("");
  const [paymentInfo, setPaymentInfo] = useState({
    cardholderName: "",
    cardLast4: "",
    billingZip: "",
  });

  // Fetch linked TCs and pending invites
  useEffect(() => {
    if (!session?.user) return;
    
    const user = session.user as any;
    if (user.role !== "REALTOR" && user.role !== "ADMIN") {
      return;
    }

    const fetchTCs = async () => {
      try {
        // Fetch linked TCs
        const tcsRes = await fetch("/api/tc/linked-tcs");
        if (tcsRes.ok) {
          const data = await tcsRes.json();
          setLinkedTCs(data.linkedTCs || []);
        }

        // Fetch pending invites
        const invitesRes = await fetch("/api/tc/invite");
        if (invitesRes.ok) {
          const data = await invitesRes.json();
          setPendingInvites(data.invites || []);
        }

        setTcsLoading(false);
      } catch (err) {
        console.error("Error fetching TCs:", err);
        setTcsLoading(false);
      }
    };

    fetchTCs();
  }, [session?.user]);

  const handleInviteTC = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");

    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }

    setInviteLoading(true);

    try {
      const res = await fetch("/api/tc/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setInviteError(
          errorData.error || "Failed to send invite"
        );
        setInviteLoading(false);
        return;
      }

      const data = await res.json();
      setPendingInvites([data, ...pendingInvites]);
      setInviteEmail("");
      setInviteLoading(false);
    } catch (err) {
      console.error("Invite error:", err);
      setInviteError("Failed to send invite");
      setInviteLoading(false);
    }
  };

  const handleRevoke = async (linkId: string) => {
    if (!confirm("Are you sure you want to revoke this TC link?")) {
      return;
    }

    setRevokeLoading(linkId);

    try {
      const res = await fetch(`/api/tc/links/${linkId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        alert("Failed to revoke link");
        setRevokeLoading("");
        return;
      }

      setLinkedTCs(linkedTCs.filter((tc) => tc.linkId !== linkId));
      setRevokeLoading("");
    } catch (err) {
      console.error("Revoke error:", err);
      alert("Failed to revoke link");
      setRevokeLoading("");
    }
  };

  const handleSendPasswordReset = async () => {
    setPasswordResetMessage("");
    if (!user?.email) {
      setPasswordResetMessage("No email found for this account.");
      return;
    }

    try {
      setPasswordResetLoading(true);
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordResetMessage(data.error || "Failed to send reset email.");
        return;
      }

      setPasswordResetMessage("Password reset link sent to your email on file.");
    } catch (_err) {
      setPasswordResetMessage("Failed to send reset email.");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  if (!session?.user) {
    return <div className="max-w-2xl mx-auto rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500 shadow-sm">Loading...</div>;
  }

  const user = session.user as any;
  const roleLabel =
    user.role === "TC"
      ? "Transaction Coordinator"
      : user.role === "REALTOR"
      ? "Realtor"
      : user.role === "ADMIN"
      ? "Admin"
      : user.role || "Realtor";
  const businessName = user.brokerageName || "Not set";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">Account Settings</h1>
        <p className="text-slate-600 mt-1">Manage your account information</p>
      </div>

      {/* Account info card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Profile Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">First Name</p>
            <p className="mt-1 text-base font-medium text-slate-900">{user.name?.split(" ")[0] || "N/A"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last Name</p>
            <p className="mt-1 text-base font-medium text-slate-900">{user.name?.split(" ")[1] || "N/A"}</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</p>
          <p className="mt-1 text-base font-medium text-slate-900">
            {user.email} <span className="text-slate-500 font-normal">• {businessName}</span>
          </p>
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</p>
          <p className="mt-1 text-base font-medium text-slate-900">{roleLabel}</p>
        </div>
      </div>

      {/* Payment information section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Payment Information</h2>
        <p className="text-sm text-slate-600">
          Per our policies, payment details are encrypted in transit and at rest. By saving payment
          information, you authorize charges according to your service agreement and posted terms.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Cardholder Name"
            value={paymentInfo.cardholderName}
            onChange={(e) =>
              setPaymentInfo((prev) => ({ ...prev, cardholderName: e.target.value }))
            }
            className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
          <input
            type="text"
            placeholder="Card Last 4"
            value={paymentInfo.cardLast4}
            onChange={(e) =>
              setPaymentInfo((prev) => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, "").slice(0, 4) }))
            }
            className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
          <input
            type="text"
            placeholder="Billing ZIP"
            value={paymentInfo.billingZip}
            onChange={(e) =>
              setPaymentInfo((prev) => ({ ...prev, billingZip: e.target.value }))
            }
            className="h-12 rounded-lg border border-slate-300 px-4 text-base text-slate-900 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
          />
        </div>

        <button
          type="button"
          className="inline-flex h-12 items-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-500 cursor-not-allowed"
          disabled
          title="Payment save flow coming next"
        >
          Save Payment Info (Coming Soon)
        </button>
      </div>

      {/* Change password section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Password</h2>
        <p className="text-sm text-slate-600">
          Send a secure reset link to your email on file.
        </p>
        <button
          type="button"
          onClick={handleSendPasswordReset}
          disabled={passwordResetLoading}
          className="inline-flex h-12 items-center rounded-lg bg-navy-900 px-5 text-sm font-medium text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {passwordResetLoading ? "Sending..." : "Send Password Reset Link"}
        </button>
        {passwordResetMessage && (
          <p className="text-sm text-navy-900">{passwordResetMessage}</p>
        )}
      </div>

      {/* Security note */}
      <div className="rounded-xl border border-navy-100 bg-navy-100/50 p-4">
        <p className="text-sm text-navy-900">
          Your account is secured with bcrypt password hashing. Your password is never stored in plain text.
        </p>
      </div>

      {/* TC Management Section (only for realtors/admins) */}
      {(user.role === "REALTOR" || user.role === "ADMIN") && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Transaction Coordinator Access</h2>

          {/* Invite TC Form */}
          <div className="border-b border-slate-200 pb-6">
            <h3 className="text-sm font-medium text-slate-900 mb-4">Invite a Transaction Coordinator</h3>

            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-800">{inviteError}</p>
              </div>
            )}

            <form onSubmit={handleInviteTC} className="flex flex-col gap-3 sm:flex-row">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="tc@example.com"
                className="h-12 flex-1 rounded-lg border border-slate-300 px-4 text-base text-slate-900 placeholder-slate-400 focus:border-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-900/30"
                disabled={inviteLoading}
                required
              />
              <button
                type="submit"
                disabled={inviteLoading}
                className="inline-flex h-12 items-center justify-center rounded-lg bg-navy-900 px-6 font-medium text-white transition-colors hover:bg-navy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/40 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {inviteLoading ? "Sending..." : "Send Invite"}
              </button>
            </form>
          </div>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="border-b border-slate-200 pb-6">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Pending Invites</h3>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{invite.email}</p>
                      <p className="text-xs text-slate-500 tabular-nums">
                        Expires:{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 font-display text-[11px] font-semibold uppercase tracking-widest text-amber-800">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked TCs */}
          {linkedTCs.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Linked TCs</h3>
              <div className="space-y-2">
                {linkedTCs.map((tc) => (
                  <div
                    key={tc.linkId}
                    className="flex min-h-12 items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {tc.firstName} {tc.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{tc.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(tc.linkId)}
                      disabled={revokeLoading === tc.linkId}
                      className="inline-flex h-12 items-center rounded-lg border border-red-300 bg-white px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {revokeLoading === tc.linkId ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!tcsLoading && pendingInvites.length === 0 && linkedTCs.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">
              No TCs invited yet. Send an invite to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
