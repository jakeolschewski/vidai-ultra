export type FramePlugin = (ctx: CanvasRenderingContext2D, t: number, W: number, H: number) => void;

export const filmGrain: FramePlugin = (ctx, t, W, H) => {
  const imageData = ctx.createImageData(W, H);
  for (let i=0; i<imageData.data.length; i+=4) {
    const v = 255 * Math.random() * 0.06;
    imageData.data[i] = v; imageData.data[i+1] = v; imageData.data[i+2] = v; imageData.data[i+3] = 12;
  }
  ctx.putImageData(imageData, 0, 0);
};

export const vignette: FramePlugin = (ctx, t, W, H) => {
  const g = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)/3, W/2,H/2, Math.max(W,H)/1.1);
  g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
};

export function applyPlugins(ctx: CanvasRenderingContext2D, t: number, W: number, H: number, list: FramePlugin[]) {
  for (const p of list) p(ctx, t, W, H);
}
