"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  brokerageName?: string;
  paymentMethod: string;
}

interface Brokerage {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  admin: {
    firstName: string;
    lastName: string;
    email: string;
  };
  agents: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    paymentMethod: string;
  }>;
}

interface TC {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  agentCount: number;
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
  
  // TC Management State
  const [expandedTcId, setExpandedTcId] = useState<string | null>(null);
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
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brokeragesRes, agentsRes, tcsRes] = await Promise.all([
          fetch("/api/admin/brokerages"),
          fetch("/api/admin/users"),
          fetch("/api/admin/tcs"),
        ]);

        if (!brokeragesRes.ok) throw new Error("Failed to fetch brokerages");
        if (!agentsRes.ok) throw new Error("Failed to fetch agents");
        if (!tcsRes.ok) throw new Error("Failed to fetch TCs");

        const brokeragesData = await brokeragesRes.json();
        const agentsData = await agentsRes.json();
        const tcsData = await tcsRes.json();

        setBrokerages(brokeragesData.brokerages);
        setAgents(agentsData.users);
        setTcs(tcsData.tcs || []);
      } catch (err) {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchData();
    }
  }, [status]);

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

  const handleUnlink = async (linkId: string) => {
    if (!confirm("Are you sure you want to unlink this agent?")) return;

    try {
      setUnlinkingId(linkId);
      const res = await fetch(`/api/admin/tcs/link/${linkId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchTCs();
      } else {
        alert("Failed to unlink agent");
      }
    } catch (err) {
      console.error("Error unlinking:", err);
      alert("Failed to unlink agent");
    } finally {
      setUnlinkingId(null);
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
          <div className="grid gap-6">
            {brokerages.map((brokerage) => (
              <div
                key={brokerage.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6"
                onClick={() => router.push(`/admin/brokerages/${brokerage.id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{brokerage.name}</h2>
                    <p className="text-sm text-gray-600">
                      Admin: {brokerage.admin.firstName} {brokerage.admin.lastName}
                    </p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full">
                    {brokerage.agents.length} Agents
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  {brokerage.phone && (
                    <div>
                      <p className="text-gray-600">Phone</p>
                      <p className="text-gray-900 font-medium">{brokerage.phone}</p>
                    </div>
                  )}
                  {brokerage.email && (
                    <div>
                      <p className="text-gray-600">Email</p>
                      <p className="text-gray-900 font-medium">{brokerage.email}</p>
                    </div>
                  )}
                </div>

                {brokerage.agents.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-gray-700 mb-2">Recent Agents:</p>
                    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                      {brokerage.agents.slice(0, 3).map((agent) => (
                        <Link
                          key={agent.id}
                          href={`/admin/clients/${agent.id}`}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-green-100 hover:text-green-700 transition-colors"
                        >
                          {agent.firstName} {agent.lastName}
                        </Link>
                      ))}
                      {brokerage.agents.length > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                          +{brokerage.agents.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {brokerages.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-600">No brokerages found</p>
              </div>
            )}
          </div>
        )}

        {/* Clients View */}
        {view === "clients" && (
          <div className="bg-white rounded-lg shadow">
            {/* Search */}
            <div className="p-6 border-b border-gray-200">
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
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
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            agent.paymentMethod === "OFFICE"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {agent.paymentMethod === "OFFICE" ? "Office Pays" : "Agent Pays"}
                        </span>
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

        {/* TC Accounts View */}
        {view === "tcs" && (
          <div>
            {/* Header with Link Button */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">TC Accounts</h2>
                <p className="text-gray-600 text-sm mt-1">Manage third-party coordinators and their linked agents</p>
              </div>
              <button
                onClick={() => setShowLinkModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg"
              >
                + Link TC to Agent
              </button>
            </div>

            {/* TCs Table */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Loading TCs...</div>
              ) : tcs.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No TC accounts found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                          Name
                        </th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                          Email
                        </th>
                        <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                          Linked Agents
                        </th>
                        <th className="text-center px-6 py-3 font-semibold text-gray-900 text-sm">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tcs.map((tc) => (
                        <div key={tc.id}>
                          <tr className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer">
                            <td className="px-6 py-4 font-medium text-gray-900">
                              {tc.firstName} {tc.lastName}
                            </td>
                            <td className="px-6 py-4 text-gray-700">{tc.email}</td>
                            <td className="px-6 py-4">
                              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-semibold">
                                {tc.agentCount} {tc.agentCount === 1 ? "agent" : "agents"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <button
                                onClick={() =>
                                  setExpandedTcId(expandedTcId === tc.id ? null : tc.id)
                                }
                                className="text-indigo-600 hover:text-indigo-900 font-medium text-sm"
                              >
                                {expandedTcId === tc.id ? "Hide" : "View"} Details
                              </button>
                            </td>
                          </tr>

                          {/* Expanded agents list */}
                          {expandedTcId === tc.id && (
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <td colSpan={4} className="px-6 py-4">
                                <div className="space-y-3">
                                  <h3 className="font-semibold text-gray-900">
                                    Linked Agents ({tc.agents.length})
                                  </h3>
                                  {tc.agents.length === 0 ? (
                                    <p className="text-gray-500 text-sm">No linked agents</p>
                                  ) : (
                                    <ul className="space-y-2">
                                      {tc.agents.map((agent) => (
                                        <li
                                          key={agent.linkId}
                                          className="flex items-center justify-between p-3 bg-white rounded border border-gray-200"
                                        >
                                          <div>
                                            <p className="font-medium text-gray-900">
                                              {agent.firstName} {agent.lastName}
                                            </p>
                                            <p className="text-sm text-gray-600">{agent.email}</p>
                                          </div>
                                          <button
                                            onClick={() => handleUnlink(agent.linkId)}
                                            disabled={unlinkingId === agent.linkId}
                                            className="px-3 py-1 text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50"
                                          >
                                            {unlinkingId === agent.linkId ? "Unlinking..." : "Unlink"}
                                          </button>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </div>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Link TC to Agent Modal */}
            {showLinkModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-lg">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Link TC to Agent</h2>

                  <div className="space-y-4 mb-6">
                    {/* TC Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Select TC
                      </label>
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
                      {linkForm.selectedTcId && (
                        <p className="text-sm text-green-600 mt-1">✓ TC selected</p>
                      )}
                    </div>

                    {/* Agent Search */}
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-1">
                        Select Agent
                      </label>
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
                      {linkForm.selectedAgentId && (
                        <p className="text-sm text-green-600 mt-1">✓ Agent selected</p>
                      )}
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
