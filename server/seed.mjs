export function seed() {
  const projectId = 'moon-train';
  const shotData = [
    ['雨夜的站台', '空无一人的站台，时钟停在 23:59。一列亮着暖光的老式列车驶入雨幕。', '远景', '缓慢推进', '24mm', 5, '雨声、远处列车刹车声', '最后一班列车，今晚去哪里？', 'station'],
    ['一张单程车票', '少女的手指摩挲泛黄车票，目的地一栏写着「月球」。', '特写', '固定镜头', '85mm', 4, '纸张摩擦声，钢琴单音', '', 'ticket'],
    ['跨过那道门', '少女抱着旧行李箱走进车厢，暖光慢慢包围她的轮廓。', '中景', '侧向跟拍', '50mm', 5, '脚步声、车门缓缓关闭', '你也在等一个不可能的答案吗？', 'door'],
    ['窗外，不再是城市', '少女看向窗外，城市的霓虹渐渐变成漂浮的星光。', '近景', '缓慢推进', '85mm', 5, '轨道节奏渐弱，弦乐渐入', '', 'window'],
    ['驶入星海', '列车离开轨道，在无边星海中前行，月球在远处升起。', '全景', '拉远', '35mm', 6, '音乐抬升，低频风声', '有些告别，是为了下一次相见。', 'space'],
    ['终点，也是起点', '少女站在月球站台上，远处的背影转身。画面停在她微笑的瞬间。', '远景', '固定镜头', '24mm', 5, '音乐落点，最后保留两秒安静', '我到了。', 'moon'],
  ];
  const shots = shotData.map((s, i) => ({ id: `shot-${i+1}`, title: s[0], description: s[1], size: s[2], movement: s[3], lens: s[4], duration: s[5], sound: s[6], dialogue: s[7], image: `/art/${s[8]}.svg`, assetId: `asset-${s[8]}`, approved: i < 3, source: 'sample',
    lighting: i < 4 ? '冷色雨夜环境光 + 车厢 3200K 暖色侧光，保留轮廓光' : '月光冷白主光，车窗暖黄补光，低对比星空',
    continuity: '林夏：短发、米色风衣、棕色行李箱。列车始终从画面左侧向右侧运动。',
    prompt: `${s[1]}。${s[2]}，${s[4]} 镜头，${s[3]}，16:9 电影构图。冷青与琥珀暖光对比，细腻胶片颗粒，克制的情绪。角色林夏始终为短黑发、米色风衣；保持棕色行李箱与列车运动方向一致。单一连续动作，避免镜头跳变。`,
  }));
  return { version: 1, projects: [{ id: projectId, title: '最后一班月球列车', idea: '一个在雨夜错过末班车的女孩，意外登上一列开往月球的列车。在星海的终点，她终于有机会和离别的人好好说再见。', duration: 30, ratio: '16:9', genre: '治愈 · 奇幻短片', stage: 2, source: 'sample', createdAt: '2026-10-07T10:00:00.000Z', updatedAt: '2026-10-07T10:00:00.000Z',
    outline: '一句话故事\n雨夜，一张写着「月球」的车票，让一个女孩踏上了与过去和解的旅程。\n\n第一幕 · 错过（0–9s）\n林夏在雨夜站台等待，时钟停在 23:59。她从口袋里摸出一张旧车票，目的地是月球。\n\n第二幕 · 出发（9–24s）\n她走进暖黄的车厢。列车驶离城市，窗外的霓虹变成星光。她终于愿意放下那个一直没有答案的问题。\n\n第三幕 · 抵达（24–30s）\n月球站台上，一个熟悉的背影回过头。林夏笑了。「我到了。」\n\n情绪曲线：孤独 → 好奇 → 惊奇 → 释然。\n叙事原则：用车票、光线与表情讲故事，减少解释性旁白。',
    bible: { character: '林夏，22 岁，齐耳黑色短发，米色风衣，白色衬衫。随身携带棕色旧行李箱。情绪克制，微表情自然。固定发型、衣领、行李箱颜色。', scene: '雨夜老式站台，铁皮顶棚，23:59 的圆形时钟。深绿列车、暖黄车窗。月球站台保留同款时钟，形成视觉呼应。', style: '写实奇幻 / 胶片质感 / 克制叙事。地面段冷青环境光与琥珀暖光对比；太空段低饱和蓝与月白。', color: '冷青 · 琥珀 · 月白', negative: '过度饱和、塑料皮肤、变脸、服装变化、多余手指、文字乱码、无动机快速运镜' },
    shots, releases: [], masterAssetId: null, aiDisclosure: false,
  }], assets: [
    ...shots.map((s,i) => ({ id: s.assetId, projectId, name: `${String(i+1).padStart(2,'0')}_${s.title}.svg`, type: 'image', category: '分镜', url: s.image, mime: 'image/svg+xml', tags: ['月球列车', s.size, '原创示意图'], version: 1, rightsConfirmed: true, source: '原创 SVG 示意图 · 非 AI 生成', createdAt: '2026-10-07T10:00:00.000Z', size: 0 })),
    { id: 'asset-character', projectId, name: '林夏_角色设定.svg', type: 'image', category: '角色', url: '/art/character.svg', mime: 'image/svg+xml', tags: ['林夏', '米色风衣', '角色锁定'], version: 1, rightsConfirmed: true, source: '原创 SVG 示意图 · 非 AI 生成', createdAt: '2026-10-07T10:00:00.000Z', size: 0 },
  ], jobs: [] };
}
