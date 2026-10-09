import React, { useState } from 'react';
import {
  Users,
  Search,
  Laptop,
  Smartphone,
  ShieldCheck,
  ShieldAlert,
  Coins,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const UserLoginsTab: React.FC = () => {
  const {
    userLogins,
    blockUserSession,
    unblockUserSession,
    creditBonusPointsToUser,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredLogins = userLogins.filter((u) => {
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      u.userName.toLowerCase().includes(q) ||
      u.userEmail.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      u.ipAddress.includes(q) ||
      u.location.toLowerCase().includes(q) ||
      u.loginMethod.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const activeCount = userLogins.filter((u) => u.status === 'active').length;
  const blockedCount = userLogins.filter((u) => u.status === 'blocked').length;
  const totalPointsCirculating = userLogins.reduce((s, u) => s + u.pointsBalance, 0);

  return (
    <div className="space-y-6 text-slate-900">
      {/* Top Banner & KPI Summary (White Theme) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            <span>User Authentication & Live Session Audit Logs</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of who logged in, authentication provider, IP address, device telemetry, and session duration.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
            Active: <strong>{activeCount} Users</strong>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
            Pool: <strong>{totalPointsCirculating} Pts</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar (White Theme) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by user name, email, phone, IP or city..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-hidden focus:border-orange-500"
          >
            <option value="all">All Sessions ({userLogins.length})</option>
            <option value="active">Active Now ({activeCount})</option>
            <option value="expired">Expired ({userLogins.length - activeCount - blockedCount})</option>
            <option value="blocked">Suspended / Blocked ({blockedCount})</option>
          </select>
        </div>
      </div>

      {/* User Sessions Table (White Theme) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 font-semibold">User & Identity</th>
                <th className="py-3.5 px-4 font-semibold">Auth Method</th>
                <th className="py-3.5 px-4 font-semibold">Device & Client</th>
                <th className="py-3.5 px-4 font-semibold">IP & Location</th>
                <th className="py-3.5 px-4 font-semibold">Session Activity</th>
                <th className="py-3.5 px-4 font-semibold text-center">Points & Spins</th>
                <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogins.map((user) => {
                const isMobile = user.device.toLowerCase().includes('phone') || user.device.toLowerCase().includes('mobile');
                return (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{user.userName}</span>
                        {user.status === 'blocked' && (
                          <span className="text-[9px] px-1 bg-red-100 text-red-700 rounded border border-red-200 font-bold">
                            BLOCKED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">{user.userEmail}</div>
                      {user.phone && (
                        <div className="text-[10px] text-slate-400 font-mono">{user.phone}</div>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 font-semibold text-[11px] text-orange-700">
                        {user.loginMethod}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        {isMobile ? (
                          <Smartphone className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        ) : (
                          <Laptop className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        )}
                        <span className="truncate">{user.device}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-mono text-emerald-700 text-[11px] font-bold">
                        {user.ipAddress}
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{user.location}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 text-[11px]">
                      <div className="text-slate-900 font-medium">{user.loginTime}</div>
                      <div className="text-[10px] text-slate-500">
                        Duration: <strong>{user.sessionDuration}</strong> (Active: {user.lastActive})
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="font-mono font-bold text-orange-600">
                        {user.pointsBalance} Pts
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {user.totalSpins} spins · {user.totalPurchases} orders
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          user.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : user.status === 'blocked'
                            ? 'bg-red-50 text-red-700 border border-red-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {user.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {user.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => creditBonusPointsToUser(user.userId, 50)}
                          title="Grant 50 bonus points to this user"
                          className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-orange-700 border border-slate-200 rounded-md font-semibold text-[11px] cursor-pointer flex items-center gap-1"
                        >
                          <Coins className="w-3 h-3" />
                          <span>+50 Pts</span>
                        </button>

                        {user.status === 'blocked' ? (
                          <button
                            type="button"
                            onClick={() => unblockUserSession(user.userId)}
                            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md font-semibold text-[11px] cursor-pointer"
                          >
                            Unblock
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => blockUserSession(user.userId)}
                            className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-md font-semibold text-[11px] cursor-pointer"
                          >
                            Block
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
