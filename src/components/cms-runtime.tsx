'use client';
import { createContext, useContext, isValidElement, cloneElement, Children, Fragment, type ReactNode, type CSSProperties } from 'react';
import { usePathname } from 'next/navigation';
import { useStore } from './store';
import { fieldKey, pageScope, safeImage, safeLink, type EditorField } from '@/lib/website';
export const CmsScope = createContext('');
export function CmsText({value,scope}:{value:string;scope:string}){
 const {site}=useStore();const key=fieldKey(scope,'text',value);const current=Object.values(site.settings).filter(v=>typeof v==='string');const fallback=current.includes(value)?value:value.replace(/\b8890\b/g,site.settings.tollFree).replaceAll('+251 911 049 916',site.settings.phoneDisplay).replaceAll('info@evpower.et',site.settings.email).replaceAll('Evpower',site.settings.companyName);const text=site.overrides[key]??fallback;const style=site.textStyles[key];
 return <span data-cms-copy="" data-cms-fields={JSON.stringify([{key,kind:'text',original:value,value:text}])} style={style?{fontWeight:style.bold?750:undefined,fontStyle:style.italic?'italic':undefined,color:style.color,fontSize:style.size?`clamp(8px, ${style.size/14}vw + ${style.size/2}px, ${style.size}px)`:undefined}:undefined}>{text}</span>;
}
export function useCmsRender(explicitScope?:string){
 const store=useStore();const inherited=useContext(CmsScope);const path=usePathname();const scope=explicitScope||inherited||pageScope(path);
 function walk(node:ReactNode):ReactNode{
  if(typeof node==='string'){
   if(!node.trim()||/^[\d\s.,+×%–:/-]+$/.test(node))return node;
   return <CmsText key={fieldKey(scope,'text',node)} value={node} scope={scope}/>;
  }
  if(!isValidElement<Record<string,unknown>>(node))return node;
  if(node.type===CmsText)return node;
  const props=node.props;
  if(props['data-cms-skip']||typeof node.type==='string'&&['svg','option','script','style','textarea'].includes(node.type))return node;
  const changes:Record<string,unknown>={};const fields:EditorField[]=[];
  for(const [attribute,kind] of [['src','image'],['href','link'],['alt','alt'],['placeholder','placeholder'],['title','title']]){
   const original=props[attribute];if(typeof original!=='string'||!original)continue;
   if(attribute==='src'&&!safeImage(original))continue;
   if(attribute==='href'&&!safeLink(original))continue;
   const key=fieldKey(scope,kind,original);const s=store.site.settings;const contacts:Record<string,string>={'mailto:info@evpower.et':`mailto:${s.email}`,'tel:+251911049916':`tel:${s.phone}`,'tel:8890':`tel:${s.tollFree}`,'https://wa.me/251911049916':`https://wa.me/${s.whatsapp.replace(/\D/g,'')}`};const fallback=kind==='link'?(contacts[original]??original):original;const value=store.site.overrides[key]??fallback;
   changes[attribute]=value;fields.push({key,kind,original,value});
  }
  if(fields.length)changes['data-cms-fields']=JSON.stringify(fields);
  if(props.children!==undefined)changes.children=Children.map(props.children as ReactNode,walk);
  return cloneElement(node,changes);
 }
 return (children:ReactNode)=>walk(children);
}
export function WebsiteTheme({children}:{children:ReactNode}){
 const {site}=useStore();const t=site.settings.theme;
 const fonts={dm:"'DM Sans Variable',Arial,sans-serif",manrope:"'Manrope Variable',Arial,sans-serif",system:'system-ui,sans-serif'};
 const style={ '--ink':t.ink,'--navy':t.navy,'--lime':t.accent,'--muted':t.muted,'--soft':t.soft,'--white':t.paper,'--paper':t.paper,'--body':fonts[t.font],'--heading':fonts[t.headingFont],'--control-radius':`${t.radius}px`,'--site-width':`${t.width}px`,background:t.background,color:t.ink,fontFamily:fonts[t.font] } as CSSProperties;
 return <div className="website-theme" style={style}>{children}</div>;
}
export function flattenSections(node:ReactNode):ReactNode[]{return Children.toArray(node).flatMap(child=>isValidElement<{children?:ReactNode}>(child)&&child.type===Fragment?flattenSections(child.props.children):[child]);}
