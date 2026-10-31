import React from 'react';
import { isChunkLoadError, reloadOnce, sawChunkFailure } from '../lib/chunkRecovery';

/**
 * OWNER 31 Oct, mobile blank screen: nothing in the app caught a render or chunk error, so React
 * unmounted the whole tree and the visitor got a white page with no way back (measured live on
 * /flights). This boundary is the last belt: a chunk failure reloads silently once, anything else
 * shows one compact card with a Reload action. It never renders during normal use.
 */

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // A throttled/blocked chunk is best cured by fetching the document again.
    if (isChunkLoadError(error)) reloadOnce();
    // Keep the detail in the console for the owner's own debugging.
    console.error('[t1s] render failed', error, info?.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const chunk = isChunkLoadError(error) || sawChunkFailure();
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6 py-10 bg-slate-50">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#E11D48] text-xl font-bold">
            !
          </div>
          <h2 className="text-base font-semibold text-slate-900">
            {chunk ? 'This page did not load' : 'Something went wrong'}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {chunk
              ? 'The connection dropped while loading this section. Try again.'
              : 'Please try again in a moment.'}
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 rounded-lg bg-[#E11D48] px-4 py-2 text-sm font-semibold text-white"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={this.reset}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
}
