import { Minus, Plus, ShoppingBasket, Trash2, X, ExternalLink } from 'lucide-react';
import { useGroceryCart } from '../context/GroceryCartContext';
import { groupByPartner } from '../lib/groceryCart';

/**
 * The grocery cart sheet (owner 20 Nov: "add to cart functionality", Blinkit-style).
 *
 * It is a basket, not a checkout: every line keeps the partner it came from, and "Order" on a line opens that
 * partner's own tracked exit. The total is the sum of the prices the shopper saw, and it says so — we do not
 * hold the money and we never claim a partner's price is locked.
 */
export function GroceryCartSheet() {
  const cart = useGroceryCart();
  if (!cart.isOpen) return null;
  const groups = groupByPartner(cart.lines);
  const { units, total, saving } = cart.totals;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-900/50" onClick={cart.closeCart}>
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShoppingBasket className="w-4 h-4 text-[#E7000B]" />
            <p className="text-sm font-black text-slate-900">Grocery cart</p>
            <span className="text-[11px] font-bold text-slate-400">{units} item{units === 1 ? '' : 's'}</span>
          </div>
          <div className="flex items-center gap-1">
            {cart.lines.length > 0 && (
              <button
                type="button"
                onClick={cart.clear}
                className="text-[11px] font-bold text-slate-400 hover:text-red-600 px-2 py-1 cursor-pointer"
              >
                Clear
              </button>
            )}
            <button type="button" onClick={cart.closeCart} aria-label="Close" className="p-1.5 text-slate-400 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {cart.lines.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              Your cart is empty. Tap <span className="font-bold">Add</span> on any grocery card.
            </p>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g.partner}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      Ordered from <span className="text-slate-900">{g.partner}</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">₹{g.subtotal.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="space-y-2">
                    {g.lines.map((l) => (
                      <div key={l.key} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2">
                        {l.image ? (
                          <img src={l.image} alt="" className="w-11 h-11 rounded-lg object-cover bg-slate-50" loading="lazy" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-slate-50" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold text-slate-900 line-clamp-2">{l.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {l.unit ? `${l.unit} · ` : ''}₹{l.price.toLocaleString('en-IN')}
                            {l.mrp > l.price && (
                              <span className="text-slate-400 line-through ml-1">₹{l.mrp.toLocaleString('en-IN')}</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center rounded-lg border border-slate-200">
                            <button
                              type="button"
                              aria-label="Decrease"
                              onClick={() => cart.setQuantity(l.key, l.qty - 1)}
                              className="px-1.5 py-1 text-slate-600 cursor-pointer"
                            >
                              {l.qty === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                            </button>
                            <span className="px-1 text-[11px] font-black text-slate-900 min-w-4 text-center">{l.qty}</span>
                            <button
                              type="button"
                              aria-label="Increase"
                              onClick={() => cart.setQuantity(l.key, l.qty + 1)}
                              className="px-1.5 py-1 text-slate-600 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          {l.url && (
                            <a
                              href={l.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg bg-[#E7000B] px-2 py-1.5 text-[10px] font-extrabold text-white"
                              title={`Order on ${g.partner}`}
                            >
                              Order
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="font-black text-slate-900">₹{total.toLocaleString('en-IN')}</p>
                <p className="text-[10px] text-slate-500">
                  {saving > 0 ? `You save ₹${saving.toLocaleString('en-IN')} · ` : ''}prices as seen when you added them
                </p>
              </div>
              {groups.length === 1 && groups[0].lines[0]?.url ? (
                <a
                  href={groups[0].lines[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[#E7000B] px-4 py-2.5 text-xs font-extrabold text-white flex items-center gap-1.5"
                >
                  Order on {groups[0].partner} <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <p className="text-[11px] font-bold text-slate-500 text-right max-w-[45%]">
                  {groups.length} partners — order each group on its own site
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The floating bar shown on the grocery feed: how much is in the basket and where to go next. */
export function GroceryCartBar() {
  const cart = useGroceryCart();
  if (cart.totals.units === 0 || cart.isOpen) return null;
  return (
    <button
      type="button"
      onClick={cart.openCart}
      className="fixed left-3 right-3 z-40 mx-auto max-w-md flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-3.5 py-2.5 text-white shadow-xl cursor-pointer"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 64px)' }}
    >
      <span className="flex items-center gap-2 text-[12px] font-extrabold">
        <ShoppingBasket className="w-4 h-4" /> {cart.totals.units} item{cart.totals.units === 1 ? '' : 's'}
      </span>
      <span className="text-[12px] font-black">
        ₹{cart.totals.total.toLocaleString('en-IN')} <span className="font-bold text-white/70">· View cart</span>
      </span>
    </button>
  );
}
