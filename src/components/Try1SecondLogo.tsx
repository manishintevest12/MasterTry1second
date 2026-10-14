import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Show only the tap-icon (e.g. compact spaces). */
  iconOnly?: boolean;
  /** Turn off animation (e.g. dense admin tables). */
  animated?: boolean;
}

/**
 * Official Try1Second logo (PNG layers: icon + wordmark).
 * The icon layer is animated: a "1-second tap" pulse with ripple glow,
 * the wordmark fades/slides in once on load, and hover re-triggers the tap.
 * Honors prefers-reduced-motion.
 */
export const Try1SecondLogo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  iconOnly = false,
  animated = true,
}) => {
  const h = size === 'sm' ? 'h-8' : size === 'lg' ? 'h-14 sm:h-16' : 'h-10 sm:h-12';

  return (
    <div
      className={`t1s-logo inline-flex items-center select-none ${animated ? 't1s-logo-anim' : ''} ${className}`}
      role="img"
      aria-label="Try1Second - 1 Second Is All It Takes"
    >
      <span className="t1s-logo-icon relative inline-flex">
        <img src="/logo-icon.png" alt="" draggable={false} className={`${h} w-auto max-w-none`} />
        <span className="t1s-logo-ring" aria-hidden="true" />
      </span>
      {!iconOnly && (
        <img
          src="/logo-wordmark.png"
          alt=""
          draggable={false}
          className={`t1s-logo-word ${h} w-auto max-w-none -ml-0.5`}
        />
      )}
    </div>
  );
};
