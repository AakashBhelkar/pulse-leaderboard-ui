"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Tooltip from "@radix-ui/react-tooltip";
import { ApiError } from "@/lib/types";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Non-retryable failures (empty selection, bad request) surface
            // immediately; transient upstream errors get two attempts.
            retry: (failureCount, error) => {
              if (error instanceof ApiError && !error.retryable) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <Tooltip.Provider delayDuration={140} skipDelayDuration={300}>
        {children}
      </Tooltip.Provider>
    </QueryClientProvider>
  );
}
