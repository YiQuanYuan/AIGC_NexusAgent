import { randomUUID } from 'node:crypto';

export const platforms = [
  { id: 'douyin', name: '抖音', mark: '♪', color: '#21252c', mode: '官方 API', status: '待申请权限', description: '申请 video.create 权限并完成 OAuth 授权后，可接入上传、创建视频与状态查询。', requirements: ['应用审核与 video.create 权限', '账号 OAuth 授权与令牌刷新', '上传 → 创建 → 平台审核 → 回执'], url: 'https://open.douyin.com/platform/resource/docs/openapi/video-management/douyin/create/create-video' },
  { id: 'xiaohongshu', name: '小红书', mark: '小红书', color: '#e84f5e', mode: '辅助交付', status: '需手动发布', description: '公开分享 SDK 可拉起发布流程；未确认普通创作者可用的服务端笔记发布 API。交付素材和文案，保留人工完成环节。', requirements: ['确认应用类型与分享 SDK 权限', '独立准备封面、文案与话题', 'SDK 不支持自动填充标题、文案、话题'], url: 'https://agora.xiaohongshu.com/doc/js' },
  { id: 'hongguo', name: '红果短剧', mark: '果', color: '#ee6c45', mode: '剧集交付', status: '待合作接入', description: '按剧目与分集准备交付包，需向短剧创作者中心核实入驻、版权材料和合作接口。抖音短剧小程序 API 不等于红果发布接口。', requirements: ['核实合作方与剧目提交权限', '完整剧目、分集、字幕与版权材料', '取得合作文档后开发专用适配器'], url: 'https://lf3-cdn-tos.draftstatic.com/obj/ies-hotsoon-draft/playlet-copyright/user_agreement.html' },
];

export function validateProject(input) {
  const title = String(input.title || '').trim();
  const idea = String(input.idea || '').trim();
  const duration = Number(input.duration || 30);
  if (!title || title.length > 80) throw new Error('项目名称需为 1–80 个字符');
  if (idea.length < 5 || idea.length > 5000) throw new Error('创意需为 5–5000 个字符');
  if (!Number.isInteger(duration) || duration < 15 || duration > 180) throw new Error('时长需为 15–180 秒');
  if (!['16:9', '9:16', '1:1'].includes(input.ratio || '16:9')) throw new Error('不支持的画幅');
  return { title, idea, duration, ratio: input.ratio || '16:9', genre: String(input.genre || '叙事短片').slice(0, 40) };
}

export function draftShots(project) {
  const descriptions = ['用一个悬念或反常细节建立开场，交代故事发生的环境。', '让主角进入画面，展示目标、情绪与阻碍。', '用一个关键物件或动作推动情节，不依赖旁白解释。', '通过人物反应揭示冲突，保持前后镜头视线方向。', '用视觉变化呈现故事转折，让观众重新理解前面的信息。', '回到核心意象，留下情绪余韵或下一集悬念。'];
  const sizes = ['远景', '中景', '特写', '近景', '全景', '远景'];
  const base = Math.floor(project.duration / 6), remainder = project.duration % 6;
  return descriptions.map((description, i) => ({
    id: randomUUID(), title: ['建立世界', '人物登场', '关键线索', '情绪反应', '故事转折', '余韵收束'][i],
    description, size: sizes[i], movement: ['缓慢推进', '侧向跟拍', '固定镜头', '缓慢推进', '拉远', '固定镜头'][i],
    lens: ['24mm', '50mm', '85mm', '85mm', '35mm', '24mm'][i],
    duration: base + (i < remainder ? 1 : 0), sound: i === 0 ? '环境声先行，音乐渐入' : '根据故事补充音效与对白',
    dialogue: '', lighting: '待确定主光方向和色温', continuity: '固定角色外观、服装、场景布局与运动方向',
    prompt: `项目：${project.title}。创意：${project.idea}。镜头 ${i + 1}：${description} ${sizes[i]}，${project.ratio}，单一明确动作，保持角色与场景一致。`,
    image: '/art/placeholder.svg', assetId: null, approved: false, source: 'template',
  }));
}

export function createProject(input) {
  const brief = validateProject(input);
  const project = { id: randomUUID(), ...brief, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    stage: 0, source: 'template', outline: `创意原文：${brief.idea}\n\n开场：在前 3 秒建立悬念，让观众知道故事的核心问题。\n发展：主角尝试达成目标，在行动中遇到阻碍。\n转折：用关键线索或选择改变故事方向。\n结尾：呼应开场的意象，给出情绪落点。\n\n这是结构化模板草稿，请结合你的创意改写人物、冲突和结局。`,
    bible: { character: '填写主角的年龄、外观、服装、动机及禁止变化的特征。', scene: '填写时代、场景布局、物件位置、天气和光线方向。', style: '写实电影感，统一调色；每个镜头只安排一个主要动作。', color: '自定义色彩体系', negative: '角色变脸、服装漂移、左右手错位、文字乱码、无动机运镜' },
    shots: [], releases: [], masterAssetId: null, aiDisclosure: false,
  };
  project.shots = draftShots(project);
  return project;
}

export function validateShot(input, existing) {
  const result = { ...existing };
  for (const key of ['title', 'description', 'size', 'movement', 'lens', 'sound', 'dialogue', 'lighting', 'continuity', 'prompt']) {
    if (key in input) result[key] = String(input[key]).slice(0, key === 'prompt' ? 6000 : 2000);
  }
  if ('duration' in input) {
    const duration = Number(input.duration);
    if (!Number.isFinite(duration) || duration < 1 || duration > 60) throw new Error('单镜头时长需为 1–60 秒');
    result.duration = duration;
  }
  if ('approved' in input) result.approved = Boolean(input.approved);
  if ('assetId' in input) result.assetId = input.assetId;
  return result;
}

export function releaseTasks(project, input, assets) {
  const selected = [...new Set(input.platforms || [])];
  if (!selected.length || selected.some(id => !platforms.some(p => p.id === id))) throw new Error('请选择有效的发布平台');
  if (!String(input.title || '').trim()) throw new Error('请填写发布标题');
  const master = assets.find(a => a.id === project.masterAssetId && a.type === 'video');
  if (!master) throw new Error('请先在成片页面选择真实的视频文件作为交付母版');
  if (!project.aiDisclosure) throw new Error('请先确认 AI 内容声明');
  if (!master.rightsConfirmed) throw new Error('请先在素材详情中确认母版的使用权');
  let scheduledAt = null;
  if (input.scheduledAt) {
    const date = new Date(input.scheduledAt);
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) throw new Error('排期需晚于当前时间');
    scheduledAt = date.toISOString();
  }
  return selected.map(platformId => ({ id: randomUUID(), platformId, title: String(input.title).slice(0, 200), description: String(input.description || '').slice(0, 5000), scheduledAt,
    status: platformId === 'douyin' ? 'blocked_auth' : 'awaiting_manual',
    reason: platformId === 'douyin' ? '等待应用权限、账号授权和发布适配器' : platformId === 'xiaohongshu' ? '已准备交付信息，请在平台完成发布' : '等待合作权限核实与剧集材料补全',
    masterAssetId: master.id, createdAt: new Date().toISOString(), events: [{ at: new Date().toISOString(), message: '交付任务已创建；尚未向外部平台提交' }],
  }));
}

export function exportProject(project, assets) {
  return { schemaVersion: '0.1', exportedAt: new Date().toISOString(), ...project,
    assets: assets.filter(a => a.projectId === project.id || project.shots.some(s => s.assetId === a.id) || project.masterAssetId === a.id),
    note: '工程包含镜头信息与素材相对地址；媒体原文件需另行备份。本地 JSON 交付清单不代表已经发布。',
  };
}
