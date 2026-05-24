"use client";

import { useState, useEffect } from "react";

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

export default function AdminTCsPage() {
  const [tcs, setTcs] = useState<TC[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTcId, setExpandedTcId] = useState<string | null>(null);

  // Link Modal State
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

  // Unlink
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTCs();
  }, []);

  const fetchTCs = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/tcs");
      if (res.ok) {
        const data = await res.json();
        setTcs(data.tcs || []);
      }
    } catch (err) {
      console.error("Error fetching TCs:", err);
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">TC Accounts</h1>
            <p className="text-gray-600 mt-2">Manage third-party coordinators and their linked agents</p>
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
  );
}
