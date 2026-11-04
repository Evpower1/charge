import { pageMetadata,ensurePageVisible } from '@/lib/website-request';
import { AboutPage } from '@/components/pages';
export async function generateMetadata(){return pageMetadata('/about','About Us');}
export default async function Page(){await ensurePageVisible('/about');return <AboutPage/>;}
