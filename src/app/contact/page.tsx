import { pageMetadata,ensurePageVisible } from '@/lib/website-request';
import { ContactPage } from '@/components/pages';
export async function generateMetadata(){return pageMetadata('/contact','Contact Us');}
export default async function Page(){await ensurePageVisible('/contact');return <ContactPage/>;}
