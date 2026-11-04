import { websiteForRequest } from '@/lib/website-request';
import { HomePage } from '@/components/home';
export default function Page(){return <HomePage/>;}

export async function generateMetadata(){const {site}=await websiteForRequest();return {title:{absolute:site.pages['/']?.seoTitle||site.settings.seoTitle},description:site.pages['/']?.seoDescription||site.settings.seoDescription,alternates:{canonical:'/'}};}
