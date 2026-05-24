import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navigate, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/Login';
import StudioPage from './pages/Studio';
import { RequireAuth } from './components/RequireAuth';

// Single QueryClient for the app. Defaults tuned for the dashboard:
//   - retry: false because most failures here are 401s and validation errors;
//     blind retries are noise.
//   - refetchOnWindowFocus: false because the live data path is the WebSocket;
//     stale-on-focus refetches would fight the socket.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <StudioPage />
            </RequireAuth>
          }
        />
        {/* Catch-all → login. Spec says login is the unauthenticated landing. */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </QueryClientProvider>
  );
}
