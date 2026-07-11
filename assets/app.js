const DEEPSEEK_API_KEY = localStorage.getItem('deepseek_api_key') || '';
const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const MODEL = 'deepseek-chat';

let knowledgeData = [];
let currentSuggestedNode = null;
let currentSessionNode = null;

// 全局调试追踪系统
const debugTracker = {
  loadCount: 0,
  loadingState: '未开始',
  activeTimers: [],
  scannerCalls: 0,
  lastLogTime: Date.now()
};

// 追踪定时器
const originalSetInterval = window.setInterval;
const originalSetTimeout = window.setTimeout;
const originalClearInterval = window.clearInterval;
const originalClearTimeout = window.clearTimeout;

window.setInterval = function(fn, delay, ...args) {
  const id = originalSetInterval.call(window, fn, delay, ...args);
  debugTracker.activeTimers.push({ type: 'interval', id, delay, created: Date.now() });
  console.log('⚠️ setInterval 创建:', id, '延迟:', delay, 'ms');
  return id;
};

window.setTimeout = function(fn, delay, ...args) {
  const id = originalSetTimeout.call(window, fn, delay, ...args);
  debugTracker.activeTimers.push({ type: 'timeout', id, delay, created: Date.now() });
  console.log('⏱️ setTimeout 创建:', id, '延迟:', delay, 'ms');
  return id;
};

window.clearInterval = function(id) {
  originalClearInterval.call(window, id);
  debugTracker.activeTimers = debugTracker.activeTimers.filter(t => t.id !== id);
  console.log('✅ clearInterval 清除:', id);
};

window.clearTimeout = function(id) {
  originalClearTimeout.call(window, id);
  debugTracker.activeTimers = debugTracker.activeTimers.filter(t => t.id !== id);
  console.log('✅ clearTimeout 清除:', id);
};

// 移除调试用的 setInterval，避免干扰
// setInterval(() => {
//   if (debugTracker.activeTimers.length > 0) {
//     console.log('📊 活动定时器数量:', debugTracker.activeTimers.length);
//     console.log('📊 活动定时器列表:', debugTracker.activeTimers);
//   }
// }, 5000);

async function loadKnowledge() {
  debugTracker.loadCount++;
  debugTracker.loadingState = '开始加载';

  // ✅ 明确的加载完成判断：如果已加载成功，立即返回
  if (knowledgeData.length > 0) {
    debugTracker.loadingState = '已加载完成';
    console.log('✅ 知识库已加载完成，跳过重复加载');
    console.log('📊 知识库节点数量:', knowledgeData.length);
    console.log('📊 加载次数计数:', debugTracker.loadCount);
    return knowledgeData;
  }

  console.log('knowledge.json 加载状态:', debugTracker.loadingState);
  console.log('📊 加载次数计数:', debugTracker.loadCount);

  try {
    debugTracker.loadingState = '正在请求文件';
    console.log('knowledge.json 加载状态:', debugTracker.loadingState);

    const res = await fetch('assets/knowledge.json');
    debugTracker.loadingState = '文件响应成功';
    console.log('knowledge.json 加载状态:', debugTracker.loadingState);

    const data = await res.json();
    const arr = Array.isArray(data) ? data : (data.nodes || []);
    // 分离 _config 配置项
    const configItem = arr.find(item => item && item._config);
    const nodes = arr.filter(item => item && !item._config);
    knowledgeData = nodes;
    if (configItem) {
      window.ENERGY_META = configItem.energyLevels || {};
    }

    // ✅ 立即更新全局变量，让其他模块可以访问
    window.knowledgeData = knowledgeData;

    // ✅ 立即设置加载完成状态
    if (knowledgeData.length > 0) {
      debugTracker.loadingState = '加载完成';
      console.log('knowledge.json 加载状态:', debugTracker.loadingState);
      console.log('✅ 知识库数据:', knowledgeData);
      console.log('✅ 知识库节点数量:', knowledgeData.length);
      console.log('📊 唯一书籍数:', new Set(knowledgeData.flatMap(n => (n.books || []).map(b => b.title))).size);
      console.log('📊 精力匹配 - high:', knowledgeData.filter(n => n.energy === 'high').length,
        '/ normal:', knowledgeData.filter(n => n.energy === 'normal').length,
        '/ low:', knowledgeData.filter(n => n.energy === 'low').length);
      const highAvg = knowledgeData.filter(n => n.energy === 'high').reduce((s, n) => s + n.duration, 0) / knowledgeData.filter(n => n.energy === 'high').length;
      const normalAvg = knowledgeData.filter(n => n.energy === 'normal').reduce((s, n) => s + n.duration, 0) / knowledgeData.filter(n => n.energy === 'normal').length;
      const lowAvg = knowledgeData.filter(n => n.energy === 'low').reduce((s, n) => s + n.duration, 0) / knowledgeData.filter(n => n.energy === 'low').length;
      console.log(`⏱️ 平均时长 - high: ${highAvg} / normal: ${normalAvg} / low: ${lowAvg}`);

      initCognitiveMap();
      updateProgress();
      initBookCarousel();

      // ✅ 触发精简版融合模块的渲染（feeder.js 提供的全局函数）
      if (window.renderCogMap) window.renderCogMap();
      if (window.renderBooksOverview) window.renderBooksOverview();

      return knowledgeData;
    } else {
      debugTracker.loadingState = '加载失败：数据为空';
      console.log('knowledge.json 加载状态:', debugTracker.loadingState);
      return [];
    }
  } catch (err) {
    debugTracker.loadingState = '加载失败';
    console.log('knowledge.json 加载状态:', debugTracker.loadingState);
    console.error('❌ Failed to load knowledge:', err);
    return [];
  }
}

function initCognitiveMap() {
  const existing = localStorage.getItem('cognitiveMap');
  if (!existing) {
    const map = {};
    knowledgeData.forEach(node => {
      map[node.id] = {
        step1: false,  // 阅读理解
        step2: false,  // 场景触发
        step3: false,  // 一句话输出
        step4: false,  // 盲区验证
        step5: false,  // 应用打卡
        completed: false,
        completedAt: null,
        applicationPlan: ''
      };
    });
    localStorage.setItem('cognitiveMap', JSON.stringify(map));
  } else {
    // 如果存在旧数据，迁移到新结构
    const map = JSON.parse(existing);
    let needsMigration = false;
    
    Object.keys(map).forEach(nodeId => {
      if (map[nodeId].status) {
        // 旧结构：有 status 字段
        needsMigration = true;
        const wasLearned = map[nodeId].status === 'established';
        map[nodeId] = {
          step1: wasLearned,
          step2: wasLearned,
          step3: wasLearned,
          step4: wasLearned,
          step5: wasLearned,
          completed: wasLearned,
          completedAt: wasLearned ? map[nodeId].learnedAt : null,
          applicationPlan: ''
        };
      }
    });
    
    if (needsMigration) {
      localStorage.setItem('cognitiveMap', JSON.stringify(map));
    }
  }
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = 'none';
  });
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.style.display = 'block';
    setTimeout(() => screen.classList.add('active'), 10);
  }

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.classList.remove('active');
    if (nav.dataset.screen === screenId) {
      nav.classList.add('active');
    }
  });
}

// 标记某个环节完成
function markNodeStepCompleted(nodeId, stepNumber) {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  if (!map[nodeId]) {
    map[nodeId] = {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      completed: false,
      completedAt: null,
      applicationPlan: ''
    };
  }
  
  map[nodeId][`step${stepNumber}`] = true;
  
  // 检查是否所有环节都完成
  if (map[nodeId].step1 && map[nodeId].step2 && map[nodeId].step3 && 
      map[nodeId].step4 && map[nodeId].step5 && !map[nodeId].completed) {
    map[nodeId].completed = true;
    map[nodeId].completedAt = new Date().toISOString();
  }
  
  localStorage.setItem('cognitiveMap', JSON.stringify(map));
  updateProgress();
}

// 获取节点环节进度
function getNodeProgress(nodeId) {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  return map[nodeId] || {
    step1: false,
    step2: false,
    step3: false,
    step4: false,
    step5: false,
    completed: false,
    completedAt: null,
    applicationPlan: ''
  };
}

// 判断节点是否全部完成
function isNodeCompleted(nodeId) {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  return map[nodeId]?.completed === true;
}

// 获取未完成节点（completed=false）
function getUnlearnedNodes() {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  const data = knowledgeData.length > 0 ? knowledgeData : (window.knowledgeData || []);
  return data.filter(n => !map[n.id] || !map[n.id].completed);
}

// 保存应用计划
function saveApplicationPlan(nodeId, plan) {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  if (!map[nodeId]) {
    map[nodeId] = {
      step1: false,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
      completed: false,
      completedAt: null,
      applicationPlan: ''
    };
  }
  map[nodeId].applicationPlan = plan;
  localStorage.setItem('cognitiveMap', JSON.stringify(map));
}

function getNodeById(nodeId) {
  return knowledgeData.find(n => n.id === nodeId);
}

function updateProgress() {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  const completedNodes = knowledgeData.filter(n => map[n.id]?.completed === true);
  const total = knowledgeData.length;
  const percent = total > 0 ? Math.round((completedNodes.length / total) * 100) : 0;

  // 更新总体进度显示
  const overallProgressEl = document.getElementById('overall-progress');
  if (overallProgressEl) {
    overallProgressEl.textContent = `当前已掌握 ${completedNodes.length}/${total} 个核心认知（${percent}%）`;
  }

  const statLearned = document.getElementById('stat-learned');
  const statTotal = document.getElementById('stat-total');
  const statPercent = document.getElementById('stat-percent');

  if (statLearned) statLearned.textContent = completedNodes.length;
  if (statTotal) statTotal.textContent = total;
  if (statPercent) statPercent.textContent = percent + '%';

  // 更新进度页的进度条
  updateProgressBars();
  updateLearnedList();
  updateNodeProgressList();
}

function updateProgressBars() {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');

  // 按领域统计
  const domainCounts = {};
  knowledgeData.forEach(node => {
    const domain = node.domain;
    if (!domainCounts[domain]) {
      domainCounts[domain] = { total: 0, completed: 0 };
    }
    domainCounts[domain].total++;
    if (map[node.id]?.completed === true) {
      domainCounts[domain].completed++;
    }
  });

  // 更新各领域进度条
  const domains = ['politics', 'military', 'history', 'philosophy', 'finance'];
  domains.forEach(domain => {
    const counts = domainCounts[domain] || { total: 0, completed: 0 };
    const percent = counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

    const barEl = document.getElementById(`progress-${domain}`);
    const percentEl = document.getElementById(`percent-${domain}`);

    if (barEl) barEl.style.width = percent + '%';
    if (percentEl) percentEl.textContent = `${counts.completed}/${counts.total} 节点已掌握（${percent}%）`;
  });
}

function updateLearnedList() {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  const listEl = document.getElementById('learned-list');

  if (!listEl) return;

  listEl.innerHTML = '';

  // 获取已完成节点（completed=true）
  const completedNodes = knowledgeData.filter(n => map[n.id]?.completed === true);

  if (completedNodes.length === 0) {
    listEl.innerHTML = '<div class="learned-node-item"><span class="learned-node-title">暂无已学节点</span></div>';
    return;
  }

  completedNodes.forEach(node => {
    const completedAt = map[node.id]?.completedAt;
    const timeStr = completedAt ? new Date(completedAt).toLocaleDateString('zh-CN') : '';

    const itemEl = document.createElement('div');
    itemEl.className = 'learned-node-item';
    itemEl.innerHTML = `
      <span class="domain-tag ${node.domain}">${node.domainName}</span>
      <span class="learned-node-title">${node.title}</span>
      <span class="learned-node-time">${timeStr}</span>
    `;
    listEl.appendChild(itemEl);
  });
}

function updateNodeProgressList() {
  const map = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');
  const listEl = document.getElementById('node-progress-list');

  if (!listEl) return;

  listEl.innerHTML = '';

  knowledgeData.forEach(node => {
    const progress = map[node.id] || { step1: false, step2: false, step3: false, step4: false, step5: false, completed: false };

    const completedSteps = [progress.step1, progress.step2, progress.step3, progress.step4, progress.step5].filter(s => s).length;
    const stepPercent = Math.round((completedSteps / 5) * 100);

    const itemEl = document.createElement('div');
    itemEl.className = 'node-item';
    itemEl.innerHTML = `
      <div class="node-item-header">
        <div class="node-info">
          <span class="domain-tag ${node.domain}">${node.domainName}</span>
          <span class="node-title">${node.title}</span>
        </div>
        <div class="node-status">
          ${progress.completed ? '<span class="node-completed-badge">已掌握</span>' : `<span class="node-progress-text">${completedSteps}/5 环节完成（${stepPercent}%）</span>`}
        </div>
      </div>
      <div class="step-bar-container">
        <div class="step-bar ${progress.step1 ? 'completed' : ''}" data-step="1"></div>
        <div class="step-bar ${progress.step2 ? 'completed' : ''}" data-step="2"></div>
        <div class="step-bar ${progress.step3 ? 'completed' : ''}" data-step="3"></div>
        <div class="step-bar ${progress.step4 ? 'completed' : ''}" data-step="4"></div>
        <div class="step-bar ${progress.step5 ? 'completed' : ''}" data-step="5"></div>
      </div>
      <div class="step-labels">
        <span>阅读</span>
        <span>场景</span>
        <span>复述</span>
        <span>验证</span>
        <span>应用</span>
      </div>
    `;

    listEl.appendChild(itemEl);
  });
}

// === 书单轮播 ===
const DOMAIN_CONFIG = {
  politics:   { name: '政治学', color: '#5a9a8f', bg: 'rgba(90,154,143,0.12)', icon: '🏛️' },
  military:   { name: '军事学', color: '#8a7eb5', bg: 'rgba(138,126,181,0.12)', icon: '⚔️' },
  history:    { name: '历史学', color: '#c4956c', bg: 'rgba(196,149,108,0.12)', icon: '📜' },
  philosophy: { name: '哲学',   color: '#5a7a9a', bg: 'rgba(90,122,154,0.12)', icon: '💭' },
  finance:    { name: '金融学', color: '#e67028', bg: 'rgba(230,112,40,0.12)', icon: '📈' }
};

let currentBookDomain = 'politics';

function renderBookCarousel(domain) {
  currentBookDomain = domain;
  const config = DOMAIN_CONFIG[domain];
  const carousel = document.getElementById('book-carousel');
  if (!carousel) return;

  // 从 knowledgeData 提取该领域的书籍（去重）
  const books = [];
  const seen = new Set();
  knowledgeData.forEach(n => {
    if (n.domain === domain) {
      (n.books || []).forEach(b => {
        if (!seen.has(b.title)) {
          seen.add(b.title);
          books.push(b);
        }
      });
    }
  });

  // 更新书数标记
  const badge = document.getElementById('book-count-badge');
  if (badge) badge.textContent = `${books.length} 本`;

  // 更新 tab 高亮
  document.querySelectorAll('.book-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.domain === domain);
  });

  // 渲染卡片
  carousel.innerHTML = books.map(b => `
    <div class="book-card" style="--domain-color:${config.color}; --domain-bg:${config.bg}">
      <div class="book-card-cover" style="--domain-color:${config.color}; --domain-color-light:${config.bg}">
        <span class="book-card-cover-icon">${config.icon}</span>
      </div>
      <div class="book-card-title">${b.title.replace(/[《》]/g, '')}</div>
      <div class="book-card-author">${b.author}</div>
      <div class="book-card-why">${b.whyRead || ''}</div>
      <span class="book-card-domain-tag">${config.name}</span>
    </div>
  `).join('');

  // 触发切换动画
  carousel.classList.remove('switching');
  void carousel.offsetWidth;
  carousel.classList.add('switching');

  // 重置滚动位置
  carousel.scrollLeft = 0;
  setTimeout(updateArrowVisibility, 100);
}

function switchBookTab(domain) {
  if (domain === currentBookDomain) return;
  renderBookCarousel(domain);
}

function scrollCarousel(direction) {
  const carousel = document.getElementById('book-carousel');
  if (!carousel) return;
  const cardWidth = 212; // 200px卡片 + 12px间距
  carousel.scrollBy({ left: direction * cardWidth * 2, behavior: 'smooth' });
  setTimeout(updateArrowVisibility, 300);
}

function updateArrowVisibility() {
  const carousel = document.getElementById('book-carousel');
  if (!carousel) return;
  const leftArrow = document.querySelector('.carousel-arrow-left');
  const rightArrow = document.querySelector('.carousel-arrow-right');
  if (leftArrow) leftArrow.style.opacity = carousel.scrollLeft <= 5 ? '0.3' : '1';
  if (rightArrow) {
    const maxScroll = carousel.scrollWidth - carousel.clientWidth;
    rightArrow.style.opacity = carousel.scrollLeft >= maxScroll - 5 ? '0.3' : '1';
  }
}

function initBookCarousel() {
  renderBookCarousel('politics');
  const carousel = document.getElementById('book-carousel');
  if (carousel) carousel.addEventListener('scroll', updateArrowVisibility);
}

// 兼容旧调用
function renderBooksList() { initBookCarousel(); }

// 暴露到全局供 onclick 调用
window.switchBookTab = switchBookTab;
window.scrollCarousel = scrollCarousel;
window.initBookCarousel = initBookCarousel;

async function callDeepseek(messages) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === 'YOUR_API_KEY_HERE') {
    return getFallbackResponse(messages);
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({ 
        model: MODEL, 
        messages, 
        temperature: 0.7, 
        max_tokens: 500 
      })
    });

    if (!res.ok) throw new Error(`API Error: ${res.status}`);
    const data = await res.json();
    const content = data.choices[0].message.content;
    return parseJSONResponse(content);
  } catch (err) {
    console.error('Deepseek API call failed:', err);
    return getFallbackResponse(messages);
  }
}

function parseJSONResponse(content) {
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (err) {
    console.error('JSON parse failed:', err);
    return null;
  }
}

function getFallbackResponse(messages) {
  const userMessages = messages.filter(m => m.role === 'user');
  const userText = userMessages.map(m => m.content).join(' ');
  const node = currentSessionNode;

  // 如果没有当前节点，返回默认追问
  if (!node) {
    return {
      action: 'followup',
      question: '能再详细说说你的想法吗？',
      probesHit: []
    };
  }

  // 分析用户回答触及的探针
  const probesHit = node.probes.filter(p => userText.includes(p));
  const round = userMessages.length;

  // 如果回答太短或轮次太少，继续追问
  if (userText.length < 20 || round < 2) {
    // 使用预设追问或生成追问
    const question = node.followUp || `能再深入说说"${node.probes.find(p => !probesHit.includes(p)) || node.probes[0]}"这个角度吗？`;
    return {
      action: 'followup',
      question: question,
      probesHit: probesHit
    };
  }

  // 如果已触及足够探针或轮次够多，返回分析结果
  if (probesHit.length >= 3 || round >= 3) {
    const probesMiss = node.probes.filter(p => !probesHit.includes(p));
    const blindSpots = probesMiss.slice(0, 2).map(p => `对"${p}"的理解不足`);

    return {
      action: 'analyze',
      overall: `用户在${round}轮对话中触及了${probesHit.length}/${node.probes.length}个关键探针。`,
      probesHit: probesHit,
      blindSpots: blindSpots.length > 0 ? blindSpots : ['无明显盲区'],
      suggestedNode: node.id
    };
  }

  // 默认继续追问
  const nextProbe = node.probes.find(p => !probesHit.includes(p));
  return {
    action: 'followup',
    question: nextProbe ? `你提到了一些观点，但我想听听你对"${nextProbe}"这个方面的看法？` : node.followUp,
    probesHit: probesHit
  };
}

function setCurrentSuggestedNode(nodeId) {
  currentSuggestedNode = nodeId;
}

function getCurrentSuggestedNode() {
  return currentSuggestedNode;
}

function setCurrentSessionNode(node) {
  currentSessionNode = node;
}

function getCurrentSessionNode() {
  return currentSessionNode;
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadKnowledge();

  document.querySelectorAll('.nav-item').forEach(nav => {
    nav.addEventListener('click', () => {
      showScreen(nav.dataset.screen);
    });
  });

  document.getElementById('btn-start-scan')?.addEventListener('click', () => {
    showScreen('scanner');
    if (window.startScanner) window.startScanner();
  });

  document.getElementById('btn-nav-start-scan')?.addEventListener('click', () => {
    showScreen('scanner');
    if (window.startScanner) window.startScanner();
  });

  document.getElementById('btn-fill-blindspot')?.addEventListener('click', () => {
    showScreen('feeder');
    setTimeout(() => {
      window.feederInitNodeMode(currentSuggestedNode);
    }, 100);
  });

  document.getElementById('btn-back-scanner')?.addEventListener('click', () => {
    showScreen('scanner');
  });

  document.getElementById('btn-back-home')?.addEventListener('click', () => {
    showScreen('welcome');
  });

  // 进度页折叠面板
  document.getElementById('learned-toggle')?.addEventListener('click', function() {
    this.classList.toggle('collapsed');
    const list = document.getElementById('learned-list');
    if (list) list.classList.toggle('hidden');
  });
});

window.showScreen = showScreen;
window.markNodeStepCompleted = markNodeStepCompleted;
window.getNodeProgress = getNodeProgress;
window.isNodeCompleted = isNodeCompleted;
window.getUnlearnedNodes = getUnlearnedNodes;
window.getNodeById = getNodeById;
window.saveApplicationPlan = saveApplicationPlan;
window.callDeepseek = callDeepseek;
window.setCurrentSuggestedNode = setCurrentSuggestedNode;
window.getCurrentSuggestedNode = getCurrentSuggestedNode;
window.setCurrentSessionNode = setCurrentSessionNode;
window.getCurrentSessionNode = getCurrentSessionNode;
// ✅ 暴露 knowledgeData 到全局，让 scanner.js 可以检查加载状态
window.knowledgeData = knowledgeData;