/**
 * Loading surfaces for the whole site (owner 27 Oct, supersedes the 22 Oct
 * 3-2-1 countdown): the countdown is gone. Every vertical now shows real search
 * progress — the live site being queried, a hard "7 of 9 stores" count, an
 * advancing bar and result-shaped skeletons — plus the reassurance copy the
 * owner asked to keep ("please wait, we are getting the best deal for you",
 * "comparing prices across the web at warp speed ... your ultimate steal").
 *
 * The actual design lives in SearchProgress.tsx. These names are kept so every
 * existing call site (ComparisonFeed, ProductPageView, strip banners) keeps
 * working unchanged.
 */
import React from 'react';
import { SearchProgressBanner, SearchProgressPanel } from './SearchProgress';

/** @deprecated no countdown any more; kept so older imports still compile. */
export const WarpCountdown: React.FC<{ className?: string }> = () => null;

/** Compact strip banner (one line) for the top of a feed or a panel. */
export const WarpBanner: React.FC<{ vertical?: string | null; query?: string }> = ({ vertical, query }) => (
  <SearchProgressBanner vertical={vertical} query={query} />
);

/**
 * Full results loader: heading, live "Checking <site>…" pill, count readout,
 * progress bar and skeleton cards. Unmounts the moment real rows land.
 */
export const WarpResultsLoader: React.FC<{ query?: string; vertical?: string | null; skeletonRows?: number }> = ({
  query,
  vertical,
  skeletonRows = 3,
}) => <SearchProgressPanel vertical={vertical} query={query} skeletonRows={skeletonRows} />;

export { SearchProgressPanel, SearchProgressBanner } from './SearchProgress';
