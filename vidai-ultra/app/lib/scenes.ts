export type Scene = { text: string, seconds: number };
export function splitToScenes(text: string, duration: number): Scene[] {
  const clean = text.replace(/\s+/g,' ').trim();
  if (!clean) return [{ text: 'Speak or paste a script — VidAI will build the scene.', seconds: duration }];
  const parts = clean.split(/[,.;!?]/).map(s => s.trim()).filter(Boolean);
  const count = Math.min(12, Math.max(4, parts.length));
  const secs = Math.max(2, Math.floor(duration / count));
  return parts.slice(0, count).map(p => ({ text: p, seconds: secs }));
}
export function srtFromScenes(scenes: Scene[]) {
  let idx=1, t=0, out='';
  const toTS = (sec:number)=>{
    const h=String(Math.floor(sec/3600)).padStart(2,'0');
    const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');
    const s=String(Math.floor(sec%60)).padStart(2,'0');
    const ms=String(Math.floor((sec%1)*1000)).padStart(3,'0');
    return `${h}:${m}:${s},${ms}`;
  };
  for (const sc of scenes){ const start = toTS(t); t += sc.seconds; const end = toTS(t-0.1); out += `${idx}\n${start} --> ${end}\n${sc.text}\n\n`; idx++; }
  return out;
}
export function palettes(){
  return [
    ["#0f0c29","#302b63","#24243e"],
    ["#141e30","#243b55","#0a0a0a"],
    ["#1a2a6c","#b21f1f","#fdbb2d"],
    ["#000428","#004e92","#000000"],
    ["#0b486b","#f56217","#000"],
    ["#001510","#00bf8f","#061700"]
  ];
}
