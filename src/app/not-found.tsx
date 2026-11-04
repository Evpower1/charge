import Link from 'next/link';
import { ArrowRight, Zap } from 'lucide-react';
export default function NotFound(){return <section className="error-page"><div className="empty-icon"><Zap size={28}/></div><div className="eyebrow" style={{justifyContent:'center'}}>404 · A LITTLE DETOUR</div><h1>Let’s get you back on the road.</h1><p>The page you’re looking for isn’t here. There’s plenty of good energy waiting back home.</p><Link href="/" className="button button-lime">Back to home<ArrowRight size={17}/></Link></section>;}
