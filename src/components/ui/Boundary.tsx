import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** What to render instead when a child throws. */
  fallback?: ReactNode | ((reset: () => void, error: Error) => ReactNode);
  onError?: (error: Error) => void;
  /** Changing this clears the error (e.g. route path). */
  resetKey?: unknown;
}

/** Contains render errors so one broken widget can never blank the whole window. */
export class Boundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[boundary]', error);
    this.props.onError?.(error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const { fallback = null } = this.props;
    return typeof fallback === 'function' ? fallback(this.reset, error) : fallback;
  }
}
