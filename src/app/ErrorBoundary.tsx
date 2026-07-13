import { Component, type ErrorInfo, type ReactNode } from 'react';
import { pushLog, redact } from '../lib/log-buffer';
import { ErrorView } from './ErrorView';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

/**
 * App-root error boundary (docs/02 §6, docs/06 §9). Renders the crash view and
 * routes the error through the log ring so a bug report carries context.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    pushLog({ level: 'error', code: 'E_CRASH', msg: redact(error.message) });
    pushLog({ level: 'error', msg: redact(info.componentStack ?? '') });
  }

  override render(): ReactNode {
    if (this.state.hasError) return <ErrorView state="crash" />;
    return this.props.children;
  }
}
