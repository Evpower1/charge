export type Product = { id: string; name: string; category: string; price: number; old_price: number | null; description: string; power: string; connector: string; stock: number; badge: string; color: string; featured: number };
export type Station = { id: string; name: string; city: string; area: string; lat: number; lng: number; power: string; connectors: string; hours: string; verified: number; source_url: string; verified_at: string; status: string };
export type User = { id: string; name: string; email: string; phone: string; role: string };
export type CartItem = { productId: string; quantity: number };
export type Address = { id: string; label: string; city: string; address: string; phone: string };
export type Order = { id: string; name: string; email: string; phone: string; city: string; address: string; total: number; subtotal: number; delivery: number; installation: number; status: string; payment_status: string; created_at: string; items: { name: string; quantity: number; price: number; product_id: string }[] };
export type Booking = { id: string; name: string; service: string; date: string; time: string; location: string; connector: string; status: string; created_at: string };
export const money = (value: number) => new Intl.NumberFormat('en-ET', { maximumFractionDigits: 0 }).format(value);
