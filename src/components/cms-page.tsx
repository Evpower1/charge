'use client';
import Link from 'next/link';
import { ArrowUpRight, Plus } from 'lucide-react';
import { isValidElement, type ReactNode, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from './store';
import { CmsScope, flattenSections, useCmsRender } from './cms-runtime';
import { normalizePage, pageScope, type SiteSection } from '@/lib/website';

const labels:Record<string,string>={hero:'Hero',compatibility:'Vehicle brands','services-section':'Services','shop-section':'Featured products','network-section':'Charging network','why-section':'Why Evpower','faq-preview':'Frequently asked questions','cta-section':'Call to action','page-intro':'Page introduction','contact-grid':'Contact details & form'};
function descriptor(node:ReactNode,index:number){
 if(isValidElement<Record<string,unknown>>(node)){
  const classes=typeof node.props.className==='string'?node.props.className.split(' '):[];
  const match=classes.find(c=>labels[c]);
  const name=typeof node.props.eyebrow==='string'?'Page introduction':match?labels[match]:typeof node.props.title==='string'?node.props.title:node.type&&typeof node.type==='function'&&node.type.name==='CTA'?'Call to action':`Page section ${index+1}`;
  return {id:match||`builtin-${index}`,label:name};
 }
 return {id:`builtin-${index}`,label:`Page section ${index+1}`};
}
export function CmsPage({children,pageKey}:{children?:ReactNode;pageKey?:string}){
 const path=usePathname();const key=pageKey||normalizePage(path);const store=useStore();const render=useCmsRender(pageScope(key));
 const nodes=flattenSections(children);const defaults=nodes.map((node,i)=>({...descriptor(node,i),node}));const configured=store.site.pages[key]?.sections||[];
 const ordered=configured.length?configured:[...defaults.map(s=>({id:s.id,label:s.label,type:'builtin',hidden:false,background:'default',align:'left'} as SiteSection))];
 const known=new Set(ordered.map(s=>s.id));const all=[...ordered,...defaults.filter(s=>!known.has(s.id)).map(s=>({id:s.id,label:s.label,type:'builtin',hidden:false,background:'default',align:'left'} as SiteSection))];
 return <CmsScope.Provider value={pageScope(key)}><div className="cms-page" data-cms-page={key}>{all.map(section=>{
  const original=defaults.find(d=>d.id===section.id);
  if(section.hidden)return <div key={section.id} hidden data-cms-section={section.id} data-cms-label={section.label}/>;
  if(section.type==='builtin'&&!original)return null;
  const style=section.padding!==undefined?{'--cms-padding':`${section.padding}px`} as CSSProperties:undefined;
  return <div key={section.id} className={`cms-section-shell cms-bg-${section.background}`} data-cms-section={section.id} data-cms-label={section.label} data-cms-padding={section.padding!==undefined?'yes':undefined} style={style}>{section.type==='builtin'?render(original!.node):<CustomSection section={section} primary={!nodes.length&&all.find(s=>!s.hidden)?.id===section.id}/>}</div>;
 })}</div></CmsScope.Provider>;
}
function CustomSection({section:s,primary=false}:{section:SiteSection;primary?:boolean}){
 const Heading=primary?'h1':'h2';
 return <section className={`section cms-custom cms-custom-${s.type} cms-align-${s.align}`}><div className="container"><div className="cms-custom-copy">{s.eyebrow&&<div className="eyebrow"><span/>{s.eyebrow}</div>}{s.title&&<Heading>{s.title}</Heading>}{s.body&&<p className="cms-paragraph">{s.body}</p>}{s.buttonLabel&&<Link className={`button ${s.background==='dark'?'button-lime':'button-dark'}`} href={s.buttonHref}>{s.buttonLabel}<ArrowUpRight size={18}/></Link>}</div>{s.image&&<img className="cms-section-image" src={s.image} alt={s.imageAlt}/>}{s.items.length>0&&(s.type==='faq'?<div className="faq-list">{s.items.map((item,i)=><details key={i}><summary>{item.title}<Plus size={16}/></summary><p className="cms-paragraph">{item.body}</p></details>)}</div>:<div className="cms-custom-grid" style={{'--cms-columns':s.columns} as CSSProperties}>{s.items.map((item,i)=><article key={i}>{item.image&&<img src={item.image} alt=""/>}<h3>{item.title}</h3><p className="cms-paragraph">{item.body}</p>{item.href&&<Link className="text-link" href={item.href}>Explore<ArrowUpRight size={16}/></Link>}</article>)}</div>)}</div></section>;
}
export function CustomWebsitePage({path}:{path:string}){return <CmsPage pageKey={path}/>;}
