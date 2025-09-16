'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { splitToScenes, srtFromScenes, palettes, Scene } from './lib/scenes';
import { pickMime } from './lib/record';
import { applyPlugins, filmGrain, vignette } from './lib/plugins';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

type Status = 'idle' | 'recording' | 'rendering' | 'converting' | 'ready' | 'error';

const PRESETS = [
  { name: 'Glorious Sunset', seed: 0 },
  { name: 'Energetic Neon', seed: 1 },
  { name: 'Minimal Noir', seed: 3 },
  { name: 'Eco Serene', seed: 5 }
];

export default function Page() {
  const [script, setScript] = useState('Golden-hour drone over panels; kid planting tree; bill drops; sunrise timelapse; QR pops; emotion first; sell second.');
  const [duration, setDuration] = useState(30);
  const [brand, setBrand] = useState('BabyBites • VidAI Ultra');
  const [affiliate, setAffiliate] = useState(process.env.NEXT_PUBLIC_AFFILIATE || 'https://www.amazon.com/?tag=yourtag-20');
  const [status, setStatus] = useState<Status>('idle');
  const [err, setErr] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mp4Url, setMp4Url] = useState('');
  const [srtUrl, setSrtUrl] = useState('');
  const [fps, setFps] = useState(30);
  const [seed, setSeed] = useState(0);
  const [width, setWidth] = useState(720);
  const [height, setHeight] = useState(1280);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedAudioRef = useRef<Blob | null>(null);

  const scenes: Scene[] = useMemo(()=>splitToScenes(script, duration), [script, duration]);
  const total = useMemo(()=>scenes.reduce((a,b)=>a+b.seconds, 0), [scenes]);

  function onLogo(e: any) {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => setLogoUrl(String(r.result));
    r.readAsDataURL(f);
  }

  // Voice capture
  async function captureVoice(seconds=10) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        recordedAudioRef.current = blob;
        const url = URL.createObjectURL(blob);
        const a = audioRef.current!; a.src = url; a.load();
      };
      rec.start(); setStatus('recording');
      setTimeout(()=>{ rec.stop(); setStatus('idle'); }, seconds*1000);
    } catch (e:any) { setErr('Mic permission denied or unavailable.'); }
  }

  function download(url: string, name: string) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }

  function exportSRT() {
    const srt = srtFromScenes(scenes);
    const blob = new Blob([srt], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    setSrtUrl(url); download(url, 'captions.srt');
  }

  async function convertToMp4(webmBlob: Blob) {
    setStatus('converting');
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    const data = new Uint8Array(await webmBlob.arrayBuffer());
    ffmpeg.FS('writeFile', 'in.webm', data);
    await ffmpeg.run('-i', 'in.webm', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', 'out.mp4');
    const out = ffmpeg.FS('readFile', 'out.mp4');
    const mp4Blob = new Blob([out.buffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(mp4Blob);
    setMp4Url(url);
    setStatus('ready');
  }

  async function render() {
    setStatus('rendering'); setErr(''); setVideoUrl(''); setMp4Url(''); setSrtUrl('');
    try {
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      canvas.width = width; canvas.height = height;
      const pals = palettes(); const pal = pals[seed % pals.length];

      const qrCanvas = document.createElement('canvas');
      await QRCode.toCanvas(qrCanvas, affiliate || 'https://example.com', { width: 240, margin: 0, color: { dark: '#000', light: '#fff' } });

      // Media streams
      const canvasStream = canvas.captureStream(fps);
      const audioEl = audioRef.current!;
      if (recordedAudioRef.current) { audioEl.src = URL.createObjectURL(recordedAudioRef.current); } else { audioEl.removeAttribute('src'); }
      const ac = new AudioContext();
      const dest = ac.createMediaStreamDestination();
      if (audioEl.src) { const src = ac.createMediaElementSource(audioEl); src.connect(dest); src.connect(ac.destination); }
      else { const s = ac.createBufferSource(); s.buffer = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate); s.connect(dest); s.start(); }
      const mixed = new MediaStream([ ...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks() ]);
      const mime = pickMime();
      const mr = new MediaRecorder(mixed, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
      recRef.current = mr; chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size>0) chunksRef.current.push(e.data) };
      mr.onstop = async () => {
        const out = new Blob(chunksRef.current, { type: mime.includes('mp4') ? 'video/mp4' : 'video/webm' });
        const url = URL.createObjectURL(out);
        setVideoUrl(url);
        // attempt mp4 conversion in-browser for maximum compatibility
        try { await convertToMp4(out); } catch { setStatus('ready'); }
      };
      mr.start();

      const totalFrames = Math.floor(total * fps);
      let frame = 0;
      audioEl.play().catch(()=>{});

      function draw() {
        const t = frame / fps;
        const sceneIdx = findSceneIndex(scenes, t);
        const scene = scenes[sceneIdx];
        // bg gradient
        const g = ctx.createLinearGradient(0,0,width,height);
        g.addColorStop(0, pal[0]); g.addColorStop(0.5, pal[1]); g.addColorStop(1, pal[2]);
        ctx.fillStyle = g; ctx.fillRect(0,0,width,height);

        // orbital shapes
        const cx = width/2, cy = height/2;
        for (let i=0;i<6;i++){
          const rr = 50 + i*34 + 10*Math.sin(t*0.7+i);
          ctx.beginPath();
          ctx.arc(cx + Math.sin(t*0.5+i)*120, cy + Math.cos(t*0.4+i)*140, rr/6, 0, Math.PI*2);
          ctx.fillStyle = `rgba(255,255,255,${0.1 + i*0.12})`; ctx.fill();
        }

        // caption reveal (burned text)
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '700 40px system-ui, -apple-system, Segoe UI, Roboto';
        const reveal = Math.min(1, (t - startOfScene(scenes, sceneIdx)) / 0.6);
        const caption = burnCaptions ? scene.text.slice(0, Math.max(1, Math.floor(scene.text.length*reveal))) : '';
        wrap(ctx, caption, 40, height*0.14, width-80, 46);
        ctx.restore();

        // logo (optional)
        if (logoUrl) { const img = new Image(); img.src = logoUrl; ctx.globalAlpha = 0.9; ctx.drawImage(img, 24, 24, 120, 40); ctx.globalAlpha = 1; }
        else { ctx.globalAlpha = 0.9; ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto'; ctx.fillStyle = '#8ef'; ctx.fillText(brand, 24, 36); ctx.globalAlpha = 1; }

        // disclosure
        ctx.font = '600 20px system-ui, -apple-system, Segoe UI, Roboto';
        ctx.fillStyle = '#0ff'; ctx.fillText('Paid links may earn commission. #ad', 24, height - 96);

        // QR + CTA
        const qrSize = 160; ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(width-qrSize-28, height-qrSize-28, qrSize+24, qrSize+24);
        ctx.drawImage(qrCanvas, width-qrSize-16, height-qrSize-16, qrSize, qrSize);
        ctx.font = '700 28px system-ui, -apple-system, Segoe UI, Roboto'; ctx.fillStyle = '#fff'; ctx.fillText('Link in bio →', 24, height - 40);

        // plugins (grading, vignette, grain)
        applyPlugins(ctx, t, width, height, [vignette, filmGrain]);

        frame++;
        if (frame <= totalFrames) { requestAnimationFrame(draw); } else { mr.stop(); }
      }
      requestAnimationFrame(draw);
    } catch (e:any) { console.error(e); setErr(e?.message || 'Unknown error'); setStatus('error'); }
  }

  function preset(seedIdx:number){ setSeed(seedIdx); }

  function reset(){ setErr(''); setVideoUrl(''); setMp4Url(''); setStatus('idle'); }

  return (
    <main id="main" className="container">
      <header style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12}}>
        <h1 style={{margin:0, fontSize:28}}>VidAI Ultra Studio</h1>
        <nav style={{display:'flex', gap:8}}>
          <a href="/landing"><button className="secondary">Landing</button></a>
          <a href="/policies/privacy.html"><button className="secondary">Privacy</button></a>
          <a href="/policies/terms.html"><button className="secondary">Terms</button></a>
        </nav>
      </header>

      <section className="grid grid2" aria-label="Controls">
        <div className="card grid">
          <label>Script / beats (split by punctuation)
            <textarea rows={6} value={script} onChange={e=>setScript(e.target.value)} aria-label="Script" />
          </label>
          <div style={{display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:8}}>
            <label>Duration<small> s</small><input type="number" min={10} max={120} value={duration} onChange={e=>setDuration(parseInt(e.target.value||'30'))}/></label>
            <label>FPS<input type="number" min={24} max={60} value={fps} onChange={e=>setFps(parseInt(e.target.value||'30'))}/></label>
            <label>W<input type="number" min={360} max={1080} value={width} onChange={e=>setWidth(parseInt(e.target.value||'720'))}/></label>
            <label>H<input type="number" min={640} max={1920} value={height} onChange={e=>setHeight(parseInt(e.target.value||'1280'))}/></label>
            <label>Seed<input type="number" min={0} max={9999} value={seed} onChange={e=>setSeed(parseInt(e.target.value||'0'))}/></label>
            <label>Burn captions<input type="checkbox" checked={burnCaptions} onChange={e=>setBurnCaptions(e.target.checked)} /></label>
          </div>
          <label>Brand overlay <input value={brand} onChange={e=>setBrand(e.target.value)} aria-label="Brand overlay"/></label>
          <label>Affiliate/landing link <input value={affiliate} onChange={e=>setAffiliate(e.target.value)} aria-label="Affiliate link"/></label>
          <label>Logo (PNG/SVG) <input type="file" accept=".png,.svg" onChange={onLogo} /></label>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button onClick={()=>captureVoice(10)}>Capture 10s narration</button>
            <button className="secondary" onClick={exportSRT}>Export SRT</button>
            <button className="secondary" onClick={reset}>Reset</button>
          </div>
          <audio ref={audioRef} controls aria-label="Narration preview" />
          {err && <p role="alert" style={{color:'#f66'}}>{err}</p>}
        </div>

        <div className="card grid">
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            <button onClick={render}>Render ▶</button>
            <button className="secondary" disabled={!videoUrl} onClick={()=>download(videoUrl, 'vidai-ultra.webm')}>Download WEBM</button>
            <button className="secondary" disabled={!mp4Url} onClick={()=>download(mp4Url, 'vidai-ultra.mp4')}>Download MP4</button>
            <span aria-live="polite">{status==='rendering' ? 'Rendering…' : status==='converting' ? 'Converting to MP4…' : status==='ready' ? 'Ready.' : ''}</span>
          </div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {PRESETS.map((p,i)=>(<button key={i} className="secondary" onClick={()=>preset(p.seed)}>{p.name}</button>))}
          </div>
          <canvas ref={canvasRef} style={{width:'100%', aspectRatio:'9/16', borderRadius:12}}/>
        </div>
      </section>

      <section className="card" aria-label="Scenes">
        <b>Timeline ({scenes.length} scenes / {total}s)</b>
        <ol>{scenes.map((s,i)=>(<li key={i}>{i+1}. {s.text} <small>({s.seconds}s)</small></li>))}</ol>
        <p style={{opacity:.8}}>MP4 conversion is attempted in-browser via FFmpeg; if not supported by your device, WEBM is provided.</p>
      </section>

      <footer className="card" style={{opacity:.85}}>
        <p>Disclosure: Some links may be affiliate. Ensure compliance with FTC guidelines, platform rules, and local laws.</p>
      </footer>
    </main>
  );
}

function findSceneIndex(scenes: Scene[], t: number) { let acc=0; for(let i=0;i<scenes.length;i++){ acc+=scenes[i].seconds; if(t<acc) return i; } return scenes.length-1; }
function startOfScene(scenes: Scene[], idx: number) { let acc=0; for(let i=0;i<idx;i++) acc+=scenes[i].seconds; return acc; }
function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lh: number) { const words = text.split(' '); let line=''; for (let n=0;n<words.length;n++){ const test=line+words[n]+' '; if(ctx.measureText(test).width>maxWidth && n>0){ ctx.fillText(line,x,y); line=words[n]+' '; y+=lh; } else line=test;} ctx.fillText(line,x,y); }
