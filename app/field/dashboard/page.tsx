'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

interface JobAssignment {
  id: string;
  orderId: string;
  fieldTechId: string;
  scheduledFor: string;
  startedAt: string | null;
  completedAt: string | null;
  order: {
    orderNumber: string;
    address: string;
    type: string;
    realtor: {
      firstName: string;
      lastName: string;
    };
  };
}

interface GroupedJobs {
  [date: string]: JobAssignment[];
}

export default function FieldDashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [todayJobs, setTodayJobs] = useState<JobAssignment[]>([]);
  const [upcomingJobs, setUpcomingJobs] = useState<GroupedJobs>({});
  const [loading, setLoading] = useState(true);
  const [expandUpcoming, setExpandUpcoming] = useState(false);

  useEffect(() => {
    fetchJobs();
    // Get user name from session
    const getSession = async () => {
      const res = await fetch('/api/auth/session');
      const session = await res.json();
      if (session?.user) {
        setFirstName(session.user.name?.split(' ')[0] || 'there');
      }
    };
    getSession();
  }, []);

  async function fetchJobs() {
    try {
      const res = await fetch('/api/field/jobs');
      if (!res.ok) throw new Error('Failed to fetch jobs');
      const jobs = await res.json();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Separate today's jobs from upcoming
      const todayArray: JobAssignment[] = [];
      const upcoming: GroupedJobs = {};

      jobs.forEach((job: JobAssignment) => {
        const jobDate = new Date(job.scheduledFor);
        jobDate.setHours(0, 0, 0, 0);

        if (jobDate.getTime() === today.getTime()) {
          todayArray.push(job);
        } else if (jobDate > today) {
          const dateKey = jobDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          });
          if (!upcoming[dateKey]) {
            upcoming[dateKey] = [];
          }
          upcoming[dateKey].push(job);
        }
      });

      // Sort today's jobs by time
      todayArray.sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      );

      setTodayJobs(todayArray);
      setUpcomingJobs(upcoming);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push('/login');
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusBadge = (job: JobAssignment) => {
    if (job.completedAt) {
      return (
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
          Completed
        </span>
      );
    }
    if (job.startedAt) {
      return (
        <span className="inline-block px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full">
          Started
        </span>
      );
    }
    return (
      <span className="inline-block px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
        Assigned
      </span>
    );
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      INSTALL: 'bg-green-100 text-green-800',
      REMOVAL: 'bg-red-100 text-red-800',
      CHANGE: 'bg-blue-100 text-blue-800',
    };
    return (
      <span
        className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
          colors[type] || 'bg-gray-100 text-gray-800'
        }`}
      >
        {type}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const JobCard = ({ job }: { job: JobAssignment }) => (
    <div
      onClick={() => router.push(`/field/jobs/${job.id}`)}
      className="bg-white border-2 border-gray-200 rounded-lg p-4 mb-3 cursor-pointer active:bg-gray-50 transition-colors min-h-[120px] flex flex-col justify-between"
    >
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{job.order.address}</h3>
        <div className="flex gap-2 mb-2 flex-wrap">
          {getTypeBadge(job.order.type)}
          {getStatusBadge(job)}
        </div>
      </div>
      <div className="flex justify-between items-end">
        <div>
          <p className="text-sm text-gray-600">
            {formatTime(job.scheduledFor)} • {job.order.realtor.firstName}
          </p>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {firstName}
          </h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg active:bg-red-600 transition-colors"
          >
            Sign Out
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {/* Today's Jobs */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-3">Today's Jobs</h2>
          {todayJobs.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <p className="text-lg text-gray-600 mb-2">No jobs scheduled for today</p>
              <p className="text-sm text-gray-500">Check back soon or view upcoming jobs below</p>
            </div>
          ) : (
            <div>
              {todayJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Jobs */}
        {Object.keys(upcomingJobs).length > 0 && (
          <div>
            <button
              onClick={() => setExpandUpcoming(!expandUpcoming)}
              className="w-full text-left bg-white p-4 rounded-lg font-bold text-gray-900 active:bg-gray-50 transition-colors flex justify-between items-center mb-3 border border-gray-200"
            >
              Upcoming Jobs (7 days)
              <span className="text-2xl">
                {expandUpcoming ? '−' : '+'}
              </span>
            </button>
            {expandUpcoming && (
              <div>
                {Object.entries(upcomingJobs).map(([dateKey, jobs]) => (
                  <div key={dateKey} className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2 px-2">
                      {dateKey}
                    </h3>
                    {jobs.map((job) => (
                      <JobCard key={job.id} job={job} />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around">
        <Link
          href="/field/dashboard"
          className="flex-1 py-4 text-center font-semibold text-blue-600 border-b-4 border-blue-600"
        >
          Jobs
        </Link>
        <button
          onClick={handleSignOut}
          className="flex-1 py-4 text-center font-semibold text-gray-600 active:bg-gray-50"
        >
          Profile
        </button>
      </div>
    </div>
  );
}
