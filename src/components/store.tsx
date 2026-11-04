'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product, Station, User, CartItem } from '@/lib/types';
export type Catalog = { products: Product[]; stations: Station[]; demo: boolean; paymentsAvailable: boolean; announcement: string };
type Store = Catalog & { user: User | null; cart: CartItem[]; cartOpen: boolean; setCartOpen: (v: boolean) => void; bookingOpen: boolean; setBookingOpen: (v: boolean) => void; addToCart: (id: string) => void; updateQuantity: (id: string, q: number) => void; clearCart: () => void; refresh: () => Promise<void>; refreshUser: () => Promise<void>; notify: (message: string) => void; toast: string };
const Context = createContext<Store | null>(null);
export async function api<T = Record<string, unknown>>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const res = await fetch(`/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}
export function StoreProvider({ initial, children }: { initial: Catalog; children: ReactNode }) {
  const [catalog, setCatalog] = useState(initial);
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [toast, setToast] = useState('');
  const refreshUser = async () => { const data = await api<{ user: User | null }>('session'); setUser(data.user); };
  const refresh = async () => { setCatalog(await api<Catalog>('catalog')); };
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('evpower-cart') || '[]');
      if (Array.isArray(saved)) setCart(saved.filter(i => typeof i.productId === 'string' && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20).slice(0,30));
    } catch { /* Start with an empty cart when local data is invalid. */ }
    setLoaded(true);
    refreshUser().catch(() => {});
  }, []);
  useEffect(() => { if (loaded) localStorage.setItem('evpower-cart', JSON.stringify(cart)); }, [cart, loaded]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(''), 4500); return () => clearTimeout(id); }, [toast]);
  const addToCart = (id: string) => {
    const p = catalog.products.find(p => p.id === id);
    if (!p?.stock) { setToast('This product is currently out of stock.'); return; }
    setCart(current => {
      const found = current.find(i => i.productId === id);
      if (found && found.quantity >= Math.min(20, p.stock)) { setToast('You have reached the available quantity.'); return current; }
      return found ? current.map(i => i.productId === id ? { ...i, quantity: i.quantity + 1 } : i) : [...current, { productId: id, quantity: 1 }];
    });
    setToast(`${p.name} added to your cart`);
  };
  const updateQuantity = (id: string, q: number) => {
    const max = Math.min(20, catalog.products.find(p => p.id === id)?.stock || 0);
    setCart(c => q <= 0 ? c.filter(i => i.productId !== id) : c.map(i => i.productId === id ? { ...i, quantity: Math.min(q, max) } : i).filter(i => i.quantity > 0));
  };
  return <Context.Provider value={{...catalog,user,cart,cartOpen,setCartOpen,bookingOpen,setBookingOpen,addToCart,updateQuantity,clearCart:()=>setCart([]),refresh,refreshUser,notify:setToast,toast}}>{children}</Context.Provider>;
}
export const useStore = () => { const store = useContext(Context); if (!store) throw new Error('Store is unavailable.'); return store; };
