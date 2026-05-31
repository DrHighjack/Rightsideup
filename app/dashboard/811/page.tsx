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

export default function ElevenPage() {
  const { status } = useSession();
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket811[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch all 811 tickets for this realtor
  useEffect(() => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }

    async function fetchTickets() {
      try {
        const res = await fetch('/api/realtor/811');
        if (res.ok) {
          const data = await res.json();
          setTickets(data);
          if (data.length > 0) {
            setSelectedTicketId(data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTickets();
  }, [status, router]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-600">Loading 811 tracker...</div>
      </div>
    );
  }

  const currentTicket = tickets.find((t) => t.id === selectedTicketId);

  if (!currentTicket) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <h1 className="text-2xl font-bold text-blue-900 mb-2">811 Ticket Tracker</h1>
          <p className="text-blue-700 mb-4">No 811 tickets yet. When you request a utility locating, you'll track progress here.</p>
          <p className="text-sm text-blue-600">Contact support if you need to create a ticket.</p>
        </div>
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
      {/* Ticket selector - only show if multiple tickets */}
      {tickets.length > 1 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Select Ticket</h2>
          <div className="space-y-2">
            {tickets.map((ticket) => (
              <button
                key={ticket.id}
                onClick={() => setSelectedTicketId(ticket.id)}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                  selectedTicketId === ticket.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{ticket.parsedAddress}</div>
                <div className="text-sm text-gray-600">#{ticket.ticketNumber || 'pending'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between mb-6">
          {stages.map((stage, idx) => {
            const isCompleted = stageIndex > idx;
            const isCurrent = stageIndex === idx;
            const isFuture = stageIndex < idx;

            return (
              <div key={stage} className="flex flex-col items-center flex-1">
                {/* Circle */}
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 transition-all ${
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

                {/* Connector line */}
                {idx < stages.length - 1 && (
                  <div
                    className={`absolute mt-14 h-1 ${isCompleted ? 'bg-green-600' : 'bg-gray-300'}`}
                    style={{
                      width: 'calc((100% - 48px) / 4 + 24px)',
                      left: 'calc(50% + 24px)',
                    }}
                  />
                )}
              </div>
            );
          })}
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
    </div>
  );
}
