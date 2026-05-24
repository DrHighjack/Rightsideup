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

type SortKey = "name" | "email" | "brokerage" | "phone";
type SortOrder = "asc" | "desc";

export default function BrokeragesPage() {
  const { status } = useSession();
  const router = useRouter();
  const [view, setView] = useState<"brokerages" | "clients">("brokerages");
  const [brokerages, setBrokerages] = useState<Brokerage[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brokeragesRes, agentsRes] = await Promise.all([
          fetch("/api/admin/brokerages"),
          fetch("/api/admin/users"),
        ]);

        if (!brokeragesRes.ok) throw new Error("Failed to fetch brokerages");
        if (!agentsRes.ok) throw new Error("Failed to fetch agents");

        const brokeragesData = await brokeragesRes.json();
        const agentsData = await agentsRes.json();

        setBrokerages(brokeragesData.brokerages);
        setAgents(agentsData.users);
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

  if (status === "loading" || loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600 mt-2">Manage clients and brokerages</p>
        </div>

        {/* View Toggle */}
        <div className="mb-6 flex gap-4">
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
            onClick={() => setView("clients")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === "clients"
                ? "bg-green-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            All Clients
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
      </div>
    </div>
  );
}
