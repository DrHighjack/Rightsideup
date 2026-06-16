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

  if (!session?.user) {
    return <div className="max-w-2xl mx-auto p-6">Loading...</div>;
  }

  const user = session.user as any;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account information</p>
      </div>

      {/* Account info card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Profile Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">First Name</p>
            <p className="text-gray-900 font-medium">{user.name?.split(" ")[0] || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Last Name</p>
            <p className="text-gray-900 font-medium">{user.name?.split(" ")[1] || "N/A"}</p>
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600">Email</p>
          <p className="text-gray-900 font-medium">{user.email}</p>
        </div>

        <div>
          <p className="text-sm text-gray-600">Role</p>
          <p className="text-gray-900 font-medium">{user.role || "REALTOR"}</p>
        </div>
      </div>

      {/* Change password section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Password</h2>
        <p className="text-sm text-gray-600">
          Password management coming soon. For now, please contact support to reset your password.
        </p>
      </div>

      {/* Security note */}
      <div className="bg-primary-light rounded-lg border border-primary p-4">
        <p className="text-sm text-primary-dark">
          Your account is secured with bcrypt password hashing. Your password is never stored in plain text.
        </p>
      </div>

      {/* TC Management Section (only for realtors/admins) */}
      {(user.role === "REALTOR" || user.role === "ADMIN") && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Transaction Coordinator Access</h2>

          {/* Invite TC Form */}
          <div className="border-b border-gray-200 pb-6">
            <h3 className="text-sm font-medium text-gray-900 mb-4">Invite a Transaction Coordinator</h3>

            {inviteError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{inviteError}</p>
              </div>
            )}

            <form onSubmit={handleInviteTC} className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="tc@example.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={inviteLoading}
                required
              />
              <button
                type="submit"
                disabled={inviteLoading}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors"
              >
                {inviteLoading ? "Sending..." : "Send Invite"}
              </button>
            </form>
          </div>

          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Pending Invites</h3>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-amber-900">{invite.email}</p>
                      <p className="text-xs text-amber-700">
                        Expires:{" "}
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-amber-700 bg-amber-100 px-3 py-1 rounded">
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
              <h3 className="text-sm font-medium text-gray-900 mb-3">Linked TCs</h3>
              <div className="space-y-2">
                {linkedTCs.map((tc) => (
                  <div
                    key={tc.linkId}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <p className="text-sm font-medium text-green-900">
                        {tc.firstName} {tc.lastName}
                      </p>
                      <p className="text-xs text-green-700">{tc.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(tc.linkId)}
                      disabled={revokeLoading === tc.linkId}
                      className="text-xs font-medium text-red-600 hover:text-red-800 disabled:text-red-400 transition-colors"
                    >
                      {revokeLoading === tc.linkId ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!tcsLoading && pendingInvites.length === 0 && linkedTCs.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No TCs invited yet. Send an invite to get started.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
