import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { loadFuriganaVisible, saveFuriganaVisible } from "../storage/furiganaVisibilityStore.js";

interface FuriganaVisibilityContextValue {
  furiganaVisible: boolean;
  toggleFuriganaVisible: () => void;
}

const FuriganaVisibilityContext = createContext<FuriganaVisibilityContextValue | null>(null);

export function FuriganaVisibilityProvider({ children }: { children: ReactNode }) {
  const [furiganaVisible, setFuriganaVisible] = useState<boolean>(loadFuriganaVisible);

  function toggleFuriganaVisible() {
    setFuriganaVisible((prev) => {
      const next = !prev;
      saveFuriganaVisible(next);
      return next;
    });
  }

  const value = useMemo(() => ({ furiganaVisible, toggleFuriganaVisible }), [furiganaVisible]);

  return <FuriganaVisibilityContext.Provider value={value}>{children}</FuriganaVisibilityContext.Provider>;
}

export function useFuriganaVisibility(): FuriganaVisibilityContextValue {
  const ctx = useContext(FuriganaVisibilityContext);
  if (!ctx) throw new Error("useFuriganaVisibility must be used within a FuriganaVisibilityProvider");
  return ctx;
}
