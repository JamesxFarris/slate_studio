import { type ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authApi, ApiError, type MeResponse } from '../lib/api';

// Route guard for authenticated surfaces. Calls /api/auth/me; on 401 redirect
// to /login. Caches the user record under ['me'] so child pages can reuse it
// without re-fetching.
export interface RequireAuthProps {
  children: ReactElement;
}

export function RequireAuth({ children }: RequireAuthProps): ReactElement {
  const query = useQuery<MeResponse, ApiError>({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });

  if (query.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-xs font-mono text-zinc-500">
        Loading&hellip;
      </div>
    );
  }

  if (query.isError) {
    if (query.error.status === 401) {
      return <Navigate to="/login" replace />;
    }
    return (
      <div className="min-h-screen flex items-center justify-center text-xs font-mono text-red-400">
        Auth check failed: {query.error.message}
      </div>
    );
  }

  return children;
}
