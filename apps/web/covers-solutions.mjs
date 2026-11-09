import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const slugs = readdirSync('../../content/solutions').filter(f=>f.endsWith('.md')).map(f=>f.slice(0,-3));
const hubs = new Set(['ai-voice-agent-for-recruitment-operations','ai-voice-agent-for-sales','ai-voice-agent-for-insurance','ai-voice-agent-for-customer-care','ai-call-qualification','voice-ai-agent-for-pre-screening','voice-ai-recruiter','ai-ivr','ai-outbound-calling-system']);
function rng(seed){let h=2166136261;for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return()=>{h^=h<<13;h^=h>>>17;h^=h<<5;return((h>>>0)%100000)/100000}}
const W=1600,H=900;
function svg(slug){
  const r=rng(slug), v=Math.floor(r()*6), hub=hubs.has(slug);
  const cx=300+r()*1000, cy=250+r()*400, R=140+r()*160;
  let art='';
  if(v===0) art=`<circle cx="${cx}" cy="${cy}" r="${R*1.8}" fill="url(#g1)" opacity=".55"/><circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#orb)"/>`;
  if(v===1) art=[1,2,3,4,5,6].map(i=>`<circle cx="${cx}" cy="${cy}" r="${i*R/2.2}" fill="none" stroke="#c4b5fd" stroke-opacity="${0.55-i*0.07}" stroke-width="2"/>`).join('')+`<circle cx="${cx}" cy="${cy}" r="${R/2}" fill="url(#orb)"/>`;
  if(v===2) art=[0,1,2,3,4,5,6].map(i=>`<path d="M-50 ${300+i*70+r()*60} C 400 ${100+i*60}, 900 ${800-i*50}, 1700 ${250+i*80}" fill="none" stroke="${i%2?'#7c3aed':'#c4b5fd'}" stroke-opacity=".6" stroke-width="${2+i%3*2}"/>`).join('')+`<circle cx="${cx}" cy="${cy}" r="${R*.7}" fill="url(#orb)"/>`;
  if(v===3) art=Array.from({length:70},()=>`<circle cx="${r()*W}" cy="${r()*H}" r="${1+r()*5}" fill="#e9d5ff" opacity="${.3+r()*.7}"/>`).join('')+`<circle cx="${cx}" cy="${cy}" r="${R*1.3}" fill="url(#g1)" opacity=".7"/><circle cx="${cx}" cy="${cy}" r="${R*.55}" fill="url(#orb)"/>`;
  if(v===4) art=`<rect y="${H*.55}" width="${W}" height="${H*.45}" fill="url(#g2)"/><circle cx="${cx}" cy="${H*.55}" r="${R*1.2}" fill="url(#orb)"/>`+[0,1,2,3].map(i=>`<line x1="0" x2="${W}" y1="${H*.55+i*40}" y2="${H*.55+i*40}" stroke="#c4b5fd" stroke-opacity=".25"/>`).join('');
  if(v===5) art=[0,1,2,3,4].map(i=>`<circle cx="${cx+(i-2)*R*.6}" cy="${cy+(i%2?40:-40)}" r="${R*(1-i*.08)}" fill="#7c3aed" opacity=".28"/>`).join('')+`<circle cx="${cx}" cy="${cy}" r="${R*.5}" fill="url(#orb)"/>`;
  const grid=Array.from({length:17},(_,i)=>`<line x1="${i*100}" y1="0" x2="${i*100}" y2="${H}"/>`).join('')+Array.from({length:10},(_,i)=>`<line x1="0" y1="${i*100}" x2="${W}" y2="${i*100}"/>`).join('');
  const sparks=Array.from({length:hub?14:7},()=>{const x=r()*W,y=r()*H,s=6+r()*10;return `<path d="M${x} ${y-s}L${x+s*.25} ${y-s*.25}L${x+s} ${y}L${x+s*.25} ${y+s*.25}L${x} ${y+s}L${x-s*.25} ${y+s*.25}L${x-s} ${y}L${x-s*.25} ${y-s*.25}Z" fill="#fff" opacity=".8"/>`}).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f0a24"/><stop offset="1" stop-color="#2a1065"/></linearGradient>
<radialGradient id="orb"><stop offset="0" stop-color="#f5f3ff"/><stop offset=".35" stop-color="#c4b5fd"/><stop offset="1" stop-color="#7c3aed"/></radialGradient>
<radialGradient id="g1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".9"/><stop offset="1" stop-color="#7c3aed" stop-opacity="0"/></radialGradient>
<linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7c3aed" stop-opacity=".6"/><stop offset="1" stop-color="#0f0a24" stop-opacity="0"/></linearGradient>
</defs><rect width="${W}" height="${H}" fill="url(#bg)"/><g stroke="#c4b5fd" stroke-opacity=".07">${grid}</g>${art}${sparks}</svg>`;
}
for (const s of slugs) await sharp(Buffer.from(svg(s))).webp({quality:82}).toFile(`public/images/solutions/covers/${s}.webp`);
console.log(slugs.length,'covers');
