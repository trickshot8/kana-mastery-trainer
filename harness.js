// DOM stub + loader used by regress.js: runs the page script in a vm context with fake elements and localStorage.
const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(process.argv[2],'utf8');
const src=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function el(id){const cls=new Set();return {id,style:{},dataset:{},disabled:false,_html:'',textContent:'',value:'',offsetWidth:1,offsetHeight:300,
 classList:{add:c=>cls.add(c),remove:c=>cls.delete(c),toggle:(c,f)=>{(f===undefined?!cls.has(c):f)?cls.add(c):cls.delete(c)},contains:c=>cls.has(c)},
 get className(){return [...cls].join(' ')},set className(v){cls.clear();String(v).split(/\s+/).filter(Boolean).forEach(c=>cls.add(c))},
 get innerHTML(){return this._html},set innerHTML(v){this._html=v},appendChild(){},addEventListener(){},querySelector(){return el('q')},getBoundingClientRect(){return{bottom:0}}}}
const els={};const store={};
const ctx={console,Math,Date,JSON,setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:()=>0,
 innerHeight:800,scrollY:0,scrollTo(){},
 localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>delete store[k]},
 document:{getElementById:id=>els[id]||(els[id]=el(id)),querySelectorAll:()=>[],querySelector:()=>el('q'),createElement:()=>el('new'),addEventListener(){},title:''}};
ctx.window=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);
module.exports={ctx,els,store,run:c=>vm.runInContext(c,ctx)};
