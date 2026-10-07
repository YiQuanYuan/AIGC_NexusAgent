import http from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, extname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { seed } from './seed.mjs';
import { createProject, draftShots, validateShot, platforms, releaseTasks, exportProject } from './domain.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dataDir = process.env.NEXUS_DATA_DIR || resolve(root, 'data');
const database = resolve(dataDir, 'studio.json');
await mkdir(resolve(dataDir, 'uploads'), { recursive: true });
await mkdir(resolve(dataDir, 'exports'), { recursive: true });
let state;
try { state = JSON.parse(await readFile(database, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; state = seed(); }
let writeQueue = Promise.resolve();
async function save() {
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.catch(() => {}).then(async () => { await writeFile(`${database}.tmp`, snapshot); await rename(`${database}.tmp`, database); });
  await writeQueue;
}
await save();
const json = (res, status, value) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
async function body(req) {
  let size = 0, chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 30 * 1024 * 1024) throw new Error('文件过大：初版单个文件上限 20MB'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw new Error('请求数据格式错误'); }
}
function getProject(id) { const p = state.projects.find(p => p.id === id); if (!p) throw new Error('项目不存在'); return p; }
const mimeMap = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.webm':'video/webm', '.mov':'video/quicktime', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.ogg':'audio/ogg' };

async function api(req, res, url) {
  const path = url.pathname;
  if (req.method === 'GET' && path === '/api/state') return json(res, 200, { ...state, platforms, integrations: { libtv: Boolean(process.env.LIBTV_ACCESS_KEY) } });
  if (req.method === 'POST' && path === '/api/exports') {
    const input = await body(req), name = basename(String(input.name || ''));
    const extension = extname(name);
    if (!['.webm','.csv','.srt','.json'].includes(extension) || name.length > 240) throw new Error('不支持的导出格式');
    if (typeof input.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new Error('文件内容无效');
    const buffer=Buffer.from(input.base64,'base64');
    if (!buffer.length || buffer.length > 20*1024*1024) throw new Error('导出文件需为 1B–20MB');
    const filename=`${randomUUID()}${extension}`;
    await writeFile(resolve(dataDir,'exports',filename),buffer);
    return json(res,201,{url:`/exports/${filename}?name=${encodeURIComponent(name)}`,name,size:buffer.length});
  }
  if (req.method === 'POST' && path === '/api/projects') {
    const p = createProject(await body(req)); state.projects.unshift(p); await save(); return json(res, 201, p);
  }
  const match = path.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
  if (match) {
    const p = getProject(match[1]), action = match[2];
    if (req.method === 'GET' && action === 'export') return json(res, 200, exportProject(p, state.assets));
    if (req.method === 'PATCH' && !action) {
      const input = await body(req);
      for (const key of ['idea','outline']) if (key in input) p[key] = String(input[key]).slice(0, 20000);
      if (input.bible) for (const key of Object.keys(p.bible)) if (key in input.bible) p.bible[key] = String(input.bible[key]).slice(0, 5000);
      if ('stage' in input) { if (!Number.isInteger(input.stage) || input.stage < 0 || input.stage > 4) throw new Error('阶段不合法'); p.stage = input.stage; }
      if ('aiDisclosure' in input) p.aiDisclosure = Boolean(input.aiDisclosure);
      if ('masterAssetId' in input) {
        if (input.masterAssetId !== null && !state.assets.some(a => a.id === input.masterAssetId && a.type === 'video' && a.projectId === p.id)) throw new Error('请选择本项目的视频素材');
        p.masterAssetId = input.masterAssetId;
      }
      p.updatedAt = new Date().toISOString(); await save(); return json(res, 200, p);
    }
    if (req.method === 'POST' && action === 'draft') {
      // Explicit user action replaces a local draft. No AI call or fabricated generation status.
      p.shots = draftShots(p); p.source = 'template'; p.stage = 2; p.updatedAt = new Date().toISOString(); await save(); return json(res, 200, p);
    }
    if (req.method === 'PATCH' && action?.startsWith('shots/')) {
      const id = action.slice(6), index = p.shots.findIndex(s => s.id === id); if (index < 0) throw new Error('镜头不存在');
      const input = await body(req); const shot = validateShot(input, p.shots[index]);
      if ('assetId' in input) {
        const a = state.assets.find(a => a.id === input.assetId && a.type === 'image'); if (!a) throw new Error('请选择图片素材'); shot.image = a.url;
      }
      p.shots[index] = shot; p.updatedAt = new Date().toISOString(); await save(); return json(res, 200, shot);
    }
    if (req.method === 'POST' && action === 'reorder') {
      const { ids } = await body(req); if (!Array.isArray(ids) || ids.length !== p.shots.length || new Set(ids).size !== ids.length || ids.some(id => !p.shots.some(s => s.id === id))) throw new Error('镜头顺序无效');
      p.shots = ids.map(id => p.shots.find(s => s.id === id)); await save(); return json(res, 200, p);
    }
    if (req.method === 'POST' && action === 'releases') {
      const tasks = releaseTasks(p, await body(req), state.assets); p.releases.unshift(...tasks); await save(); return json(res, 201, tasks);
    }
    if (req.method === 'PATCH' && action?.startsWith('releases/')) {
      const t = p.releases.find(t => t.id === action.slice(9)); if (!t) throw new Error('任务不存在');
      const input = await body(req);
      if (input.status === 'cancelled' && t.status !== 'manual_reported') { t.status = 'cancelled'; t.events.push({ at: new Date().toISOString(), message: '用户取消交付任务' }); }
      else if (input.status === 'manual_reported' && ['awaiting_manual','blocked_auth'].includes(t.status)) {
        const link = new URL(input.url); const allowed = t.platformId === 'douyin' ? ['douyin.com'] : t.platformId === 'xiaohongshu' ? ['xiaohongshu.com','xhslink.com'] : ['hongguo.com','hongguoduannju.com'];
        if (link.protocol !== 'https:' || !allowed.some(domain => link.hostname === domain || link.hostname.endsWith(`.${domain}`))) throw new Error('请填写对应平台的 HTTPS 作品链接');
        t.status = 'manual_reported'; t.url = link.href; t.events.push({ at: new Date().toISOString(), message: '用户登记手动发布链接（未经平台 API 验证）' });
      } else throw new Error('不能执行这个状态变更');
      await save(); return json(res, 200, t);
    }
    if (req.method === 'POST' && action === 'libtv') {
      if (!process.env.LIBTV_ACCESS_KEY) return json(res, 409, { error: 'LibTV 尚未配置，请在服务端 .env 中设置 LIBTV_ACCESS_KEY 并重启' });
      const input = await body(req), s = p.shots.find(s => s.id === input.shotId); if (!s) throw new Error('镜头不存在');
      const response = await fetch('https://im.liblib.tv/openapi/session', { method: 'POST', headers: { Authorization: `Bearer ${process.env.LIBTV_ACCESS_KEY}`, 'Content-Type':'application/json' }, body: JSON.stringify({ message: `请生成该分镜的${input.kind === 'video' ? '视频' : '图片'}：${s.prompt}\n角色设定：${p.bible.character}\n视觉风格：${p.bible.style}\n避免：${p.bible.negative}` }), signal: AbortSignal.timeout(45000) });
      if (!response.ok) return json(res, 502, { error: `LibTV 服务返回 ${response.status}，请检查服务端权限与配额` });
      const result = await response.json(); if (!result.data?.sessionId) throw new Error('LibTV 未返回有效会话');
      const job = { id: randomUUID(), projectId:p.id, shotId:s.id, provider:'libtv', sessionId:result.data.sessionId, projectUuid:result.data.projectUuid, status:'submitted', createdAt:new Date().toISOString() };
      state.jobs.unshift(job); await save(); return json(res, 201, job);
    }
  }
  if (req.method === 'GET' && path.startsWith('/api/jobs/')) {
    const job = state.jobs.find(j => j.id === path.slice(10)); if (!job) throw new Error('任务不存在');
    if (!process.env.LIBTV_ACCESS_KEY) return json(res, 409, { error: 'LibTV 未配置' });
    const response = await fetch(`https://im.liblib.tv/openapi/session/${encodeURIComponent(job.sessionId)}`, { headers: { Authorization: `Bearer ${process.env.LIBTV_ACCESS_KEY}` }, signal:AbortSignal.timeout(30000) });
    if (!response.ok) return json(res, 502, { error:`LibTV 查询失败：${response.status}` });
    const result = await response.json(); return json(res, 200, { ...job, messages:result.data?.messages || [] });
  }
  if (req.method === 'POST' && path === '/api/assets') {
    const input = await body(req); getProject(input.projectId);
    const allowed = { 'image/png':'.png', 'image/jpeg':'.jpg', 'image/webp':'.webp', 'video/mp4':'.mp4', 'video/webm':'.webm', 'video/quicktime':'.mov', 'audio/mpeg':'.mp3', 'audio/wav':'.wav', 'audio/ogg':'.ogg' };
    const extension = allowed[input.mime]; if (!extension) throw new Error('支持 PNG、JPG、WebP、MP4、WebM、MOV、MP3、WAV、OGG');
    if (typeof input.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)) throw new Error('文件内容无效');
    const buffer = Buffer.from(input.base64, 'base64'); if (!buffer.length || buffer.length > 20 * 1024 * 1024) throw new Error('单个文件需为 1B–20MB');
    const id = randomUUID(), filename = `${id}${extension}`;
    await writeFile(resolve(dataDir, 'uploads', filename), buffer);
    const asset = { id, projectId:input.projectId, name:basename(String(input.name || filename)).slice(0,200), type:input.mime.split('/')[0], category:input.category || (input.mime.startsWith('video') ? '视频' : input.mime.startsWith('audio') ? '声音' : '参考'), url:`/uploads/${filename}`, mime:input.mime, size:buffer.length, tags:[], version:1, rightsConfirmed:false, source:'本地上传', createdAt:new Date().toISOString() };
    state.assets.unshift(asset); await save(); return json(res, 201, asset);
  }
  if (req.method === 'PATCH' && path.startsWith('/api/assets/')) {
    const asset = state.assets.find(a => a.id === path.slice(12)); if (!asset) throw new Error('素材不存在');
    const input = await body(req);
    if ('rightsConfirmed' in input) asset.rightsConfirmed = Boolean(input.rightsConfirmed);
    if ('tags' in input) asset.tags = String(input.tags).split(/[,，]/).map(t => t.trim()).filter(Boolean).slice(0,12).map(t => t.slice(0,40));
    if ('category' in input) { if (!['角色','场景','分镜','参考','视频','声音'].includes(input.category)) throw new Error('分类无效'); asset.category = input.category; }
    await save(); return json(res, 200, asset);
  }
  return json(res, 404, { error:'接口不存在' });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      // Keep local mutation endpoints same-origin. Bind loopback by default.
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) return json(res, 403, { error:'不允许跨站请求' });
      return await api(req, res, url);
    }
    if (!['GET','HEAD'].includes(req.method)) return json(res, 405, { error:'不支持的请求方法' });
    const uploaded = url.pathname.startsWith('/uploads/'), exported=url.pathname.startsWith('/exports/');
    const base = uploaded ? resolve(dataDir, 'uploads') : exported ? resolve(dataDir,'exports') : resolve(root, 'public');
    const relative = uploaded || exported ? url.pathname.slice(9) : url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = resolve(base, relative);
    if (!file.startsWith(`${base}${sep}`)) return json(res, 403, { error:'无效文件路径' });
    const info = await stat(file); if (!info.isFile()) return json(res, 404, { error:'文件不存在' });
    const bytes = await readFile(file); const mime = mimeMap[extname(file)] || 'application/octet-stream';
    const downloadName=basename(String(url.searchParams.get('name') || basename(file))).slice(0,240);
    res.writeHead(200, { 'Content-Type':mime, 'Content-Length':bytes.length, ...(exported ? {'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`} : {}), 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'", 'Cache-Control':'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch(error) {
    if (res.headersSent) return res.end();
    if (error.code === 'ENOENT') return json(res, 404, { error:'文件不存在' });
    const safeErrors = /^(项目|创意|时长|不支持|请求|文件|请选择|请先|请填写|单|阶段|镜头|素材|不能|排期|LibTV|分类|导出)/;
    json(res, safeErrors.test(error.message) ? 400 : 500, { error:safeErrors.test(error.message) ? error.message : '服务暂时无法处理请求，请重试' });
    if (!safeErrors.test(error.message)) console.error(error.message);
  }
});
server.listen(Number(process.env.PORT || 4317), process.env.HOST || '127.0.0.1', () => console.log(`Nexus Studio → http://${process.env.HOST || '127.0.0.1'}:${server.address().port}`));
