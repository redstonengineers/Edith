import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './primitives';
import { reportBrowserError } from '@/services/monitoring';

/** Evita que un fallo en una pantalla tumbe toda la aplicación. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('UI error:', error, info.componentStack); reportBrowserError(error); }
  render() {
    if (this.state.error) return <ErrorState title="Esta pantalla ha fallado" description="El resto de la aplicación sigue funcionando. Puedes reintentar o volver al inicio." onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
