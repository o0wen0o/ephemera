import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CloudSun, Feather, Save, X } from 'lucide-react';
import { type Entry, localDate, moods, entryValid } from './data';
const DRAFT='ephemera-prototype-draft-v1';
export function Editor({entry,onClose,onSave,inline=false}:{entry?:Entry;onClose:()=>void;onSave:(entry:Entry)=>boolean;inline?:boolean}){
 const [value,setValue]=useState<Entry>(()=>{try{const d=JSON.parse(localStorage.getItem(DRAFT)||'null');if(entryValid(d)&&(!entry||d.id===entry.id))return d}catch{/* start an empty sheet */}if(entry)return {...entry};return {id:crypto.randomUUID(),title:'',body:'',date:localDate(),mood:'平静',weather:'晴天',tags:[],favorite:false,updated_at:new Date().toISOString()}});
 const [tag,setTag]=useState(value.tags.join('，'));
 const [saved,setSaved]=useState('');
 const [error,setError]=useState('');
 const [dirty,setDirty]=useState(false);
 const titleRef=useRef<HTMLInputElement>(null);
 const update=(part:Partial<Entry>)=>{setValue(v=>({...v,...part}));setDirty(true)};
 useEffect(()=>{if(!inline)titleRef.current?.focus()},[inline]);
 useEffect(()=>{if(!dirty)return;try{localStorage.setItem(DRAFT,JSON.stringify({...value,tags:tag.split(/[,，]/).map(t=>t.trim()).filter(Boolean)}));setSaved('草稿已存于本机')}catch{setSaved('草稿未保存，请导出或释放浏览器空间')}},[value,tag,dirty]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault()}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 const submit=()=>{if(!value.title.trim()&&!value.body.trim()){setError('写下一句话，再把今天收好。');return}const updated={...value,title:value.title.trim()||'无题',tags:[...new Set(tag.split(/[,，]/).map(t=>t.trim()).filter(Boolean))].slice(0,8),updated_at:new Date().toISOString()};if(onSave(updated)){setDirty(false);try{localStorage.removeItem(DRAFT)}catch{/* entry is already saved */}if(inline){setValue({id:crypto.randomUUID(),title:'',body:'',date:localDate(),mood:'平静',weather:'晴天',tags:[],favorite:false,updated_at:new Date().toISOString()});setTag('');setSaved('上一篇日记已收好')}else onClose()}};
 return <section className={'editor '+(inline?'editor-inline':'')} aria-label="写日记">
 <div className="editor-top"><button className="text-btn" onClick={onClose}><ArrowLeft size={17}/>返回日记</button><span className="draft-status"><Check size={13}/>{saved||'只属于你的片刻'}</span>{!inline&&<button className="icon-btn" aria-label="关闭编辑器" onClick={onClose}><X size={20}/></button>}</div>
 <div className="editor-paper"><div className="editor-eyebrow"><Feather size={17}/><span>一页日常，一点微光</span></div><label className="sr-only" htmlFor="entry-title">日记标题</label><input ref={titleRef} id="entry-title" className="title-input" placeholder="为今天，起一个名字" value={value.title} onChange={e=>update({title:e.target.value})} maxLength={120}/>
 <div className="editor-meta"><label>日期 <input aria-label="日记日期" type="date" required value={value.date} onChange={e=>{if(e.target.value)update({date:e.target.value})}}/></label><label><CloudSun size={16}/><select aria-label="天气" value={value.weather} onChange={e=>update({weather:e.target.value})}>{['晴天','多云','小雨','下雪','阴天'].map(w=><option key={w}>{w}</option>)}</select></label></div>
 <label className="sr-only" htmlFor="entry-body">日记正文</label><textarea id="entry-body" className="body-input" placeholder={'此刻，你想留下什么？\n\n一阵风，一次相遇，或是一件微不足道的小事……'} value={value.body} onChange={e=>update({body:e.target.value})}/>
 <div className="editor-bottom"><span>今天的心情</span><div className="mood-choices">{moods.map((m,i)=><button key={m} className={value.mood===m?'selected':''} onClick={()=>update({mood:m})}>{['◡','☀','♡','☂','☾'][i]} {m}</button>)}</div><label className="tag-input-label">标签<input placeholder="日常，阅读，小确幸" aria-label="日记标签，用逗号分隔" value={tag} onChange={e=>{setTag(e.target.value);setDirty(true)}}/></label></div></div>
 <footer className="editor-footer"><span>{value.body.replace(/\s/g,'').length} 字 · 慢慢写，不着急</span>{error&&<span className="error" role="alert">{error}</span>}<button className="primary" onClick={submit}><Save size={16}/>收好这篇日记</button></footer>
 </section>
}
