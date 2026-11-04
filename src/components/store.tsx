'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Product, Station, User, CartItem } from '@/lib/types';
import { websiteSchema, type Website } from '@/lib/website';
export type Catalog = { products: Product[]; stations: Station[]; demo: boolean; paymentsAvailable: boolean; announcement: string; site: Website; previewAuthorized?: boolean };
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
  const [previewSite,setPreviewSite]=useState<Website|null>(null);
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

  useEffect(()=>{
    if(!initial.previewAuthorized||window.parent===window)return;
    document.documentElement.classList.add('cms-preview-mode');
    const receive=(event:MessageEvent)=>{
      if(event.origin!==location.origin||event.source!==window.parent)return;
      if(event.data?.type==='evpower:document'){
        const parsed=websiteSchema.safeParse(event.data.document);
        if(parsed.success)setPreviewSite(parsed.data);
      }
      if(event.data?.type==='evpower:highlight'){
        document.querySelectorAll('.cms-selected').forEach(el=>el.classList.remove('cms-selected'));
        document.querySelectorAll<HTMLElement>('[data-cms-fields],[data-cms-section]').forEach(el=>{
          const fields=el.dataset.cmsFields?JSON.parse(el.dataset.cmsFields):[];
          if(fields.some((f:{key:string})=>f.key===event.data.key)||el.dataset.cmsSection===event.data.section)el.classList.add('cms-selected');
        });
      }
    };
    const collect=()=>{
      const fields=new Map();document.querySelectorAll<HTMLElement>('[data-cms-fields]').forEach(el=>{try{for(const f of JSON.parse(el.dataset.cmsFields||'[]'))fields.set(f.key,f);}catch{}});
      const sections=[...document.querySelectorAll<HTMLElement>('[data-cms-section]')].map(el=>({id:el.dataset.cmsSection,label:el.dataset.cmsLabel}));
      window.parent.postMessage({type:'evpower:fields',fields:[...fields.values()],sections},location.origin);
    };
    let timer:ReturnType<typeof setTimeout>;
    const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(collect,100);});
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-cms-fields','data-cms-label']});
    const select=(event:MouseEvent)=>{
      const target=(event.target as HTMLElement).closest<HTMLElement>('[data-cms-fields],[data-cms-section]');if(!target)return;
      event.preventDefault();event.stopPropagation();
      let fields=[];try{fields=JSON.parse(target.dataset.cmsFields||'[]');}catch{}
      window.parent.postMessage({type:'evpower:select',key:fields[0]?.key,section:target.closest<HTMLElement>('[data-cms-section]')?.dataset.cmsSection},location.origin);
    };
    window.addEventListener('message',receive);document.addEventListener('click',select,true);
    window.parent.postMessage({type:'evpower:ready'},location.origin);collect();
    return()=>{clearTimeout(timer);observer.disconnect();window.removeEventListener('message',receive);document.removeEventListener('click',select,true);document.documentElement.classList.remove('cms-preview-mode');};
  },[initial.previewAuthorized]);
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
  return <Context.Provider value={{...catalog,site:previewSite||catalog.site,announcement:(previewSite||catalog.site).settings.announcement,user,cart,cartOpen,setCartOpen,bookingOpen,setBookingOpen,addToCart,updateQuantity,clearCart:()=>setCart([]),refresh,refreshUser,notify:setToast,toast}}>{children}</Context.Provider>;
}
export const useStore = () => { const store = useContext(Context); if (!store) throw new Error('Store is unavailable.'); return store; };
