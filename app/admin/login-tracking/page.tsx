"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

interface UserLoginData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export default function LoginTrackingPage() {
  const [users, setUsers] = useState<UserLoginData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLoginData = async () => {
      try {
        const res = await fetch("/api/admin/login-tracking");
        if (!res.ok) throw new Error("Failed to fetch login data");
        const data = await res.json();
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchLoginData();
  }, []);

  const getStatusColor = (lastLoginAt: string | null) => {
    if (!lastLoginAt) {
      return "bg-gray-100";
    }

    const lastLogin = new Date(lastLoginAt);
    const now = new Date();
    const daysSinceLogin = Math.floor(
      (now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLogin === 0) return "bg-green-50"; // Online today
    if (daysSinceLogin <= 7) return "bg-blue-50"; // Active this week
    if (daysSinceLogin <= 30) return "bg-yellow-50"; // Active this month
    return "bg-red-50"; // Inactive
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800";
      case "SALESMEN":
        return "bg-blue-100 text-blue-800";
      case "FIELD_TECH":
        return "bg-purple-100 text-purple-800";
      case "TC":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getLastLoginText = (lastLoginAt: string | null) => {
    if (!lastLoginAt) {
      return "Never logged in";
    }
    return formatDistanceToNow(new Date(lastLoginAt), { addSuffix: true });
  };

  if (loading) {
    return <div className="p-8 text-center">Loading login data...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Login Tracking</h1>
        <p className="text-gray-600">
          Monitor when users last logged in and their activity status
        </p>
      </div>

      {/* Legend */}
      <div className="mb-6 grid grid-cols-2 gap-4 max-w-2xl">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-100 rounded"></div>
          <span className="text-sm text-gray-700">Logged in today</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-100 rounded"></div>
          <span className="text-sm text-gray-700">Active this week</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-yellow-100 rounded"></div>
          <span className="text-sm text-gray-700">Active this month</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-100 rounded"></div>
          <span className="text-sm text-gray-700">Inactive</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Account Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={`${getStatusColor(user.lastLoginAt)} hover:bg-opacity-75 transition`}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {format(new Date(user.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {getLastLoginText(user.lastLoginAt)}
                      </div>
                      {user.lastLoginAt && (
                        <div className="text-gray-500">
                          {format(new Date(user.lastLoginAt), "MMM d, yyyy h:mm a")}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {!user.lastLoginAt && (
                      <span className="text-gray-500 italic">No login yet</span>
                    )}
                    {user.lastLoginAt &&
                      new Date().getTime() -
                        new Date(user.lastLoginAt).getTime() <
                        24 * 60 * 60 * 1000 && (
                        <span className="text-green-600 font-medium">Active</span>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <div className="px-6 py-4 text-center text-gray-500">
            No users found
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">Total Users</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {users.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">Active Today</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {users.filter(
              (u) =>
                u.lastLoginAt &&
                new Date().getTime() - new Date(u.lastLoginAt).getTime() <
                  24 * 60 * 60 * 1000
            ).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">Never Logged In</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {users.filter((u) => !u.lastLoginAt).length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">Inactive (30+ days)</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">
            {users.filter((u) => {
              if (!u.lastLoginAt) return false;
              const days = Math.floor(
                (new Date().getTime() - new Date(u.lastLoginAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return days >= 30;
            }).length}
          </div>
        </div>
      </div>
    </div>
  );
}
