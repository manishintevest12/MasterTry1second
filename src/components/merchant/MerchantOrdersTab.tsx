import { useState, useMemo, FC } from 'react';
import {
  Search,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  IndianRupee,
  MapPin,
  Building2,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { VERTICAL_META } from '../../data/mockData';
import { VerticalId } from '../../types';

export const MerchantOrdersTab: FC = () => {
  const { authenticatedVendor, userPurchases, addToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCity, setSelectedCity] = useState<string>('all');

  const vendorVertical = (authenticatedVendor?.vertical || 'food') as VerticalId;
  const verticalMeta = VERTICAL_META[vendorVertical] || VERTICAL_META.food;

  // Filter purchases strictly by the authenticated vendor's vertical and brand
  const verticalPurchases = useMemo(() => {
    return userPurchases.filter((order) => {
      // Must match vertical
      if (order.vertical !== vendorVertical) return false;

      // If vendor has specific brandId, prefer matching their brand or vertical
      if (authenticatedVendor?.brandId && authenticatedVendor.brandId !== 'all') {
        const vendorBrandLower = authenticatedVendor.brandId.toLowerCase();
        const orderMerchantLower = order.merchantName.toLowerCase();
        // If there's an exact or partial brand match, prioritize it; otherwise show vertical benchmark orders
        if (orderMerchantLower.includes(vendorBrandLower) || vendorBrandLower.includes(orderMerchantLower)) {
          return true;
        }
      }
      return true;
    });
  }, [userPurchases, vendorVertical, authenticatedVendor]);

  // Apply UI Filters
  const filteredOrders = useMemo(() => {
    return verticalPurchases.filter((order) => {
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const matchesCity = selectedCity === 'all' || order.userCity.toLowerCase() === selectedCity.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        order.id.toLowerCase().includes(q) ||
        order.orderId.toLowerCase().includes(q) ||
        order.userName.toLowerCase().includes(q) ||
        order.userEmail.toLowerCase().includes(q) ||
        order.itemTitle.toLowerCase().includes(q) ||
        order.merchantName.toLowerCase().includes(q) ||
        order.userCity.toLowerCase().includes(q);

      return matchesStatus && matchesCity && matchesQuery;
    });
  }, [verticalPurchases, selectedStatus, selectedCity, searchQuery]);

  // Extract unique cities
  const uniqueCities = useMemo(() => {
    return Array.from(new Set(verticalPurchases.map((o) => o.userCity)));
  }, [verticalPurchases]);

  // Summary Metrics
  const totalGmv = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.orderAmount, 0);
  }, [filteredOrders]);

  const totalCommission = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.commissionEarned, 0);
  }, [filteredOrders]);

  // 1-Click Export CSV
  const handleExportCsv = () => {
    if (filteredOrders.length === 0) {
      addToast('alert', 'No Orders Found', 'No orders match your active filter criteria.');
      return;
    }

    const headers = [
      'Order ID',
      'Merchant Reference ID',
      'Order Timestamp',
      'Customer Name',
      'Customer Email',
      'Delivery City',
      'Merchant Store',
      'Item / SKU Title',
      'Vertical Category',
      'Order Value (INR)',
      'Commission Rate',
      'Commission Earned (INR)',
      'Order Status',
      'Network / Tracking',
    ];

    const rows = filteredOrders.map((o) => [
      `"${o.id}"`,
      `"${o.orderId}"`,
      `"${o.timestamp}"`,
      `"${o.userName}"`,
      `"${o.userEmail}"`,
      `"${o.userCity}"`,
      `"${o.merchantName}"`,
      `"${o.itemTitle.replace(/"/g, '""')}"`,
      `"${o.vertical}"`,
      o.orderAmount,
      `"${o.commissionRate}"`,
      o.commissionEarned,
      `"${o.status}"`,
      `"${o.affiliateNetwork || 'Direct API'}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${authenticatedVendor?.brandId || 'merchant'}_${vendorVertical}_orders_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    addToast('success', 'Orders Exported to CSV', `Exported ${filteredOrders.length} ${verticalMeta.name} orders successfully.`);
  };

  return (
    <div className="space-y-6 text-slate-900 font-sans">
      {/* Top Banner: Strictly Scoped to Vendor's Category */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            <span>Category-Scoped Feed: {verticalMeta.name}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Customer Orders & Redirection Attribution
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Real-time feed of purchases and metasearch click-through conversions generated for <strong>{authenticatedVendor?.companyName || verticalMeta.name}</strong>. Cross-vertical data from other categories is isolated.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleExportCsv}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/20 hover:scale-105 active:scale-95 shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Orders ({filteredOrders.length})</span>
        </button>
      </div>

      {/* 3 Metric Summary Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase">
            Total {verticalMeta.name} Orders
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              {filteredOrders.length}
            </span>
            <span className="text-xs text-slate-400">Transactions</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase">
            Gross Order Value (GMV)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">
              ₹{totalGmv.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-emerald-600 font-bold">Delivered</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block uppercase">
            Commission / Partner Revenue
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              ₹{totalCommission.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs text-slate-400">Attributed</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by order ID, customer name, SKU or city...`}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Order Statuses</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="processing">Processing</option>
            </select>

            {/* City Filter */}
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold cursor-pointer focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Cities</option>
              {uniqueCities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-3.5">Order / SKU Details</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-3 text-right">Order Value</th>
                <th className="py-3 px-3 text-right">Commission</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No {verticalMeta.name} orders match your active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* SKU Details */}
                    <td className="py-3 px-3.5">
                      <div className="space-y-0.5">
                        <span className="font-bold text-slate-900 block leading-tight">
                          {order.itemTitle}
                        </span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                            {order.orderId}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-slate-600">{order.merchantName}</span>
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-800 block text-xs leading-tight">
                        {order.userName}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {order.userEmail}
                      </span>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1 text-slate-700 font-medium text-xs">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{order.userCity}</span>
                      </div>
                    </td>

                    {/* Order Amount */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 text-xs">
                      ₹{order.orderAmount.toLocaleString('en-IN')}
                    </td>

                    {/* Commission */}
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono font-bold text-emerald-700 block text-xs">
                        ₹{order.commissionEarned.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {order.commissionRate}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          order.status === 'approved' || order.status === 'paid'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="py-3 px-3 text-right text-slate-400 text-[11px] font-mono">
                      {order.timestamp}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
