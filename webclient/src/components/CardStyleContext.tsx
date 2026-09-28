import { createContext, useContext } from "react";
import type { CardStyle } from "../lib/preferences";

const CardStyleContext = createContext<CardStyle>("original");

export const CardStyleProvider = CardStyleContext.Provider;
export function useCardStyle() {
  return useContext(CardStyleContext);
}
