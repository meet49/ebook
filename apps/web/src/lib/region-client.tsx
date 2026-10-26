"use client";

import { createContext, useContext, type ReactNode } from "react";

const InternationalContext = createContext(false);

/** Whether the visitor is outside India (decided on the server from Vercel's geo header). */
export function RegionProvider({ international, children }: { international: boolean; children: ReactNode }) {
  return <InternationalContext.Provider value={international}>{children}</InternationalContext.Provider>;
}

export function useInternational(): boolean {
  return useContext(InternationalContext);
}
