"use client";

import { useSession } from "next-auth/react";
import { Fragment, useState, useEffect } from "react";
import Script from "next/script";
import PageSkeleton from "../../components/PageSkeleton";

declare global {
  interface Window {
    Tokenizer?: new (options: {
      url: string;
      apikey: string;
      container: string;
      submission: (resp: { status?: string; token?: string; message?: string }) => void;
    }) => { submit?: () => void };
  }
}

const fluidPayPublicKey = process.env.NEXT_PUBLIC_FLUIDPAY_PUBLIC_KEY || "";
const fluidPayBaseUrl =
  process.env.NEXT_PUBLIC_FLUIDPAY_BASE_URL || "https://sandbox.fluidpay.com";

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

interface SavedPaymentMethod {
  id: string;
  last4: string | null;
  nickname: string | null;
  createdAt?: string;
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
  const [cardOnFile, setCardOnFile] = useState<boolean | null>(null);
  const [savedCards, setSavedCards] = useState<SavedPaymentMethod[]>([]);
  const [accountCreditAmount, setAccountCreditAmount] = useState(0);
  const [addingPaymentMethod, setAddingPaymentMethod] = useState(false);
  const [paymentScriptLoaded, setPaymentScriptLoaded] = useState(false);
  const [paymentFormReady, setPaymentFormReady] = useState(false);
  const [savingPaymentMethod, setSavingPaymentMethod] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [savingNickname, setSavingNickname] = useState(false);
  const [nicknameError, setNicknameError] = useState("");
  const [paymentTokenizer, setPaymentTokenizer] = useState<{ submit?: () => void } | null>(null);

  // Fetch linked TCs and pending invites
  useEffect(() => {
    if (!session?.user) return;
    
    const user = session.user;
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

  useEffect(() => {
    const role = session?.user?.role;
    if (role !== "REALTOR" && role !== "TC") return;

    const fetchCardOnFile = async () => {
      try {
        const response = await fetch("/api/payments/card-on-file");
        const data = (await response.json()) as {
          hasCard?: boolean;
          cards?: SavedPaymentMethod[];
          accountCreditAmount?: number;
        };
        setCardOnFile(response.ok ? Boolean(data.hasCard) : false);
        setSavedCards(data.cards || []);
        setAccountCreditAmount(data.accountCreditAmount || 0);
      } catch (error) {
        console.error("Failed to check payment method:", error);
        setCardOnFile(false);
      }
    };

    void fetchCardOnFile();
  }, [session?.user]);

  useEffect(() => {
    if (!paymentScriptLoaded || (!addingPaymentMethod && cardOnFile !== false) || !window.Tokenizer) return;

    if (!fluidPayPublicKey) {
      setPaymentError("FluidPay public key is not configured.");
      return;
    }

    const container = document.getElementById("account-payment-form");
    if (!container) return;
    container.replaceChildren();

    try {
      const tokenizer = new window.Tokenizer({
        url: fluidPayBaseUrl,
        apikey: fluidPayPublicKey,
        container: "#account-payment-form",
        submission: async (response) => {
          if (response.status !== "success" || !response.token) {
            setPaymentError(response.message || "Card tokenization failed.");
            setSavingPaymentMethod(false);
            return;
          }

          try {
            const saveResponse = await fetch("/api/payments/save-card", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: response.token }),
            });
            const data = (await saveResponse.json()) as { error?: string; card?: SavedPaymentMethod };
            if (!saveResponse.ok) throw new Error(data.error || "Failed to save payment method");
            setCardOnFile(true);
            if (data.card) setSavedCards((previous) => [...previous, data.card as SavedPaymentMethod]);
            setAddingPaymentMethod(false);
            setPaymentMessage("Payment method saved securely.");
            setPaymentError("");
          } catch (error) {
            setPaymentError(error instanceof Error ? error.message : "Failed to save payment method");
          } finally {
            setSavingPaymentMethod(false);
          }
        },
      });
      setPaymentTokenizer(tokenizer);
      setPaymentFormReady(Boolean(tokenizer.submit));
    } catch (error) {
      console.error("Payment form initialization failed:", error);
      setPaymentError("Failed to initialize payment form.");
    }
  }, [addingPaymentMethod, cardOnFile, paymentScriptLoaded]);

  const handleSavePaymentMethod = () => {
    setPaymentError("");
    setPaymentMessage("");
    if (!paymentTokenizer?.submit) {
      setPaymentError("Payment form is still loading. Please wait a moment.");
      return;
    }
    setSavingPaymentMethod(true);
    paymentTokenizer.submit();
  };

  const handleSaveNickname = async () => {
    setSavingNickname(true);
    setNicknameError("");
    try {
      const response = await fetch("/api/payments/card-on-file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: editingNickname, nickname: nicknameDraft }),
      });
      const data = (await response.json()) as { nickname?: string | null; error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to save card nickname");
      setSavedCards((previous) => previous.map((card) => card.id === editingNickname ? { ...card, nickname: data.nickname || null } : card));
      setNicknameDraft(data.nickname || "");
      setEditingNickname(null);
    } catch (error) {
      setNicknameError(error instanceof Error ? error.message : "Failed to save card nickname");
    } finally {
      setSavingNickname(false);
    }
  };

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
      if (res.ok && data?.emailSent === false) {
        setInviteError(
          data?.warning ||
            "Invite was created but email delivery failed. Share the invite link manually from the pending invite."
        );
      }
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

  const handleSendPasswordReset = async (userEmail?: string) => {
    setPasswordResetMessage("");
    const emailToUse = userEmail || session?.user?.email;
    if (!emailToUse) {
      setPasswordResetMessage("No email found for this account.");
      return;
    }

    try {
      setPasswordResetLoading(true);
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToUse }),
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
    return <PageSkeleton variant="form" />;
  }

  const user = session.user;
  const roleLabel =
    user.accountTitle || (user.role === "TC"
      ? "Transaction Coordinator"
      : user.role === "REALTOR"
      ? "Realtor"
      : user.role === "ADMIN"
      ? "Admin"
      : user.role || "Realtor");
  const businessName = user.brokerageName || "Not set";
  const [firstName = "N/A", ...lastNameParts] = (user.name || "").trim().split(/\s+/);
  const lastName = lastNameParts.join(" ") || "N/A";

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
            <p className="mt-1 text-base font-medium text-slate-900">{firstName}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Last Name</p>
            <p className="mt-1 text-base font-medium text-slate-900">{lastName}</p>
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
          Your card is tokenized securely by FluidPay. North Shore Sign Co does not store your full card number or CVV.
        </p>

        {user.role === "REALTOR" || user.role === "TC" ? (
          <>
            <Script
              src={`${fluidPayBaseUrl}/tokenizer/tokenizer.js`}
              strategy="afterInteractive"
              onLoad={() => setPaymentScriptLoaded(true)}
              onError={() => setPaymentError("Failed to load payment form.")}
            />
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-medium text-green-900">Available account credit</p>
              <p className="mt-1 text-2xl font-bold text-green-700">${accountCreditAmount.toFixed(2)}</p>
            </div>
            {cardOnFile === null ? (
              <p className="text-sm text-slate-600">Checking saved payment method...</p>
            ) : (
              <>
                {(!cardOnFile || addingPaymentMethod) && (
                  <>
                    <div id="account-payment-form" className="min-h-[220px] rounded-lg border border-slate-200 p-3" />
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSavePaymentMethod}
                        disabled={savingPaymentMethod || !paymentFormReady}
                        className="inline-flex h-12 items-center rounded-lg bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {savingPaymentMethod ? "Saving..." : "Save Payment Method"}
                      </button>
                      {paymentError && (
                        <div className="min-w-[16rem] flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
                          <p className="font-semibold text-red-900">Failed to Save Card</p>
                          <p className="mt-1 text-sm text-red-800">{paymentError}</p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {cardOnFile && (
                  <div className="overflow-x-auto rounded-lg border border-slate-200" role="status">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">Saved payment methods</p>
                      {!addingPaymentMethod ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentError("");
                            setAddingPaymentMethod(true);
                          }}
                          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                        >
                          Add another card
                        </button>
                      ) : null}
                    </div>
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Nickname</th>
                          <th className="px-4 py-3 font-semibold">Payment method</th>
                          <th className="px-4 py-3 text-right font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {savedCards.map((card) => (
                          <Fragment key={card.id}>
                            <tr className="border-b border-slate-200 bg-white text-slate-800 last:border-0">
                              <td className="px-4 py-4 font-medium">{card.nickname || "Unnamed card"}</td>
                              <td className="px-4 py-4">{card.last4 ? `Card ending in ${card.last4}` : "Card securely saved"}</td>
                              <td className="px-4 py-4 text-right">
                                {editingNickname !== card.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNicknameDraft(card.nickname || "");
                                      setNicknameError("");
                                      setEditingNickname(card.id);
                                    }}
                                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    {card.nickname ? "Edit nickname" : "Add nickname"}
                                  </button>
                                ) : null}
                              </td>
                            </tr>
                            {editingNickname === card.id ? (
                              <tr key={`${card.id}-editor`} className="border-b border-slate-200 bg-slate-50">
                                <td colSpan={3} className="px-4 py-3">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <input
                                      type="text"
                                      value={nicknameDraft}
                                      onChange={(event) => setNicknameDraft(event.target.value)}
                                      maxLength={60}
                                      placeholder="e.g. Business card"
                                      aria-label="Card nickname"
                                      className="h-10 min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void handleSaveNickname()}
                                      disabled={savingNickname}
                                      className="h-10 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                                    >
                                      {savingNickname ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingNickname(null)}
                                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                  {nicknameError ? <p className="mt-2 text-sm text-red-700">{nicknameError}</p> : null}
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            {/*
            {cardOnFile ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200" role="status">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nickname</th>
                      <th className="px-4 py-3 font-semibold">Payment method</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white text-slate-800">
                      <td className="px-4 py-4 font-medium">{cardNickname || "Unnamed card"}</td>
                      <td className="px-4 py-4">{cardLast4 ? `Card ending in ${cardLast4}` : "Card securely saved"}</td>
                      <td className="px-4 py-4 text-right">
                        {!editingNickname ? (
                          <button
                            type="button"
                            onClick={() => {
                              setNicknameDraft(cardNickname || "");
                              setNicknameError("");
                              setEditingNickname(true);
                            }}
                            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                          >
                            {cardNickname ? "Edit nickname" : "Add nickname"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {editingNickname ? (
                      <tr className="border-t border-slate-200 bg-slate-50">
                        <td colSpan={3} className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={nicknameDraft}
                              onChange={(event) => setNicknameDraft(event.target.value)}
                              maxLength={60}
                              placeholder="e.g. Business card"
                              aria-label="Card nickname"
                              className="h-10 min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveNickname()}
                              disabled={savingNickname}
                              className="h-10 rounded-md bg-navy-900 px-3 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
                            >
                              {savingNickname ? "Saving..." : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNickname(false)}
                              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                          {nicknameError ? <p className="mt-2 text-sm text-red-700">{nicknameError}</p> : null}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : (
              <>
                <div id="account-payment-form" className="min-h-[220px] rounded-lg border border-slate-200 p-3" />
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSavePaymentMethod}
                    disabled={savingPaymentMethod || !paymentFormReady}
                    className="inline-flex h-12 items-center rounded-lg bg-navy-900 px-5 text-sm font-medium text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingPaymentMethod ? "Saving..." : "Save Payment Method"}
                  </button>
                  {paymentError && (
                    <div className="min-w-[16rem] flex-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3" role="alert">
                      <p className="font-semibold text-red-900">Failed to Save Card</p>
                      <p className="mt-1 text-sm text-red-800">{paymentError}</p>
                    </div>
                  )}
                </div>
              </>
            )}
            */}
            {paymentMessage && !cardOnFile && <p className="text-sm text-green-700">{paymentMessage}</p>}
          </>
        ) : (
          <p className="text-sm text-slate-600">Payment methods are managed by the account administrator.</p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 pt-4" aria-label="Accepted payment methods">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-slate-500">We accept</span>
          <span className="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-2.5 text-xs font-extrabold italic tracking-tight text-blue-800">
            VISA
          </span>
          <span className="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-2.5 text-xs font-extrabold tracking-tight text-red-700">
            Mastercard
          </span>
          <span className="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-2.5 text-xs font-extrabold tracking-tight text-blue-600">
            AMEX
          </span>
          <span className="inline-flex h-8 items-center rounded border border-slate-200 bg-white px-2.5 text-xs font-extrabold tracking-tight text-sky-700">
            PayPal
          </span>
        </div>
      </div>

      {/* Change password section */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm sm:p-6 space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">Password</h2>
        <p className="text-sm text-slate-600">
          Send a secure reset link to your email on file.
        </p>
        <button
          type="button"
          onClick={() => {
            void handleSendPasswordReset();
          }}
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
