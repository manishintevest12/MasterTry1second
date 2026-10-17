import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Show only the stopwatch icon (e.g. compact spaces). */
  iconOnly?: boolean;
  /** Show the "1 SECOND IS ALL IT TAKES" tagline under the wordmark (hero / loader use). */
  tagline?: boolean;
  /** Turn off animation (e.g. dense admin tables). */
  animated?: boolean;
}

/**
 * Official Try1Second logo (PNG layers cut from the owner's artwork).
 * "Dynamic" behaviour, all pure CSS (no JS, no extra requests):
 *   - the stopwatch tile does a 1-second "tick": a quick press, then a gold ring pulse
 *   - a bright arc sweeps once around the dial every second-cycle (the "1 second" idea)
 *   - the corner sparkle twinkles
 *   - the wordmark slides in once, the red swoosh draws in, and the orange dot bounces
 * Hover re-triggers the tick. Honors prefers-reduced-motion.
 */
export const Try1SecondLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  iconOnly = false,
  tagline = false,
  animated = true,
}) => {
  // icon is ~square, wordmark ratio 721:136, so one height drives both
  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14 sm:h-16' : 'h-10 sm:h-12';
  const wordH = size === 'sm' ? 'h-5' : size === 'lg' ? 'h-8 sm:h-9' : 'h-6 sm:h-7';

  return (
    <div
      className={`t1s-logo inline-flex items-center gap-2 select-none ${animated ? 't1s-logo-anim' : ''} ${className}`}
      role="img"
      aria-label="Try1Second - 1 Second Is All It Takes"
    >
      <span className="t1s-logo-icon relative inline-flex">
        <img src="/logo-icon.webp" alt="" draggable={false} width={259} height={254} className={`${h} w-auto max-w-none`} />
        <span className="t1s-logo-ring" aria-hidden="true" />
        <span className="t1s-logo-sweep" aria-hidden="true" />
        <svg className="t1s-logo-spark" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0 L14 9.5 L24 12 L14 14.5 L12 24 L10 14.5 L0 12 L10 9.5 Z" fill="#fff" />
        </svg>
      </span>
      {!iconOnly && (
        <span className="t1s-logo-wordwrap inline-flex flex-col items-start justify-center">
          <img
            src="/logo-wordmark.webp"
            alt=""
            draggable={false}
            width={721}
            height={136}
            className={`t1s-logo-word ${wordH} w-auto max-w-none`}
          />
          {tagline && (
            <img
              src="/logo-tagline.webp"
              alt=""
              draggable={false}
              width={533}
              height={26}
              className="t1s-logo-tag mt-1 h-[0.45rem] sm:h-2 w-auto max-w-none"
            />
          )}
        </span>
      )}
    </div>
  );
};
