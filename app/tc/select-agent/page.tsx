"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Agent {
  linkId: string;
  agentId: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName: string | null;
  grantedBy: string;
}

export default function SelectAgentPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectingAgentId, setSelectingAgentId] = useState<string>("");
  const [switchingLoading, setIsSwitchingLoading] = useState(false);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const res = await fetch("/api/tc/agents");

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/login");
            return;
          }
          setError("Failed to load agents");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setAgents(data.agents || []);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching agents:", err);
        setError("Failed to load agents");
        setLoading(false);
      }
    };

    fetchAgents();
  }, [router]);

  const handleSelectAgent = async (agentId: string) => {
    setSelectingAgentId(agentId);
    setIsSwitchingLoading(true);
    setError("");

    try {
      const res = await fetch("/api/tc/set-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setError(errorData.error || "Failed to switch agent");
        setIsSwitchingLoading(false);
        return;
      }

      const data = await res.json();
      
      // Store activeAgent in localStorage for persistence across pages
      localStorage.setItem(
        "tc_active_agent",
        JSON.stringify(data.activeAgent)
      );

      // Success - redirect to TC dashboard
      router.push("/tc/dashboard");
    } catch (err) {
      console.error("Error switching agent:", err);
      setError("Failed to switch agent");
      setIsSwitchingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded"></div>
            <div className="h-4 bg-gray-300 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Agent</h1>
        <p className="text-gray-600 text-sm mb-6">
          Choose which agent you want to act as
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {agents.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-700">
              You are not linked to any agents yet. Please ask a realtor to invite you.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <button
                key={agent.linkId}
                onClick={() => handleSelectAgent(agent.agentId)}
                disabled={switchingLoading && selectingAgentId !== agent.agentId}
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                  selectingAgentId === agent.agentId
                    ? "border-indigo-600 bg-indigo-50"
                    : "border-gray-200 hover:border-indigo-300 hover:bg-blue-50"
                } ${switchingLoading && selectingAgentId === agent.agentId ? "opacity-75" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">
                      {agent.firstName} {agent.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{agent.email}</p>
                    {agent.brokerageName && (
                      <p className="text-xs text-gray-400 mt-1">
                        {agent.brokerageName}
                      </p>
                    )}
                  </div>
                  {selectingAgentId === agent.agentId && switchingLoading ? (
                    <div className="ml-4 flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                    </div>
                  ) : (
                    <div className="ml-4 text-indigo-600 text-xl">→</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>Granted by: {agents[0]?.grantedBy}</p>
        </div>
      </div>
    </div>
  );
}
