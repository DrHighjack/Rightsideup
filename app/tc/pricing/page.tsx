"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Service {
  serviceType: string;
  amountCents: number;
}

interface Agent {
  agentId: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName: string;
  services: Service[];
}

export default function TCPricingPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const res = await fetch("/api/tc/pricing");

        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = "/login";
            return;
          }
          throw new Error("Failed to fetch pricing");
        }

        const data = await res.json();
        setAgents(data.agents || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center">Loading pricing information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="text-center text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Price Sheet for Your Clients</h1>
          <p className="text-gray-600">
            View and share pricing for each of your agents
          </p>
        </div>

        {agents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">You are not yet linked to any agents.</p>
            <p className="text-sm text-gray-500">
              Ask your agents to invite you to manage their pricing information.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {agents.map((agent) => (
              <div
                key={agent.agentId}
                className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
              >
                {/* Card Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-2xl font-bold mb-1">
                        {agent.firstName} {agent.lastName}
                      </h2>
                      <p className="text-blue-100 mb-1">{agent.email}</p>
                      <p className="text-sm text-blue-100">
                        🏢 {agent.brokerageName}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        const printWindow = window.open(
                          `/tc/pricing/${agent.agentId}/quote`,
                          "_blank"
                        );
                        if (printWindow) {
                          printWindow.focus();
                        }
                      }}
                      className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
                    >
                      🖨️ Print Quote Sheet
                    </button>
                  </div>
                </div>

                {/* Services Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-8 py-4 text-left text-sm font-semibold text-gray-900">
                          Service Type
                        </th>
                        <th className="px-8 py-4 text-right text-sm font-semibold text-gray-900">
                          Price
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {agent.services.map((service) => (
                        <tr key={service.serviceType} className="hover:bg-gray-50">
                          <td className="px-8 py-4 text-sm font-medium text-gray-900">
                            {service.serviceType}
                          </td>
                          <td className="px-8 py-4 text-right text-sm font-semibold text-indigo-600">
                            ${(service.amountCents / 100).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {agent.services.length === 0 && (
                  <div className="px-8 py-6 text-center text-gray-500">
                    No services configured for this agent
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-8 px-6 py-4">
          <Link
            href="/tc/dashboard"
            className="text-gray-700 hover:text-indigo-600 font-medium transition-colors"
          >
            📊 Dashboard
          </Link>
          <Link
            href="/tc/pricing"
            className="text-indigo-600 font-medium border-b-2 border-indigo-600 pb-1"
          >
            💰 Pricing
          </Link>
        </div>
      </div>

      {/* Spacer for bottom nav */}
      <div className="h-20"></div>
    </div>
  );
}
