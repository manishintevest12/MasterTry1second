import React, { useEffect, useRef, useState } from 'react';

/**
 * PageSpeed round-3 (21 Oct, owner target 95+ on mobile): below-fold sections
 * mount only when the user approaches them (IntersectionObserver, 1200px
 * rootMargin). On throttled mobile this removed a large slice of Style & Layout
 * (1.3s throttled) from initial render, and the Chrome install section's live
 * 'iPhone 17' scrape + /api/deals fetch no longer fire during page load.
 * A minHeight placeholder reserves layout space so there is no CLS when the
 * real section mounts; content-visibility on the wrapper keeps offscreen
 * layout cheap even after mounting (see .t1s-deferred in index.css).
 */
export function Deferred({ children, minHeight = 320, id }: { children: React.ReactNode; minHeight?: number; id?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: '1200px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} id={id} className="t1s-deferred" style={show ? undefined : { minHeight }}>
      {show ? children : null}
    </div>
  );
}
