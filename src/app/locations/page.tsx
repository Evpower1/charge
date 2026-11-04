import { pageMetadata,ensurePageVisible } from '@/lib/website-request';
import { LocationsPage } from '@/components/pages';
export async function generateMetadata(){return pageMetadata('/locations','Charging Locations');}
export default async function Page(){await ensurePageVisible('/locations');return <LocationsPage/>;}
