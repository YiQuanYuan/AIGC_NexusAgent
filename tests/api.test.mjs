import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
let server, base, directory;
before(async () => {
  directory=await mkdtemp(resolve(tmpdir(),'nexus-test-'));
  server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'0',HOST:'127.0.0.1',NEXUS_DATA_DIR:directory,LIBTV_ACCESS_KEY:''},cwd:resolve(import.meta.dirname,'..'),stdio:['ignore','pipe','pipe']});
  base=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('测试服务启动超时')),10000);server.stdout.on('data',chunk=>{const match=String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});server.once('exit',code=>{clearTimeout(timer);reject(new Error(`测试服务退出 ${code}`));});server.stderr.on('data',chunk=>process.stderr.write(chunk));});
});
after(async () => { if(server){server.kill('SIGTERM');await new Promise(resolve=>server.exitCode!==null?resolve():server.once('exit',resolve));}if(directory)await rm(directory,{recursive:true,force:true}); });
async function request(path,method='GET',body){const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}

test('完整本地创作与交付：新建、编辑、上传、关联、发布阻塞、导出', async () => {
  let result=await request('/api/projects','POST',{title:'API 测试故事',idea:'一个邮差把最后一封信送到星空。',duration:30,ratio:'16:9'});assert.equal(result.status,201);const p=result.data;
  result=await request(`/api/projects/${p.id}/shots/${p.shots[0].id}`,'PATCH',{duration:6,description:'邮差打开了一封没有地址的信。'});assert.equal(result.data.duration,6);
  result=await request('/api/assets','POST',{projectId:p.id,name:'poster.png',mime:'image/png',base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jp3sAAAAASUVORK5CYII=',category:'分镜'});assert.equal(result.status,201);const image=result.data;
  result=await request(`/api/projects/${p.id}/shots/${p.shots[0].id}`,'PATCH',{assetId:image.id});assert.equal(result.data.image,image.url);
  const mediaResponse=await fetch(`${base}${image.url}`);assert.equal(mediaResponse.status,200);assert.equal(mediaResponse.headers.get('content-type'),'image/png');
  result=await request(`/api/projects/${p.id}/reorder`,'POST',{ids:p.shots.map(s=>s.id).reverse()});assert.equal(result.data.shots[0].id,p.shots.at(-1).id);
  result=await request(`/api/projects/${p.id}/releases`,'POST',{platforms:['douyin'],title:'测试'});assert.equal(result.status,400);
  // Transport-only fixture; video encoding validity belongs to the later media probe worker.
  result=await request('/api/assets','POST',{projectId:p.id,name:'fixture.webm',mime:'video/webm',base64:Buffer.from('transport test only').toString('base64'),category:'视频'});const video=result.data;assert.equal(result.status,201);
  await request(`/api/assets/${video.id}`,'PATCH',{rightsConfirmed:true,tags:'成片,测试'});
  await request(`/api/projects/${p.id}`,'PATCH',{masterAssetId:video.id,aiDisclosure:true});
  result=await request(`/api/projects/${p.id}/releases`,'POST',{platforms:['douyin','xiaohongshu'],title:'星空来信'});assert.equal(result.status,201);assert.equal(result.data[0].status,'blocked_auth');const task=result.data[0];
  result=await request(`/api/projects/${p.id}/releases/${task.id}`,'PATCH',{status:'manual_reported',url:'https://evil.example/video'});assert.equal(result.status,400);
  result=await request(`/api/projects/${p.id}/releases/${task.id}`,'PATCH',{status:'manual_reported',url:'https://www.douyin.com/video/123'});assert.equal(result.data.status,'manual_reported');
  result=await request(`/api/projects/${p.id}/export`);assert.ok(result.data.assets.some(a=>a.id===video.id));assert.equal(result.data.releases.length,2);
  result=await request('/api/state');assert.ok(result.data.projects.some(item=>item.id===p.id));assert.equal(result.data.integrations.libtv,false);
});

test('拒绝跨站写入、镜头乱序和未配置的模型调用',async()=>{
  const response=await fetch(`${base}/api/projects`,{method:'POST',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
  const result=await request('/api/projects/moon-train/reorder','POST',{ids:['shot-1']});assert.equal(result.status,400);
  const generation=await request('/api/projects/moon-train/libtv','POST',{shotId:'shot-1'});assert.equal(generation.status,409);
});

test('导出文件真实落盘并通过本地地址完整下载',async()=>{
  const payload='镜头,名称\n01,星空来信';
  const result=await request('/api/exports','POST',{name:'专业分镜.csv',base64:Buffer.from(payload).toString('base64')});
  assert.equal(result.status,201);assert.equal(result.data.size,Buffer.byteLength(payload));
  const response=await fetch(`${base}${result.data.url}`);assert.equal(response.status,200);assert.equal(await response.text(),payload);assert.ok(response.headers.get('content-disposition').startsWith('attachment'));
});
