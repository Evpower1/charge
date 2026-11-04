'use client';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Zap, ShieldCheck, Plus, X, Minus, ShoppingBag, Check, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useId, type ReactNode } from 'react';
import { useStore } from './store';
import { money, type Product } from '@/lib/types';
export function Brand({ light = false }: { light?: boolean }) { return <Link href="/" className={`brand ${light?'brand-light':''}`} aria-label="Evpower home"><span className="brand-symbol"><Zap fill="currentColor" strokeWidth={1.5}/></span><span>evpower<span className="brand-dot">.</span></span></Link>; }
export function SectionHeading({ eyebrow, title, text, action, href }: { eyebrow: string; title: string; text?: string; action?: string; href?: string }) { return <div className="section-heading"><div><div className="eyebrow"><span/> {eyebrow}</div><h2>{title}</h2></div><div className="section-heading-right">{text&&<p>{text}</p>}{action&&href&&<Link className="text-link" href={href}>{action}<ArrowUpRight size={17}/></Link>}</div></div>; }
export function PageIntro({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: ReactNode }) { return <section className="page-intro"><div className="container"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>{eyebrow}</span></div><div className="eyebrow"><span/>{eyebrow}</div><h1>{title}</h1><p>{text}</p>{children}</div><span className="intro-orbit" aria-hidden="true"/></section>; }
export function EmptyState({ icon, title, text, action }: {icon?:ReactNode;title:string;text:string;action?:ReactNode}) { return <div className="empty-state"><div className="empty-icon">{icon||<ShoppingBag/>}</div><h3>{title}</h3><p>{text}</p>{action}</div>; }
export function Spinner() { return <LoaderCircle className="spin" size={18}/>; }
export function ErrorMessage({ message }: {message:string}) { return message?<p className="form-error" role="alert">{message}</p>:null; }
export function ProductArt({ product, large = false }: {product:Product;large?:boolean}) {
  const color=product.color;
  const id=useId();
  return <svg viewBox="0 0 360 280" className={`product-art ${large?'large':''}`} role="img" aria-label={`${product.name} product illustration`}>
    <defs><linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1"><stop stopColor={color==='dark'?'#354943':'#ffffff'}/><stop offset="1" stopColor={color==='dark'?'#122a25':'#d5ded8'}/></linearGradient><filter id={`${id}-shadow`} x="-50%" y="-30%" width="200%" height="180%"><feDropShadow dx="7" dy="12" stdDeviation="10" floodColor="#193e30" floodOpacity=".15"/></filter></defs>
    <ellipse cx="184" cy="246" rx="79" ry="11" fill="#193e30" opacity=".06"/>
    {color==='cable'?<g filter={`url(#${id}-shadow)`}><path d="M225 190C300 105 141 76 117 160C93 243 230 253 252 167C276 75 118 55 101 154C89 234 220 265 260 180" fill="none" stroke="#253c35" strokeWidth="14"/><path d="M121 155L101 100M239 168L272 117" stroke="#263e35" strokeWidth="11"/><g transform="rotate(-21 99 90)"><rect x="82" y="63" width="30" height="52" rx="10" fill="#182e26"/><rect x="87" y="57" width="20" height="19" rx="6" fill="#92b45c"/></g><g transform="rotate(30 274 105)"><rect x="260" y="77" width="30" height="52" rx="10" fill="#182e26"/><rect x="265" y="71" width="20" height="19" rx="6" fill="#92b45c"/></g></g>:
    color==='adapter'?<g filter={`url(#${id}-shadow)`} transform="rotate(-25 180 145)"><rect x="146" y="79" width="70" height="139" rx="24" fill="#243b32"/><ellipse cx="181" cy="85" rx="35" ry="18" fill="#536c5e"/><ellipse cx="181" cy="83" rx="24" ry="12" fill="#14291f"/><circle cx="172" cy="82" r="4" fill="#9eb8a4"/><circle cx="188" cy="82" r="4" fill="#9eb8a4"/><rect x="163" y="126" width="36" height="4" rx="2" fill="#b6dc73"/></g>:
    color==='portable'?<g filter={`url(#${id}-shadow)`}><path d="M165 207C95 247 73 175 106 138C126 115 159 133 160 107M202 78C256 35 295 100 262 149C239 180 215 164 216 204" stroke="#263c34" strokeWidth="9" fill="none"/><rect x="143" y="79" width="72" height="139" rx="24" fill="#21372e"/><rect x="153" y="108" width="52" height="48" rx="5" fill="#9cbfa6"/><text x="179" y="128" textAnchor="middle" fontSize="15" fontFamily="monospace" fill="#163c2d">3.7</text><text x="179" y="145" textAnchor="middle" fontSize="7" fill="#244c3b">CHARGING</text><circle cx="179" cy="180" r="9" fill="#c5ed85"/><path d="M157 94h43" stroke="#5f7668" strokeWidth="2"/></g>:
    <g filter={`url(#${id}-shadow)`}><path d="M227 115C288 113 286 234 220 233C195 233 179 219 181 201" stroke="#21382e" strokeWidth="9" fill="none"/><rect x="127" y="48" width={color==='duo'?113:101} height="168" rx="29" fill={`url(#${id}-body)`} stroke={color==='dark'?'#465b50':'#c4d1c6'} strokeWidth="1.5"/><path d="M140 76q38 -16 74 0" fill="none" stroke={color==='dark'?'#647b6b':'white'} strokeWidth="2"/><rect x="145" y="88" width="64" height="50" rx="9" fill="#17382a"/><circle cx="177" cy="111" r="12" fill="none" stroke="#bce27d" strokeWidth="2"/><path d="m180 102-7 11h6l-4 10 10-14h-7z" fill="#c8f28a"/><circle cx="177" cy="156" r="3" fill="#81bb54"/><text x="177" y="182" fontSize="8" fontWeight="600" fontFamily="sans-serif" textAnchor="middle" fill={color==='dark'?'#c5d5c8':'#476351'}>evpower.</text><path d="m222 181 6 28" stroke="#18362a" strokeWidth="15" strokeLinecap="round"/>{color==='duo'&&<path d="M128 113C70 122 75 230 132 230" stroke="#21382e" strokeWidth="8" fill="none"/>}</g>}
  </svg>;
}
export function ProductCard({ product }: {product:Product}) {
  const {addToCart}=useStore();
  return <article className="product-card"><Link href={`/shop/${product.id}`} className="product-image">{product.badge&&<span className="product-badge">{product.badge}</span>}<ProductArt product={product}/><span className="product-view">View product<ArrowUpRight size={15}/></span></Link><div className="product-meta">{product.category}<span><Zap size={11}/>{product.power}</span></div><Link href={`/shop/${product.id}`}><h3>{product.name}</h3></Link><div className="product-bottom"><div className="product-price">{money(product.price)} <small>ETB</small>{product.old_price&&<del>{money(product.old_price)}</del>}</div><button className="add-product" aria-label={`Add ${product.name} to cart`} disabled={!product.stock} onClick={()=>addToCart(product.id)}><Plus size={19}/></button></div></article>;
}
export function Modal({ children, title, onClose, wide = false }: {children:ReactNode;title:string;onClose:()=>void;wide?:boolean}) {
  const ref=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement;
    const overflow=document.body.style.overflow; document.body.style.overflow='hidden';
    ref.current?.focus();
    const listener=(e:KeyboardEvent)=>{
      if(e.key==='Escape')closeRef.current();
      if(e.key==='Tab'){
        const all=ref.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]');
        if(!all?.length)return;
        const first=all[0],last=all[all.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
      }
    };
    document.addEventListener('keydown',listener);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',listener);previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X/></button></div>{children}</div></div>;
}
export function CartDrawer() {
  const store=useStore();
  if(!store.cartOpen)return null;
  const lines=store.cart.map(i=>({...i,product:store.products.find(p=>p.id===i.productId)})).filter(i=>i.product);
  const total=lines.reduce((sum,i)=>sum+i.product!.price*i.quantity,0);
  return <Modal title={`Your cart (${lines.reduce((n,i)=>n+i.quantity,0)})`} onClose={()=>store.setCartOpen(false)}>{lines.length?<><div className="cart-lines">{lines.map(i=><div className="cart-line" key={i.productId}><div className="cart-art"><ProductArt product={i.product!}/></div><div className="cart-line-info"><h3>{i.product!.name}</h3><p>{money(i.product!.price)} ETB</p><div className="quantity"><button aria-label={`Decrease ${i.product!.name} quantity`} onClick={()=>store.updateQuantity(i.productId,i.quantity-1)}><Minus size={13}/></button><span>{i.quantity}</span><button aria-label={`Increase ${i.product!.name} quantity`} onClick={()=>store.updateQuantity(i.productId,i.quantity+1)}><Plus size={13}/></button></div></div><button className="icon-button" aria-label={`Remove ${i.product!.name}`} onClick={()=>store.updateQuantity(i.productId,0)}><X size={17}/></button></div>)}</div><div className="cart-subtotal"><span>Subtotal</span><strong>{money(total)} ETB</strong></div><p className="muted small">{total>=25000?'Your order qualifies for free delivery.':'Free delivery on orders over 25,000 ETB.'} Installation options at checkout.</p><Link className="button button-lime full" href="/checkout" onClick={()=>store.setCartOpen(false)}>Continue to checkout<ArrowRight size={18}/></Link><p className="secure-note"><ShieldCheck size={15}/>Secure payments powered by Chapa</p></>:<EmptyState title="A little power goes a long way." text="Find the perfect charger or accessory for your electric journey." action={<Link href="/shop" className="button button-lime" onClick={()=>store.setCartOpen(false)}>Explore the shop<ArrowRight size={17}/></Link>}/>}</Modal>;
}
export function Toast() {const {toast}=useStore();return toast?<div className="toast" role="status"><Check size={18}/>{toast}</div>:null;}
