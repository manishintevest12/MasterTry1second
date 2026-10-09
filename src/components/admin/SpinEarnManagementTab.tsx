import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  Zap,
  ShoppingBag,
  Award,
  Tag,
  Percent,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Eye,
  EyeOff,
  Sliders,
  Coins,
  Clock,
  Play,
  Copy,
  Check,
  Search,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SpinReward, SpinWinnerLog } from '../../types';

const COLOR_OPTIONS = [
  { name: 'Orange Glow', value: 'from-orange-500 to-amber-600', border: 'border-orange-500', bg: 'bg-orange-500' },
  { name: 'Emerald Green', value: 'from-emerald-500 to-teal-600', border: 'border-emerald-500', bg: 'bg-emerald-500' },
  { name: 'Royal Purple', value: 'from-purple-600 to-indigo-700', border: 'border-purple-500', bg: 'bg-purple-500' },
  { name: 'Rose Red', value: 'from-rose-500 to-pink-600', border: 'border-rose-500', bg: 'bg-rose-500' },
  { name: 'Sky Blue', value: 'from-blue-500 to-cyan-600', border: 'border-blue-500', bg: 'bg-blue-500' },
  { name: 'Amber Gold', value: 'from-amber-400 to-yellow-600', border: 'border-amber-400', bg: 'bg-amber-400' },
  { name: 'Dark Indigo', value: 'from-indigo-600 to-slate-800', border: 'border-indigo-500', bg: 'bg-indigo-500' },
];

const ICON_OPTIONS = [
  { label: 'Gift Box', id: 'Gift' },
  { label: 'Lightning Zap', id: 'Zap' },
  { label: 'Shopping Bag', id: 'ShoppingBag' },
  { label: 'Honor Award', id: 'Award' },
  { label: 'Sparkles', id: 'Sparkles' },
  { label: 'Discount Tag', id: 'Tag' },
  { label: 'Percentage', id: 'Percent' },
];

export const SpinEarnManagementTab: React.FC = () => {
  const {
    spinRewards,
    spinCostPoints,
    setSpinCostPoints,
    addSpinReward,
    updateSpinReward,
    deleteSpinReward,
    toggleSpinRewardActive,
    spinWinners,
  } = useApp();

  const [activeSubView, setActiveSubView] = useState<'rewards' | 'settings' | 'winners' | 'simulator'>('rewards');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Search & Filter for Winners
  const [winnersSearch, setWinnersSearch] = useState('');
  const [winnersFilter, setWinnersFilter] = useState('all');

  // Add / Edit Reward Modal State
  const [isAddRewardModalOpen, setIsAddRewardModalOpen] = useState(false);
  const [editingRewardId, setEditingRewardId] = useState<string | null>(null);

  const [rewardForm, setRewardForm] = useState({
    title: '',
    description: '',
    voucherCode: '',
    color: 'from-orange-500 to-amber-600',
    iconName: 'Gift',
    value: '',
    expiryDays: 30,
    probabilityWeight: 15,
    stockLimit: 50,
  });

  // Simulator State
  const [simResults, setSimResults] = useState<{ [title: string]: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const activeRewards = spinRewards.filter((r) => r.isActive !== false);
  const totalProbabilityWeight = activeRewards.reduce((s, r) => s + (r.probabilityWeight || 10), 0);

  const handleOpenAddModal = () => {
    setEditingRewardId(null);
    setRewardForm({
      title: '',
      description: '',
      voucherCode: '',
      color: 'from-orange-500 to-amber-600',
      iconName: 'Gift',
      value: '',
      expiryDays: 30,
      probabilityWeight: 15,
      stockLimit: 50,
    });
    setIsAddRewardModalOpen(true);
  };

  const handleOpenEditModal = (reward: SpinReward) => {
    setEditingRewardId(reward.id);
    setRewardForm({
      title: reward.title,
      description: reward.description,
      voucherCode: reward.voucherCode,
      color: reward.color || 'from-orange-500 to-amber-600',
      iconName: reward.iconName || 'Gift',
      value: reward.value,
      expiryDays: reward.expiryDays,
      probabilityWeight: reward.probabilityWeight || 10,
      stockLimit: reward.stockLimit || 50,
    });
    setIsAddRewardModalOpen(true);
  };

  const handleSaveReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardForm.title || !rewardForm.voucherCode) return;

    if (editingRewardId) {
      updateSpinReward(editingRewardId, {
        ...rewardForm,
        stockRemaining: rewardForm.stockLimit,
      });
    } else {
      addSpinReward(rewardForm);
    }

    setIsAddRewardModalOpen(false);
  };

  const handleCopyCode = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleRunSimulation = () => {
    if (activeRewards.length === 0) return;
    setIsSimulating(true);

    setTimeout(() => {
      const tally: { [title: string]: number } = {};
      activeRewards.forEach((r) => {
        tally[r.title] = 0;
      });

      const totalWeight = activeRewards.reduce((s, r) => s + (r.probabilityWeight || 10), 0);
      const SIM_COUNT = 1000;

      for (let i = 0; i < SIM_COUNT; i++) {
        let rand = Math.random() * totalWeight;
        let chosen = activeRewards[0];
        for (const r of activeRewards) {
          rand -= (r.probabilityWeight || 10);
          if (rand <= 0) {
            chosen = r;
            break;
          }
        }
        tally[chosen.title] = (tally[chosen.title] || 0) + 1;
      }

      setSimResults(tally);
      setIsSimulating(false);
    }, 600);
  };

  const filteredWinners = spinWinners.filter((w) => {
    const matchesFilter = winnersFilter === 'all' || w.status === winnersFilter;
    const q = winnersSearch.toLowerCase().trim();
    const matchesQuery =
      !q ||
      w.userName.toLowerCase().includes(q) ||
      w.userEmail.toLowerCase().includes(q) ||
      w.rewardTitle.toLowerCase().includes(q) ||
      w.voucherCode.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="space-y-6 text-slate-900">
      {/* Top Banner & High-Level KPIs (White Theme) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
              <Gift className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Spin & Earn Rewards Engine</span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Admin Authority Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure wheel prizes, adjust probabilities, set spin coin costs, and manage live voucher inventory.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Custom Prize</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row (White Theme) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Active Wheel Slices</span>
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {activeRewards.length} <span className="text-xs font-normal text-slate-400">/ {spinRewards.length} Total</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">100% Guaranteed Spin</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Points Per Spin</span>
            <Coins className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700 font-mono flex items-center gap-2">
            <span>{spinCostPoints} Pts</span>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <button
              type="button"
              onClick={() => setSpinCostPoints(Math.max(10, spinCostPoints - 10))}
              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
            >
              -10
            </button>
            <button
              type="button"
              onClick={() => setSpinCostPoints(spinCostPoints + 10)}
              className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-bold hover:bg-slate-200 cursor-pointer"
            >
              +10
            </button>
            <span className="text-[10px] text-slate-500 ml-1">Editable</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Total Weight Pool</span>
            <Percent className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {totalProbabilityWeight}%
          </div>
          <span className="text-[11px] text-slate-500">Normalized across slices</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
            <span>Recorded Winners</span>
            <Award className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono">
            {spinWinners.length}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium">Auto-attributed</span>
        </div>
      </div>

      {/* Sub Navigation Tabs (White Theme) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubView('rewards')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubView === 'rewards'
              ? 'bg-orange-50 text-orange-700 border border-orange-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Gift className="w-3.5 h-3.5" />
          <span>Wheel Slices & Prizes ({spinRewards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView('winners')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubView === 'winners'
              ? 'bg-orange-50 text-orange-700 border border-orange-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Winners Audit Log ({spinWinners.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubView('simulator')}
          className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubView === 'simulator'
              ? 'bg-orange-50 text-orange-700 border border-orange-200 font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>1,000 Spin Probability Simulator</span>
        </button>
      </div>

      {/* VIEW 1: REWARDS CATALOG & WHEEL SLICES */}
      {activeSubView === 'rewards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing all <strong>{spinRewards.length} prizes</strong>. Slices marked as <em>Active</em> appear on the user's Spin Wheel.
            </span>
            <span className="text-[11px] text-slate-500">
              Tip: Click toggle to instantly enable/disable any slice from the wheel.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {spinRewards.map((reward) => {
              const isActive = reward.isActive !== false;
              const probRatio = totalProbabilityWeight > 0 ? (((reward.probabilityWeight || 10) / totalProbabilityWeight) * 100).toFixed(1) : '0';

              return (
                <div
                  key={reward.id}
                  className={`rounded-2xl border p-4.5 transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-white border-slate-200 shadow-xs'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div>
                    {/* Header with Color Badge, Status Toggle, Actions */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${reward.color} flex items-center justify-center text-white shadow-xs shrink-0`}
                        >
                          <Gift className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">
                            {reward.title}
                          </h4>
                          <span className="text-[10px] text-amber-700 font-mono font-semibold">
                            {reward.value}
                          </span>
                        </div>
                      </div>

                      {/* Active Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => toggleSpinRewardActive(reward.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer flex items-center gap-1 ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                        title={isActive ? 'Deactivate prize' : 'Activate prize'}
                      >
                        {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{isActive ? 'Active' : 'Disabled'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mb-3">
                      {reward.description}
                    </p>

                    {/* Metadata & Probabilities */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] mb-3">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Odds / Weight:</span>
                        <span className="font-bold text-orange-700 font-mono">
                          {reward.probabilityWeight || 10} pts (~{probRatio}%)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Voucher Prefix:</span>
                        <span className="font-mono text-slate-800 font-bold truncate block">
                          {reward.voucherCode}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Stock Quota:</span>
                        <span className="font-mono text-emerald-700 font-bold">
                          {reward.stockRemaining ?? reward.stockLimit ?? 50} / {reward.stockLimit ?? 50}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Validity:</span>
                        <span className="text-slate-700 font-medium">
                          {reward.expiryDays} Days
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Toolbar */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(reward)}
                      className="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 font-semibold cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3 text-orange-600" />
                      <span>Edit Rules</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteSpinReward(reward.id)}
                      className="px-2 py-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 text-[11px] font-semibold cursor-pointer flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: WINNERS AUDIT LOG */}
      {activeSubView === 'winners' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={winnersSearch}
                onChange={(e) => setWinnersSearch(e.target.value)}
                placeholder="Search winners by name, email, voucher code, prize..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={winnersFilter}
                onChange={(e) => setWinnersFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-hidden focus:border-orange-500"
              >
                <option value="all">All Redemptions ({spinWinners.length})</option>
                <option value="claimed">Claimed</option>
                <option value="redeemed">Redeemed</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 font-semibold">User Winner</th>
                    <th className="py-3 px-4 font-semibold">Reward Title & Value</th>
                    <th className="py-3 px-4 font-semibold">Generated Voucher Code</th>
                    <th className="py-3 px-4 font-semibold">Points Cost</th>
                    <th className="py-3 px-4 font-semibold">Won At</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWinners.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                        No spin winners found matching your criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredWinners.map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{w.userName}</div>
                          <div className="text-[11px] text-slate-500">{w.userEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{w.rewardTitle}</div>
                          <div className="text-[10px] text-amber-700 font-mono font-semibold">{w.value}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 w-fit">
                            <span>{w.voucherCode}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyCode(w.voucherCode)}
                              className="text-slate-400 hover:text-slate-800 cursor-pointer ml-1"
                              title="Copy Voucher Code"
                            >
                              {copiedCode === w.voucherCode ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-700">
                          -{w.pointsDeducted} Pts
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {w.wonAt}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              w.status === 'claimed'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : w.status === 'redeemed'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-[11px] text-slate-500 font-medium">
                            Authorized
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: 1,000 SPINS PROBABILITY SIMULATOR */}
      {activeSubView === 'simulator' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Play className="w-4 h-4 text-orange-600" />
                <span>Monte Carlo Wheel Probability Simulator (1,000 Spins)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulates 1,000 automated spins against your active probability weights to verify prize economy and ROI.
              </p>
            </div>

            <button
              type="button"
              disabled={isSimulating}
              onClick={handleRunSimulation}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-2"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Simulating 1,000 Spins...' : 'Run Simulation'}</span>
            </button>
          </div>

          {simResults && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Simulation Outcome Breakdown (1,000 Test Spins):
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(simResults).map(([title, count]) => {
                  const percent = ((count / 1000) * 100).toFixed(1);
                  return (
                    <div key={title} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-900 truncate">{title}</span>
                        <span className="font-mono font-bold text-orange-700">{count} wins ({percent}%)</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT REWARD MODAL (White Theme) */}
      {isAddRewardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Gift className="w-4 h-4 text-orange-600" />
                <span>{editingRewardId ? 'Edit Wheel Prize Rules' : 'Add New Wheel Prize'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRewardModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-4 pt-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Prize Title *
                </label>
                <input
                  type="text"
                  required
                  value={rewardForm.title}
                  onChange={(e) => setRewardForm({ ...rewardForm, title: e.target.value })}
                  placeholder="e.g. ₹500 Flipkart Gift Card or Flat 20% Off Swiggy"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Prize Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={rewardForm.description}
                  onChange={(e) => setRewardForm({ ...rewardForm, description: e.target.value })}
                  placeholder="e.g. Applicable on all electronic & fashion orders above ₹1,999"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Value / Discount Badge *
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardForm.value}
                    onChange={(e) => setRewardForm({ ...rewardForm, value: e.target.value })}
                    placeholder="e.g. ₹500 Off / 100 Pts"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Voucher Code Prefix *
                  </label>
                  <input
                    type="text"
                    required
                    value={rewardForm.voucherCode}
                    onChange={(e) => setRewardForm({ ...rewardForm, voucherCode: e.target.value.toUpperCase() })}
                    placeholder="e.g. FLIP500"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-orange-500 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Probability Weight
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={rewardForm.probabilityWeight}
                    onChange={(e) => setRewardForm({ ...rewardForm, probabilityWeight: parseInt(e.target.value, 10) || 10 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Stock Quota
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={rewardForm.stockLimit}
                    onChange={(e) => setRewardForm({ ...rewardForm, stockLimit: parseInt(e.target.value, 10) || 50 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Validity (Days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={rewardForm.expiryDays}
                    onChange={(e) => setRewardForm({ ...rewardForm, expiryDays: parseInt(e.target.value, 10) || 30 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Color Gradient Selection */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Slice Gradient Theme
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setRewardForm({ ...rewardForm, color: c.value })}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        rewardForm.color === c.value
                          ? `${c.border} bg-orange-50/60 ring-2 ring-orange-500`
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${c.value}`} />
                      <span className="text-[10px] text-slate-700 font-medium truncate w-full">
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddRewardModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-500 font-bold text-white rounded-xl cursor-pointer"
                >
                  {editingRewardId ? 'Save Prize Changes' : 'Add to Spin Wheel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

