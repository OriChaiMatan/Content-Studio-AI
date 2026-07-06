import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class PodcastErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PodcastErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-outline">broken_image</span>
          </div>
          <p className="text-[15px] font-medium text-on-surface mb-1">
            Something went wrong displaying this episode.
          </p>
          <p className="text-[13px] text-on-surface-variant mb-5 max-w-[340px]">
            The episode data may be malformed. Please regenerate the episode.
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-container text-on-surface text-[13px] font-medium hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Dismiss
          </button>
          {import.meta.env.DEV && (
            <pre className="mt-4 text-[10px] text-error/70 max-w-[480px] text-start overflow-auto">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
