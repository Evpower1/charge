import { pageMetadata,ensurePageVisible } from '@/lib/website-request';
import { ServicesPage } from '@/components/pages';
export async function generateMetadata(){return pageMetadata('/services','EV Charging Services');}
export default async function Page(){await ensurePageVisible('/services');return <ServicesPage/>;}
