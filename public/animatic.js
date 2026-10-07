export async function exportAnimatic(project, { onProgress, signal } = {}) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) throw new Error('此浏览器不支持预演导出，请使用新版 Chrome 或 Edge');
  const format = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!format) throw new Error('此浏览器不支持 WebM 录制');
  const images = await Promise.all(project.shots.map(shot => new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('有分镜图片无法加载，请检查素材')); img.src = shot.image;
  })));
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = project.ratio === '9:16' ? [720,1280] : project.ratio === '1:1' ? [960,960] : [1280,720];
  const ctx = canvas.getContext('2d');
  // A visible rendering surface also works in embedded browsers that throttle detached canvases.
  const preview=document.querySelector('.export-progress');
  canvas.style.width='100%';canvas.style.borderRadius='7px';
  preview?.querySelector('img')?.replaceWith(canvas);
  const total = project.shots.reduce((n, s) => n+s.duration, 0);
  const boundaries = project.shots.map((_,i) => project.shots.slice(0,i+1).reduce((n,s)=>n+s.duration,0));
  const stream = canvas.captureStream(24);
  const recorder = new MediaRecorder(stream, { mimeType:format, videoBitsPerSecond:1800000 });
  const chunks = []; let frame, started;
  function draw(seconds) {
    const index = Math.max(0, boundaries.findIndex(boundary => seconds < boundary));
    const shot = project.shots[index], img = images[index];
    const start = index ? boundaries[index-1] : 0;
    const zoom = 1 + .055 * ((seconds - start) / shot.duration);
    const scale = Math.max(canvas.width/img.width, canvas.height/img.height) * zoom;
    const w = img.width*scale, h = img.height*scale;
    ctx.fillStyle = '#101c25'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
    const gradient = ctx.createLinearGradient(0,canvas.height*.65,0,canvas.height); gradient.addColorStop(0,'transparent'); gradient.addColorStop(1,'rgba(0,0,0,.8)'); ctx.fillStyle=gradient; ctx.fillRect(0,canvas.height*.65,canvas.width,canvas.height*.35);
    ctx.fillStyle='#fff'; ctx.font=`${canvas.width>1000?26:24}px sans-serif`; ctx.textAlign='center';
    const text = shot.dialogue || shot.title;
    const maxWidth = canvas.width-90; const lines=[]; let line='';
    for (const char of text) { if (ctx.measureText(line+char).width>maxWidth) { lines.push(line); line=''; } line+=char; } if(line)lines.push(line);
    lines.slice(0,3).forEach((line,j)=>ctx.fillText(line,canvas.width/2,canvas.height-64-(Math.min(lines.length,3)-1-j)*36));
    ctx.textAlign='left'; ctx.fillStyle='rgba(255,255,255,.55)'; ctx.font='14px monospace'; ctx.fillText(`STORYBOARD PREVIEW  /  ${String(index+1).padStart(2,'0')}`,30,35);
    stream.getVideoTracks()[0]?.requestFrame?.();
  }
  draw(0);
  return await new Promise((resolve, reject) => {
    let failure;
    const finish = () => { cancelAnimationFrame(frame); stream.getTracks().forEach(track=>track.stop()); signal?.removeEventListener('abort',abort); failure ? reject(failure) : resolve(new Blob(chunks,{type:'video/webm'})); };
    const abort = () => { failure = new Error('已取消预演导出'); if(recorder.state!=='inactive')recorder.stop(); };
    recorder.ondataavailable = event => { if(event.data.size)chunks.push(event.data); };
    recorder.onerror = () => { failure=new Error('视频录制失败'); if(recorder.state!=='inactive')recorder.stop(); else finish(); };
    recorder.onstop = finish;
    signal?.addEventListener('abort',abort,{once:true});
    if (signal?.aborted) { stream.getTracks().forEach(t=>t.stop()); reject(new Error('已取消预演导出')); return; }
    recorder.start(1000); started=performance.now();
    const tick = () => { const elapsed=(performance.now()-started)/1000; if(elapsed>=total){onProgress?.(1);recorder.stop();return;} draw(elapsed); onProgress?.(elapsed/total); frame=requestAnimationFrame(tick); };
    frame=requestAnimationFrame(tick);
  });
}
