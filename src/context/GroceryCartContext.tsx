import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import {
  GroceryCartLine, addLine, cartTotals, loadCart, qtyOf, removeLine, saveCart, setQty,
} from '../lib/groceryCart';

/**
 * Grocery cart state (owner 20 Nov). One provider at the app root, localStorage-backed, so the stepper on a
 * card, the floating cart bar and the cart sheet all read the same basket.
 */
interface GroceryCartApi {
  lines: GroceryCartLine[];
  add: (line: Omit<GroceryCartLine, 'qty'>, qty?: number) => void;
  setQuantity: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  qtyOf: (key: string) => number;
  totals: { items: number; units: number; total: number; mrpTotal: number; saving: number };
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const Ctx = createContext<GroceryCartApi | null>(null);

export function GroceryCartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<GroceryCartLine[]>(() => loadCart());
  const [isOpen, setOpen] = useState(false);

  // persist on every change (a shopper who reloads mid-basket should not lose it)
  useEffect(() => { saveCart(lines); }, [lines]);

  const add = useCallback((line: Omit<GroceryCartLine, 'qty'>, qty = 1) => {
    setLines((cur) => addLine(cur, line, qty));
  }, []);
  const setQuantity = useCallback((key: string, qty: number) => setLines((cur) => setQty(cur, key, qty)), []);
  const remove = useCallback((key: string) => setLines((cur) => removeLine(cur, key)), []);
  const clear = useCallback(() => setLines([]), []);
  const qty = useCallback((key: string) => qtyOf(lines, key), [lines]);
  const totals = useMemo(() => cartTotals(lines), [lines]);

  const value = useMemo<GroceryCartApi>(() => ({
    lines, add, setQuantity, remove, clear, qtyOf: qty, totals,
    isOpen, openCart: () => setOpen(true), closeCart: () => setOpen(false),
  }), [lines, add, setQuantity, remove, clear, qty, totals, isOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGroceryCart(): GroceryCartApi {
  const ctx = useContext(Ctx);
  // A card rendered outside the provider (a story, a test) must not crash: it gets a working no-op basket.
  if (!ctx) {
    return {
      lines: [], add: () => undefined, setQuantity: () => undefined, remove: () => undefined,
      clear: () => undefined, qtyOf: () => 0,
      totals: { items: 0, units: 0, total: 0, mrpTotal: 0, saving: 0 },
      isOpen: false, openCart: () => undefined, closeCart: () => undefined,
    };
  }
  return ctx;
}
