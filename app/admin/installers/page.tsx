"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

interface Installer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  assignedJobCount: number;
  isActive: boolean;
}

interface InstallerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

const emptyForm: InstallerForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

export default function AdminInstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<InstallerForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadInstallers = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const response = await fetch("/api/admin/field-techs?includeInactive=true", {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load installers");
      setInstallers(Array.isArray(data) ? data : []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load installers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadInstallers();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    try {
      setSubmitting(true);
      const response = await fetch("/api/admin/field-techs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create installer");

      setForm(emptyForm);
      setShowCreateForm(false);
      setSuccessMessage(
        data.emailWarning
          ? `${data.emailWarning} Temporary password: ${data.temporaryPassword}`
          : "Installer account created and welcome email sent."
      );
      await loadInstallers();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create installer");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccessChange = async (installer: Installer, isActive: boolean) => {
    const action = isActive ? "restore access for" : "remove access for";
    if (!window.confirm(`Are you sure you want to ${action} ${installer.firstName} ${installer.lastName}?`)) {
      return;
    }

    try {
      setUpdatingId(installer.id);
      setLoadError("");
      setSuccessMessage("");
      const response = await fetch(`/api/admin/field-techs/${installer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to update installer");

      setSuccessMessage(isActive ? "Installer access restored." : "Installer access removed.");
      await loadInstallers();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to update installer");
    } finally {
      setUpdatingId(null);
    }
  };

  const activeInstallers = installers.filter((installer) => installer.isActive);
  const inactiveInstallers = installers.filter((installer) => !installer.isActive);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Installer Accounts</h1>
            <p className="mt-2 text-gray-600">Create installer logins and manage access to field jobs.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setFormError("");
              setShowCreateForm((current) => !current);
            }}
            className="h-10 rounded-lg bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700"
          >
            {showCreateForm ? "Cancel" : "Add Installer"}
          </button>
        </div>

        {successMessage ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
            {successMessage}
          </div>
        ) : null}

        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {loadError}
          </div>
        ) : null}

        {showCreateForm ? (
          <form onSubmit={handleCreate} className="border-y border-gray-200 bg-white px-4 py-5 md:px-6">
            <h2 className="text-lg font-semibold text-gray-900">New installer</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                First name
                <input
                  required
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-gray-300 px-3 text-gray-900"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Last name
                <input
                  required
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-gray-300 px-3 text-gray-900"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Email
                <input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-gray-300 px-3 text-gray-900"
                />
              </label>
              <label className="text-sm font-medium text-gray-700">
                Phone <span className="font-normal text-gray-500">(optional)</span>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="mt-1.5 h-10 w-full rounded-md border border-gray-300 px-3 text-gray-900"
                />
              </label>
            </div>
            {formError ? <p className="mt-3 text-sm text-red-700">{formError}</p> : null}
            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="h-10 rounded-md bg-primary-600 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create and Send Welcome Email"}
              </button>
            </div>
          </form>
        ) : null}

        <section className="overflow-hidden border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">Active installers ({activeInstallers.length})</h2>
          </div>
          <InstallerTable
            installers={activeInstallers}
            loading={loading}
            updatingId={updatingId}
            onAccessChange={handleAccessChange}
          />
        </section>

        {inactiveInstallers.length > 0 ? (
          <section className="overflow-hidden border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="font-semibold text-gray-900">Removed installers ({inactiveInstallers.length})</h2>
            </div>
            <InstallerTable
              installers={inactiveInstallers}
              loading={false}
              updatingId={updatingId}
              onAccessChange={handleAccessChange}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function InstallerTable({
  installers,
  loading,
  updatingId,
  onAccessChange,
}: {
  installers: Installer[];
  loading: boolean;
  updatingId: string | null;
  onAccessChange: (installer: Installer, isActive: boolean) => void;
}) {
  if (loading) return <p className="p-6 text-sm text-gray-500">Loading installers...</p>;
  if (installers.length === 0) return <p className="p-6 text-sm text-gray-500">No installers found.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-5 py-3 font-semibold">Installer</th>
            <th className="px-5 py-3 font-semibold">Contact</th>
            <th className="px-5 py-3 text-center font-semibold">Open jobs</th>
            <th className="px-5 py-3 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {installers.map((installer) => (
            <tr key={installer.id}>
              <td className="px-5 py-4 font-medium">
                <Link href={`/admin/installers/${installer.id}`} className="text-primary-700 hover:underline">
                  {installer.firstName} {installer.lastName}
                </Link>
              </td>
              <td className="px-5 py-4 text-gray-600">
                <div>{installer.email}</div>
                {installer.phone ? <div className="mt-1 text-xs text-gray-500">{installer.phone}</div> : null}
              </td>
              <td className="px-5 py-4 text-center text-gray-700">{installer.assignedJobCount}</td>
              <td className="px-5 py-4 text-right">
                <button
                  type="button"
                  disabled={updatingId === installer.id}
                  onClick={() => onAccessChange(installer, !installer.isActive)}
                  className={installer.isActive
                    ? "rounded-md border border-red-300 px-3 py-2 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    : "rounded-md border border-green-300 px-3 py-2 font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"}
                >
                  {updatingId === installer.id ? "Updating..." : installer.isActive ? "Remove Access" : "Restore Access"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}