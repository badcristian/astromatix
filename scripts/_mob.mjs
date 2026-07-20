import { chromium } from 'playwright';
const [path, w] = [process.argv[2], Number(process.argv[3])];
const b=await chromium.launch(); const c=await b.newContext({reducedMotion:'reduce'});
async function secs(url){
  const p=await c.newPage();
  for(const x of ['**cookiebot.com**','**usercentrics.eu**']) await p.route(x,r=>r.abort());
  await p.setViewportSize({width:w,height:900});
  await p.goto(url,{waitUntil:'networkidle'});
  await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,40))}window.scrollTo(0,0)});
  const r=await p.evaluate(()=>{
    const heads=[...document.querySelectorAll('h1,h2,h3,h4')]
      .filter(h=>!h.closest('nav,footer,header')&&h.getBoundingClientRect().height);
    const out=heads.map(h=>({t:h.textContent.replace(/\s+/g,' ').trim().slice(0,30), y:Math.round(h.getBoundingClientRect().top+scrollY)}));
    const imgs=[...document.querySelectorAll('main img,.body img')].filter(i=>i.getBoundingClientRect().width>100)
      .map(i=>{const r=i.getBoundingClientRect();return Math.round(r.width)+'x'+Math.round(r.height)});
    return {total:document.documentElement.scrollHeight,out,imgs:imgs.slice(0,6)};
  });
  await p.close(); return r;
}
const [o,n]=await Promise.all([secs('https://www.jobmatix.com'+path),secs('http://localhost:4321'+path)]);
console.log(`${path} @${w}   original=${o.total}  rebuild=${n.total}  delta=${n.total-o.total}`);
console.log(`  orig imgs: ${o.imgs.join(' ')}`);
console.log(`  reb  imgs: ${n.imgs.join(' ')}`);
console.log('  heading gaps (orig -> rebuild):');
const map=new Map(n.out.map(x=>[x.t,x.y]));
let po=0,pn=0;
for(const {t,y} of o.out){ if(!map.has(t)) continue; const ny=map.get(t);
  const go=y-po, gn=ny-pn; po=y; pn=ny;
  const d=gn-go; if(Math.abs(d)>40) console.log(`    ${String(go).padStart(5)} -> ${String(gn).padStart(5)}  (${d>0?'+':''}${d})  ${t}`);
}
await b.close();
