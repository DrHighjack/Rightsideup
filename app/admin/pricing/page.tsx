"use client";

import { useEffect, useState } from "react";

interface MasterPrice {
  id: string;
  serviceType: string;
  amountCents: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PriceOverride {
  id: string;
  serviceType: string;
  amountCents: number;
  isLocked: boolean;
  userId: string | null;
  brokerageId: string | null;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  brokerage?: {
    id: string;
    name: string;
  } | null;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface Brokerage {
  id: string;
  name: string;
}

type OverrideFilter = "all" | "realtors" | "brokerages" | "locked" | "unlocked";

export default function PricingPage() {
  const [masterPrices, setMasterPrices] = useState<MasterPrice[]>([]);
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Master price editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);

  // Filter state for overrides
  const [overrideFilter, setOverrideFilter] = useState<OverrideFilter>("all");

  // Add override modal
  const [showAddOverrideModal, setShowAddOverrideModal] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    serviceType: "",
    amountCents: 0,
    clientType: "realtor" as "realtor" | "brokerage",
    clientId: "",
    isLocked: false,
  });
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [availableBrokerages, setAvailableBrokerages] = useState<Brokerage[]>([]);
  const [clientSearchInput, setClientSearchInput] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const fetchClientsData = async () => {
    try {
      const res = await fetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setAvailableUsers(data.users || []);
        setAvailableBrokerages(data.brokerages || []);
      }
    } catch (err) {
      console.error("Failed to fetch clients data:", err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pricesRes, overridesRes] = await Promise.all([
        fetch("/api/admin/pricing"),
        fetch("/api/admin/pricing/overrides"),
      ]);

      if (!pricesRes.ok || !overridesRes.ok) {
        throw new Error("Failed to fetch pricing data");
      }

      const pricesData = await pricesRes.json();
      const overridesData = await overridesRes.json();

      setMasterPrices(pricesData.masterPrices || []);
      setOverrides(overridesData.overrides || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditMasterPrice = (id: string, currentPrice: number) => {
    setEditingId(id);
    setEditPrice(currentPrice);
  };

  const handleSaveMasterPrice = async (serviceType: string) => {
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          amountCents: editPrice,
        }),
      });

      if (!res.ok) throw new Error("Failed to update price");

      setEditingId(null);
      await fetchData();
    } catch (err) {
      alert("Error saving price: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleToggleLock = async (id: string, isLocked: boolean) => {
    try {
      const action = isLocked ? "unlock" : "lock";
      const res = await fetch(`/api/admin/pricing/overrides/${id}/${action}`, {
        method: "PUT",
      });

      if (!res.ok) throw new Error(`Failed to ${action} price`);

      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleDeleteOverride = async (id: string) => {
    if (!confirm("Are you sure you want to delete this override?")) return;

    try {
      const res = await fetch(`/api/admin/pricing/overrides/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete override");

      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const handleAddOverride = async () => {
    if (!overrideForm.serviceType || !overrideForm.clientId) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const body: any = {
        serviceType: overrideForm.serviceType,
        amountCents: overrideForm.amountCents,
      };

      if (overrideForm.clientType === "realtor") {
        body.userId = overrideForm.clientId;
      } else {
        body.brokerageId = overrideForm.clientId;
      }

      const res = await fetch("/api/admin/pricing/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to create override");

      setShowAddOverrideModal(false);
      setOverrideForm({
        serviceType: "",
        amountCents: 0,
        clientType: "realtor",
        clientId: "",
        isLocked: false,
      });
      setClientSearchInput("");
      setShowClientDropdown(false);
      await fetchData();
    } catch (err) {
      alert("Error: " + (err instanceof Error ? err.message : "Unknown error"));
    }
  };

  const filteredOverrides = overrides.filter((override) => {
    if (overrideFilter === "realtors") return override.userId !== null;
    if (overrideFilter === "brokerages") return override.brokerageId !== null;
    if (overrideFilter === "locked") return override.isLocked;
    if (overrideFilter === "unlocked") return !override.isLocked;
    return true;
  });

  const getMasterPrice = (serviceType: string): number | null => {
    return masterPrices.find((p) => p.serviceType === serviceType)?.amountCents ?? null;
  };

  const getPriceDifference = (overridePrice: number, masterPrice: number | null) => {
    if (!masterPrice) return null;
    const diff = overridePrice - masterPrice;
    const sign = diff > 0 ? "+" : "";
    return `${sign}$${(diff / 100).toFixed(2)}`;
  };

  if (loading) {
    return <div className="p-8 text-center">Loading pricing data...</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Pricing Management</h1>
        <p className="text-gray-600">
          Manage master prices and client overrides with lock controls
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {/* Section 1: Master Prices */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Master Prices</h2>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Add Service Type
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Service Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {masterPrices.map((price) => (
                <tr key={price.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {price.serviceType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === price.id ? (
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) =>
                          setEditPrice(Math.max(0, parseInt(e.target.value) || 0))
                        }
                        className="w-24 px-2 py-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <span className="text-sm text-gray-600">
                        ${(price.amountCents / 100).toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {price.description || "—"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {editingId === price.id ? (
                      <div className="space-x-2">
                        <button
                          onClick={() => handleSaveMasterPrice(price.serviceType)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleEditMasterPrice(price.id, price.amountCents)}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {masterPrices.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">No master prices found</div>
          )}
        </div>
        {editingId && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-800">
            ⚠️ <strong>Warning:</strong> Updating this price will cascade to all unlocked client
            overrides for this service type.
          </div>
        )}
      </div>

      {/* Section 2: Client Price Overrides */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Client Price Overrides</h2>
          <button
            onClick={() => {
              setShowAddOverrideModal(true);
              fetchClientsData();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add Override
          </button>
        </div>

        {/* Filter buttons */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {(
            [
              { value: "all", label: "All" },
              { value: "realtors", label: "Realtors" },
              { value: "brokerages", label: "Brokerages" },
              { value: "locked", label: "Locked Only" },
              { value: "unlocked", label: "Unlocked Only" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.value}
              onClick={() => setOverrideFilter(filter.value)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                overrideFilter === filter.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Service Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Override Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  vs Master
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOverrides.map((override) => {
                const masterPrice = getMasterPrice(override.serviceType);
                const clientName = override.user
                  ? `${override.user.firstName} ${override.user.lastName}`
                  : override.brokerage?.name;
                const clientType = override.user ? "Realtor" : "Brokerage";

                return (
                  <tr key={override.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{clientName}</div>
                      <div className="text-xs text-gray-500">{clientType}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {override.serviceType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${(override.amountCents / 100).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {masterPrice ? (
                        <span
                          className={
                            override.amountCents > masterPrice
                              ? "text-red-600"
                              : override.amountCents < masterPrice
                                ? "text-green-600"
                                : "text-gray-600"
                          }
                        >
                          {getPriceDifference(override.amountCents, masterPrice)}
                        </span>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {override.isLocked ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          🔒 Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          🔓 Unlocked
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                      <button
                        onClick={() => handleToggleLock(override.id, override.isLocked)}
                        className={`px-3 py-1 rounded ${
                          override.isLocked
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                        }`}
                      >
                        {override.isLocked ? "Unlock" : "Lock"}
                      </button>
                      <button
                        onClick={() => handleDeleteOverride(override.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredOverrides.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">No overrides found</div>
          )}
        </div>
      </div>

      {/* Add Override Modal */}
      {showAddOverrideModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Add Price Override</h3>

            <div className="space-y-4">
              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Type
                </label>
                <select
                  value={overrideForm.serviceType}
                  onChange={(e) =>
                    setOverrideForm({ ...overrideForm, serviceType: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select service type...</option>
                  {masterPrices.map((price) => (
                    <option key={price.serviceType} value={price.serviceType}>
                      {price.serviceType}
                    </option>
                  ))}
                </select>
              </div>

              {/* Client Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Type
                </label>
                <select
                  value={overrideForm.clientType}
                  onChange={(e) => {
                    setOverrideForm({
                      ...overrideForm,
                      clientType: e.target.value as "realtor" | "brokerage",
                      clientId: "",
                    });
                    setClientSearchInput("");
                    setShowClientDropdown(false);
                    fetchClientsData();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="realtor">Realtor</option>
                  <option value="brokerage">Brokerage</option>
                </select>
              </div>

              {/* Client Selection with Autocomplete */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {overrideForm.clientType === "realtor" ? "Select Realtor" : "Select Brokerage"}
                </label>
                <input
                  type="text"
                  placeholder={`Search ${overrideForm.clientType}...`}
                  value={
                    overrideForm.clientId
                      ? (overrideForm.clientType === "realtor"
                          ? availableUsers.find((u) => u.id === overrideForm.clientId)
                            ? `${availableUsers.find((u) => u.id === overrideForm.clientId)?.firstName} ${availableUsers.find((u) => u.id === overrideForm.clientId)?.lastName}`
                            : ""
                          : availableBrokerages.find((b) => b.id === overrideForm.clientId)?.name) || ""
                      : clientSearchInput
                  }
                  onChange={(e) => {
                    setClientSearchInput(e.target.value);
                    setShowClientDropdown(true);
                    setOverrideForm({ ...overrideForm, clientId: "" });
                    if (!availableUsers.length && !availableBrokerages.length) {
                      fetchClientsData();
                    }
                  }}
                  onFocus={() => {
                    setShowClientDropdown(true);
                    if (!availableUsers.length && !availableBrokerages.length) {
                      fetchClientsData();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                {/* Dropdown */}
                {showClientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {overrideForm.clientType === "realtor"
                      ? availableUsers
                          .filter((user) =>
                            `${user.firstName} ${user.lastName} ${user.email}`
                              .toLowerCase()
                              .includes(clientSearchInput.toLowerCase())
                          )
                          .map((user) => (
                            <div
                              key={user.id}
                              onClick={() => {
                                setOverrideForm({ ...overrideForm, clientId: user.id });
                                setClientSearchInput(
                                  `${user.firstName} ${user.lastName}`
                                );
                                setShowClientDropdown(false);
                              }}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          ))
                      : availableBrokerages
                          .filter((brokerage) =>
                            brokerage.name
                              .toLowerCase()
                              .includes(clientSearchInput.toLowerCase())
                          )
                          .map((brokerage) => (
                            <div
                              key={brokerage.id}
                              onClick={() => {
                                setOverrideForm({
                                  ...overrideForm,
                                  clientId: brokerage.id,
                                });
                                setClientSearchInput(brokerage.name);
                                setShowClientDropdown(false);
                              }}
                              className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {brokerage.name}
                              </div>
                            </div>
                          ))}
                    {((overrideForm.clientType === "realtor" &&
                      availableUsers.filter((user) =>
                        `${user.firstName} ${user.lastName} ${user.email}`
                          .toLowerCase()
                          .includes(clientSearchInput.toLowerCase())
                      ).length === 0) ||
                      (overrideForm.clientType === "brokerage" &&
                        availableBrokerages.filter((brokerage) =>
                          brokerage.name
                            .toLowerCase()
                            .includes(clientSearchInput.toLowerCase())
                        ).length === 0)) && (
                      <div className="px-3 py-2 text-center text-sm text-gray-500">
                        No {overrideForm.clientType}s found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Price */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Price (cents)
                </label>
                <input
                  type="number"
                  value={overrideForm.amountCents}
                  onChange={(e) =>
                    setOverrideForm({
                      ...overrideForm,
                      amountCents: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 5000 for $50.00"
                />
              </div>

              {/* Lock Toggle */}
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={overrideForm.isLocked}
                    onChange={(e) =>
                      setOverrideForm({ ...overrideForm, isLocked: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="ml-2 text-sm text-gray-700">Lock this override</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Locked overrides won't be affected by master price updates
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowAddOverrideModal(false);
                  setClientSearchInput("");
                  setShowClientDropdown(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOverride}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
