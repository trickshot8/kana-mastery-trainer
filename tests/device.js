// A simulated device (used by sync.test.js): its own localStorage, real timers and fetch, page served from `origin`.
const fs=require('fs'),vm=require('vm');
function el(id){const cls=new Set();return {id,style:{},dataset:{},disabled:false,_html:'',textContent:'',value:'',offsetWidth:1,offsetHeight:300,
 classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),toggle:(c,f)=>{(f===undefined?!cls.has(c):f)?cls.add(c):cls.delete(c)},contains:c=>cls.has(c)},
 get className(){return [...cls].join(' ')},set className(v){cls.clear();String(v).split(/\s+/).filter(Boolean).forEach(c=>cls.add(c))},
 get innerHTML(){return this._html},set innerHTML(v){this._html=v},appendChild(){},addEventListener(){},querySelector(){return el('q')},getBoundingClientRect(){return{bottom:0}}}}
module.exports=function device(file,origin,preset,log){
  const html=fs.readFileSync(file,'utf8');
  const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
  const els={},store=Object.assign({},preset||{});
  const loc={origin,protocol:origin?new URL(origin).protocol:'file:'};
  const f=log?((u,o)=>{log.push(((o&&o.method)||'GET')+' '+u);return fetch(u,o);}):fetch;
  const ctx={console,Math,Date,JSON,URL,Promise,fetch:f,AbortController,setTimeout,clearTimeout,requestAnimationFrame:()=>0,
   innerHeight:800,scrollY:0,scrollTo(){},addEventListener(){},location:loc,
   localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>delete store[k]},
   document:{visibilityState:'visible',getElementById:id=>els[id]||(els[id]=el(id)),querySelectorAll:()=>[],querySelector:()=>el('q'),createElement:()=>el('new'),addEventListener(){},title:''}};
  ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
  const run=c=>vm.runInContext(c,ctx);
  return {run,els,store,loc,
    srs:()=>JSON.parse(store.kana_srs||'{}'),mis:()=>JSON.parse(store.kana_mistakes||'{}'),
    pend:()=>JSON.parse(store.kana_pending||'{}'),sync:()=>run('Sync.sync()'),state:()=>run('Sync.state()'),
    answer:(k,ok)=>run(`updateSRSEntry('${k}',${ok},true)`)};
};
