import * as React from 'react';
import { createContext, useContext, type ReactNode } from 'react';

const NamespaceContext = createContext<string | null>(null);

export function NamespaceProvider({
  fullId,
  children,
}: {
  fullId: string;
  children: ReactNode;
}) {
  return (
    <NamespaceContext.Provider value={fullId}>
      {children}
    </NamespaceContext.Provider>
  );
}

export const useParentFullId = (): string | null => useContext(NamespaceContext);
