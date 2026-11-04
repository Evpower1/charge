import { pageMetadata,ensurePageVisible } from '@/lib/website-request';
import { ShopPage } from '@/components/pages';
export async function generateMetadata(){return pageMetadata('/shop','EV Chargers & Accessories');}
export default async function Page(){await ensurePageVisible('/shop');return <ShopPage/>;}
