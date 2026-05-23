import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { queryClient } from '../../api/queryClient';
import { AuthProvider } from '../../context/AuthContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              toast: 'bg-card text-card-foreground border border-border',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
