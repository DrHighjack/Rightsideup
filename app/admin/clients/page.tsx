"use client";

import { useEffect, useState } from "react";

interface RealtorData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  brokerageName?: string;
  phone?: string;
  createdAt: string;
  _count: {
    orders: number;
  };
}

export default function AdminClientsPage() {
  const [realtors, setRealtors] = useState<RealtorData[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    async function fetchRealtors() {
      try {
        setLoading(true);
        let url = `/api/admin/users?page=${page}&limit=20`;
        if (search) {
          url += `&search=${encodeURIComponent(search)}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        setRealtors(data.users);
        setTotalPages(data.pagination.pages);
      } catch (error) {
        console.error("Failed to fetch realtors:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRealtors();
  }, [page, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Realtor Accounts</h1>
        <p className="text-gray-600">Manage realtor accounts and view their order history</p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            id="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, or brokerage..."
            className="w-full rounded-md border border-gray-300 px-4 py-2"
          />
        </div>
      </div>

      {/* Realtors table */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">Loading realtors...</div>
      ) : realtors.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No realtors found</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Brokerage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Orders
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody>
                {realtors.map((realtor) => (
                  <tr
                    key={realtor.id}
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => (window.location.href = `/admin/clients/${realtor.id}`)}
                  >
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {realtor.firstName} {realtor.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor.brokerageName || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {realtor._count.orders}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(realtor.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
