export function pickMime(): string {
  const prefer = ['video/mp4;codecs=h264,aac','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus'];
  for (const m of prefer) { /* @ts-ignore */
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
  }
  return 'video/webm;codecs=vp9,opus';
}
