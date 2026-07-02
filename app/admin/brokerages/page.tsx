"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { sendAdminPasswordReset } from "@/lib/admin-password-reset";

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  brokerageId?: string | null;
  brokerageName?: string;
  paymentMethod: string;
  freeInstallGivenBy?: string;
}

interface Closer {
  id: string;
  firstName: string;
  lastName: string;
  role: "ADMIN" | "SALESMEN";
}

interface Brokerage {
  id: string;
  name: string;
  address?: string;
  billingType: "AGENT" | "BROKERAGE";
  basePriceCents?: number | null;
  isActive: boolean;
  agentCount: number;
  email?: string;
  phone?: string;
  brokerageOwner?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

interface TC {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string | null;
  agentCount: number;
  linkedAgentCount?: number;
  isActive?: boolean;
  agents: Array<{
    linkId: string;
    agentId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  }>;
  createdAt: string;
}

interface UserSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: string;
}

interface RealtorSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface LinkFormState {
  selectedTcId: string | null;
  selectedAgentId: string | null;
  tcSearchQuery: string;
  agentSearchQuery: string;
  tcSearchResults: UserSearchResult[];
  agentSearchResults: UserSearchResult[];
}

type SortKey = "name" | "email" | "brokerage" | "phone";
type SortOrder = "asc" | "desc";

export default function ManagementPage() {
  const { status } = useSession();
  const router = useRouter();
  const [view, setView] = useState<"clients" | "brokerages" | "tcs">("clients");
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tcs, setTcs] = useState<TC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [closers, setClosers] = useState<Closer[]>([]);
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [addingClient, setAddingClient] = useState(false);
  const [addClientError, setAddClientError] = useState("");
  const [agentUpdatingId, setAgentUpdatingId] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({
    firstName: "",
    lastName: "",
    email: "",
    brokerageId: "",
    phone: "",
    brokerageName: "",
    paymentMethod: "OFFICE" as "OFFICE" | "SELF",
    closedByUserId: "",
    password: "",
  });
  const [brokerageSearchQuery, setBrokerageSearchQuery] = useState("");
  const [showBrokerageDropdown, setShowBrokerageDropdown] = useState(false);
  const [showAttachRealtorModal, setShowAttachRealtorModal] = useState(false);
  const [attachBrokerage, setAttachBrokerage] = useState<{ id: string; name: string } | null>(null);
  const [attachRealtorQuery, setAttachRealtorQuery] = useState("");
  const [attachRealtorResults, setAttachRealtorResults] = useState<RealtorSearchResult[]>([]);
  const [selectedAttachRealtorId, setSelectedAttachRealtorId] = useState("");
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const [attachError, setAttachError] = useState("");
  
  // TC Management State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkForm, setLinkForm] = useState<LinkFormState>({
    selectedTcId: null,
    selectedAgentId: null,
    tcSearchQuery: "",
    agentSearchQuery: "",
    tcSearchResults: [],
    agentSearchResults: [],
  });
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [showTcModal, setShowTcModal] = useState(false);
  const [editingTcId, setEditingTcId] = useState<string | null>(null);
  const [tcSubmitting, setTcSubmitting] = useState(false);
  const [tcError, setTcError] = useState("");
  const [showTcPasswordModal, setShowTcPasswordModal] = useState(false);
  const [newTcPassword, setNewTcPassword] = useState("");
  const [newTcName, setNewTcName] = useState("");
  const [tcForm, setTcForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [showBrokerageModal, setShowBrokerageModal] = useState(false);
  const [editingBrokerageId, setEditingBrokerageId] = useState<string | null>(null);
  const [brokerageSubmitting, setBrokerageSubmitting] = useState(false);
  const [brokerageError, setBrokerageError] = useState("");
  const [brokerageForm, setBrokerageForm] = useState({
    name: "",
    address: "",
    phone: "",
    email: "",
    billingType: "AGENT" as "AGENT" | "BROKERAGE",
    basePrice: "",
    createOwnerAccount: true,
    ownerFirstName: "",
    ownerLastName: "",
    ownerEmail: "",
    ownerPassword: "",
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchBrokerages = async () => {
    const brokeragesRes = await fetch("/api/admin/brokerages");
    if (!brokeragesRes.ok) throw new Error("Failed to fetch brokerages");
    const brokeragesData = await brokeragesRes.json();
    setBrokerages(brokeragesData.brokerages || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      const [agentsResult, tcsResult, closersResult, brokeragesResult] =
        await Promise.allSettled([
          fetch("/api/admin/users"),
          fetch("/api/admin/tcs"),
          fetch("/api/admin/users?role=ADMIN,SALESMEN&limit=200"),
          fetch("/api/admin/brokerages"),
        ]);

      // Clients are the core data for this page; keep other failures non-fatal.
      if (agentsResult.status === "fulfilled" && agentsResult.value.ok) {
        const agentsData = await agentsResult.value.json();
        setAgents(agentsData.users || []);
      } else {
        setAgents([]);
        setError("Failed to load clients");
      }

      if (tcsResult.status === "fulfilled" && tcsResult.value.ok) {
        const tcsData = await tcsResult.value.json();
        setTcs(tcsData.tcs || []);
      } else {
        setTcs([]);
      }

      if (closersResult.status === "fulfilled" && closersResult.value.ok) {
        const closersData = await closersResult.value.json();
        setClosers(closersData.users || []);
      } else {
        setClosers([]);
      }

      if (brokeragesResult.status === "fulfilled" && brokeragesResult.value.ok) {
        const brokeragesData = await brokeragesResult.value.json();
        setBrokerages(brokeragesData.brokerages || []);
      } else {
        setBrokerages([]);
      }

      setLoading(false);
    };

    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

  const resetBrokerageModal = () => {
    setEditingBrokerageId(null);
    setBrokerageError("");
    setBrokerageForm({
      name: "",
      address: "",
      phone: "",
      email: "",
      billingType: "AGENT",
      basePrice: "",
      createOwnerAccount: true,
      ownerFirstName: "",
      ownerLastName: "",
      ownerEmail: "",
      ownerPassword: "",
    });
  };

  const openCreateBrokerageModal = () => {
    resetBrokerageModal();
    setShowBrokerageModal(true);
  };

  const openEditBrokerageModal = (brokerage: Brokerage) => {
    setEditingBrokerageId(brokerage.id);
    setBrokerageError("");
    setBrokerageForm({
      name: brokerage.name || "",
      address: brokerage.address || "",
      phone: brokerage.phone || "",
      email: brokerage.email || "",
      billingType: brokerage.billingType,
      basePrice:
        brokerage.basePriceCents !== null && brokerage.basePriceCents !== undefined
          ? (brokerage.basePriceCents / 100).toString()
          : "",
      createOwnerAccount: false,
      ownerFirstName: "",
      ownerLastName: "",
      ownerEmail: "",
      ownerPassword: "",
    });
    setShowBrokerageModal(true);
  };

  const handleSaveBrokerage = async () => {
    setBrokerageError("");

    if (!brokerageForm.name.trim()) {
      setBrokerageError("Brokerage name is required");
      return;
    }

    let basePriceDollars: number | null = null;
    if (brokerageForm.basePrice.trim()) {
      const parsed = Number(brokerageForm.basePrice);
      if (Number.isNaN(parsed) || parsed < 0) {
        setBrokerageError("Base price must be a valid positive dollar amount");
        return;
      }
      basePriceDollars = parsed;
    }

    if (!editingBrokerageId && brokerageForm.createOwnerAccount) {
      if (
        !brokerageForm.ownerFirstName.trim() ||
        !brokerageForm.ownerLastName.trim() ||
        !brokerageForm.ownerEmail.trim() ||
        !brokerageForm.ownerPassword.trim()
      ) {
        setBrokerageError("Brokerage owner first name, last name, email, and password are required");
        return;
      }

      if (brokerageForm.ownerPassword.trim().length < 6) {
        setBrokerageError("Brokerage owner password must be at least 6 characters");
        return;
      }
    }

    try {
      setBrokerageSubmitting(true);

      const payload = {
        name: brokerageForm.name.trim(),
        address: brokerageForm.address.trim() || undefined,
        phone: brokerageForm.phone.trim() || undefined,
        email: brokerageForm.email.trim() || undefined,
        billingType: brokerageForm.billingType,
        basePriceDollars,
        brokerageAccount:
          !editingBrokerageId && brokerageForm.createOwnerAccount
            ? {
                firstName: brokerageForm.ownerFirstName.trim(),
                lastName: brokerageForm.ownerLastName.trim(),
                email: brokerageForm.ownerEmail.trim().toLowerCase(),
                password: brokerageForm.ownerPassword,
              }
            : undefined,
      };

      const endpoint = editingBrokerageId
        ? `/api/admin/brokerages/${editingBrokerageId}`
        : "/api/admin/brokerages";
      const method = editingBrokerageId ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setBrokerageError(data.error || "Failed to save brokerage");
        return;
      }

      await fetchBrokerages();
      setShowBrokerageModal(false);
      resetBrokerageModal();
    } catch (err) {
      setBrokerageError("Failed to save brokerage");
    } finally {
      setBrokerageSubmitting(false);
    }
  };

  const handleDeactivateBrokerage = async (brokerage: Brokerage) => {
    if (!confirm(`Deactivate ${brokerage.name}?`)) return;

    try {
      const res = await fetch(`/api/admin/brokerages/${brokerage.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to deactivate brokerage");
        return;
      }

      await fetchBrokerages();
    } catch (err) {
      alert("Failed to deactivate brokerage");
    }
  };

  const handleSendPasswordReset = async (email?: string) => {
    if (!email) return;
    if (!confirm(`Send a password reset email to ${email}?`)) return;

    try {
      await sendAdminPasswordReset(email);
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to send password reset email");
      console.error(error);
    }
  };

  const handleQuickUpdateAgent = async (
    agentId: string,
    updates: { paymentMethod?: "OFFICE" | "SELF"; closedByUserId?: string | null }
  ) => {
    try {
      setAgentUpdatingId(agentId);
      setError("");

      const res = await fetch(`/api/admin/users/${agentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update client");
        return;
      }

      setAgents((prev) =>
        prev.map((agent) =>
          agent.id === agentId
            ? {
                ...agent,
                paymentMethod: data.user.paymentMethod,
                freeInstallGivenBy: data.user.freeInstallGivenBy || undefined,
              }
            : agent
        )
      );
    } catch (_err) {
      setError("Failed to update client");
    } finally {
      setAgentUpdatingId(null);
    }
  };

  // Filter and sort agents based on search and sort settings
  const filteredAgents = agents
    .filter((agent) => {
      const searchLower = search.toLowerCase();
      return (
        agent.firstName.toLowerCase().includes(searchLower) ||
        agent.lastName.toLowerCase().includes(searchLower) ||
        agent.email.toLowerCase().includes(searchLower) ||
        (agent.phone && agent.phone.toLowerCase().includes(searchLower)) ||
        (agent.brokerageName && agent.brokerageName.toLowerCase().includes(searchLower))
      );
    })
    .sort((a, b) => {
      let aVal: string = "";
      let bVal: string = "";

      if (sortKey === "name") {
        aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
        bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
      } else if (sortKey === "email") {
        aVal = a.email.toLowerCase();
        bVal = b.email.toLowerCase();
      } else if (sortKey === "phone") {
        aVal = (a.phone || "").toLowerCase();
        bVal = (b.phone || "").toLowerCase();
      } else if (sortKey === "brokerage") {
        aVal = (a.brokerageName || "").toLowerCase();
        bVal = (b.brokerageName || "").toLowerCase();
      }

      if (sortOrder === "asc") {
        return aVal.localeCompare(bVal);
      } else {
        return bVal.localeCompare(aVal);
      }
    });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const SortIcon = ({ active, order }: { active: boolean; order: SortOrder }) => {
    if (!active) return <span className="text-gray-300">↕</span>;
    return <span>{order === "asc" ? "↑" : "↓"}</span>;
  };

  const handleCreateClient = async () => {
    setAddClientError("");

    if (
      !newClient.firstName.trim() ||
      !newClient.lastName.trim() ||
      !newClient.email.trim() ||
      !newClient.closedByUserId
    ) {
      setAddClientError("First name, last name, email, and Closed By are required");
      return;
    }

    try {
      setAddingClient(true);

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddClientError(data.error || "Failed to create realtor");
        return;
      }

      const refreshAgentsRes = await fetch("/api/admin/users");
      if (refreshAgentsRes.ok) {
        const refreshed = await refreshAgentsRes.json();
        setAgents(refreshed.users || []);
      }

      alert(
        `Realtor created successfully. Temporary password: ${data.tempPassword}`
      );

      setNewClient({
        firstName: "",
        lastName: "",
        email: "",
        brokerageId: "",
        phone: "",
        brokerageName: "",
        paymentMethod: "OFFICE",
        closedByUserId: "",
        password: "",
      });
      setBrokerageSearchQuery("");
      setShowBrokerageDropdown(false);
      setShowAddClientModal(false);
    } catch (err) {
      console.error(err);
      setAddClientError("Failed to create realtor");
    } finally {
      setAddingClient(false);
    }
  };

  const openAttachRealtorModal = (brokerage: Brokerage) => {
    setAttachBrokerage({ id: brokerage.id, name: brokerage.name });
    setAttachRealtorQuery("");
    setAttachRealtorResults([]);
    setSelectedAttachRealtorId("");
    setAttachError("");
    setShowAttachRealtorModal(true);
  };

  const handleAttachRealtor = async () => {
    if (!attachBrokerage?.id || !selectedAttachRealtorId) {
      setAttachError("Select a realtor to add");
      return;
    }

    try {
      setAttachSubmitting(true);
      setAttachError("");

      const res = await fetch(`/api/admin/brokerages/${attachBrokerage.id}/agents/attach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ realtorId: selectedAttachRealtorId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAttachError(data.error || "Failed to add realtor to brokerage");
        return;
      }

      await Promise.all([fetchBrokerages(), fetch("/api/admin/users").then(async (r) => {
        if (r.ok) {
          const refreshed = await r.json();
          setAgents(refreshed.users || []);
        }
      })]);

      setShowAttachRealtorModal(false);
      setAttachBrokerage(null);
    } catch (_err) {
      setAttachError("Failed to add realtor to brokerage");
    } finally {
      setAttachSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showAttachRealtorModal || attachRealtorQuery.trim().length < 2) {
      setAttachRealtorResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/users/search?query=${encodeURIComponent(attachRealtorQuery.trim())}&role=REALTOR`
        );

        if (!res.ok) {
          setAttachRealtorResults([]);
          return;
        }

        const data = await res.json();
        setAttachRealtorResults(data.users || []);
      } catch {
        setAttachRealtorResults([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [attachRealtorQuery, showAttachRealtorModal]);

  // TC Management Functions
  const fetchTCs = async () => {
    try {
      const res = await fetch("/api/admin/tcs");
      if (res.ok) {
        const data = await res.json();
        setTcs(data.tcs || []);
      }
    } catch (err) {
      console.error("Error fetching TCs:", err);
    }
  };

  const resetTcForm = () => {
    setEditingTcId(null);
    setTcError("");
    setTcForm({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      password: "",
    });
  };

  const openCreateTcModal = () => {
    resetTcForm();
    setShowTcModal(true);
  };

  const openEditTcModal = (tc: TC) => {
    setEditingTcId(tc.id);
    setTcError("");
    setTcForm({
      firstName: tc.firstName || "",
      lastName: tc.lastName || "",
      email: tc.email,
      phone: tc.phone || "",
      password: "",
    });
    setShowTcModal(true);
  };

  const handleSaveTc = async () => {
    setTcError("");

    if (!tcForm.firstName.trim() || !tcForm.lastName.trim()) {
      setTcError("First Name and Last Name are required");
      return;
    }

    if (!editingTcId && !tcForm.email.trim()) {
      setTcError("Email is required");
      return;
    }

    try {
      setTcSubmitting(true);

      if (editingTcId) {
        const res = await fetch(`/api/admin/tcs/${editingTcId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: tcForm.firstName.trim(),
            lastName: tcForm.lastName.trim(),
            phone: tcForm.phone.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setTcError(data.error || "Failed to update TC");
          return;
        }

        await fetchTCs();
        setShowTcModal(false);
        resetTcForm();
      } else {
        const res = await fetch("/api/admin/tcs/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: tcForm.firstName.trim(),
            lastName: tcForm.lastName.trim(),
            email: tcForm.email.trim(),
            phone: tcForm.phone.trim() || undefined,
            password: tcForm.password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setTcError(data.error || "Failed to create TC");
          return;
        }

        await fetchTCs();
        setShowTcModal(false);
        setNewTcPassword(data.generatedPassword || "");
        setNewTcName(`${tcForm.firstName.trim()} ${tcForm.lastName.trim()}`);
        setShowTcPasswordModal(true);
        resetTcForm();
      }
    } catch (err) {
      setTcError(editingTcId ? "Failed to update TC" : "Failed to create TC");
    } finally {
      setTcSubmitting(false);
    }
  };

  const handleDeactivateTc = async (tc: TC) => {
    const fullName = `${tc.firstName || ""} ${tc.lastName || ""}`.trim();
    const confirmed = confirm(
      `Deactivate ${fullName}? They will no longer be able to log in.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/admin/tcs/${tc.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to deactivate TC");
        return;
      }

      await fetchTCs();
    } catch (err) {
      alert("Failed to deactivate TC");
    }
  };

  const searchTCUsers = async (query: string) => {
    if (query.length < 2) {
      setLinkForm((prev) => ({ ...prev, tcSearchQuery: query, tcSearchResults: [] }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}&role=TC`);
      if (res.ok) {
        const data = await res.json();
        setLinkForm((prev) => ({
          ...prev,
          tcSearchQuery: query,
          tcSearchResults: data.users || [],
        }));
      }
    } catch (err) {
      console.error("Error searching TCs:", err);
    }
  };

  const searchAgentUsers = async (query: string) => {
    if (query.length < 2) {
      setLinkForm((prev) => ({ ...prev, agentSearchQuery: query, agentSearchResults: [] }));
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/search?query=${encodeURIComponent(query)}&role=REALTOR`);
      if (res.ok) {
        const data = await res.json();
        setLinkForm((prev) => ({
          ...prev,
          agentSearchQuery: query,
          agentSearchResults: data.users || [],
        }));
      }
    } catch (err) {
      console.error("Error searching agents:", err);
    }
  };

  const handleLinkSubmit = async () => {
    if (!linkForm.selectedTcId || !linkForm.selectedAgentId) {
      setLinkError("Please select both a TC and an agent");
      return;
    }

    try {
      setLinkSubmitting(true);
      setLinkError("");

      const res = await fetch("/api/admin/tcs/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tcUserId: linkForm.selectedTcId,
          agentUserId: linkForm.selectedAgentId,
        }),
      });

      if (res.ok) {
        alert("Link created successfully!");
        setShowLinkModal(false);
        setLinkForm({
          selectedTcId: null,
          selectedAgentId: null,
          tcSearchQuery: "",
          agentSearchQuery: "",
          tcSearchResults: [],
          agentSearchResults: [],
        });
        await fetchTCs();
      } else {
        const error = await res.json();
        setLinkError(error.error || "Failed to create link");
      }
    } catch (err) {
      setLinkError("Failed to create link");
      console.error(err);
    } finally {
      setLinkSubmitting(false);
    }
  };

  const formatDate = (date: string) => {
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return "—";
    }
  };

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Management</h1>
          <p className="text-gray-600 mt-2">Manage clients, brokerages, TC groups, and TC accounts</p>
        </div>

        {/* View Toggle */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={() => setView("clients")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === "clients"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All Clients
          </button>
          <button
            onClick={() => setView("brokerages")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === "brokerages"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            Brokerages & TC Groups
          </button>
          <button
            onClick={() => setView("tcs")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === "tcs"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            TC Accounts
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Brokerages View */}
        {view === "brokerages" && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Brokerages</h2>
                <p className="text-sm text-gray-600 mt-1">Create and manage brokerage billing rules</p>
              </div>
              <button
                onClick={openCreateBrokerageModal}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
              >
                + Add Brokerage
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Name</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Address</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Phone</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Brokerage Login</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Billing Type</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Base Price</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Agent Count</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {brokerages.map((brokerage) => (
                    <tr key={brokerage.id} className={!brokerage.isActive ? "bg-gray-50" : "hover:bg-gray-50"}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {brokerage.name}
                        {!brokerage.isActive && (
                          <span className="ml-2 inline-block text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{brokerage.address || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{brokerage.phone || "—"}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {brokerage.brokerageOwner?.email || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                            brokerage.billingType === "BROKERAGE"
                              ? "bg-indigo-100 text-indigo-800"
                              : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {brokerage.billingType}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {brokerage.basePriceCents == null
                          ? "Standard"
                          : `$${(brokerage.basePriceCents / 100).toFixed(2)}`}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{brokerage.agentCount}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-4">
                          <button
                            onClick={() => openEditBrokerageModal(brokerage)}
                            className="text-green-700 hover:text-green-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openAttachRealtorModal(brokerage)}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Add Existing Realtor
                          </button>
                          <button
                            onClick={() =>
                              handleSendPasswordReset(
                                brokerage.brokerageOwner?.email || brokerage.email
                              )
                            }
                            className="text-indigo-600 hover:text-indigo-700 font-medium"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDeactivateBrokerage(brokerage)}
                            disabled={!brokerage.isActive}
                            className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {brokerages.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600">No brokerages found</p>
                </div>
              )}
            </div>

            {showBrokerageModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-xl w-full p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {editingBrokerageId ? "Edit Brokerage" : "Add Brokerage"}
                  </h3>

                  <div className="space-y-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Brokerage Name</label>
                      <input
                        type="text"
                        value={brokerageForm.name}
                        onChange={(e) => setBrokerageForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Brokerage Name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Address</label>
                      <input
                        type="text"
                        value={brokerageForm.address}
                        onChange={(e) =>
                          setBrokerageForm((prev) => ({ ...prev, address: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Address"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Phone</label>
                      <input
                        type="text"
                        value={brokerageForm.phone}
                        onChange={(e) =>
                          setBrokerageForm((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Phone"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Brokerage Contact Email</label>
                      <input
                        type="email"
                        value={brokerageForm.email}
                        onChange={(e) =>
                          setBrokerageForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="billing@brokerage.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">Who Pays?</label>
                      <div className="space-y-2">
                        <label className="flex items-start gap-2 text-sm text-gray-700">
                          <input
                            type="radio"
                            name="billingType"
                            checked={brokerageForm.billingType === "AGENT"}
                            onChange={() =>
                              setBrokerageForm((prev) => ({ ...prev, billingType: "AGENT" }))
                            }
                            className="mt-0.5"
                          />
                          Agent pays their own invoices
                        </label>
                        <label className="flex items-start gap-2 text-sm text-gray-700">
                          <input
                            type="radio"
                            name="billingType"
                            checked={brokerageForm.billingType === "BROKERAGE"}
                            onChange={() =>
                              setBrokerageForm((prev) => ({ ...prev, billingType: "BROKERAGE" }))
                            }
                            className="mt-0.5"
                          />
                          Brokerage is billed for all agents
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Base Price Override</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={brokerageForm.basePrice}
                        onChange={(e) =>
                          setBrokerageForm((prev) => ({ ...prev, basePrice: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="e.g. 45.00"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave blank to use standard pricing</p>
                    </div>

                    {!editingBrokerageId && (
                      <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
                          <input
                            type="checkbox"
                            checked={brokerageForm.createOwnerAccount}
                            onChange={(e) =>
                              setBrokerageForm((prev) => ({
                                ...prev,
                                createOwnerAccount: e.target.checked,
                              }))
                            }
                          />
                          Create brokerage login account
                        </label>

                        {brokerageForm.createOwnerAccount && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <input
                              type="text"
                              value={brokerageForm.ownerFirstName}
                              onChange={(e) =>
                                setBrokerageForm((prev) => ({
                                  ...prev,
                                  ownerFirstName: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Owner first name"
                            />
                            <input
                              type="text"
                              value={brokerageForm.ownerLastName}
                              onChange={(e) =>
                                setBrokerageForm((prev) => ({
                                  ...prev,
                                  ownerLastName: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Owner last name"
                            />
                            <input
                              type="email"
                              value={brokerageForm.ownerEmail}
                              onChange={(e) =>
                                setBrokerageForm((prev) => ({
                                  ...prev,
                                  ownerEmail: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="owner@brokerage.com"
                            />
                            <input
                              type="password"
                              minLength={8}
                              value={brokerageForm.ownerPassword}
                              onChange={(e) =>
                                setBrokerageForm((prev) => ({
                                  ...prev,
                                  ownerPassword: e.target.value,
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                              placeholder="Owner password"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {brokerageError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {brokerageError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowBrokerageModal(false);
                        resetBrokerageModal();
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBrokerage}
                      disabled={brokerageSubmitting}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg"
                    >
                      {brokerageSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clients View */}
        {view === "clients" && (
          <div className="bg-white rounded-lg shadow">
            {/* Search */}
            <div className="p-6 border-b border-gray-200 flex gap-4 items-center">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={() => setShowAddClientModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg whitespace-nowrap"
              >
                + Add Realtor
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-green-600 transition-colors"
                      >
                        Name
                        <SortIcon active={sortKey === "name"} order={sortOrder} />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => toggleSort("email")}
                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-green-600 transition-colors"
                      >
                        Email
                        <SortIcon active={sortKey === "email"} order={sortOrder} />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => toggleSort("brokerage")}
                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-green-600 transition-colors"
                      >
                        Brokerage
                        <SortIcon active={sortKey === "brokerage"} order={sortOrder} />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left">
                      <button
                        onClick={() => toggleSort("phone")}
                        className="flex items-center gap-2 font-semibold text-gray-900 hover:text-green-600 transition-colors"
                      >
                        Phone
                        <SortIcon active={sortKey === "phone"} order={sortOrder} />
                      </button>
                    </th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Payment</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Closed By</th>
                    <th className="px-6 py-3 text-left font-semibold text-gray-900">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {agent.firstName} {agent.lastName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{agent.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {agent.brokerageName || "—"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{agent.phone || "—"}</td>
                      <td className="px-6 py-4 text-sm">
                        <select
                          value={agent.paymentMethod || "OFFICE"}
                          onChange={(e) =>
                            handleQuickUpdateAgent(agent.id, {
                              paymentMethod: e.target.value as "OFFICE" | "SELF",
                            })
                          }
                          disabled={agentUpdatingId === agent.id}
                          className="px-2 py-1 border border-gray-300 rounded-md bg-white text-sm"
                        >
                          <option value="OFFICE">Office Pays</option>
                          <option value="SELF">Agent Pays</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <select
                          value={agent.freeInstallGivenBy || ""}
                          onChange={(e) =>
                            handleQuickUpdateAgent(agent.id, {
                              closedByUserId: e.target.value || null,
                            })
                          }
                          disabled={agentUpdatingId === agent.id}
                          className="px-2 py-1 border border-gray-300 rounded-md bg-white text-sm min-w-[220px]"
                        >
                          <option value="">Not Assigned</option>
                          {closers.map((closer) => (
                            <option key={closer.id} value={closer.id}>
                              {closer.firstName} {closer.lastName} ({closer.role})
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Link
                          href={`/admin/clients/${agent.id}`}
                          className="text-green-600 hover:text-green-700 font-medium transition-colors"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredAgents.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-600">
                    {search ? "No agents match your search" : "No clients found"}
                  </p>
                </div>
              )}
            </div>

            {/* Results count */}
            {agents.length > 0 && (
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
                Showing {filteredAgents.length} of {agents.length} clients
              </div>
            )}
          </div>
        )}

        {showAddClientModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Add Realtor</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="First Name"
                  value={newClient.firstName}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, firstName: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={newClient.lastName}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, lastName: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={newClient.email}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2"
                />
                <input
                  type="text"
                  placeholder="Phone (optional)"
                  value={newClient.phone}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, phone: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                <input
                  type="text"
                  placeholder="Search brokerage (optional)"
                  value={brokerageSearchQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBrokerageSearchQuery(value);
                    setShowBrokerageDropdown(true);
                    setNewClient((prev) => ({
                      ...prev,
                      brokerageName: value,
                      brokerageId: "",
                    }));
                  }}
                  onFocus={() => setShowBrokerageDropdown(true)}
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                />
                {showBrokerageDropdown && (
                  <div className="md:col-span-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setNewClient((prev) => ({ ...prev, brokerageId: "", brokerageName: "" }));
                        setBrokerageSearchQuery("");
                        setShowBrokerageDropdown(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      No brokerage
                    </button>
                    {brokerages
                      .filter((brokerage) =>
                        brokerage.name.toLowerCase().includes(brokerageSearchQuery.trim().toLowerCase())
                      )
                      .slice(0, 10)
                      .map((brokerage) => (
                        <button
                          key={brokerage.id}
                          type="button"
                          onClick={() => {
                            setNewClient((prev) => ({
                              ...prev,
                              brokerageId: brokerage.id,
                              brokerageName: brokerage.name,
                            }));
                            setBrokerageSearchQuery(brokerage.name);
                            setShowBrokerageDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {brokerage.name}
                        </button>
                      ))}
                    {brokerages.filter((brokerage) =>
                      brokerage.name.toLowerCase().includes(brokerageSearchQuery.trim().toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-500">No matching brokerages</div>
                    )}
                  </div>
                )}
                <select
                  value={newClient.paymentMethod}
                  onChange={(e) =>
                    setNewClient((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value as "OFFICE" | "SELF",
                    }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="OFFICE">Office Pays</option>
                  <option value="SELF">Agent Pays</option>
                </select>
                <select
                  value={newClient.closedByUserId}
                  onChange={(e) =>
                    setNewClient((prev) => ({ ...prev, closedByUserId: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Select Closed By (required)</option>
                  {closers.map((closer) => (
                    <option key={closer.id} value={closer.id}>
                      {closer.firstName} {closer.lastName} ({closer.role})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Password (optional, autogenerated if blank)"
                  value={newClient.password}
                  onChange={(e) => setNewClient((prev) => ({ ...prev, password: e.target.value }))}
                  className="px-3 py-2 border border-gray-300 rounded-lg md:col-span-2"
                />
              </div>

              {addClientError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {addClientError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddClientModal(false);
                    setAddClientError("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={addingClient}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg"
                >
                  {addingClient ? "Creating..." : "Create Realtor"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAttachRealtorModal && attachBrokerage && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-xl w-full p-6 shadow-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Add Existing Realtor</h2>
              <p className="text-sm text-gray-600 mb-4">Assign a realtor to {attachBrokerage.name}</p>

              <input
                type="text"
                placeholder="Search realtor by name or email"
                value={attachRealtorQuery}
                onChange={(e) => {
                  setAttachRealtorQuery(e.target.value);
                  setSelectedAttachRealtorId("");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3"
              />

              <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto mb-3">
                {attachRealtorResults.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-gray-500">Type at least 2 characters to search</div>
                ) : (
                  attachRealtorResults.map((realtor) => {
                    const fullName = `${realtor.firstName || ""} ${realtor.lastName || ""}`.trim();
                    return (
                      <button
                        key={realtor.id}
                        type="button"
                        onClick={() => setSelectedAttachRealtorId(realtor.id)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                          selectedAttachRealtorId === realtor.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <div className="font-medium text-gray-900">{fullName || "Unnamed Realtor"}</div>
                        <div className="text-xs text-gray-600">{realtor.email}</div>
                      </button>
                    );
                  })
                )}
              </div>

              {attachError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {attachError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAttachRealtorModal(false);
                    setAttachBrokerage(null);
                    setAttachRealtorQuery("");
                    setAttachRealtorResults([]);
                    setSelectedAttachRealtorId("");
                    setAttachError("");
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAttachRealtor}
                  disabled={attachSubmitting || !selectedAttachRealtorId}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg"
                >
                  {attachSubmitting ? "Adding..." : "Add Realtor"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TC Accounts View */}
        {view === "tcs" && (
          <div>
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">TC Accounts</h2>
                <p className="text-gray-600 text-sm mt-1">Manage third-party coordinators and their linked agents</p>
              </div>
              <button
                onClick={openCreateTcModal}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
              >
                + Add TC
              </button>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading TCs...</div>
              ) : tcs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No TC accounts found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Full Name</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Email</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Phone</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Linked Agent Count</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Joined Date</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Status</th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tcs.map((tc) => {
                        const fullName = `${tc.firstName || ""} ${tc.lastName || ""}`.trim();
                        const isActive = tc.isActive ?? true;

                        return (
                          <tr key={tc.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900">{fullName || "—"}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{tc.email}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{tc.phone || "—"}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{tc.linkedAgentCount ?? tc.agentCount}</td>
                            <td className="px-6 py-4 text-sm text-gray-700">{formatDate(tc.createdAt)}</td>
                            <td className="px-6 py-4 text-sm">
                              <span
                                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                  isActive ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                                }`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm">
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => openEditTcModal(tc)}
                                  className="text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                  Edit
                                </button>
                                <Link
                                  href={`/admin/tcs/${tc.id}`}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View Profile
                                </Link>
                                <button
                                  onClick={() => handleDeactivateTc(tc)}
                                  disabled={!isActive}
                                  className="text-red-600 hover:text-red-700 disabled:text-gray-400 disabled:cursor-not-allowed font-medium"
                                >
                                  Deactivate
                                </button>
                                <button
                                  onClick={() => {
                                    setShowLinkModal(true);
                                    setLinkForm((prev) => ({
                                      ...prev,
                                      selectedTcId: tc.id,
                                      tcSearchQuery: fullName,
                                      tcSearchResults: [],
                                    }));
                                  }}
                                  className="text-green-700 hover:text-green-800 font-medium"
                                >
                                  Link to Agent
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showTcModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-xl w-full p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    {editingTcId ? "Edit TC" : "Add TC"}
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">First Name</label>
                      <input
                        type="text"
                        value={tcForm.firstName}
                        onChange={(e) => setTcForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="First Name"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={tcForm.lastName}
                        onChange={(e) => setTcForm((prev) => ({ ...prev, lastName: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Last Name"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-900 mb-1">Email</label>
                      <input
                        type="email"
                        value={tcForm.email}
                        onChange={(e) => setTcForm((prev) => ({ ...prev, email: e.target.value }))}
                        disabled={Boolean(editingTcId)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-500"
                        placeholder="Email"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-900 mb-1">Phone</label>
                      <input
                        type="text"
                        value={tcForm.phone}
                        onChange={(e) => setTcForm((prev) => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Phone (optional)"
                      />
                    </div>

                    {!editingTcId && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-900 mb-1">Password</label>
                        <input
                          type="text"
                          value={tcForm.password}
                          onChange={(e) => setTcForm((prev) => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Password (optional)"
                        />
                        <p className="text-xs text-gray-500 mt-1">Leave blank to auto-generate a secure password</p>
                      </div>
                    )}
                  </div>

                  {tcError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {tcError}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowTcModal(false);
                        resetTcForm();
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTc}
                      disabled={tcSubmitting}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg"
                    >
                      {tcSubmitting ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showTcPasswordModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-lg">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">TC Created Successfully</h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Share these credentials with the TC — this password will not be shown again
                  </p>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
                    <p className="text-sm text-gray-600">TC</p>
                    <p className="font-semibold text-gray-900">{newTcName}</p>
                    <p className="text-sm text-gray-600 mt-2">Password</p>
                    <p className="font-mono text-sm text-gray-900 break-all">{newTcPassword}</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowTcPasswordModal(false);
                      setNewTcPassword("");
                      setNewTcName("");
                    }}
                    className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Link TC to Agent Modal */}
            {showLinkModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Link TC to Agent</h2>

                  <div className="space-y-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Select TC</label>
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={linkForm.tcSearchQuery}
                        onChange={(e) => searchTCUsers(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                      />
                      {linkForm.tcSearchResults.length > 0 && (
                        <ul className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                          {linkForm.tcSearchResults.map((tc) => (
                            <li
                              key={tc.id}
                              onClick={() =>
                                setLinkForm((prev) => ({
                                  ...prev,
                                  selectedTcId: tc.id,
                                  tcSearchQuery: `${tc.firstName} ${tc.lastName}`,
                                  tcSearchResults: [],
                                }))
                              }
                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                            >
                              {tc.firstName} {tc.lastName} ({tc.email})
                            </li>
                          ))}
                        </ul>
                      )}
                      {linkForm.selectedTcId && <p className="text-sm text-green-600 mt-1">✓ TC selected</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">Select Agent</label>
                      <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={linkForm.agentSearchQuery}
                        onChange={(e) => searchAgentUsers(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-2"
                      />
                      {linkForm.agentSearchResults.length > 0 && (
                        <ul className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                          {linkForm.agentSearchResults.map((agent) => (
                            <li
                              key={agent.id}
                              onClick={() =>
                                setLinkForm((prev) => ({
                                  ...prev,
                                  selectedAgentId: agent.id,
                                  agentSearchQuery: `${agent.firstName} ${agent.lastName}`,
                                  agentSearchResults: [],
                                }))
                              }
                              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"
                            >
                              {agent.firstName} {agent.lastName} ({agent.email})
                            </li>
                          ))}
                        </ul>
                      )}
                      {linkForm.selectedAgentId && <p className="text-sm text-green-600 mt-1">✓ Agent selected</p>}
                    </div>

                    {linkError && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{linkError}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowLinkModal(false);
                        setLinkForm({
                          selectedTcId: null,
                          selectedAgentId: null,
                          tcSearchQuery: "",
                          agentSearchQuery: "",
                          tcSearchResults: [],
                          agentSearchResults: [],
                        });
                        setLinkError("");
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLinkSubmit}
                      disabled={linkSubmitting}
                      className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg"
                    >
                      {linkSubmitting ? "Linking..." : "Link"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
