import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Try1SecondLogo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  // Height configurations
  const heightClass =
    size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14 sm:h-16' : 'h-10 sm:h-12';

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <svg
        viewBox="0 0 380 96"
        className={`${heightClass} w-auto`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Try1Second - 1 Second Is All It Takes"
      >
        <defs>
          {/* Badge Red Gradient */}
          <linearGradient id="badgeRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FB2C53" />
            <stop offset="45%" stopColor="#E11D48" />
            <stop offset="100%" stopColor="#9F1239" />
          </linearGradient>

          {/* Golden Neon Ring Gradient */}
          <linearGradient id="goldRing" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="50%" stopColor="#EAB308" />
            <stop offset="100%" stopColor="#CA8A04" />
          </linearGradient>

          {/* 3D Sphere Gold Gradient */}
          <radialGradient id="sphereGold" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#FEF08A" />
            <stop offset="40%" stopColor="#F59E0B" />
            <stop offset="100%" stopColor="#B45309" />
          </radialGradient>

          {/* Drop Shadows */}
          <filter id="badgeShadow" x="-10%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#E11D48" floodOpacity="0.35" />
          </filter>

          <filter id="numShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.8" />
          </filter>

          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#FBBF24" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* ================= LEFT ICON ================= */}
        {/* Outer Red Rounded Badge */}
        <rect
          x="6"
          y="6"
          width="82"
          height="82"
          rx="22"
          fill="url(#badgeRed)"
          filter="url(#badgeShadow)"
        />

        {/* Subtle Inner Highlight Border */}
        <rect
          x="6.75"
          y="6.75"
          width="80.5"
          height="80.5"
          rx="21.25"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Stopwatch Top Buttons */}
        {/* Left top pin at 10 o'clock */}
        <rect
          x="32"
          y="15"
          width="7"
          height="4"
          rx="1.5"
          transform="rotate(-30 32 15)"
          fill="#FDE047"
        />

        {/* Top-Right Spark Wire & Firecracker Starburst */}
        {/* Wire */}
        <line
          x1="58"
          y1="23"
          x2="67"
          y2="13"
          stroke="#FBBF24"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* White/Gold Exploding Spark (12 rays) */}
        <g transform="translate(68, 12)">
          <line x1="-7" y1="0" x2="7" y2="0" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="0" y1="-7" x2="0" y2="7" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-5" y1="-5" x2="5" y2="5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-5" y1="5" x2="5" y2="-5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="-6.5" y1="-2.5" x2="6.5" y2="2.5" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="-2.5" y1="-6.5" x2="2.5" y2="6.5" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="0" cy="0" r="2.2" fill="#FFFFFF" />
        </g>

        {/* Clock Outer Glowing Ring */}
        <circle
          cx="47"
          cy="48"
          r="30.5"
          stroke="url(#goldRing)"
          strokeWidth="3"
          filter="url(#goldGlow)"
        />

        {/* Clock Dark Face */}
        <circle cx="47" cy="48" r="29" fill="#08080C" />

        {/* Clock Dial Radial Ticks */}
        {/* 12 o'clock */}
        <line x1="47" y1="22" x2="47" y2="26" stroke="#FDE047" strokeWidth="1.6" strokeLinecap="round" />
        {/* 1 o'clock */}
        <line x1="60" y1="25.5" x2="58" y2="29" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 2 o'clock */}
        <line x1="69.5" y1="35" x2="66" y2="37" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 3 o'clock */}
        <line x1="73" y1="48" x2="69" y2="48" stroke="#FDE047" strokeWidth="1.6" strokeLinecap="round" />
        {/* 4 o'clock */}
        <line x1="69.5" y1="61" x2="66" y2="59" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 5 o'clock */}
        <line x1="60" y1="70.5" x2="58" y2="67" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 6 o'clock */}
        <line x1="47" y1="74" x2="47" y2="70" stroke="#FDE047" strokeWidth="1.6" strokeLinecap="round" />
        {/* 7 o'clock */}
        <line x1="34" y1="70.5" x2="36" y2="67" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 8 o'clock */}
        <line x1="24.5" y1="61" x2="28" y2="59" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 9 o'clock */}
        <line x1="21" y1="48" x2="25" y2="48" stroke="#FDE047" strokeWidth="1.6" strokeLinecap="round" />
        {/* 10 o'clock */}
        <line x1="24.5" y1="35" x2="28" y2="37" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />
        {/* 11 o'clock */}
        <line x1="34" y1="25.5" x2="36" y2="29" stroke="#FDE047" strokeWidth="1.2" strokeLinecap="round" />

        {/* Clock Hands pointing to 1 o'clock and 8 o'clock */}
        <line
          x1="47"
          y1="48"
          x2="59"
          y2="28"
          stroke="#F59E0B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <line
          x1="47"
          y1="48"
          x2="28"
          y2="60"
          stroke="#CBD5E1"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {/* Center Clock Pivot */}
        <circle cx="47" cy="48" r="3" fill="#F59E0B" />
        <circle cx="47" cy="48" r="1.2" fill="#FFFFFF" />

        {/* Foreground Solid White Numeral "1" with Serif and Base */}
        <path
          d="M 37.5 37.5 
             L 45 32 
             L 51 32 
             L 51 64 
             L 57 64 
             L 57 69 
             L 37 69 
             L 37 64 
             L 43 64 
             L 43 37.5 
             Z"
          fill="#FFFFFF"
          filter="url(#numShadow)"
        />

        {/* ================= RIGHT WORDMARK ================= */}
        {/* "Try" in Dark Navy #101828 + "1Second" in Rich Crimson #C81E3D */}
        <g id="brandText" transform="translate(104, 52)">
          {/* Try */}
          <text
            x="0"
            y="0"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, sans-serif"
            fontSize="45"
            fontWeight="900"
            letterSpacing="-0.03em"
            fill="#0F172A"
          >
            Try<tspan fill="#C81E3D">1Second</tspan>
          </text>
        </g>

        {/* 3D Gold / Orange Orb floating next to the lowercase 'd' */}
        <circle
          cx="311"
          cy="48"
          r="4.2"
          fill="url(#sphereGold)"
          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.25))"
        />

        {/* Crimson Swoosh Underline */}
        <path
          d="M 103 61.5 C 160 63.5, 250 63.5, 314 58.5"
          stroke="#C81E3D"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />

        {/* Small gold bead at the end of the swoop line */}
        <circle
          cx="314.5"
          cy="58.5"
          r="2.2"
          fill="url(#sphereGold)"
        />

        {/* Tagline: "1 SECOND IS ALL IT TAKES" */}
        <text
          x="105"
          y="77.5"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, sans-serif"
          fontSize="11.5"
          fontWeight="900"
          letterSpacing="0.12em"
          fill="#0F172A"
        >
          1 SECOND IS ALL IT TAKES
        </text>
      </svg>
    </div>
  );
};
