/* Hebrew calendar + crypto — from original app */
const HebrewDate=(function(){
  const HM=['ניסן','אייר','סיון','תמוז','אב','אלול','תשרי','חשון','כסלו','טבת','שבט','אדר','אדר א׳','אדר ב׳'];
  const HL={1:'א',2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י',20:'כ',30:'ל',40:'מ',50:'נ',60:'ס',70:'ע',80:'פ',90:'צ',100:'ק',200:'ר',300:'ש',400:'ת'};
  function isLeap(y){return ((7*y+1)%19)<7}
  function monthsIn(y){return isLeap(y)?13:12}
  function elapsedDays(y){const m=Math.floor((235*y-234)/19);const p=12084+13753*m;let d=m*29+Math.floor(p/25920);if(((3*(d+1))%7)<3)d++;return d}
  function delay1(y){const last=elapsedDays(y-1),cur=elapsedDays(y),next=elapsedDays(y+1);if(next-cur===356)return 2;if(cur-last===382)return 1;return 0}
  function delay2(y){return elapsedDays(y)+delay1(y)}
  function daysInYear(y){return elapsedDays(y+1)-elapsedDays(y)}
  function longChesh(y){return daysInYear(y)%10===5}
  function shortKis(y){return daysInYear(y)%10===3}
  function daysInMonth(y,m){
    if(m===2||m===4||m===6||m===10||m===13)return 29;
    if(m===8&&!longChesh(y))return 29;
    if(m===9&&shortKis(y))return 29;
    if(m===12&&!isLeap(y))return 29;
    return 30;
  }
  function gToJD(y,m,d){const a=Math.floor((14-m)/12),y2=y+4800-a,m2=m+12*a-3;return d+Math.floor((153*m2+2)/5)+365*y2+Math.floor(y2/4)-Math.floor(y2/100)+Math.floor(y2/400)-32045-0.5}
  function toJD(y,m,d){const mn=monthsIn(y);let jd=delay2(y)+d+347997;if(m<7){for(let mo=7;mo<=mn;mo++)jd+=daysInMonth(y,mo);for(let mo=1;mo<m;mo++)jd+=daysInMonth(y,mo)}else{for(let mo=7;mo<m;mo++)jd+=daysInMonth(y,mo)}return jd}
  function jdToH(jd){jd=Math.floor(jd)+0.5;let count=Math.floor(((jd-347995.5)*98496.0)/35975351.0);let y=count-1;for(let i=count;jd>=toJD(i,7,1);i++)y++;const first=jd<toJD(y,1,1)?7:1;let m=first;for(let i=first;jd>toJD(y,i,daysInMonth(y,i));i++)m++;const dayRaw=(jd-toJD(y,m,1))+1;const dim=daysInMonth(y,m);const d=Math.max(1,Math.min(dim,Math.floor(dayRaw+0.5)));return{year:y,month:m,day:d}}
  function gToH(date){const jd=Math.floor(gToJD(date.getFullYear(),date.getMonth()+1,date.getDate())+0.5);return jdToH(jd)}
  function yToStr(y){let v=y%1000;if(y>=5000)v=y-5000;let r='';if(v>=400){const h=Math.floor(v/100),tt=Math.floor(h/4);for(let i=0;i<tt;i++)r+='ת';const rem=h%4;if(rem>0)r+=HL[rem*100];v=v%100}else if(v>=100){const h=Math.floor(v/100);r+=HL[h*100];v=v%100}if(v===15)r+='טו';else if(v===16)r+='טז';else{if(v>=10){const t=Math.floor(v/10);r+=HL[t*10];v=v%10}if(v>0)r+=HL[v]}if(r.length>1)r=r.slice(0,-1)+'״'+r.slice(-1);else if(r.length===1)r=r+'׳';return r}
  function dToL(d){const di=Math.floor(Number(d));if(!Number.isFinite(di)||di<1)return'';if(di===15)return'ט״ו';if(di===16)return'ט״ז';let r='';if(di>=10){const t=Math.floor(di/10);r+=HL[t*10];const rem=di%10;if(rem>0)r=r+HL[rem]}else r=HL[di];if(!r)return'';if(r.length>1)r=r.slice(0,-1)+'״'+r.slice(-1);else if(r.length===1)r=r+'׳';return r}
  function fmt(date,opts){opts=opts||{};const h=gToH(date);let mn=HM[h.month-1]||'';if(h.month===12&&isLeap(h.year))mn='אדר א׳';if(h.month===13)mn='אדר ב׳';const dayNum=Math.floor(Number(h.day));const dStr=opts.short?String(dayNum):dToL(h.day);const yStr=yToStr(h.year);if(opts.dayOnly)return dStr;if(opts.dayMonth)return(dStr+' '+mn).trim();return[dStr,mn,yStr].filter(Boolean).join(' ')}
  return{format:fmt,convert:gToH}
})();

const Crypto=(function(){
  const enc=new TextEncoder();
  const dec=new TextDecoder();
  async function deriveKey(password,salt){
    const baseKey=await crypto.subtle.importKey('raw',enc.encode(password),{name:'PBKDF2'},false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:100000,hash:'SHA-256'},baseKey,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function encrypt(text,password){
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const key=await deriveKey(password,salt);
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,enc.encode(text));
    const c=new Uint8Array(salt.length+iv.length+ct.byteLength);
    c.set(salt,0);c.set(iv,salt.length);c.set(new Uint8Array(ct),salt.length+iv.length);
    let s='';const bytes=c;for(let i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  async function decrypt(encrypted,password){
    const c=Uint8Array.from(atob(encrypted),x=>x.charCodeAt(0));
    const salt=c.slice(0,16),iv=c.slice(16,28),ct=c.slice(28);
    const key=await deriveKey(password,salt);
    const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:iv},key,ct);
    return dec.decode(pt);
  }
  async function hashPassword(password){
    const salt=crypto.getRandomValues(new Uint8Array(16));
    const key=await deriveKey(password,salt);
    const v=await crypto.subtle.encrypt({name:'AES-GCM',iv:new Uint8Array(12)},key,enc.encode('verify'));
    const c=new Uint8Array(salt.length+v.byteLength);
    c.set(salt,0);c.set(new Uint8Array(v),salt.length);
    let s='';for(let i=0;i<c.length;i++)s+=String.fromCharCode(c[i]);
    return btoa(s);
  }
  async function verifyPassword(password,hash){
    try{
      const c=Uint8Array.from(atob(hash),x=>x.charCodeAt(0));
      const salt=c.slice(0,16),v=c.slice(16);
      const key=await deriveKey(password,salt);
      const d=await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(12)},key,v);
      return dec.decode(d)==='verify';
    }catch(e){return false}
  }
  return{encrypt,decrypt,hashPassword,verifyPassword};
})();
