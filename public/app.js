import { exportAnimatic } from './animatic.js';

const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
  grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  film:'M4 3h16v18H4z M4 8h16 M4 16h16 M8 3v18 M16 3v18',
  folder:'M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z',
  image:'M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01',
  send:'M22 2L9 15 M22 2l-7 20-6-7-7-6z',
  sliders:'M4 21v-7 M4 10V3 M12 21V12 M12 8V3 M20 21v-5 M20 12V3 M1 14h6 M9 8h6 M17 16h6',
  book:'M3 3h7a2 2 0 0 1 2 2v16a4 4 0 0 0-4-2H3z M21 3h-7a2 2 0 0 0-2 2v16a4 4 0 0 1 4-2h5z',
  plus:'M12 5v14 M5 12h14', arrow:'M5 12h14 M13 6l6 6-6 6', down:'M6 9l6 6 6-6',
  search:'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  bell:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4',
  spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z M20 2v4 M18 4h4',
  play:'M8 5l12 7-12 7z', pause:'M8 5v14 M16 5v14', check:'M5 12l4 4L19 6',
  clock:'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  more:'M5 12h.01 M12 12h.01 M19 12h.01', list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  download:'M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5', upload:'M12 16V4 M7 9l5-5 5 5 M4 17v4h16v-4',
  close:'M6 6l12 12 M6 18L18 6', camera:'M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  layers:'M12 3l10 6-10 6L2 9z M2 13l10 6 10-6 M2 17l10 6 10-6',
  shield:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6', link:'M10 13l4-4 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
  volume:'M11 4L6 8H3v8h3l5 4z M15 8q5 4 0 8 M18 5q8 7 0 14',
  edit:'M16 3l5 5-12 12H4v-5z M14 5l5 5', chevron:'M9 5l7 7-7 7', back:'M19 12H5 M11 6l-6 6 6 6',
  external:'M14 3h7v7 M21 3L10 14 M10 3H3v18h18v-7', alert:'M12 3l10 18H2z M12 9v5 M12 17h.01',
  bolt:'M13 2L3 14h8l-1 8 11-12h-8z', heart:'M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 8 16 8 16S25 10 20 5',
};
function icon(name, size=19) { return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`; }
let state, currentId=localStorage.getItem('nexus-project') || 'moon-train', view='studio', stage=2, assetFilter='全部', search='', boardMode='grid';
let modalCleanup=()=>{}, focusBeforeModal, exporting=false;
const project=()=>state.projects.find(p=>p.id===currentId)||state.projects[0];
const stages=[['创意与剧本','book'],['角色与场景','layers'],['分镜设计','grid'],['成片与声音','film'],['多端发布','send']];
const nav=[['studio','创作工作台','grid'],['projects','我的项目','folder'],['assets','素材库','image'],['release','发布中心','send']];

async function api(path, options={}) {
  const response=await fetch(`/api${path}`, { ...options, headers: { 'Content-Type':'application/json', ...options.headers }, body:options.body ? JSON.stringify(options.body) : undefined });
  const result=await response.json(); if(!response.ok)throw new Error(result.error || '操作失败'); return result;
}
async function refresh(renderPage=true) { state=await api('/state'); if(!state.projects.some(p=>p.id===currentId))currentId=state.projects[0]?.id; if(renderPage)render(); }
async function mutate(path,body,method='PATCH',message='已保存') { await api(path,{method,body}); await refresh(); if(message)toast(message); }
function toast(message, error=false) { const el=document.createElement('div'); el.className=`toast ${error?'error':''}`; el.innerHTML=`${icon(error?'alert':'check')}<span>${escape(message)}</span>`; $('#toast-root').append(el); setTimeout(()=>el.remove(),4500); }
function total(p=project()){return p.shots.reduce((n,s)=>n+s.duration,0);}
function badge(text,type=''){return `<span class="badge ${type}">${escape(text)}</span>`;}
function button(text,action,cls='secondary',extra=''){return `<button class="btn ${cls}" data-action="${action}" ${extra}>${text}</button>`;}
function heading(eyebrow,title,description,actions=''){return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;}

function render() {
  const p=project();
  $('#app').innerHTML=`<aside class="sidebar">
    <a class="brand" href="#studio" data-view="studio"><img src="/art/logo.svg" alt=""><div>NEXUS<span>STUDIO</span></div></a>
    <button class="workspace-switch" data-action="workspace"><span class="workspace-avatar">Y</span><span>一泉的创作空间<small>PERSONAL WORKSPACE</small></span>${icon('down',14)}</button>
    <div class="nav-label">创作空间</div><nav>${nav.map(([id,label,i])=>`<button class="nav-item ${view===id?'active':''}" data-view="${id}" aria-label="${label}">${icon(i)}<span>${label}</span>${id==='projects'?`<small>${state.projects.length}</small>`:id==='release'&&p.releases.length?`<small>${p.releases.length}</small>`:''}</button>`).join('')}</nav>
    <div class="nav-label second">工作室</div><nav><button class="nav-item ${view==='integrations'?'active':''}" data-view="integrations" aria-label="模型与集成">${icon('sliders')}<span>模型与集成</span></button><button class="nav-item ${view==='guide'?'active':''}" data-view="guide" aria-label="创作指南">${icon('book')}<span>创作指南</span><span class="tiny-dot"></span></button></nav>
    <div class="sidebar-bottom"><div class="studio-note"><div>${icon('spark',17)} <span>让创意有下一幕</span></div><p>从一句灵感，到一个完整的故事。<br>你的导演工作台，准备好了。</p><button data-action="new-project">开始新的创作 ${icon('arrow',16)}</button></div><button class="profile" data-action="workspace"><span class="profile-avatar">泉</span><span>一泉<small>独立创作者</small></span>${badge('本地初版')}</button></div>
  </aside><div class="main-shell"><header class="topbar"><div class="breadcrumb">创作空间 ${icon('chevron',12)} <strong>${nav.find(n=>n[0]===view)?.[1]||({guide:'创作指南',integrations:'模型与集成'})[view]}</strong></div><div class="top-actions"><span class="save-state"><i></i> 本地持久保存</span><button class="icon-btn" aria-label="查看任务通知" data-action="notifications">${icon('bell')}</button><span class="top-avatar">Y</span></div></header><main class="content">${({studio:studioView,projects:projectsView,assets:assetsView,release:releaseView,integrations:integrationsView,guide:guideView})[view]()}</main><footer class="app-footer"><span>NEXUS STUDIO <em> / </em> CREATE WITH INTENTION.</span><span>本地工作台 v0.1 <span class="footer-dot">·</span> 模板与示例模式</span></footer></div>`;
  bindEvents();
}

function studioView() {
  const p=project(), approved=p.shots.filter(s=>s.approved).length;
  return `${heading('YOUR DIRECTOR’S DESK / 导演工作台','让每一个想法，都有好镜头。','把创意、分镜与素材放在一起，专注讲一个好故事。',button(`${icon('plus',17)} 新建项目`,'new-project','primary'))}
  <section class="project-banner"><div class="banner-art"><img src="${escape(p.shots[0]?.image||'/art/station.svg')}" alt="项目概念画面"><div class="art-shade"></div><span class="image-caption">${p.source==='sample'?'原创概念示意 / 非 AI 成片':'项目分镜预览'}</span></div><div class="banner-content"><div class="banner-top">${badge('当前项目','dark')}<button class="icon-btn light" aria-label="切换项目" data-view="projects">${icon('more')}</button></div><div><div class="project-kicker">A STORY IN THE MAKING</div><h2>${escape(p.title)}</h2><p>${escape(p.idea)}</p></div><div class="banner-bottom"><div class="project-meta"><span>${icon('film',15)}${escape(p.genre)}</span><span>${icon('clock',15)}${total(p)}s</span><span>${p.ratio}</span></div>${button(`预览分镜 ${icon('play',15)}`,'preview','glass')}</div></div></section>
  <div class="pipeline">${stages.map(([label,i],index)=>`<button class="pipeline-step ${stage===index?'active':''} ${index<stage?'done':''}" data-stage="${index}"><span class="step-number">${index<stage?icon('check',14):String(index+1).padStart(2,'0')}</span><span>${label}<small>${['写下故事的起点','锁定视觉一致性','让故事变成镜头','把镜头串成故事','让作品被更多人看见'][index]}</small></span>${index<4?`<span class="step-arrow">${icon('chevron',14)}</span>`:''}</button>`).join('')}</div>
  ${[briefView,bibleView,boardView,editView,releaseStage][stage](p,approved)}`;
}

function briefView(p) {
  return `<div class="stage-heading"><div><h2>故事先行，画面随后。</h2><p>定义主角、冲突与情绪落点，再开始生成。</p></div>${badge(p.source==='sample'?'示例剧本':'本地模板草稿','soft')}</div><div class="split-layout"><form id="brief-form" class="panel editor-panel"><div class="panel-heading"><h3>${icon('spark')} 创意简报</h3><span class="muted">01 / BRIEF</span></div><label>故事的种子<textarea name="idea" rows="4" required>${escape(p.idea)}</textarea></label><label>剧本与叙事结构<textarea name="outline" rows="14" required>${escape(p.outline)}</textarea></label><div class="form-footer"><span class="muted">草稿需要你确定人物、行动与转折。</span><button type="submit" class="btn primary">${icon('check',16)} 保存剧本</button></div></form><aside class="panel editorial-panel"><span class="eyebrow">STORY FIRST</span><h3>好故事，<br>从一个问题开始。</h3><div class="big-index">01.</div><div class="advice-block"><h4>他想要什么？</h4><p>给主角一个具体目标，让故事有前进的方向。</p></div><div class="advice-block"><h4>什么在阻止他？</h4><p>让阻碍发生在行动中，冲突比解释更有力量。</p></div><div class="advice-block"><h4>结尾改变了什么？</h4><p>用一个视觉细节呼应开场，留下情绪余韵。</p></div>${button(`生成分镜模板 ${icon('arrow',16)}`,'draft','secondary full')}<small class="note">本地规则生成结构草稿，不调用 AI 模型。</small></aside></div>`;
}

function bibleView(p) {
  return `<div class="stage-heading"><div><h2>先定义世界，再进入故事。</h2><p>把每次生成都需要遵守的视觉设定，沉淀为项目的创作圣经。</p></div>${badge('贯穿全部镜头','soft')}</div><div class="split-layout"><form id="bible-form" class="panel editor-panel"><div class="panel-heading"><h3>${icon('layers')} 项目视觉设定</h3><span class="muted">02 / STORY BIBLE</span></div>${[['character','角色锁定','外观、服装、道具与人物动机'],['scene','场景锁定','布局、空间关系、天气与固定物件'],['style','视觉风格','调色、质感、光线与叙事方式'],['negative','避免出现','不能改变或不希望模型生成的内容']].map(([key,label,hint])=>`<label>${label}<small>${hint}</small><textarea name="${key}" rows="3">${escape(p.bible[key])}</textarea></label>`).join('')}<label>色彩关键词<input name="color" value="${escape(p.bible.color)}"></label><div class="form-footer"><span class="muted">设定会附加到 LibTV 的生成指令。</span><button type="submit" class="btn primary">保存设定</button></div></form><aside><div class="panel reference-panel"><img src="/art/character.svg" alt="示例角色视觉设定"><div><span class="eyebrow">CHARACTER REFERENCE</span><h3>不只是相似，要始终是同一个人。</h3><p>使用同一套角色参考、服装和道具。示例图仅演示设定管理，实际项目请上传角色多角度参考。</p>${button(`${icon('upload',16)} 管理角色素材`,'goto-characters','secondary full')}</div></div><div class="consistency-card">${icon('shield',21)}<div><strong>连续性从这里开始</strong><p>同一场景固定主光方向与空间布局；相邻镜头检查视线、运动方向与动作衔接。</p></div></div></aside></div>`;
}

function boardView(p,approved) {
  return `<div class="stage-heading board-heading"><div><h2>分镜设计 <span class="count-pill">${p.shots.length}</span></h2><p>先把故事看清楚，再把每一帧做漂亮。</p></div><div class="board-tools"><span class="approval">${icon('check',14)} ${approved} / ${p.shots.length} 已确认</span><div class="view-toggle"><button class="${boardMode==='grid'?'active':''}" data-action="board-grid" aria-label="网格分镜">${icon('grid',16)}</button><button class="${boardMode==='list'?'active':''}" data-action="board-list" aria-label="列表分镜">${icon('list',16)}</button></div>${button(`${icon('download',16)} 导出分镜`,'export-shots','secondary')}</div></div>
    <div class="board-layout"><div><div class="shot-grid ${boardMode==='list'?'list-mode':''}">${p.shots.map((s,i)=>`<article class="shot-card" draggable="true" data-shot="${s.id}"><button class="shot-image" data-action="edit-shot" data-id="${s.id}"><img src="${escape(s.image)}" alt="${escape(s.title)}"><span class="shot-index">${String(i+1).padStart(2,'0')}</span><span class="shot-duration">${s.duration}s</span><span class="image-edit">${icon('edit',16)} 编辑镜头</span>${s.approved?`<span class="approved-mark">${icon('check',12)}</span>`:''}</button><div class="shot-info"><div class="shot-title"><h3>${escape(s.title)}</h3><button class="icon-btn" aria-label="编辑 ${escape(s.title)}" data-action="edit-shot" data-id="${s.id}">${icon('more',17)}</button></div><div class="shot-tags"><span>${s.size}</span><span>${s.movement}</span><span>${s.lens}</span></div><p>${escape(s.description)}</p><div class="shot-status"><span class="status-dot ${s.approved?'green':''}"></span>${s.approved?'分镜已确认':s.source==='template'?'模板草稿 · 待完善':'待确认'}<button data-action="approve-shot" data-id="${s.id}" class="text-link">${s.approved?'取消确认':'确认分镜'} ${icon('arrow',12)}</button></div></div></article>`).join('')}</div><p class="board-hint">${icon('layers',14)} 拖动卡片调整顺序 · 点击画面编辑镜头语言 · 示例画面为原创 SVG 示意图</p></div>
    <aside class="director-panel"><div class="director-label">${icon('spark',18)} 导演笔记 <span>DIRECTOR’S NOTE</span></div><h3>让镜头有目的，<br>让情绪有呼吸。</h3><div class="note-section"><span class="note-index">01</span><div><h4>先抓住前三秒</h4><p>用一个反常细节或悬念开场，让观众愿意看下去。</p></div></div><div class="note-section"><span class="note-index">02</span><div><h4>景别形成节奏</h4><p>远景建立空间，特写强调细节。避免连续使用相同构图。</p></div></div><div class="note-section"><span class="note-index">03</span><div><h4>保持视觉连续</h4><p>锁定角色、道具、光线和视线方向，每个镜头只安排一个主要动作。</p></div></div><div class="palette"><span style="background:#233e48"></span><span style="background:#6a8f8c"></span><span style="background:#d8bb83"></span><span style="background:#e6e3d1"></span></div><div class="palette-label">本片色彩 / ${escape(p.bible.color)}</div><div class="director-bottom">${icon('shield',15)} 已有 ${p.shots.filter(s=>s.assetId).length} 个镜头关联素材</div>${button(`查看完整设定 ${icon('arrow',15)}`,'goto-bible','text full')}</aside></div>
    <section class="timeline-panel"><div class="timeline-title"><div>${icon('film',18)}<strong>节奏预演</strong><span>先听故事的呼吸，再开始制作。</span></div>${button(`${icon('play',14)} 播放预演`,'preview','secondary compact')}</div><div class="timeline-track">${p.shots.map((s,i)=>`<button style="flex:${s.duration}" data-action="edit-shot" data-id="${s.id}"><img src="${escape(s.image)}" alt=""><span>${String(i+1).padStart(2,'0')} <small>${s.duration}s</small></span></button>`).join('')}</div><div class="timeline-ruler"><span>00:00</span><span>镜头总长 ${total(p)}s ${total(p)!==p.duration?`/ 目标 ${p.duration}s`:''}</span><span>00:${String(total(p)).padStart(2,'0')}</span></div></section>`;
}

function editView(p) {
  const videos=state.assets.filter(a=>a.projectId===p.id&&a.type==='video'), master=videos.find(a=>a.id===p.masterAssetId);
  return `<div class="stage-heading"><div><h2>把镜头串成故事。</h2><p>先用分镜预演验证节奏，再导入真正的视频母版。</p></div>${button(`${icon('download',16)} 导出静音预演`,'export-animatic','secondary')}</div><div class="split-layout"><section class="panel master-panel">${master?`<video controls src="${escape(master.url)}" class="master-video"></video>`:`<button class="master-placeholder" data-action="preview"><img src="${escape(p.shots[0]?.image)}" alt="分镜预演封面"><span>${icon('play',30)}<strong>先看看故事的节奏</strong><small>分镜静态预演 · ${total(p)} 秒 · 无音轨</small></span></button>`}<div class="editor-panel"><div class="panel-heading"><h3>交付母版</h3>${badge(master?'已选择视频':'未导入成片',master?'soft':'warm')}</div><form id="master-form"><label>选择本项目的视频素材<select name="masterAssetId"><option value="">尚未选择</option>${videos.map(v=>`<option value="${v.id}" ${v.id===p.masterAssetId?'selected':''}>${escape(v.name)}</option>`).join('')}</select></label><label class="checkbox-label"><input type="checkbox" name="aiDisclosure" ${p.aiDisclosure?'checked':''}><span>确认作品含 AI 生成内容，发布时按平台要求声明。</span></label><div class="form-footer">${button(`${icon('upload',16)} 上传视频`,'upload-video','secondary')}<button class="btn primary" type="submit">保存母版选择</button></div></form></div></section><aside class="panel editorial-panel"><span class="eyebrow">POST PRODUCTION</span><h3>画面讲故事，<br>声音给它生命。</h3><div class="advice-block"><h4>01 / 粗剪与节奏</h4><p>按分镜时长预演，删掉重复信息。竖版构图应单独检查主体和字幕位置。</p></div><div class="advice-block"><h4>02 / 声音与字幕</h4><p>对白、环境声、音效与音乐分轨管理。保留音乐授权信息，导出可校对的 SRT 字幕。</p></div><div class="advice-block"><h4>03 / 交付前检查</h4><p>检查黑帧、角色变化、字幕错字、声音电平和素材使用权，再确认最终母版。</p></div>${button(`${icon('download',16)} 导出对白字幕 SRT`,'export-srt','secondary full')}<small class="note">初版支持静态分镜静音 WebM 预演。音轨混合、AI 视频生成和 MP4 精剪需后续接入。</small></aside></div>`;
}
function releaseStage(p){return `<div class="stage-heading"><div><h2>一个故事，多种相遇。</h2><p>为不同平台准备不同的标题、封面和交付信息。</p></div>${button(`进入发布中心 ${icon('arrow',16)}`,'goto-release','primary')}</div>${platformCards()}<div class="info-banner">${icon('alert',20)}<div><strong>交付任务与平台发布分开记录</strong><p>当前未授权任何媒体账号。任务会等待接口接入或人工完成，不会自动显示为发布成功。</p></div></div>${button(`${icon('send',16)} 创建交付任务`,'new-release','secondary')}`;}

function projectsView() {
  return `${heading('YOUR STORIES / 我的项目','每个故事，都值得好好完成。','在一个地方管理创意、分镜和交付进度。',button(`${icon('plus',17)} 新建项目`,'new-project','primary'))}<div class="project-grid">${state.projects.map(p=>`<button class="project-card" data-action="open-project" data-id="${p.id}"><div><img src="${escape(p.shots[0]?.image||'/art/placeholder.svg')}" alt="${escape(p.title)}">${badge(p.source==='sample'?'示例项目':'创作中','dark')}</div><section><span class="eyebrow">${escape(p.genre)}</span><h2>${escape(p.title)}</h2><p>${escape(p.idea)}</p><div class="project-card-meta"><span>${p.shots.length} 个镜头 · ${total(p)}s · ${p.ratio}</span>${icon('arrow',17)}</div></section></button>`).join('')}<button class="new-project-card" data-action="new-project"><span>${icon('plus',28)}</span><h3>下一个故事，从这里开始。</h3><p>短片、短剧、品牌故事，或任何新想法。</p></button></div>`;
}

function assetsView() {
  const p=project();
  const assets=state.assets.filter(a=>a.projectId===p.id).filter(a=>assetFilter==='全部'||a.category===assetFilter).filter(a=>!search||`${a.name} ${a.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return `${heading('YOUR CREATIVE LIBRARY / 素材库','好素材，是可以复用的创作记忆。',`当前项目：${escape(p.title)}。为每个素材保留分类、标签与镜头关联。`,button(`${icon('upload',17)} 上传素材`,'upload-asset','primary'))}<div class="asset-toolbar"><div class="tabs">${['全部','角色','场景','分镜','视频','声音','参考'].map(f=>`<button class="${assetFilter===f?'active':''}" data-filter="${f}">${f}</button>`).join('')}</div><label class="search-box">${icon('search',17)}<input id="asset-search" placeholder="搜索素材、标签…" value="${escape(search)}" aria-label="搜索素材"></label></div><div class="asset-summary"><span>${assets.length} 个素材</span><span>${icon('link',14)} 点开素材查看关联与使用权</span></div><div class="asset-grid">${assets.map(a=>`<button class="asset-card" data-action="asset-detail" data-id="${a.id}"><div class="asset-image">${a.type==='image'?`<img src="${escape(a.url)}" alt="${escape(a.name)}">`:a.type==='video'?`<video src="${escape(a.url)}#t=0.1" preload="metadata" muted></video><span class="media-icon">${icon('play',24)}</span>`:`<div class="audio-art">${icon('volume',38)}<div class="wave">${Array.from({length:24},(_,i)=>`<i style="height:${10+(i*17)%45}px"></i>`).join('')}</div></div>`}${badge(a.category,'dark')}</div><div class="asset-info"><h3>${escape(a.name)}</h3><p>${escape(a.source)} <span>v${a.version}</span></p><div class="asset-tags">${a.tags.slice(0,3).map(t=>`<span>${escape(t)}</span>`).join('')}</div><div class="asset-rights">${icon(a.rightsConfirmed?'shield':'alert',13)} ${a.rightsConfirmed?'使用权已确认':'使用权待确认'}</div></div></button>`).join('')}</div>${assets.length?'':`<div class="empty-state">${icon('image',44)}<h3>${search?'没有匹配的素材':'还没有这类素材'}</h3><p>${search?'试试其他名称或标签。':'上传图片、视频或声音，建立你的创作资产。'}</p>${button('上传素材','upload-asset','secondary')}</div>`}`;
}

function platformCards(){return `<div class="platform-grid">${state.platforms.map(p=>`<article class="panel platform-card"><div class="platform-head"><span class="platform-logo ${p.id}" style="background:${p.color}">${p.mark}</span><div><h3>${p.name}</h3><small>${p.mode}</small></div>${badge(p.status,p.id==='douyin'?'soft':'warm')}</div><p>${escape(p.description)}</p><ul>${p.requirements.map(r=>`<li>${icon('check',13)} ${escape(r)}</li>`).join('')}</ul><a href="${p.url}" target="_blank" rel="noopener" class="text-link">查看官方依据 ${icon('external',13)}</a></article>`).join('')}</div>`;}
const statuses={blocked_auth:['待接入授权','warm'],awaiting_manual:['待人工交付','soft'],manual_reported:['已登记发布链接','soft'],cancelled:['已取消','']};
function releaseView(){
  const p=project();
  return `${heading('DISTRIBUTION DESK / 发布中心','让好故事，抵达更多人。','统一准备素材与文案；按各平台真实能力安排交付。',button(`${icon('plus',17)} 新建交付任务`,'new-release','primary'))}${platformCards()}<div class="stage-heading"><div><h2>交付队列 <span class="count-pill">${p.releases.length}</span></h2><p>当前项目：${escape(p.title)} · 时间按 Asia/Shanghai 显示</p></div>${button(`${icon('download',16)} 导出交付清单`,'export-project','secondary')}</div><div class="panel queue-panel">${p.releases.length?`<div class="queue-table"><div class="queue-row queue-header"><span>作品 / 平台</span><span>计划时间</span><span>状态</span><span>操作</span></div>${p.releases.map(t=>{const pf=state.platforms.find(p=>p.id===t.platformId);return `<div class="queue-row"><div class="queue-work"><span class="platform-logo small ${pf.id}" style="background:${pf.color}">${pf.mark}</span><div><strong>${escape(t.title)}</strong><small>${pf.name}</small></div></div><span class="queue-time">${t.scheduledAt?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(t.scheduledAt)):'准备后交付'}<small>仅记录排期 · 未自动提交</small></span><div>${badge(...statuses[t.status])}<small class="reason">${escape(t.reason)}</small></div><div class="queue-actions">${t.url?`<a href="${escape(t.url)}" target="_blank" rel="noopener" class="text-link">作品链接 ${icon('external',13)}</a>`:t.status!=='cancelled'?`${button('登记链接','manual-release','text compact',`data-id="${t.id}"`)}${button('取消','cancel-release','text compact',`data-id="${t.id}"`)}`:''}</div></div>`;}).join('')}</div>`:`<div class="empty-state queue-empty">${icon('send',35)}<h3>下一个好故事，准备启程。</h3><p>先选择视频母版，再为各平台创建交付任务。<br>初版不会向媒体账号实际上传或发布。</p>${button('准备第一份交付','new-release','secondary')}</div>`}</div><div class="info-banner">${icon('shield',20)}<div><strong>每次交付，都有来处。</strong><p>记录素材使用权、AI 声明、交付任务和人工登记链接。官方接口、合作接口和人工操作各自保留真实状态。</p></div></div>`;
}

function integrationsView(){return `${heading('CONNECTED CREATIVITY / 模型与集成','好工具，在合适的时候接力。','让模型负责生成，让工作台负责故事、资产和流程。')}<div class="integration-hero"><div class="integration-symbol">L<span>↗</span></div><div><div class="eyebrow">VERIFIED PROVIDER / 已核实接口</div><h2>LibTV Agent-IM</h2><p>使用官方会话接口提交创作指令、查询消息，并跳转原始画布。<br>你的角色设定与镜头提示词会随任务一起提交。</p></div>${badge(state.integrations.libtv?'密钥已配置':'待配置密钥',state.integrations.libtv?'soft':'warm')}</div><div class="split-layout"><section class="panel editor-panel"><div class="panel-heading"><h3>${icon('bolt')} 生成连接</h3></div><div class="setup-step"><span>01</span><div><h4>获取 LibTV Access Key</h4><p>向服务商申请调用权限，确认账号可用的模型与计费方式。</p></div></div><div class="setup-step"><span>02</span><div><h4>只在服务端配置</h4><p>将 <code>LIBTV_ACCESS_KEY</code> 填入项目根目录的 <code>.env</code>，使用 <code>node --env-file=.env server/index.mjs</code> 启动。密钥不会发给浏览器。</p></div></div><div class="setup-step"><span>03</span><div><h4>在镜头中提交生成</h4><p>打开分镜编辑器，检查提示词并选择生成图片或视频。提交会调用真实服务并消耗服务商配额。查询结果在生成任务列表中查看。</p></div></div><a class="text-link" href="https://github.com/libtv-labs/libtv-skills" target="_blank" rel="noopener">官方接口与鉴权说明 ${icon('external',14)}</a></section><aside class="panel editorial-panel"><span class="eyebrow">BUILD WITH INTENTION</span><h3>把能力接进来，<br>把作品留在手里。</h3><p>下一阶段为图片、视频、语音和剪辑分别建立适配器，统一任务回执、素材血缘与费用记录。</p><div class="advice-block"><h4>规划中的能力</h4><p>多模型路由 / 首尾帧控制 / 多音轨剪辑 / FFmpeg 渲染 / 平台 OAuth / 可靠发布队列。</p></div><span class="note">目前已实现 LibTV 指令提交与手动查询。自动提取结果、下载入库、重试与视频拼接尚未实现。</span></aside></div><div class="stage-heading"><div><h2>生成任务</h2><p>只有真实接口返回的任务才会出现在这里。</p></div></div><div class="panel job-panel">${state.jobs.length?state.jobs.map(j=>`<div class="job-row"><div><strong>${escape(state.projects.find(p=>p.id===j.projectId)?.title||'项目')} · ${escape(state.projects.flatMap(p=>p.shots).find(s=>s.id===j.shotId)?.title||'镜头')}</strong><small>LIBTV · ${escape(j.sessionId)}</small></div>${badge('已提交会话','soft')}${button('查询消息','query-job','secondary compact',`data-id="${j.id}"`)}<a class="text-link" href="https://www.liblib.tv/canvas?projectId=${encodeURIComponent(j.projectUuid||'')}" target="_blank" rel="noopener">打开画布 ${icon('external',13)}</a></div>`).join(''):`<div class="empty-state compact-empty">${icon('spark',25)}<p>尚未向模型提交生成任务</p></div>`}</div>`;}

function guideView(){return `${heading('FROM IDEA TO SCREEN / 创作指南','先成为导演，再使用 AI。','参考 LibTV 的创作能力，建立适合长期复用的生产流程。')}<div class="guide-intro"><span class="eyebrow">THE NEXUS WAY</span><h2>把生成变成有依据的创作。</h2><p>创意不是一段提示词，成片也不是镜头的堆叠。<br>用故事结构、视觉设定和镜头语言，把每一步连起来。</p><span class="guide-number">05</span></div><div class="guide-grid">${[
['01','创意 → 剧本','明确观众、题材、主角目标、冲突和结局。把开场钩子、转折与情绪落点写出来。','交付物：简报 / 故事梗概 / 分场剧本'],
['02','剧本 → 视觉圣经','固定角色、服装、道具、场景、色彩和光线。用参考图支撑设定，减少后续返工。','交付物：角色表 / 场景表 / 风格参考'],
['03','视觉 → 专业分镜','为每个镜头明确叙事目的、景别、焦段、机位、运镜、动作、声音和时长。先用预演验证节奏。','交付物：镜头表 / 首帧参考 / 提示词 / 预演'],
['04','分镜 → 成片','先低成本试镜再生成高质量版本。检查角色与空间连续性，完成剪辑、配音、字幕、音效和调色。','交付物：版本素材 / 母版 / 字幕 / 封面'],
['05','成片 → 发行','按平台准备画幅、封面、文案和剧集材料。区分上传、审核、发布与人工登记，回收真实数据。','交付物：平台交付包 / 回执 / 复盘记录'],
].map(([n,t,d,o])=>`<article class="panel guide-card"><span>${n}</span><h3>${t}</h3><p>${d}</p><small>${o}</small></article>`).join('')}<article class="panel guide-card mint-card">${icon('heart',25)}<h3>把素材变成资产</h3><p>每个素材保留所属项目、用途、标签、来源和使用权；通过镜头关联找到它在故事中的位置。</p><small>后续增加：版本分支 / 内容哈希 / 父素材血缘</small></article></div><section class="panel sources"><h3>调研依据 <span>2026.10.07 核实</span></h3><p>优先使用官网与官方接口文档。红果的具体合作接口仍需入驻后核实。</p><a href="https://www.liblib.tv/" target="_blank" rel="noopener">LibTV 官方创作工具 ${icon('external',13)}</a><a href="https://github.com/libtv-labs/libtv-skills" target="_blank" rel="noopener">LibTV Agent-IM 官方仓库 ${icon('external',13)}</a><a href="https://open.douyin.com/platform/resource/docs/openapi/video-management/douyin/create/create-video" target="_blank" rel="noopener">抖音视频创建接口 ${icon('external',13)}</a><a href="https://agora.xiaohongshu.com/doc/js" target="_blank" rel="noopener">小红书分享 SDK ${icon('external',13)}</a><a href="https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/playlet-copyright/user_agreement.html" target="_blank" rel="noopener">短剧版权中心用户协议 ${icon('external',13)}</a><a href="/research.html" target="_blank">完整产品与技术设计 ${icon('arrow',13)}</a></section>`;}

function bindEvents(){
  $$('[data-view]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();view=el.dataset.view;search='';render();window.scrollTo(0,0);}));
  $$('[data-stage]').forEach(el=>el.addEventListener('click',()=>{stage=Number(el.dataset.stage);render();}));
  $$('[data-filter]').forEach(el=>el.addEventListener('click',()=>{assetFilter=el.dataset.filter;render();}));
  bindActions($('#app'));
  $('#asset-search')?.addEventListener('input',event=>{const pos=event.target.selectionStart;search=event.target.value;render();const input=$('#asset-search');input.focus();input.setSelectionRange(pos,pos);});
  $('#brief-form')?.addEventListener('submit',submit(async data=>mutate(`/projects/${project().id}`,data,'PATCH','剧本已保存')));
  $('#bible-form')?.addEventListener('submit',submit(async data=>mutate(`/projects/${project().id}`,{bible:data},'PATCH','视觉设定已保存')));
  $('#master-form')?.addEventListener('submit',submit(async(data,form)=>mutate(`/projects/${project().id}`,{masterAssetId:data.masterAssetId||null,aiDisclosure:form.aiDisclosure.checked},'PATCH','母版信息已保存')));
  let dragId;
  $$('.shot-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{dragId=card.dataset.shot;e.dataTransfer.setData('text/plain',dragId);card.classList.add('dragging');});
    card.addEventListener('dragend',()=>{$$('.shot-card').forEach(c=>c.classList.remove('dragging','drag-over'));});
    card.addEventListener('dragover',e=>{e.preventDefault();card.classList.add('drag-over');});
    card.addEventListener('dragleave',()=>card.classList.remove('drag-over'));
    card.addEventListener('drop',async e=>{e.preventDefault();try{const ids=project().shots.map(s=>s.id);const from=ids.indexOf(dragId),to=ids.indexOf(card.dataset.shot);if(from<0||from===to)return;ids.splice(to,0,ids.splice(from,1)[0]);await mutate(`/projects/${project().id}/reorder`,{ids},'POST','镜头顺序已保存');}catch(e){toast(e.message,true);}});
  });
}
function bindActions(root){ $$('[data-action]',root).forEach(el=>el.addEventListener('click',async event=>{event.preventDefault();try{await action(el.dataset.action,el.dataset.id);}catch(e){toast(e.message,true);}})); }
function submit(fn){return async event=>{event.preventDefault();const form=event.target,btn=$('button[type=submit]',form);if(btn)btn.disabled=true;try{await fn(Object.fromEntries(new FormData(form)),form);}catch(e){toast(e.message,true);}finally{if(btn)btn.disabled=false;}};}

function openModal(title,subtitle,html,cls=''){
  closeModal(false);focusBeforeModal=document.activeElement;
  $('#modal-root').innerHTML=`<div class="modal-backdrop"><section class="modal ${cls}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${title}</h2><p>${subtitle}</p></div><button class="icon-btn" data-action="close-modal" aria-label="关闭窗口">${icon('close',22)}</button></div><div class="modal-body">${html}</div></section></div>`;
  document.body.classList.add('modal-open');bindActions($('#modal-root'));
  $('.modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
  const first=$('input:not([type=checkbox]),textarea,select,button',$('.modal'));first?.focus();
}
function closeModal(restore=true){modalCleanup();modalCleanup=()=>{};$('#modal-root').innerHTML='';document.body.classList.remove('modal-open');if(restore)focusBeforeModal?.focus();}
document.addEventListener('keydown',event=>{if(!$('.modal'))return;if(event.key==='Escape'){closeModal();return;}if(event.key==='Tab'){const items=$$('button:not([disabled]),[href],input,textarea,select',$('.modal')).filter(el=>el.offsetParent!==null),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});

async function action(name,id){
  const p=project();
  switch(name){
    case 'close-modal':closeModal();break;
    case 'new-project':newProjectModal();break;
    case 'open-project':currentId=id;localStorage.setItem('nexus-project',id);stage=project().stage;view='studio';render();break;
    case 'workspace':openModal('你的创作空间','本地工作台 · 数据保存在本项目的 data 目录',`<div class="workspace-detail"><span class="profile-avatar large">泉</span><h3>一泉的创作空间</h3><p>${state.projects.length} 个项目 · ${state.assets.length} 个素材 · 无外部账号授权</p><p>所有创作内容保存在本机。备份时请同时保留工程 JSON 和 data/uploads 中的媒体文件。</p></div>`);break;
    case 'notifications':openModal('工作台动态','当前真实状态',`<div class="notification-item">${icon('check',20)}<div><strong>本地项目已加载</strong><p>${state.projects.length} 个项目与 ${state.assets.length} 个素材可用。</p></div></div><div class="notification-item">${icon('link',20)}<div><strong>${state.integrations.libtv?'LibTV 密钥已配置':'模型尚未连接'}</strong><p>${state.integrations.libtv?'可在分镜编辑器提交真实生成任务。':'当前可以编辑模板草稿、管理素材和导出分镜预演。'}</p></div></div><div class="notification-item">${icon('send',20)}<div><strong>媒体账号尚未接入</strong><p>交付任务会保留为待接入或待人工处理。</p></div></div>`);break;
    case 'edit-shot':shotModal(id);break;
    case 'approve-shot':{const s=p.shots.find(s=>s.id===id);await mutate(`/projects/${p.id}/shots/${id}`,{approved:!s.approved},'PATCH',s.approved?'已取消镜头确认':'镜头已确认');break;}
    case 'board-grid':boardMode='grid';render();break;
    case 'board-list':boardMode='list';render();break;
    case 'goto-bible':stage=1;view='studio';render();break;
    case 'goto-characters':assetFilter='角色';view='assets';render();break;
    case 'goto-release':view='release';render();break;
    case 'draft':openModal('重新生成分镜模板','会替换当前镜头列表，请先导出有价值的镜头信息。',`<p>使用本地故事结构规则生成 6 个镜头，保留项目剧本与视觉设定。新镜头需要你完善具体行动，并关联自己的素材。</p><div class="form-footer">${button('先导出工程','export-project','secondary')}${button('替换为模板草稿','confirm-draft','primary')}</div>`);break;
    case 'confirm-draft':await mutate(`/projects/${p.id}/draft`,{},'POST','分镜模板已生成，请完善镜头内容');stage=2;closeModal();render();break;
    case 'preview':previewModal();break;
    case 'export-project':await download(JSON.stringify(await api(`/projects/${p.id}/export`),null,2),`${p.title}_工程与交付清单.json`,'application/json');toast('工程清单已导出，媒体原文件需单独备份');break;
    case 'export-shots':await exportShots(p);break;
    case 'export-srt':await exportSrt(p);break;
    case 'export-animatic':await exportVideo(p);break;
    case 'upload-asset':uploadModal();break;
    case 'upload-video':uploadModal('video');break;
    case 'asset-detail':assetModal(id);break;
    case 'new-release':releaseModal();break;
    case 'cancel-release':await mutate(`/projects/${p.id}/releases/${id}`,{status:'cancelled'},'PATCH','交付任务已取消');break;
    case 'manual-release':manualModal(id);break;
    case 'query-job':{const job=await api(`/jobs/${id}`);openModal('LibTV 会话消息','服务商返回的原始消息，尚未自动导入素材库。',`<pre class="job-output">${escape(JSON.stringify(job.messages,null,2))}</pre>`);break;}
  }
}

function newProjectModal(){
  openModal('你的下一个故事是什么？','从一句创意开始，让我们为它搭一个舞台。',`<form id="new-project-form"><label>项目名称<input name="title" placeholder="给故事起个名字" maxlength="80" required></label><label>一句话创意<textarea name="idea" rows="4" placeholder="谁，在什么地方，想做什么，遇到了什么意外？" minlength="5" maxlength="5000" required></textarea></label><div class="form-grid"><label>内容类型<select name="genre"><option>叙事短片</option><option>竖屏短剧</option><option>品牌广告</option><option>知识科普</option><option>音乐视觉</option></select></label><label>目标时长<select name="duration"><option value="30">30 秒</option><option value="60">60 秒</option><option value="90">90 秒</option><option value="120">120 秒</option></select></label><label>画幅<select name="ratio"><option>16:9</option><option>9:16</option><option>1:1</option></select></label></div><div class="form-note">${icon('spark',17)} 初版会创建本地结构化草稿和 6 个分镜模板，便于你进一步创作。</div><div class="form-footer"><span class="muted">故事，由你来定义。</span><button type="submit" class="btn primary">创建项目 ${icon('arrow',16)}</button></div></form>`);
  $('#new-project-form').addEventListener('submit',submit(async data=>{const p=await api('/projects',{method:'POST',body:data});currentId=p.id;localStorage.setItem('nexus-project',p.id);stage=0;view='studio';await refresh();closeModal();toast('项目已创建，先完善你的故事');}));
}

function shotModal(id){
  const p=project(),s=p.shots.find(s=>s.id===id), index=p.shots.indexOf(s), images=state.assets.filter(a=>a.type==='image');
  openModal(`镜头 ${String(index+1).padStart(2,'0')} · ${escape(s.title)}`,'为每一次生成明确叙事目的与镜头语言。',`<div class="shot-editor"><div class="shot-editor-preview"><img src="${escape(s.image)}" alt="${escape(s.title)}"><div class="reference-caption">${s.source==='sample'?'原创概念示意图':'关联画面 / 模板占位'}</div><div class="scene-note"><h4>${icon('shield',16)} 当前角色设定</h4><p>${escape(p.bible.character)}</p></div><div class="scene-note"><h4>${icon('volume',16)} 当前声音设计</h4><p>${escape(s.sound)}</p></div></div><form id="shot-form"><label>镜头名称<input name="title" value="${escape(s.title)}" required></label><label>画面与行动<textarea name="description" rows="3">${escape(s.description)}</textarea></label><div class="form-grid four"><label>景别<select name="size">${['大远景','远景','全景','中景','近景','特写','大特写'].map(v=>`<option ${s.size===v?'selected':''}>${v}</option>`).join('')}</select></label><label>运镜<select name="movement">${['固定镜头','缓慢推进','拉远','侧向跟拍','摇镜头','升降镜头','手持跟拍'].map(v=>`<option ${s.movement===v?'selected':''}>${v}</option>`).join('')}</select></label><label>焦段<input name="lens" value="${escape(s.lens)}"></label><label>时长 / 秒<input name="duration" type="number" min="1" max="60" step="0.5" value="${s.duration}" required></label></div><label>光线与色彩<input name="lighting" value="${escape(s.lighting)}"></label><label>连续性要求<input name="continuity" value="${escape(s.continuity)}"></label><div class="form-grid two"><label>声音设计<input name="sound" value="${escape(s.sound)}"></label><label>对白 / 字幕<input name="dialogue" value="${escape(s.dialogue)}"></label></div><label>关联图片素材<select name="assetId"><option value="">${s.assetId?'保留当前关联':'待关联素材'}</option>${images.map(a=>`<option value="${a.id}" ${a.id===s.assetId?'selected':''}>${escape(a.name)}</option>`).join('')}</select></label><label>生成提示词 <button type="button" id="build-prompt" class="text-link inline-link">根据镜头信息重新整理 ${icon('spark',12)}</button><textarea name="prompt" aria-label="生成提示词" rows="4">${escape(s.prompt)}</textarea></label><label class="checkbox-label"><input name="approved" type="checkbox" ${s.approved?'checked':''}><span>镜头语言已确认</span></label><div class="form-footer"><div class="generation-controls"><select id="generation-kind" aria-label="生成类型"><option value="image">生成图片</option><option value="video">生成视频</option></select><button type="button" id="generate-shot" class="btn secondary">${icon('spark',15)} 提交 LibTV</button></div><button type="submit" class="btn primary">保存镜头</button></div><small class="note">生成前请先保存镜头。LibTV ${state.integrations.libtv?'已配置，提交会消耗服务商配额':'未配置，不会调用模型'}。</small></form></div>`,'wide');
  $('#build-prompt').addEventListener('click',()=>{const form=$('#shot-form');form.prompt.value=`${form.description.value}。${form.size.value}，${form.lens.value} 镜头，${form.movement.value}，时长 ${form.duration.value} 秒，${p.ratio} 构图。光线：${form.lighting.value}。连续性：${form.continuity.value}。风格：${p.bible.style}。保持单一明确动作，避免：${p.bible.negative}。`;toast('提示词已整理，请保存镜头');});
  $('#shot-form').addEventListener('submit',submit(async(data,form)=>{data.duration=Number(data.duration);data.approved=form.approved.checked;if(!data.assetId)delete data.assetId;await mutate(`/projects/${p.id}/shots/${id}`,data,'PATCH','镜头已保存');closeModal();}));
  $('#generate-shot').addEventListener('click',async()=>{const btn=$('#generate-shot');btn.disabled=true;try{const form=$('#shot-form'),data=Object.fromEntries(new FormData(form));data.duration=Number(data.duration);data.approved=form.approved.checked;if(!data.assetId)delete data.assetId;await api(`/projects/${p.id}/shots/${id}`,{method:'PATCH',body:data});await api(`/projects/${p.id}/libtv`,{method:'POST',body:{shotId:id,kind:$('#generation-kind').value}});await refresh();closeModal();view='integrations';render();toast('真实生成指令已提交，可查询会话消息');}catch(e){toast(e.message,true);}finally{btn.disabled=false;}});
}

function previewModal(){
  const p=project();let seconds=0,playing=true,last=performance.now(),frame;
  openModal('先看一遍故事。',`静态分镜预演 · ${total(p)} 秒 · 无音轨 · 非 AI 视频`, `<div class="preview-screen"><img id="preview-image" src="${escape(p.shots[0]?.image)}" alt=""><div class="preview-letterbox top"></div><div class="preview-letterbox bottom"></div><span class="preview-watermark">STORYBOARD / ${escape(p.title)}</span><div id="preview-subtitle"></div></div><div class="preview-controls"><button class="icon-btn" id="preview-play" aria-label="暂停预演">${icon('pause',18)}</button><input type="range" id="preview-seek" min="0" max="${total(p)}" step=".1" value="0" aria-label="预演进度"><span id="preview-time">00:00 / 00:${total(p)}</span></div><div class="preview-meta"><strong id="preview-shot"></strong><span id="preview-camera"></span></div>`,'preview-modal');
  function update(){let cumulative=0;const index=p.shots.findIndex(s=>{cumulative+=s.duration;return seconds<cumulative;});const s=p.shots[Math.max(0,index)];$('#preview-image').src=s.image;$('#preview-subtitle').textContent=s.dialogue||s.title;$('#preview-shot').textContent=`${String(Math.max(0,index)+1).padStart(2,'0')} / ${s.title}`;$('#preview-camera').textContent=`${s.size} · ${s.movement} · ${s.lens}`;$('#preview-seek').value=seconds;$('#preview-time').textContent=`${timeDisplay(seconds)} / ${timeDisplay(total(p))}`;}
  const tick=now=>{if(playing){seconds+=(now-last)/1000;if(seconds>=total(p)){seconds=total(p)-.01;playing=false;$('#preview-play').innerHTML=icon('play',18);}}last=now;update();frame=requestAnimationFrame(tick);};
  $('#preview-play').addEventListener('click',()=>{if(seconds>=total(p)-.05)seconds=0;playing=!playing;$('#preview-play').innerHTML=icon(playing?'pause':'play',18);$('#preview-play').ariaLabel=playing?'暂停预演':'播放预演';});
  $('#preview-seek').addEventListener('input',e=>{seconds=Number(e.target.value);update();});
  frame=requestAnimationFrame(tick);modalCleanup=()=>cancelAnimationFrame(frame);update();
}
function timeDisplay(seconds){return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}

function uploadModal(type=''){
  openModal(type==='video'?'导入你的成片':'给故事增加一点素材','文件保存在本机项目中，单个文件上限 20MB。',`<form id="upload-form"><label class="file-drop">${icon('upload',32)}<strong>选择${type==='video'?'视频':'图片、视频或音频'}文件</strong><span>PNG / JPG / WebP / MP4 / WebM / MOV / MP3 / WAV / OGG</span><input name="file" type="file" accept="${type==='video'?'video/mp4,video/webm,video/quicktime':'image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/wav,audio/ogg'}" required></label><label>素材分类<select name="category">${['参考','角色','场景','分镜','视频','声音'].map(v=>`<option ${v===(type==='video'?'视频':assetFilter==='全部'?'参考':assetFilter)?'selected':''}>${v}</option>`).join('')}</select></label><div class="form-note">${icon('shield',17)} 上传后，请在素材详情中记录标签并确认使用权。</div><div class="form-footer"><span id="upload-status" class="muted">保留原文件，建立项目素材记录。</span><button type="submit" class="btn primary">上传素材</button></div></form>`);
  $('#upload-form').addEventListener('submit',submit(async(_,form)=>{const file=form.file.files[0];if(file.size>20*1024*1024)throw new Error('单个文件上限为 20MB');$('#upload-status').textContent='正在上传…';await uploadFile(file,form.category.value);await refresh();closeModal();toast('素材已上传，可在素材库编辑标签和使用权');}));
}
async function uploadFile(file,category){
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('无法读取文件'));reader.readAsDataURL(file);});
  return await api('/assets',{method:'POST',body:{projectId:project().id,name:file.name,mime:file.type||guessMime(file.name),base64,category}});
}
function guessMime(name){const ext=name.split('.').at(-1).toLowerCase();return {mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'}[ext]||'';}

function assetModal(id){
  const a=state.assets.find(a=>a.id===id),used=state.projects.flatMap(p=>p.shots.filter(s=>s.assetId===id).map(s=>`${p.title} / ${s.title}`));
  openModal(escape(a.name),'素材的信息与它在故事中的位置',`<div class="asset-detail-preview">${a.type==='image'?`<img src="${escape(a.url)}" alt="${escape(a.name)}">`:a.type==='video'?`<video controls src="${escape(a.url)}"></video>`:`<audio controls src="${escape(a.url)}"></audio>`}</div><form id="asset-form"><div class="form-grid two"><label>分类<select name="category">${['角色','场景','分镜','参考','视频','声音'].map(v=>`<option ${v===a.category?'selected':''}>${v}</option>`).join('')}</select></label><label>标签（逗号分隔）<input name="tags" value="${escape(a.tags.join(', '))}"></label></div><label class="checkbox-label"><input type="checkbox" name="rightsConfirmed" ${a.rightsConfirmed?'checked':''}><span>我确认有权在本项目中使用这个素材。</span></label><div class="asset-detail-meta"><p>来源：${escape(a.source)} · 版本 v${a.version}${a.size?` · ${(a.size/1024/1024).toFixed(2)} MB`:''}</p><p>镜头关联：${used.length?used.map(escape).join('、'):'暂未被镜头引用'}</p></div><div class="form-footer"><a class="btn secondary" href="${escape(a.url)}" download="${escape(a.name)}">${icon('download',16)} 下载原素材</a><button type="submit" class="btn primary">保存素材信息</button></div></form>`);
  $('#asset-form').addEventListener('submit',submit(async(data,form)=>{data.rightsConfirmed=form.rightsConfirmed.checked;await mutate(`/assets/${id}`,data,'PATCH','素材信息已保存');closeModal();}));
}

function releaseModal(){
  const p=project(),master=state.assets.find(a=>a.id===p.masterAssetId);
  if(!master||!p.aiDisclosure||!master.rightsConfirmed){openModal('先完成交付准备','母版、使用权与 AI 声明都需要有记录。',`<div class="checklist">${[[Boolean(master),'选择本项目真实的视频母版'],[Boolean(master?.rightsConfirmed),'在素材详情确认母版使用权'],[p.aiDisclosure,'确认作品的 AI 内容声明']].map(([ok,label])=>`<div>${icon(ok?'check':'clock',20)}<span>${label}</span>${badge(ok?'已完成':'待完成',ok?'soft':'warm')}</div>`).join('')}</div><div class="form-footer">${button('去素材库确认使用权','goto-assets','secondary')}${button(`准备视频母版 ${icon('arrow',16)}`,'goto-master','primary')}</div>`);$$('[data-action="goto-master"]').forEach(e=>e.addEventListener('click',()=>{closeModal();view='studio';stage=3;render();}));$$('[data-action="goto-assets"]').forEach(e=>e.addEventListener('click',()=>{closeModal();view='assets';assetFilter='视频';render();}));return;}
  openModal('为作品安排下一站。','创建的是本地交付任务，当前不会自动上传到平台。',`<form id="release-form"><label>发布标题<input name="title" value="${escape(p.title)}" maxlength="200" required></label><label>文案与话题<textarea name="description" rows="4">${escape(p.idea)}\n#AI短片 #${escape(p.genre)}</textarea></label><label>选择平台</label><div class="platform-choices">${state.platforms.map(p=>`<label class="platform-choice"><input type="checkbox" name="platforms" value="${p.id}" checked><span class="platform-logo small ${p.id}" style="background:${p.color}">${p.mark}</span><span>${p.name}<small>${p.mode}</small></span></label>`).join('')}</div><label>计划交付时间（可选，Asia/Shanghai）<input name="scheduledAt" type="datetime-local"></label><div class="form-note">${icon('film',17)} 母版：${escape(master.name)}。排期仅记录在清单中，不会触发外部提交。</div><div class="form-footer"><span class="muted">按平台权限等待接入或人工完成。</span><button type="submit" class="btn primary">创建交付任务</button></div></form>`);
  $('#release-form').addEventListener('submit',submit(async(data,form)=>{data.platforms=[...form.querySelectorAll('[name=platforms]:checked')].map(el=>el.value);if(data.scheduledAt)data.scheduledAt=`${data.scheduledAt}:00+08:00`;await api(`/projects/${p.id}/releases`,{method:'POST',body:data});await refresh();view='release';render();closeModal();toast('交付任务已创建，尚未向平台提交');}));
}
function manualModal(id){
  const t=project().releases.find(t=>t.id===id),p=state.platforms.find(p=>p.id===t.platformId);
  openModal('登记手动发布链接',`${p.name} · ${escape(t.title)}`,`<form id="manual-form"><label>平台作品链接<input type="url" name="url" placeholder="https://…" required></label><div class="form-note">${icon('alert',17)} 此记录由你手动提供，不代表平台 API 已确认发布或审核结果。</div><div class="form-footer"><button type="submit" class="btn primary">保存发布记录</button></div></form>`);
  $('#manual-form').addEventListener('submit',submit(async data=>{await mutate(`/projects/${project().id}/releases/${id}`,{...data,status:'manual_reported'},'PATCH','手动发布链接已登记');closeModal();}));
}

async function download(content,name,type){
  const blob=content instanceof Blob?content:new Blob([content],{type});
  if(!blob.size)throw new Error('导出文件为空，请重试');
  const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('无法读取导出文件'));reader.readAsDataURL(blob);});
  const result=await api('/exports',{method:'POST',body:{name,base64}});
  const a=document.createElement('a');a.href=result.url;a.download=name;document.body.append(a);a.click();a.remove();
  return result;
}
async function exportShots(p){
  const fields=[['序号',(_,i)=>i+1],['镜头名称',s=>s.title],['画面行动',s=>s.description],['景别',s=>s.size],['焦段',s=>s.lens],['运镜',s=>s.movement],['时长秒',s=>s.duration],['光线',s=>s.lighting],['连续性',s=>s.continuity],['声音',s=>s.sound],['对白',s=>s.dialogue],['提示词',s=>s.prompt],['素材',s=>s.assetId||'']];
  // Prefix formula-like cells to keep exported creative text inert in spreadsheet apps.
  const cell=v=>`"${String(v??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
  const csv='\uFEFF'+fields.map(([h])=>cell(h)).join(',')+'\r\n'+p.shots.map((s,i)=>fields.map(([,fn])=>cell(fn(s,i))).join(',')).join('\r\n');
  await download(csv,`${p.title}_专业分镜.csv`,'text/csv;charset=utf-8');toast('专业分镜表已导出');
}
async function exportSrt(p){let start=0,n=0;const ts=s=>{const ms=Math.round(s*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;};const blocks=p.shots.map(s=>{const end=start+s.duration,block=s.dialogue.trim()?`${++n}\n${ts(start)} --> ${ts(end)}\n${s.dialogue.trim()}\n`:'';start=end;return block;}).filter(Boolean);if(!blocks.length){toast('当前镜头没有对白，请先填写字幕',true);return;}await download(blocks.join('\n'),`${p.title}_对白.srt`,'text/plain;charset=utf-8');toast('对白字幕已导出，请在剪辑软件中校对');}
async function exportVideo(p){
  if(exporting){toast('已有预演正在导出');return;}exporting=true;const controller=new AbortController();
  openModal('正在制作静音分镜预演','将分镜静态画面按时长录制为 WebM；请保持当前页面可见。',`<div class="export-progress"><img src="${escape(p.shots[0]?.image)}" alt="预演封面"><div class="progress-bar"><i id="export-bar"></i></div><p id="export-label">正在准备画面…</p><small>这是静态分镜预演，不包含 AI 动作视频或音轨。</small></div>`);
  modalCleanup=()=>controller.abort();
  try{const blob=await exportAnimatic(p,{signal:controller.signal,onProgress:n=>{if($('#export-bar'))$('#export-bar').style.width=`${n*100}%`;if($('#export-label'))$('#export-label').textContent=`正在录制 ${(n*100).toFixed(0)}% · 总长 ${total(p)}s`;}});modalCleanup=()=>{};if(blob.size<1000)throw new Error('录制未产生有效视频数据，请换用新版 Chrome 或 Edge');const result=await download(blob,`${p.title}_静音分镜预演.webm`);openModal('静音分镜预演已保存',`本地文件 ${(result.size/1024/1024).toFixed(2)} MB · ${total(p)} 秒分镜 · 无音轨`, `<div class="export-progress"><video controls src="${result.url}" style="width:100%;border-radius:7px"></video><p style="margin-top:17px">文件已完整保存在本机，可预览或重新下载。</p><div class="form-footer"><a class="btn primary" href="${result.url}" download="${escape(result.name)}">${icon('download',16)} 下载 WebM 预演</a><span class="muted">这是静态分镜预演，不是 AI 动态成片。</span></div></div>`);toast('WebM 预演已保存到本地导出目录');}catch(e){modalCleanup=()=>{};if(!controller.signal.aborted)openModal('预演导出暂未完成','没有保存空文件，请根据下面的原因重试。',`<div class="form-note">${icon('alert',19)} ${escape(e.message)}</div><p>你仍然可以播放分镜预演，或导出镜头表和字幕。</p>`);}finally{exporting=false;}
}

try{await refresh(false);stage=project().stage;render();}catch(e){$('#app').innerHTML=`<div class="boot"><img src="/art/logo.svg" width="54" alt="Nexus"><h2>工作台暂时无法加载</h2><p>${escape(e.message)}</p><button class="btn primary" id="reload">重新加载</button></div>`;$('#reload').addEventListener('click',()=>location.reload());}
