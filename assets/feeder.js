let currentNodeId = null;
let feederMode = 'energy';
let currentStep = 1; // 当前环节（1-5）

function showEnergySelector(show) {
  const selector = document.getElementById('energy-selector');
  if (selector) selector.style.display = show ? 'flex' : 'none';
}

function showContentCard(show) {
  const card = document.getElementById('content-card');
  if (card) card.style.display = show ? 'block' : 'none';
}

function showStepProgress(show) {
  const progress = document.getElementById('step-progress');
  if (progress) progress.style.display = show ? 'flex' : 'none';
}

function showStepInteraction(show) {
  const interaction = document.getElementById('step-interaction');
  if (interaction) interaction.style.display = show ? 'block' : 'none';
}

function showFeederActions(show) {
  const actions = document.getElementById('feeder-actions');
  if (actions) actions.style.display = show ? 'block' : 'none';
}

function showLearnedFeedback(show) {
  const feedback = document.getElementById('learned-feedback');
  if (feedback) feedback.classList.toggle('show', show);
}

function showContentList(show) {
  const list = document.getElementById('content-list');
  if (list) list.style.display = show ? 'block' : 'none';
}

function resetFeeder() {
  currentNodeId = null;
  feederMode = 'energy';
  currentStep = 1;
  showEnergySelector(true);
  showContentCard(false);
  showStepProgress(false);
  showStepInteraction(false);
  showFeederActions(false);
  showLearnedFeedback(false);
  showContentList(false);
  
  document.querySelectorAll('.energy-btn').forEach(btn => {
    btn.classList.remove('active');
  });
}

// 更新环节进度指示器
function updateStepProgress() {
  const progress = window.getNodeProgress(currentNodeId);
  
  for (let i = 1; i <= 5; i++) {
    const dot = document.querySelector(`.step-dot[data-step="${i}"]`);
    if (dot) {
      if (progress[`step${i}`] || i < currentStep) {
        dot.classList.add('completed');
      } else {
        dot.classList.remove('completed');
      }
    }
  }
}

// 显示环节问题
function showStepQuestion(question) {
  const questionEl = document.getElementById('step-question');
  if (questionEl) {
    questionEl.innerHTML = `<p class="step-question-text">${question}</p>`;
  }
}

// 清空输入框
function clearStepInput() {
  const input = document.getElementById('step-input');
  if (input) input.value = '';
}

// 渲染节点内容（Step 1）
function renderNode(node) {
  if (!node) return;

  currentNodeId = node.id;
  currentStep = 1;

  // 初始化环节进度
  const progress = window.getNodeProgress(node.id);
  
  // 如果已有环节进度，恢复到第一个未完成环节
  for (let i = 1; i <= 5; i++) {
    if (!progress[`step${i}`]) {
      currentStep = i;
      break;
    }
  }

  const domainTag = document.getElementById('card-domain');
  if (domainTag) {
    domainTag.className = `domain-tag ${node.domain}`;
    domainTag.textContent = node.domainName;
  }

  const cardMeta = document.getElementById('card-meta');
  if (cardMeta) cardMeta.textContent = `${node.level} · ${node.duration} 分钟`;

  const cardTitle = document.getElementById('card-title');
  if (cardTitle) cardTitle.textContent = node.title;

  const cardCore = document.getElementById('card-core');
  if (cardCore) cardCore.textContent = node.core;

  const cardScenario = document.getElementById('card-scenario');
  if (cardScenario) cardScenario.textContent = node.scenario;

  const cardUpgrade = document.getElementById('card-upgrade');
  if (cardUpgrade) cardUpgrade.textContent = node.upgrade;

  const questionsList = document.getElementById('card-questions');
  if (questionsList) {
    questionsList.innerHTML = '';
    node.questions.forEach(q => {
      const li = document.createElement('li');
      li.textContent = q;
      questionsList.appendChild(li);
    });
  }

  // 渲染书籍：主书 + 延伸阅读胶囊
  const bookSection = document.getElementById('card-books');
  if (bookSection) {
    const books = node.books || [];
    if (books.length > 0) {
      const mainBook = books[0];
      const otherBooks = books.slice(1);
      bookSection.innerHTML = `
        <div class="book">
          <div class="book-title">📖 ${mainBook.title}</div>
          <div class="book-author">${mainBook.author}</div>
          <div class="book-why"><strong>为什么读：</strong>${mainBook.whyRead}</div>
        </div>
        ${otherBooks.length > 0 ? `
          <div class="book-extra">
            <span class="extra-label">延伸阅读：</span>
            ${otherBooks.map(b => `<span class="book-pill">${b.title} · ${b.author}</span>`).join('')}
          </div>
        ` : ''}
      `;
      bookSection.style.display = 'block';
    } else {
      bookSection.style.display = 'none';
    }
  }

  showEnergySelector(false);
  showContentCard(true);
  showStepProgress(true);
  updateStepProgress();
  
  // 根据当前环节显示内容
  if (currentStep === 1) {
    showStepInteraction(false);
    showFeederActions(true);
    
    // 修改按钮文本
    const btnMarkLearned = document.getElementById('btn-mark-learned');
    if (btnMarkLearned) btnMarkLearned.textContent = '我读完了，进入下一步';
  } else {
    startStep(currentStep);
  }
  
  showLearnedFeedback(false);
  showContentList(false);
}

// 开始某个环节
async function startStep(step) {
  const node = window.getNodeById(currentNodeId);
  if (!node) return;

  showContentCard(true);
  showStepProgress(true);
  updateStepProgress();
  showFeederActions(false);
  showStepInteraction(true);

  const stepLabels = {
    2: '场景触发',
    3: '一句话输出',
    4: '盲区验证',
    5: '应用打卡'
  };

  const questions = {
    2: `你能举一个自己生活中的例子吗？比如工作中、家庭里、社交时，遇到过类似"${node.title}"的场景吗？`,
    3: '用一句话复述你学到了什么核心认知？',
    4: `让我再问一个问题来验证你的理解：${node.probes ? node.probes[Math.floor(Math.random() * node.probes.length)] : node.questions[0]}`,
    5: `下次遇到类似场景，你会怎么用这个认知？记录你的应用计划。`
  };

  showStepQuestion(`<strong>Step ${step}: ${stepLabels[step]}</strong><br>${questions[step]}`);
  clearStepInput();
}

// 提交环节回答
async function submitStepAnswer() {
  const input = document.getElementById('step-input');
  const userAnswer = input?.value.trim();

  if (!userAnswer) {
    alert('请输入你的回答');
    return;
  }

  const node = window.getNodeById(currentNodeId);
  if (!node) return;

  // 根据环节判断回答
  let isValid = false;
  let feedback = '';

  switch (currentStep) {
    case 2: // 场景触发
      isValid = await validateSceneTrigger(node, userAnswer);
      feedback = isValid ? '很好，这个例子体现了该认知的应用场景。' : '再想想，可以更具体一点，说说这个场景中你是怎么意识到这个认知的？';
      break;

    case 3: // 一句话输出
      isValid = await validateOneSentence(node, userAnswer);
      feedback = isValid ? '抓住了核心，很好！' : '可以更聚焦核心概念，试着提炼一下关键词。';
      break;

    case 4: // 盲区验证
      isValid = await validateBlindSpotCheck(node, userAnswer);
      feedback = isValid ? '通过验证，你对这个认知的理解到位了。' : '建议再复习一遍核心阐述，加深理解后再来验证。';
      break;

    case 5: // 应用打卡
      isValid = true; // 应用计划不需要验证
      feedback = `已记录。下次遇到【${node.scenario}】时，你会用【${node.title}】来判断。`;
      window.saveApplicationPlan(currentNodeId, userAnswer);
      break;
  }

  // 显示反馈
  const questionEl = document.getElementById('step-question');
  if (questionEl) {
    questionEl.innerHTML = `<p class="step-feedback ${isValid ? 'success' : 'warning'}">${feedback}</p>`;
  }

  // 如果通过，进入下一步或完成
  if (isValid) {
    window.markNodeStepCompleted(currentNodeId, currentStep);
    
    setTimeout(() => {
      if (currentStep === 5) {
        // 全部完成
        completeNode();
      } else {
        currentStep++;
        updateStepProgress();
        startStep(currentStep);
      }
    }, 1500);
  } else {
    // 未通过，显示重新输入提示
    setTimeout(() => {
      startStep(currentStep);
    }, 2000);
  }
}

// Step 2: 验证场景触发
async function validateSceneTrigger(node, userAnswer) {
  // 使用 Deepseek API 判断
  const messages = [
    {
      role: 'system',
      content: `你是一个认知学习助手。用户正在学习"${node.title}"这个认知节点。核心阐述：${node.core}。触发场景：${node.scenario}。请判断用户的回答是否体现了该认知在实际生活中的应用场景。`
    },
    {
      role: 'user',
      content: userAnswer
    }
  ];

  const result = await window.callDeepseek(messages);
  
  if (result && result.isValid !== undefined) {
    return result.isValid;
  }

  // 降级判断：关键词匹配
  const keywords = node.probes || [node.title];
  const hasKeyword = keywords.some(k => userAnswer.includes(k));
  const hasScenario = userAnswer.length > 20 && (userAnswer.includes('工作') || userAnswer.includes('生活') || userAnswer.includes('家庭') || userAnswer.includes('朋友'));

  return hasKeyword || hasScenario;
}

// Step 3: 验证一句话输出
async function validateOneSentence(node, userAnswer) {
  // 使用 Deepseek API 判断
  const messages = [
    {
      role: 'system',
      content: `你是一个认知学习助手。用户正在学习"${node.title}"这个认知节点。核心探针关键词：${(node.probes || []).join(',')}。请判断用户的一句话复述是否包含核心探针关键词或体现了核心认知。`
    },
    {
      role: 'user',
      content: userAnswer
    }
  ];

  const result = await window.callDeepseek(messages);
  
  if (result && result.isValid !== undefined) {
    return result.isValid;
  }

  // 降级判断：关键词匹配
  const probes = node.probes || [node.title];
  const hasProbe = probes.some(p => userAnswer.includes(p));
  
  return hasProbe && userAnswer.length < 100; // 一句话应该简短
}

// Step 4: 验证盲区检测
async function validateBlindSpotCheck(node, userAnswer) {
  // 使用 Deepseek API 判断探针命中率
  const messages = [
    {
      role: 'system',
      content: `你是一个认知学习助手。用户正在学习"${node.title}"这个认知节点。核心探针：${(node.probes || []).join(',')}。请判断用户对这个问题的回答是否触及了至少3个核心探针。`
    },
    {
      role: 'user',
      content: userAnswer
    }
  ];

  const result = await window.callDeepseek(messages);
  
  if (result && result.probesHit) {
    return result.probesHit.length >= 3;
  }

  // 降级判断：关键词匹配
  const probes = node.probes || [];
  const probesHit = probes.filter(p => userAnswer.includes(p));
  
  return probesHit.length >= 3 || probesHit.length >= Math.floor(probes.length * 0.6);
}

// 完成节点学习
function completeNode() {
  const node = window.getNodeById(currentNodeId);
  
  showStepInteraction(false);
  showContentCard(false);
  showStepProgress(false);
  
  const feedbackMessage = document.getElementById('feedback-message');
  if (feedbackMessage) {
    feedbackMessage.textContent = node 
      ? `恭喜！你已掌握"${node.title}"这个认知节点。`
      : '恭喜！你已掌握这个认知节点。';
  }
  
  showLearnedFeedback(true);
  window.updateProgress();
}

function selectEnergyLevel(level) {
  document.querySelectorAll('.energy-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.energy === level);
  });

  localStorage.setItem('energyLevel', level);

  let durationMin = 0;
  let durationMax = 60;

  switch (level) {
    case 'high':
      durationMin = 10;
      durationMax = 60;
      break;
    case 'normal':
      durationMin = 5;
      durationMax = 12;
      break;
    case 'low':
      durationMin = 0;
      durationMax = 8;
      break;
  }

  // 调试日志：筛选条件
  const filterConditions = {
    energyLevel: level,
    durationMin: durationMin,
    durationMax: durationMax
  };
  console.log('筛选条件:', filterConditions);

  const unlearned = window.getUnlearnedNodes();
  console.log('未学节点数量:', unlearned.length);
  console.log('未学节点列表:', unlearned.map(n => ({ id: n.id, title: n.title, duration: n.duration, domain: n.domain })));

  const filtered = unlearned.filter(n => n.duration >= durationMin && n.duration <= durationMax);
  
  // 调试日志：匹配结果
  const matchedNodes = filtered.map(n => ({
    id: n.id,
    title: n.title,
    duration: n.duration,
    domain: n.domain,
    domainName: n.domainName
  }));
  console.log('匹配结果:', matchedNodes);
  console.log('匹配节点数量:', matchedNodes.length);
  
  const sorted = sortByDomainRotation(filtered);
  
  if (sorted.length > 0) {
    console.log('最终选中节点:', sorted[0]);
    renderNode(sorted[0]);
  } else if (unlearned.length > 0) {
    // 兜底：该精力状态无匹配，但存在未学节点，显示所有未学节点列表
    console.log('当前精力状态无匹配，显示所有未学节点');
    renderContentList(sortByDomainRotation(unlearned));
  } else {
    // 所有节点已学完
    showEnergySelector(true);
    console.log('所有节点已学完');
    alert('恭喜！你已学完所有知识节点！');
  }
}

function sortByDomainRotation(nodes) {
  const domainOrder = ['military', 'politics', 'history', 'philosophy', 'finance'];
  const lastDomain = localStorage.getItem('lastDomain') || '';
  const lastIndex = domainOrder.indexOf(lastDomain);

  const sorted = [...nodes].sort((a, b) => {
    const aIndex = domainOrder.indexOf(a.domain);
    const bIndex = domainOrder.indexOf(b.domain);

    const aScore = (aIndex - lastIndex + domainOrder.length) % domainOrder.length;
    const bScore = (bIndex - lastIndex + domainOrder.length) % domainOrder.length;

    return aScore - bScore;
  });

  if (sorted.length > 0) {
    localStorage.setItem('lastDomain', sorted[0].domain);
  }

  return sorted;
}

function loadNextNode() {
  const unlearned = window.getUnlearnedNodes();
  if (unlearned.length === 0) {
    alert('恭喜！你已学完所有知识节点！');
    window.showScreen('welcome');
    return;
  }

  const sorted = sortByDomainRotation(unlearned);
  renderNode(sorted[0]);
}

function renderContentList(nodes) {
  const container = document.getElementById('content-list');
  if (!container) return;

  container.innerHTML = '';

  nodes.forEach(node => {
    const item = document.createElement('div');
    item.className = 'content-item';
    item.onclick = () => renderNode(node);

    let domainStyle = '';
    switch (node.domain) {
      case 'politics': domainStyle = 'background: #f5e6e6; color: #a06060;'; break;
      case 'military': domainStyle = 'background: #e6f0f5; color: #4a7080;'; break;
      case 'history': domainStyle = 'background: #e6f0e6; color: #60a060;'; break;
      case 'philosophy': domainStyle = 'background: #e8e6f5; color: #7060a0;'; break;
      case 'finance': domainStyle = 'background: #f0e8e0; color: #a07060;'; break;
    }

    item.innerHTML = `
      <div class="content-item-header">
        <span class="domain-tag" style="${domainStyle}">${node.domainName}</span>
        <span class="content-item-title">${node.title}</span>
      </div>
      <div class="content-item-meta">${node.level} · ${node.duration} 分钟</div>
    `;

    container.appendChild(item);
  });

  showEnergySelector(false);
  showContentCard(false);
  showStepProgress(false);
  showStepInteraction(false);
  showFeederActions(false);
  showLearnedFeedback(false);
  showContentList(true);
}

function feederInitTimeMode(minutes) {
  resetFeeder();
  
  const unlearned = window.getUnlearnedNodes();
  const filtered = unlearned.filter(n => n.duration <= minutes);
  
  if (filtered.length === 0) {
    alert(`没有${minutes}分钟内可学的未完成节点`);
    showEnergySelector(true);
    return;
  }

  const sorted = sortByDomainRotation(filtered);
  renderContentList(sorted);
}

function feederInitNodeMode(nodeId) {
  resetFeeder();
  
  const node = window.getNodeById(nodeId);
  if (node) {
    renderNode(node);
  } else {
    alert('未找到对应的知识节点');
    showEnergySelector(true);
  }
}

function feederInitEnergyMode() {
  resetFeeder();
}

// Step 1: 点击"我读完了，进入下一步"
function handleStep1Complete() {
  if (currentStep !== 1) return;
  
  window.markNodeStepCompleted(currentNodeId, 1);
  currentStep = 2;
  updateStepProgress();
  startStep(2);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.energy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectEnergyLevel(btn.dataset.energy);
    });
  });

  // Step 1 按钮
  const btnMarkLearned = document.getElementById('btn-mark-learned');
  if (btnMarkLearned) {
    btnMarkLearned.addEventListener('click', handleStep1Complete);
  }

  // Step 2-5 提交按钮
  const btnSubmitStep = document.getElementById('btn-submit-step');
  if (btnSubmitStep) {
    btnSubmitStep.addEventListener('click', submitStepAnswer);
  }

  // 继续学习下一个
  const btnNextLearn = document.getElementById('btn-next-learn');
  if (btnNextLearn) {
    btnNextLearn.addEventListener('click', loadNextNode);
  }

  // 返回首页
  const btnBackHome = document.getElementById('btn-back-home');
  if (btnBackHome) {
    btnBackHome.addEventListener('click', () => {
      window.showScreen('welcome');
    });
  }

  const feederScreen = document.getElementById('feeder');
  if (feederScreen) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (feederScreen.classList.contains('active')) {
            feederInitEnergyMode();
          }
        }
      });
    });
    
    observer.observe(feederScreen, { attributes: true });
  }
});

window.feederInitTimeMode = feederInitTimeMode;

/* =====================================================
   精简版融合 - 卡片/探针/认知地图/书籍总览
   用 IIFE 包裹，避免与 app.js 顶层 let knowledgeData 冲突
   ===================================================== */
(function() {

let knowledgeData = [];
const ENERGY_LABELS = { high: '精力充沛', normal: '状态正常', low: '有点疲惫' };
let currentMatchedIds = [];

function getProgress() { try { return JSON.parse(localStorage.getItem('learningProgress') || '{}'); } catch (e) { return {}; } }
function saveProgress(p) { localStorage.setItem('learningProgress', JSON.stringify(p)); }

// 单节点进度读写（step-based 格式）
function getNodeProgress(nodeId) {
  const all = getProgress();
  return all[nodeId] || null;
}
function setNodeProgress(nodeId, data) {
  const all = getProgress();
  all[nodeId] = { ...(all[nodeId] || {}), ...data };
  saveProgress(all);
}

// 打卡记录
function recordCheckIn() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = JSON.parse(localStorage.getItem('checkInData') || '{}');
    if (!data[today]) {
      data[today] = true;
      localStorage.setItem('checkInData', JSON.stringify(data));
    }
  } catch (e) {}
}

// 派发进度更新事件
function dispatchProgressUpdate() {
  window.dispatchEvent(new CustomEvent('progress:update'));
}

// 兼容旧 API：字符串状态 + 新 step 对象格式
function getNodeStatus(id) {
  const p = getProgress()[id];
  if (!p) return 'unread';
  if (typeof p === 'string') return p; // 旧格式 'read'/'mastered'
  return p.completed ? 'mastered' : (p.step1 ? 'read' : 'unread');
}

// 统计：已掌握 / 已读节点数
function countMastered() {
  return Object.values(getProgress()).filter(p => {
    if (!p) return false;
    if (p === 'mastered') return true;
    if (typeof p === 'object' && p.completed) return true;
    return false;
  }).length;
}
function countRead() {
  return Object.values(getProgress()).filter(p => {
    if (!p) return false;
    if (p === 'read' || p === 'mastered') return true;
    if (typeof p === 'object' && (p.step1 || p.completed)) return true;
    return false;
  }).length;
}

// Toast 提示
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.3s;pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => toast.style.opacity = '0', 2500);
}

// 卡片内闪现提示
function flashHint(nodeId, msg) {
  const card = document.querySelector(`.node-card[data-node-id="${nodeId}"]`);
  if (!card) return;
  let hint = card.querySelector('.flash-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.className = 'flash-hint';
    card.querySelector('.learn-area')?.appendChild(hint);
  }
  if (hint) {
    hint.textContent = msg;
    hint.style.display = 'block';
    setTimeout(() => hint.style.display = 'none', 3000);
  }
}

// ==================== 学习步骤流程 ====================

const LEARN_STEPS = {
  high: [
    { name: '深读', label: '我读完了，进入思考', type: 'read', fields: ['core','scenario','upgrade'] },
    { name: '思辨', label: '提交思考', type: 'answer', promptField: 'topic', followupField: 'followUp', needKeywords: 2 },
    { name: '应用', label: '记录并完成', type: 'apply', questionIndex: 0, placeholder: '写下你下次遇到类似场景会怎么做…' }
  ],
  normal: [
    { name: '阅读', label: '读完了，进入复述', type: 'read', fields: ['core','scenario'] },
    { name: '复述', label: '提交复述', type: 'answer', promptField: 'topic', needKeywords: 1 },
    { name: '应用', label: '完成', type: 'apply', questionIndex: 0, placeholder: '一句话写下你的应用计划…' }
  ],
  low: [
    { name: '速读', label: '看完了，标记完成', type: 'read', fields: ['core'] },
    { name: '轻记', label: '知道了，完成', type: 'done', promptField: 'topic' }
  ]
};

function renderNodeCard(n, energy) {
  const progress = getNodeProgress(n.id);
  const mastered = progress && progress.completed;
  const meta = (window.ENERGY_META || {})[n.energy] || {};
  const isDeep = meta.cardStyle === 'highlighted';
  const isLight = meta.cardStyle === 'minimal';
  const accentBorder = isDeep ? 'node-card-deep' : isLight ? 'node-card-light' : 'node-card-standard';
  const tagColor = meta.accentColor || '#E67028';
  const depthTag = isDeep ? '深度' : isLight ? '轻量' : '标准';

  const scores = (window.getDomainScores && window.getDomainScores()) || {};
  const hasScores = Object.keys(scores).length > 0;
  let recommendBadge = '';
  if (hasScores) {
    const s = scores[n.domainName] || 0;
    if (s === 0) recommendBadge = '<span class="rec-badge rec-low">🌱 你在这个领域是 0 基础</span>';
    else if (s < 50) recommendBadge = '<span class="rec-badge rec-mid">🌿 你有基础认知，建议深入</span>';
    else recommendBadge = '<span class="rec-badge rec-high">🌳 你已掌握，建议查漏补缺</span>';
  }

  return `
    <div class="node-card ${accentBorder}" data-node-id="${n.id}">
      <div class="node-meta">
        <span class="domain-tag" style="background:${tagColor}15; color:${tagColor};">${n.domainName}</span>
        <span class="level-tag">${n.level} · ${depthTag} · ${n.duration} 分钟</span>
        ${mastered ? '<span class="mastered-tag">✓ 已掌握</span>' : ''}
      </div>
      ${recommendBadge ? `<div class="node-recommend">${recommendBadge}</div>` : ''}
      <h3>${n.title}</h3>
      <div class="learn-area" id="learn-${n.id}">
        ${mastered ? renderMasteredView(n, progress) : renderLearnFlow(n, energy, 1)}
      </div>
    </div>
  `;
}

function renderLearnFlow(n, energy, stepNum) {
  const steps = LEARN_STEPS[energy];
  const step = steps[stepNum - 1];
  if (!step) return '';

  // 步骤进度指示器
  const dots = steps.map((s, i) =>
    `<span class="step-dot ${i < stepNum ? 'done' : ''} ${i === stepNum-1 ? 'current' : ''}">${i+1}</span>`
  ).join('<span class="step-arrow">→</span>');

  let body = '';
  if (step.type === 'read') {
    body = step.fields.map(f => {
      if (f === 'core') return `<div class="core">${n.core}</div>`;
      if (f === 'scenario') return `<div class="scenario">${n.scenario}</div>`;
      if (f === 'upgrade') return `<div class="upgrade">${n.upgrade}</div>`;
      return '';
    }).join('');
    // 书籍信息附在阅读步骤
    const books = n.books || [];
    const mainBook = books[0];
    const otherBooks = books.slice(1);
    if (mainBook) {
      body += `
        <div class="book">
          <div class="book-title">📖 ${mainBook.title}</div>
          <div class="book-author">${mainBook.author}</div>
          <div class="book-why"><strong>为什么读：</strong>${mainBook.whyRead}</div>
        </div>
        ${otherBooks.length > 0 ? `
          <div class="book-extra">
            <span class="extra-label">延伸阅读：</span>
            ${otherBooks.map(b => `<span class="book-pill">${b.title} · ${b.author}</span>`).join('')}
          </div>
        ` : ''}
      `;
    }
  } else if (step.type === 'answer') {
    body = `
      <div class="topic">${n[step.promptField]}</div>
      ${step.followupField ? `<div class="followup-hint">💡 追问：${n[step.followupField]}</div>` : ''}
      <textarea class="learn-input" id="input-${n.id}-${stepNum}" placeholder="用你自己的话回答（包含关键词更容易通过）…" rows="3"></textarea>
      <div class="keyword-hint">参考关键词：${n.probes.slice(0,3).join('、')}</div>
    `;
  } else if (step.type === 'apply') {
    const q = n.questions && n.questions[step.questionIndex] ? n.questions[step.questionIndex] : '';
    body = `
      <div class="topic">📝 ${q}</div>
      <textarea class="learn-input" id="input-${n.id}-${stepNum}" placeholder="${step.placeholder}" rows="2"></textarea>
    `;
  } else if (step.type === 'done') {
    body = `<div class="topic">${n[step.promptField]}</div><p class="light-hint">轻松看看就好，点一下就算完成 👇</p>`;
  }

  return `
    <div class="step-progress">${dots}</div>
    <div class="step-label">第 ${stepNum} 步 · ${step.name}</div>
    ${body}
    <button class="step-btn" onclick="advanceStep('${n.id}','${energy}',${stepNum})">${step.label}</button>
  `;
}

function renderMasteredView(n, progress) {
  const dateStr = progress.completedAt
    ? new Date(progress.completedAt).toLocaleDateString()
    : '';
  return `
    <div class="mastered-view">
      <p class="mastered-text">✅ 你已于 ${dateStr} 完成此节点</p>
      <div class="core">${n.core}</div>
      ${progress.applicationNote ? `<div class="app-note">📌 你的应用计划：${progress.applicationNote}</div>` : ''}
      <button class="review-btn" onclick="restartLearning('${n.id}')">重新学习</button>
    </div>
  `;
}

function restartLearning(nodeId) {
  const n = knowledgeData.find(x => x.id === nodeId);
  if (!n) return;
  const energy = n.energy;
  setNodeProgress(nodeId, { step1: false, step2: false, step3: false, completed: false, completedAt: null });
  const learnArea = document.querySelector(`.node-card[data-node-id="${nodeId}"] .learn-area`);
  if (learnArea) learnArea.innerHTML = renderLearnFlow(n, energy, 1);
  // 移除已掌握标记
  const tag = document.querySelector(`.node-card[data-node-id="${nodeId}"] .mastered-tag`);
  if (tag) tag.remove();
  refreshCogMapNode(nodeId);
}

function advanceStep(nodeId, energy, stepNum) {
  const n = knowledgeData.find(x => x.id === nodeId);
  if (!n) return;
  const steps = LEARN_STEPS[energy];
  const step = steps[stepNum - 1];

  // 记录当前步骤完成
  setNodeProgress(nodeId, { [`step${stepNum}`]: true });
  recordCheckIn();

  // answer 类型：关键词匹配校验（不阻断，仅提示）
  if (step.type === 'answer') {
    const input = document.getElementById(`input-${nodeId}-${stepNum}`);
    const text = (input?.value || '').trim();
    if (text.length < 5) {
      flashHint(nodeId, '再多写一点，至少 5 个字哦');
      setNodeProgress(nodeId, { [`step${stepNum}`]: false });
      return;
    }
    const hits = (n.probes || []).filter(kw => text.includes(kw)).length;
    if (hits < step.needKeywords) {
      flashHint(nodeId, `回答里最好包含这些关键词：${n.probes.slice(0,3).join('、')}（当前命中 ${hits} 个）`);
    }
  }

  // apply 类型：记录应用笔记
  if (step.type === 'apply') {
    const input = document.getElementById(`input-${nodeId}-${stepNum}`);
    if (input?.value) setNodeProgress(nodeId, { applicationNote: input.value.trim() });
  }

  // 判断是否全部完成
  if (stepNum >= steps.length) {
    setNodeProgress(nodeId, { completed: true, completedAt: Date.now(), energy: energy });
    // 刷新卡片为已掌握状态
    const learnArea = document.querySelector(`.node-card[data-node-id="${nodeId}"] .learn-area`);
    if (learnArea) learnArea.innerHTML = renderMasteredView(n, getNodeProgress(nodeId));
    const meta = document.querySelector(`.node-card[data-node-id="${nodeId}"] .node-meta`);
    if (meta && !meta.querySelector('.mastered-tag')) {
      meta.insertAdjacentHTML('beforeend', '<span class="mastered-tag">✓ 已掌握</span>');
    }
    refreshCogMapNode(nodeId);
    dispatchProgressUpdate();
    showToast(`🎉 完成！你建立了【${n.domainName}】的一个认知节点`);
    return;
  }

  // 推进到下一步
  const learnArea = document.querySelector(`.node-card[data-node-id="${nodeId}"] .learn-area`);
  if (learnArea) learnArea.innerHTML = renderLearnFlow(n, energy, stepNum + 1);
  refreshCogMapNode(nodeId);
}

function loadFeederKnowledge() {
  if (window.knowledgeData && window.knowledgeData.length > 0) {
    knowledgeData = window.knowledgeData;
    renderCogMap();
    renderBooksOverview();
    // 默认折叠书籍总览
    const booksEl = document.getElementById('books-overview');
    if (booksEl) booksEl.classList.add('collapsed');
    console.log('✅ feeder 知识库已就绪（来自 app.js）：', knowledgeData.length, '个节点 /', new Set(knowledgeData.flatMap(n => (n.books || []).map(b => b.title))).size, '本书');
    return;
  }
  fetch('./assets/knowledge.json')
    .then(res => res.json())
    .then(data => {
      // 分离 _config 配置项与节点
      const arr = Array.isArray(data) ? data : (data.nodes || []);
      const configItem = arr.find(item => item && item._config);
      const nodes = arr.filter(item => item && !item._config);
      knowledgeData = nodes;
      window.knowledgeData = nodes;
      if (configItem) {
        window.ENERGY_META = configItem.energyLevels || {};
        console.log('✅ ENERGY_META 已加载:', Object.keys(window.ENERGY_META).map(k => `${k} = ${window.ENERGY_META[k].tagline}`).join(' / '));
      }
      renderCogMap();
      renderBooksOverview();
      // 默认折叠书籍总览
      const booksEl = document.getElementById('books-overview');
      if (booksEl) booksEl.classList.add('collapsed');
      console.log('✅ feeder 知识库加载完成：', nodes.length, '个节点 /', new Set(nodes.flatMap(n => (n.books || []).map(b => b.title))).size, '本书');
    })
    .catch(err => console.error('❌ feeder 知识库加载失败', err));
}

function selectEnergy(energy) {
  document.querySelectorAll('.energy-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`[data-energy="${energy}"]`);
  if (btn) btn.classList.add('active');

  // 整页色调：按精力状态切换背景
  document.body.classList.remove('energy-high', 'energy-normal', 'energy-low');
  document.body.classList.add('energy-' + energy);
  localStorage.setItem('currentEnergy', energy);

  const data = knowledgeData.length > 0 ? knowledgeData : (window.knowledgeData || []);
  if (knowledgeData.length === 0 && data.length > 0) knowledgeData = data;

  const matched = data.filter(n => n.energy === energy);

  // ✅ 按能力分数排序（分数低的领域优先）
  const scores = (window.getDomainScores && window.getDomainScores()) || {};
  const hasScores = Object.keys(scores).length > 0;
  if (hasScores) {
    matched.sort((a, b) => {
      const sA = scores[a.domainName] || 0;
      const sB = scores[b.domainName] || 0;
      if (sA !== sB) return sA - sB;
      // 同领域内，入门优先
      return a.level === '入门' ? -1 : 1;
    });
  }
  currentMatchedIds = matched.map(n => n.id);

  const resultArea = document.getElementById('feed-result');
  if (!resultArea) return;
  document.getElementById('result-energy-label').textContent = ENERGY_LABELS[energy];
  document.getElementById('result-count').textContent = matched.length;
  resultArea.classList.add('show');
  const listEl = document.getElementById('node-list');

  if (matched.length === 0) {
    listEl.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">😔 当前没有匹配该精力状态的节点</div>';
    return;
  }

  listEl.innerHTML = matched.map(n => renderNodeCard(n, energy)).join('');

  setTimeout(() => resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // 重新渲染认知地图，反映新匹配节点的最新状态
  if (typeof renderCogMap === 'function') renderCogMap();
}

function renderCogMap() {
  const grid = document.getElementById('cog-map-grid');
  if (!grid) return;
  const data = knowledgeData.length > 0 ? knowledgeData : (window.knowledgeData || []);
  if (knowledgeData.length === 0 && data.length > 0) knowledgeData = data;
  const energyLabels = { high: '⚡ 精力充沛', normal: '🌊 状态正常', low: '🌙 有点疲惫' };
  const domains = ['政治学', '军事学', '历史学', '哲学', '金融学'];
  const energies = ['high', 'normal', 'low'];
  let html = '<div class="cog-map-axis"></div>';
  energies.forEach(e => { html += `<div class="cog-map-axis">${energyLabels[e]}</div>`; });
  domains.forEach(domain => {
    html += `<div class="cog-map-axis">${domain}</div>`;
    energies.forEach(energy => {
      const nodes = data.filter(n => n.domainName === domain && n.energy === energy);
      if (nodes.length === 0) html += '<div class="cog-map-cell"><div class="cog-map-empty">—</div></div>';
      else html += '<div class="cog-map-cell">' + nodes.map(n => `<button class="cog-map-node ${getNodeStatus(n.id)}" data-node-id="${n.id}" title="${n.title}">${n.title}</button>`).join('') + '</div>';
    });
  });
  grid.innerHTML = html;
  grid.querySelectorAll('.cog-map-node').forEach(btn => {
    btn.addEventListener('click', () => {
      const nodeId = btn.dataset.nodeId;
      const node = data.find(n => n.id === nodeId);
      if (!node) return;
      selectEnergy(node.energy);
      setTimeout(() => {
        const idx = currentMatchedIds.indexOf(nodeId);
        const cards = document.querySelectorAll('.feed-result .node-card');
        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
          cards[idx].style.transition = 'box-shadow 0.3s';
          cards[idx].style.boxShadow = '0 0 0 3px #D4A574';
          setTimeout(() => { cards[idx].style.boxShadow = ''; }, 1500);
        }
      }, 200);
    });
  });
}

function refreshCogMapNode(nodeId) {
  const btn = document.querySelector(`.cog-map-node[data-node-id="${nodeId}"]`);
  if (!btn) return;
  btn.className = 'cog-map-node ' + getNodeStatus(nodeId);
}

function renderBooksOverview() {
  const body = document.getElementById('books-overview-body');
  if (!body) return;
  const data = knowledgeData.length > 0 ? knowledgeData : (window.knowledgeData || []);
  if (knowledgeData.length === 0 && data.length > 0) knowledgeData = data;
  const domainMap = {};
  data.forEach(n => {
    (n.books || []).forEach(b => {
      if (!domainMap[b.title]) domainMap[b.title] = { ...b, domains: new Set() };
      domainMap[b.title].domains.add(n.domainName);
    });
  });
  const domainOrder = ['政治学', '军事学', '历史学', '哲学', '金融学'];
  const html = domainOrder.map(domain => {
    const books = Object.values(domainMap).filter(b => b.domains.has(domain));
    if (books.length === 0) return '';
    return `<div class="books-domain-block"><h4>${domain} · ${books.length} 本</h4><ul>${books.map(b => `<li>${b.title} — ${b.author}</li>`).join('')}</ul></div>`;
  }).join('');
  body.innerHTML = html;
}

function toggleBooksOverview() {
  const el = document.getElementById('books-overview');
  if (el) el.classList.toggle('collapsed');
}

// 启动：优先用 app.js 已加载的数据，否则自行 fetch
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadFeederKnowledge);
} else {
  loadFeederKnowledge();
}

// 暴露到全局，供 onclick 和 app.js 调用
window.selectEnergy = selectEnergy;
window.toggleBooksOverview = toggleBooksOverview;
window.renderCogMap = renderCogMap;
window.renderBooksOverview = renderBooksOverview;
window.advanceStep = advanceStep;
window.restartLearning = restartLearning;
window.countMastered = countMastered;
window.countRead = countRead;
window.getNodeProgress = getNodeProgress;

})(); // end IIFE
window.feederInitNodeMode = feederInitNodeMode;