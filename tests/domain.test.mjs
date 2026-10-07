import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, draftShots, validateShot, releaseTasks, exportProject } from '../server/domain.mjs';
import { seed } from '../server/seed.mjs';

test('草稿以用户创意为依据，任意支持时长的分镜总时长均守恒', () => {
  for(const duration of [15,29,30,61,179,180]) {
    const p=createProject({title:'城市的最后一束光',idea:'一个女孩沿着河流寻找消失的灯塔。',duration,ratio:'9:16'});
    assert.equal(p.shots.length,6);
    assert.equal(p.shots.reduce((n,s)=>n+s.duration,0),duration);
    assert.ok(p.shots.every(s=>s.prompt.includes(p.idea)&&s.image==='/art/placeholder.svg'));
    assert.equal(p.source,'template');
    assert.equal(new Set(p.shots.map(s=>s.id)).size,6);
  }
});

test('不接受缺失创意、不合法画幅和异常时长', () => {
  for(const input of [{title:'',idea:'一个女孩寻找灯塔'}, {title:'灯塔',idea:'a'}, {title:'灯塔',idea:'一个女孩寻找灯塔',duration:0.5}, {title:'灯塔',idea:'一个女孩寻找灯塔',ratio:'3:4'}]) assert.throws(()=>createProject(input));
});

test('镜头编辑保留未编辑信息并阻止超长时长', () => {
  const shot=seed().projects[0].shots[0];
  const edited=validateShot({duration:7,dialogue:'末班车到了。',approved:false},shot);
  assert.equal(edited.duration,7);assert.equal(edited.title,shot.title);assert.equal(edited.image,shot.image);assert.equal(shot.duration,5);
  for(const duration of [-1,0,NaN,61])assert.throws(()=>validateShot({duration},shot));
});

test('未提供视频母版、使用权或 AI 声明时不能创建交付', () => {
  const p=seed().projects[0],input={platforms:['douyin'],title:'测试作品'};
  assert.throws(()=>releaseTasks(p,input,[]),/母版/);
  p.masterAssetId='master';const assets=[{id:'master',type:'video',rightsConfirmed:false}];
  assert.throws(()=>releaseTasks(p,input,assets),/声明/);
  p.aiDisclosure=true;assert.throws(()=>releaseTasks(p,input,assets),/使用权/);
});

test('交付任务保持真实待接入状态，去重平台且不伪造发布成功', () => {
  const p=seed().projects[0];p.masterAssetId='master';p.aiDisclosure=true;
  const tasks=releaseTasks(p,{platforms:['douyin','douyin','xiaohongshu','hongguo'],title:'测试作品',scheduledAt:new Date(Date.now()+3600000).toISOString()},[{id:'master',type:'video',rightsConfirmed:true}]);
  assert.equal(tasks.length,3);assert.equal(tasks[0].status,'blocked_auth');assert.equal(tasks[1].status,'awaiting_manual');assert.equal(tasks[2].status,'awaiting_manual');assert.ok(tasks.every(t=>t.masterAssetId==='master'&&!t.url&&t.events.length===1));
  assert.throws(()=>releaseTasks(p,{platforms:['douyin'],title:'测试',scheduledAt:'2020-01-01'},[{id:'master',type:'video',rightsConfirmed:true}]),/排期/);
});

test('工程导出包含项目资产和复用素材，不混入不相关媒体', () => {
  const {projects,assets}=seed();const p=projects[0];const result=exportProject(p,[...assets,{id:'other',projectId:'different',type:'image'}]);
  assert.equal(result.assets.length,assets.length);assert.equal(result.schemaVersion,'0.1');assert.ok(result.note.includes('媒体原文件'));
});
