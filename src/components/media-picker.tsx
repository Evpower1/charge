'use client';
import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Upload, Check, Archive, X } from 'lucide-react';
import { api } from './store';
import { Modal, Spinner, ErrorMessage } from './ui';
import type { MediaItem } from '@/lib/website';
export function MediaPicker({value,onChange,label='Image',allowClear=true}:{value:string;onChange:(value:string)=>void;label?:string;allowClear?:boolean}){
 const [open,setOpen]=useState(false);
 return <div className="media-picker"><span className="editor-label">{label}</span><div className="media-current">{value?<img src={value} alt="Selected website image"/>:<span><ImagePlus size={25}/></span>}<div><button type="button" className="button button-outline" onClick={()=>setOpen(true)}><ImagePlus size={15}/>{value?'Replace image':'Choose image'}</button>{value&&allowClear&&<button type="button" className="text-link" onClick={()=>onChange('')}><X size={12}/>Remove</button>}</div></div>{open&&<MediaLibrary onClose={()=>setOpen(false)} onChoose={url=>{onChange(url);setOpen(false);}}/>}</div>;
}
export function MediaLibrary({onClose,onChoose}:{onClose:()=>void;onChoose?:(url:string)=>void}){
 const [media,setMedia]=useState<MediaItem[]>([]);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const input=useRef<HTMLInputElement>(null);
 const load=async()=>setMedia((await api<{media:MediaItem[]}>('cms/media')).media);
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 const upload=async(file:File)=>{setError('');if(file.size>8*1024*1024){setError('Choose an image smaller than 8 MB.');return;}setBusy(true);try{const body=new FormData();body.set('file',file);const res=await fetch('/api/cms/media',{method:'POST',body});const data=await res.json();if(!res.ok)throw new Error(data.error);await load();if(onChoose){onChoose(data.url);}}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <Modal title="Your image library" wide onClose={onClose}><p className="small muted" style={{marginTop:18}}>Upload public website images. PNG, JPEG, or WebP, up to 8 MB each.</p><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload website image" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);}} className="editor-file-input"/><button type="button" className="button button-lime" style={{margin:'18px 0'}} disabled={busy} onClick={()=>input.current?.click()}>{busy?<Spinner/>:<Upload size={16}/>}Upload an image</button><ErrorMessage message={error}/><div className="media-library">{media.map(item=><article key={item.id}><button type="button" className="media-image-button" onClick={()=>onChoose?.(item.url)} aria-label={`Choose ${item.name}`}><img src={item.url} alt={item.name}/>{onChoose&&<span><Check size={16}/>Use image</span>}</button><div><span title={item.name}>{item.name}</span><button type="button" className="icon-button" aria-label={`Archive ${item.name}`} title="Remove from library; existing page images remain available" onClick={async()=>{try{await api('cms/media',{id:item.id},'DELETE');await load();}catch(e){setError((e as Error).message);}}}><Archive size={13}/></button></div></article>)}</div>{!media.length&&!busy&&<p className="admin-empty">Your uploaded images will appear here.</p>}</Modal>;
}
