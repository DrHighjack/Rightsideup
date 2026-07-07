'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface UtilityLine {
  name: string;
  status: 'PENDING' | 'RESPONDED' | 'CLEAR' | 'CONFLICT';
  respondedAt?: string;
}

interface Ticket811 {
  id: string;
  ticketNumber?: string;
  parsedAddress: string;
  stage: string;
  utilityLines?: UtilityLine[];
  requestedDate?: string;
  ticketSubmittedAt?: string;
  allLinesRespondedAt?: string;
  clearanceDate?: string;
  createdAt: string;
}

interface ActivityEvent {
  timestamp: string;
  type: 'REQUESTED' | 'TICKET_SUBMITTED' | 'UTILITY_RESPONDED' | 'ALL_CLEAR' | 'ORDER_RELEASED';
  utility?: string;
  message: string;
}

interface PropertyOption {
  id: string;
  address: string;
  orderNumber?: string;
  agentId?: string;
  agentName?: string;
  needs811: boolean;
}

export default function ElevenPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const userRole = (session?.user as any)?.role;
  const [tickets, setTickets] = useState<Ticket811[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [newTicketNumber, setNewTicketNumber] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch all 811 tickets for this realtor
  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    async function fetchTickets() {
      try {
        const [ticketsRes, ordersRes] = await Promise.all([
          fetch('/api/realtor/811'),
          fetch('/api/orders?limit=200'),
        ]);

        if (ticketsRes.ok) {
          const data = await ticketsRes.json();
          const ticketsData = Array.isArray(data)
            ? data
            : Array.isArray(data?.tickets)
              ? data.tickets
              : [];

          setTickets(ticketsData);
          if (ticketsData.length > 0) {
            setSelectedTicketId(ticketsData[0].id);
          }
        }

        if (ordersRes.ok) {
          const orderData = await ordersRes.json();
          const orderList = Array.isArray(orderData?.orders) ? orderData.orders : [];
          const isTC = userRole === 'TC';
          const uniqueMap = new Map<string, PropertyOption>();

          orderList.forEach((order: any) => {
            const address = typeof order?.address === 'string' ? order.address.trim() : '';
            if (!address) return;

            const firstName = typeof order?.realtor?.firstName === 'string' ? order.realtor.firstName.trim() : '';
            const lastName = typeof order?.realtor?.lastName === 'string' ? order.realtor.lastName.trim() : '';
            const agentName = `${firstName} ${lastName}`.trim() || 'Unknown Agent';
            const agentId = typeof order?.realtor?.id === 'string' ? order.realtor.id : '';
            const needs811 = !order?.self811Accepted && !order?.ticket811;

            const dedupeKey = isTC
              ? `${agentId || 'unknown'}::${address.toLowerCase()}`
              : address.toLowerCase();

            const candidate: PropertyOption = {
              id: order.id,
              address,
              orderNumber: order.orderNumber,
              agentId,
              agentName,
              needs811,
            };

            const existing = uniqueMap.get(dedupeKey);
            if (!existing || (!existing.needs811 && candidate.needs811)) {
              uniqueMap.set(dedupeKey, candidate);
            }
          });

          const propertyOptions: PropertyOption[] = Array.from(uniqueMap.values()).sort((a, b) => {
            if (isTC) {
              const agentCompare = (a.agentName || '').localeCompare(b.agentName || '');
              if (agentCompare !== 0) return agentCompare;
            }

            if (a.needs811 !== b.needs811) {
              return a.needs811 ? -1 : 1;
            }

            return a.address.localeCompare(b.address);
          });

          setProperties(propertyOptions);

          if (propertyOptions.length > 0) {
            setSelectedOrderId(propertyOptions[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [status, router, userRole]);

  const handleAddTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');

    if (!selectedOrderId) {
      setAddError('Please select a property');
      return;
    }

    if (!newTicketNumber.trim()) {
      setAddError('Ticket number is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch('/api/realtor/811', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrderId,
          ticketNumber: newTicketNumber.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || 'Failed to add ticket');
        return;
      }

      if (data?.ticket) {
        setTickets((prev) => [data.ticket, ...prev]);
        setSelectedTicketId(data.ticket.id);
      }

      setNewTicketNumber('');
    } catch (error) {
      console.error('Failed to add ticket:', error);
      setAddError('Failed to add ticket');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading 811 tracker...</div>
      </div>
    );
  }

  const currentTicket = tickets.find((t) => t.id === selectedTicketId);
  const isTC = userRole === 'TC';

  const groupedProperties = properties.reduce((acc, property) => {
    const groupName = isTC ? (property.agentName || 'Unknown Agent') : 'My Listings';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(property);
    return acc;
  }, {} as Record<string, PropertyOption[]>);

  Object.keys(groupedProperties).forEach((groupName) => {
    groupedProperties[groupName].sort((a, b) => {
      if (a.needs811 !== b.needs811) {
        return a.needs811 ? -1 : 1;
      }
      return a.address.localeCompare(b.address);
    });
  });

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      REQUESTED: 'Requested',
      TICKET_SUBMITTED: 'Ticket Submitted',
      LINES_RESPONDED: 'Lines Responded',
      CLEAR: 'Good to Dig!',
    };

    return labels[stage] || stage;
  };

  const addTicketCard = (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Submit 811 Ticket</h2>
      <p className="text-sm text-gray-600 mb-4">
        Select the property and enter the 811 ticket number to add a new one.
      </p>

      <form onSubmit={handleAddTicket} className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <select
          value={selectedOrderId}
          onChange={(e) => setSelectedOrderId(e.target.value)}
          className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg"
          disabled={submitting || properties.length === 0}
        >
          {properties.length === 0 && <option value="">No properties available</option>}
          {isTC
            ? Object.entries(groupedProperties).map(([agentName, agentProperties]) => (
                <optgroup key={agentName} label={agentName}>
                  {agentProperties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.needs811 ? '[811 # Needed] ' : ''}
                      {property.address} {property.orderNumber ? `(${property.orderNumber})` : ''}
                    </option>
                  ))}
                </optgroup>
              ))
            : properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.needs811 ? '[811 # Needed] ' : ''}
                  {property.address} {property.orderNumber ? `(${property.orderNumber})` : ''}
                </option>
              ))}
        </select>

        <input
          type="text"
          value={newTicketNumber}
          onChange={(e) => setNewTicketNumber(e.target.value)}
          placeholder="Ticket Number"
          className="px-3 py-2 border border-gray-300 rounded-lg"
          disabled={submitting}
        />

        <div className="md:col-span-3 flex items-center justify-between gap-3">
          {addError ? (
            <p className="text-sm text-red-700">{addError}</p>
          ) : (
            <span className="text-xs text-gray-500">Pending tickets can be reviewed by admin.</span>
          )}

          <button
            type="submit"
            disabled={submitting || properties.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {submitting ? 'Adding...' : 'Add Ticket'}
          </button>
        </div>

        <div className="md:col-span-3 pt-1">
          <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-red-100 text-red-800 border border-red-200 rounded">
            811 # Needed
          </span>
          <span className="ml-2 text-xs text-gray-500">These listings are sorted to the top.</span>
        </div>
      </form>
    </div>
  );

  const ticketListCard = tickets.length > 0 && (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">811 Tickets</h2>
          <p className="text-sm text-gray-600">Click a ticket to view the full tracking details.</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
          {tickets.length} total
        </span>
      </div>

      <div className="space-y-2">
        {tickets.map((ticket) => (
          <button
            key={ticket.id}
            onClick={() => setSelectedTicketId(ticket.id)}
            className={`w-full rounded-lg border px-4 py-3 text-left transition ${
              selectedTicketId === ticket.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-gray-900">{ticket.parsedAddress}</div>
                <div className="mt-1 text-sm text-gray-600">
                  Ticket #{ticket.ticketNumber || 'pending'}
                </div>
              </div>
              <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                {getStageLabel(ticket.stage)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  if (!currentTicket) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {isTC && addTicketCard}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-blue-900 mb-2">811 Ticket Tracker</h1>
          <p className="text-blue-700 mb-4">No 811 tickets yet. When you request a utility locating, you'll track progress here.</p>
          <p className="text-sm text-blue-600">
            {isTC ? 'Use the submission form above to add the first ticket.' : 'Contact support if you need to create a ticket.'}
          </p>
        </div>
        {!isTC && addTicketCard}
      </div>
    );
  }

  // Build activity timeline from ticket data
  const buildActivityLog = (): ActivityEvent[] => {
    const events: ActivityEvent[] = [];

    if (currentTicket.createdAt) {
      events.push({
        timestamp: currentTicket.createdAt,
        type: 'REQUESTED',
        message: 'You requested utility locating',
      });
    }

    if (currentTicket.ticketSubmittedAt) {
      events.push({
        timestamp: currentTicket.ticketSubmittedAt,
        type: 'TICKET_SUBMITTED',
        message: `811 assigned ticket #${currentTicket.ticketNumber || 'pending'}`,
      });
    }

    if (Array.isArray(currentTicket.utilityLines)) {
      currentTicket.utilityLines.forEach((line) => {
        if (line.respondedAt && line.status !== 'PENDING') {
          events.push({
            timestamp: line.respondedAt,
            type: 'UTILITY_RESPONDED',
            utility: line.name,
            message: `${line.name} responded - ${line.status === 'CLEAR' ? 'safe to dig' : 'conflict'}`,
          });
        }
      });
    }

    if (currentTicket.allLinesRespondedAt) {
      events.push({
        timestamp: currentTicket.allLinesRespondedAt,
        type: 'ALL_CLEAR',
        message: 'All utilities responded',
      });
    }

    if (currentTicket.clearanceDate) {
      events.push({
        timestamp: currentTicket.clearanceDate,
        type: 'ORDER_RELEASED',
        message: 'Order released - ready to schedule',
      });
    }

    // Sort by timestamp, most recent first
    return events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const activityLog = buildActivityLog();

  // Utility line helpers
  const utilityLines = currentTicket.utilityLines || [];
  const respondedCount = utilityLines.filter((l) => l.status !== 'PENDING').length;
  const hasConflict = utilityLines.some((l) => l.status === 'CONFLICT');

  // Stage helpers
  const stages = ['REQUESTED', 'TICKET_SUBMITTED', 'LINES_RESPONDED', 'CLEAR'];
  const stageIndex = stages.indexOf(currentTicket.stage);
  const stageLabels: Record<string, string> = {
    REQUESTED: 'Requested',
    TICKET_SUBMITTED: 'Ticket Submitted',
    LINES_RESPONDED: 'Lines Responded',
    CLEAR: 'Good to Dig!',
  };

  const getUtilityColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-gray-100 border-gray-300';
      case 'RESPONDED':
        return 'bg-blue-50 border-blue-300';
      case 'CLEAR':
        return 'bg-green-50 border-green-300';
      case 'CONFLICT':
        return 'bg-red-50 border-red-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getUtilityStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-gray-200 text-gray-800',
      RESPONDED: 'bg-blue-200 text-blue-800',
      CLEAR: 'bg-green-200 text-green-800',
      CONFLICT: 'bg-red-200 text-red-800',
    };
    return styles[status] || styles.PENDING;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {isTC && addTicketCard}

      {isTC && ticketListCard}

      {!isTC && tickets.length > 1 && ticketListCard}

      {/* Conflict warning banner */}
      {hasConflict && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
          <div className="flex items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-red-800">Conflict Detected</h3>
              <p className="text-sm text-red-700 mt-1">
                One or more utility lines reported a conflict. Please contact support before proceeding.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentTicket.parsedAddress}</h1>
        {currentTicket.ticketNumber && (
          <p className="text-lg text-gray-600">811 Ticket #{currentTicket.ticketNumber}</p>
        )}
      </div>

      {/* 4-Stage Progress Stepper */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="relative mb-6">
          {/* Connector track centered through circle middle */}
          <div className="absolute left-0 right-0 top-6 h-1 bg-gray-300" />
          <div
            className="absolute left-0 top-6 h-1 bg-green-600 transition-all duration-300"
            style={{
              width: `${
                stages.length > 1
                  ? Math.max(0, Math.min(100, (Math.max(stageIndex, 0) / (stages.length - 1)) * 100))
                  : 0
              }%`,
            }}
          />

          <div className="relative grid grid-cols-4 gap-2">
            {stages.map((stage, idx) => {
              const isCompleted = stageIndex > idx;
              const isCurrent = stageIndex === idx;

              return (
                <div key={stage} className="flex flex-col items-center">
                  {/* Circle */}
                  <div
                    className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-all ${
                      isCurrent
                        ? 'bg-blue-600 text-white animate-pulse scale-110'
                        : isCompleted
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {isCompleted ? '✓' : isCurrent ? '●' : idx + 1}
                  </div>

                  {/* Stage name */}
                  <div
                    className={`text-center text-sm font-medium ${
                      isCurrent ? 'text-blue-600 font-bold' : isCompleted ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {stageLabels[stage]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Status message */}
        <div className="mt-8 text-center">
          {stageIndex === 3 ? (
            <div className="inline-block bg-green-100 border-2 border-green-500 rounded-full px-6 py-2">
              <p className="text-green-800 font-bold">✓ Good to Dig! Order Ready to Schedule</p>
            </div>
          ) : (
            <p className="text-gray-700">
              Current Stage: <span className="font-semibold text-blue-600">{stageLabels[currentTicket.stage]}</span>
            </p>
          )}
        </div>
      </div>

      {/* Utility Lines Section */}
      {utilityLines.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Utility Lines</h2>
            <p className="text-sm text-gray-600">
              <span className="font-semibold text-gray-900">{respondedCount}</span> of{' '}
              <span className="font-semibold text-gray-900">{utilityLines.length}</span> utilities responded
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-6 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(respondedCount / utilityLines.length) * 100}%` }}
            />
          </div>

          {/* Utility cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {utilityLines.map((line) => (
              <div key={line.name} className={`border-2 rounded-lg p-4 ${getUtilityColor(line.status)}`}>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-gray-900">{line.name}</h3>
                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${getUtilityStatusBadge(line.status)}`}>
                    {line.status}
                  </span>
                </div>

                {/* Status icon and message */}
                <div className="flex items-center gap-2 text-sm">
                  {line.status === 'PENDING' && (
                    <>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" />
                      <span className="text-gray-600">Waiting for response...</span>
                    </>
                  )}
                  {line.status === 'RESPONDED' && (
                    <>
                      <span className="text-blue-600">⊙</span>
                      <span className="text-blue-700">Responded</span>
                    </>
                  )}
                  {line.status === 'CLEAR' && (
                    <>
                      <span className="text-green-600">✓</span>
                      <span className="text-green-700">Safe to dig</span>
                    </>
                  )}
                  {line.status === 'CONFLICT' && (
                    <>
                      <span className="text-red-600">✕</span>
                      <span className="text-red-700">Conflict - contact support</span>
                    </>
                  )}
                </div>

                {/* Response date if available */}
                {line.respondedAt && (
                  <div className="mt-2 text-xs text-gray-600">
                    Responded: {new Date(line.respondedAt).toLocaleDateString()} at{' '}
                    {new Date(line.respondedAt).toLocaleTimeString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Timeline */}
      {activityLog.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Activity Timeline</h2>

          <div className="space-y-4">
            {activityLog.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                {/* Timeline dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-4 h-4 rounded-full ${
                      event.type === 'REQUESTED'
                        ? 'bg-blue-500'
                        : event.type === 'TICKET_SUBMITTED'
                          ? 'bg-purple-500'
                          : event.type === 'UTILITY_RESPONDED'
                            ? 'bg-cyan-500'
                            : event.type === 'ALL_CLEAR'
                              ? 'bg-green-500'
                              : 'bg-emerald-600'
                    }`}
                  />
                  {idx < activityLog.length - 1 && <div className="w-0.5 h-12 bg-gray-300 mt-2" />}
                </div>

                {/* Event content */}
                <div className="pb-4 flex-1">
                  <p className="font-semibold text-gray-900">{event.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(event.timestamp).toLocaleDateString()} at{' '}
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state for activity */}
      {activityLog.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <p className="text-gray-600">No activity yet</p>
        </div>
      )}
      {!isTC && addTicketCard}
    </div>
  );
}
