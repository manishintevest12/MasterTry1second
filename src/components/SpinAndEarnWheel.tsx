import React, { useState } from 'react';
import {
  Gift,
  Sparkles,
  Zap,
  ShoppingBag,
  Award,
  Copy,
  Check,
  RotateCw,
  ExternalLink,
  Info,
  Users,
  Share2,
  UserPlus,
  Send,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SpinReward, WonReward } from '../types';

export const SpinAndEarnWheel: React.FC = () => {
  const {
    userPoints,
    spinsAvailable,
    executeSpin,
    isSpinning,
    wonRewards,
    selectedWonReward,
    setSelectedWonReward,
    addPoints,
    setActiveNavTab,
    spinRewards,
    spinCostPoints,
    referralCode,
    referredFriends,
    referFriend,
  } = useApp();

  const [rotationDegree, setRotationDegree] = useState<number>(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [inviteName, setInviteName] = useState<string>('');
  const [inviteEmail, setInviteEmail] = useState<string>('');

  const activeSlices = spinRewards.filter((r) => r.isActive !== false);
  const numSlices = activeSlices.length;
  const sliceAngle = 360 / (numSlices || 1);

  const pointsToNext = userPoints >= spinCostPoints ? 0 : spinCostPoints - (userPoints % spinCostPoints);
  const progressPercent = Math.min(100, ((userPoints % spinCostPoints) / spinCostPoints) * 100);

  const handleSpinClick = async () => {
    if (userPoints < spinCostPoints || isSpinning || numSlices === 0) return;

    // Pick random target slice index
    const targetIndex = Math.floor(Math.random() * numSlices);

    const extraFullRotations = 360 * 5; // 5 full spins
    const targetSliceCenter = targetIndex * sliceAngle + sliceAngle / 2;
    const newTotalDegree = rotationDegree + extraFullRotations + (360 - (targetSliceCenter % 360));
    setRotationDegree(newTotalDegree);

    await executeSpin();
  };

  const handleCopy = (code: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const referralShareUrl = `${window.location.origin}/?ref=${referralCode}`;

  const handleCopyReferralLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralShareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `Compare prices in 1 second across Amazon, Blinkit, Zomato, Cleartrip & more! Sign up with my link to get verified lowest deals: ${referralShareUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim()) return;
    referFriend(inviteName, inviteEmail);
    setInviteName('');
    setInviteEmail('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 rounded-3xl text-white p-6 sm:p-8 shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-bold text-white mb-3">
            <Users className="w-3.5 h-3.5 text-amber-200" />
            <span>Referral Rewards Program</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Spin & Earn Reward Wheel
          </h1>
          <p className="text-orange-100 text-xs sm:text-sm mt-2 leading-relaxed">
            Earn <strong>1 Point for every new referral</strong> you make to Try1Second! Collect {spinCostPoints} Points to unlock an instant spin on our prize wheel for gift cards, vouchers & cashback.
          </p>

          {/* Test Buttons Toolbar so user can experience immediately */}
          <div className="mt-4 pt-4 border-t border-white/20 flex flex-wrap items-center gap-2">
            <span className="text-xs text-orange-200 font-semibold mr-1">
              Simulate Referrals:
            </span>
            <button
              type="button"
              onClick={() => referFriend('Sneha Kapoor', 'sneha.k@gmail.com')}
              className="px-2.5 py-1 bg-white/15 hover:bg-white/25 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              +1 Referral (Sneha)
            </button>
            <button
              type="button"
              onClick={() => {
                referFriend('Karan Johar', 'karan@gmail.com');
                referFriend('Priya Sharma', 'priya@gmail.com');
                referFriend('Arjun Nair', 'arjun@gmail.com');
              }}
              className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-md text-xs font-bold transition-colors cursor-pointer"
            >
              +3 Referrals
            </button>
            <button
              type="button"
              onClick={() => addPoints(100, 'Tester Instant 100-Pt Spin Unlock')}
              className="px-3 py-1 bg-white text-orange-800 hover:bg-orange-50 rounded-md text-xs font-extrabold shadow-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-orange-600" />
              Unlock 100-Pt Spin
            </button>
          </div>
        </div>

        {/* Decorative background circle */}
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Refer & Earn Active Program Card */}
      <div className="bg-white rounded-2xl border border-orange-200 p-5 sm:p-6 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        <div className="md:col-span-5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Invite Friends · Earn 1 Point Each
              </h2>
              <p className="text-xs text-slate-500">
                1 friend joined = 1 point accredited to your wallet
              </p>
            </div>
          </div>

          <div className="pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Your Referral Link:
            </span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pl-3">
              <span className="text-xs font-mono font-semibold text-slate-800 truncate flex-1">
                {referralShareUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyReferralLink}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Referral Link on WhatsApp</span>
          </button>
        </div>

        {/* Quick Friend Referral Form */}
        <div className="md:col-span-7 bg-slate-50 rounded-xl p-4 border border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-orange-600" />
              <span>Simulate Friend Sign-up (+1 Point)</span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              {referredFriends.length} Friends Joined
            </span>
          </div>

          <form onSubmit={handleSendInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Friend's Name..."
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-orange-500"
            />
            <input
              type="email"
              placeholder="Email (optional)..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-hidden focus:border-orange-500"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>Send Invite (+1 Pt)</span>
            </button>
          </form>

          {/* Recent Referral Badges */}
          <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2 overflow-x-auto scrollbar-none text-[11px]">
            <span className="text-slate-400 font-semibold shrink-0">Recent:</span>
            {referredFriends.slice(0, 4).map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700 shrink-0 font-medium"
              >
                <span>{f.name}</span>
                <strong className="text-orange-600 font-bold">+{f.pointsAwarded} pt</strong>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: THE INTERACTIVE WHEEL (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs flex flex-col items-center text-center">
          {/* Points Progress Header */}
          <div className="w-full max-w-md mb-6">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-slate-800">
                Wallet Balance: <strong className="text-base text-orange-600 font-mono">{userPoints}</strong> pts
              </span>
              <span className="font-semibold text-slate-500">
                {spinsAvailable > 0 ? (
                  <span className="text-emerald-600 font-bold">
                    🎉 {spinsAvailable} Spin{spinsAvailable > 1 ? 's' : ''} Ready!
                  </span>
                ) : (
                  <span>{pointsToNext} referrals to next spin</span>
                )}
              </span>
            </div>

            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500"
                style={{ width: `${userPoints >= 100 ? 100 : progressPercent}%` }}
              />
            </div>
          </div>

          {/* The Spinning Wheel Container */}
          <div className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center my-4">
            {/* Top Indicator Needle */}
            <div className="absolute top-0 z-20 -mt-3.5 flex flex-col items-center filter drop-shadow-md">
              <div className="w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[22px] border-t-slate-900" />
              <div className="w-2.5 h-2.5 bg-orange-500 rounded-full -mt-1 ring-2 ring-white" />
            </div>

            {/* SVG Wheel with Dynamic Rotation */}
            <div
              style={{
                transform: `rotate(${rotationDegree}deg)`,
                transition: isSpinning
                  ? 'transform 3.5s cubic-bezier(0.15, 0.9, 0.2, 1)'
                  : 'none',
              }}
              className="w-full h-full rounded-full shadow-lg border-4 border-slate-900/10 overflow-hidden relative"
            >
              <svg viewBox="0 0 400 400" className="w-full h-full">
                {activeSlices.map((slice, index) => {
                  const startAngle = index * sliceAngle;
                  const endAngle = startAngle + sliceAngle;
                  const startRad = ((startAngle - 90) * Math.PI) / 180;
                  const endRad = ((endAngle - 90) * Math.PI) / 180;
                  const x1 = 200 + 200 * Math.cos(startRad);
                  const y1 = 200 + 200 * Math.sin(startRad);
                  const x2 = 200 + 200 * Math.cos(endRad);
                  const y2 = 200 + 200 * Math.sin(endRad);
                  const pathData = `M 200 200 L ${x1} ${y1} A 200 200 0 0 1 ${x2} ${y2} Z`;

                  // Text position along bisector
                  const midRad = ((startAngle + sliceAngle / 2 - 90) * Math.PI) / 180;
                  const textX = 200 + 130 * Math.cos(midRad);
                  const textY = 200 + 130 * Math.sin(midRad);
                  const textRotation = startAngle + sliceAngle / 2;

                  return (
                    <g key={slice.id}>
                      <path
                        d={pathData}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />
                      <text
                        x={textX}
                        y={textY}
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                        className="select-none tracking-tight"
                      >
                        {slice.value}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Center Hub / Spin Trigger Button */}
            <button
              type="button"
              disabled={userPoints < spinCostPoints || isSpinning || numSlices === 0}
              onClick={handleSpinClick}
              className={`absolute z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex flex-col items-center justify-center text-white shadow-xl transition-transform active:scale-95 cursor-pointer ${
                userPoints >= spinCostPoints && !isSpinning && numSlices > 0
                  ? 'bg-slate-900 hover:bg-slate-800 ring-4 ring-orange-500 animate-pulse'
                  : 'bg-slate-400 cursor-not-allowed opacity-90'
              }`}
            >
              <RotateCw
                className={`w-5 h-5 mb-0.5 ${isSpinning ? 'animate-spin' : ''}`}
              />
              <span className="text-[11px] font-black uppercase tracking-wider">
                {isSpinning ? 'Spinning...' : 'SPIN'}
              </span>
              <span className="text-[9px] font-semibold text-orange-300">
                {spinCostPoints} pts
              </span>
            </button>
          </div>

          {/* Spin status note */}
          <div className="mt-4 text-xs text-slate-500">
            {spinsAvailable > 0 ? (
              <span className="text-emerald-700 font-bold">
                You have {spinsAvailable} spin{spinsAvailable > 1 ? 's' : ''} available! Click the center button to spin.
              </span>
            ) : (
              <span>
                Need <strong>{pointsToNext} more points</strong>. Every new referral adds +1 point!
              </span>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: REWARD PRIZES & MY CLAIMED VOUCHERS (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Wheel Prize Pool Slices List */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-orange-600" />
              <span>Prize Pool on the Wheel ({activeSlices.length} Slices)</span>
            </h3>

            <div className="grid grid-cols-2 gap-2">
              {activeSlices.map((prize) => (
                <div
                  key={prize.id}
                  className="p-2.5 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-2"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: prize.color }}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-slate-900 block truncate">
                      {prize.title}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {prize.value}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Won Rewards / Vouchers Backpack */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" />
                <span>My Claimed Vouchers ({wonRewards.length})</span>
              </h3>
            </div>

            {wonRewards.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
                <Gift className="w-8 h-8 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">No vouchers won yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Reach 100 points via referrals or use simulator buttons above to spin!
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {wonRewards.map((won) => (
                  <div
                    key={won.id}
                    className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs font-bold text-slate-900">
                        {won.reward.title}
                      </strong>
                      <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-1.5 py-0.2 rounded-sm">
                        Active
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 font-mono text-xs font-bold bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-800">
                        <span>{won.voucherCode}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(won.voucherCode)}
                          className="text-slate-400 hover:text-slate-700 ml-1 cursor-pointer"
                        >
                          {copiedCode === won.voucherCode ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>

                      <span className="text-[10px] text-slate-400">
                        Expires: {won.expiresAt}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Referral Reward Rule Explainer */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-500" />
              <span>Try1Second Referral Points Rule</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">
              Users earn <strong>1 Point for every new friend referred</strong> to Try1Second. Points are awarded upon friend sign-up or verification and do not depend on purchases or merchant redirections. Points never expire and unlock guaranteed prizes on the prize wheel!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
