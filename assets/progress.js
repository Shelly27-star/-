/* =====================================================
   5 域诊断 / 雷达图 / 进度统计 / 打卡日历
   ===================================================== */
(function() {

const DOMAINS = ['政治学', '军事学', '历史学', '哲学', '金融学'];

// ==================== localStorage 工具 ====================

function getDomainScores() {
  try { return JSON.parse(localStorage.getItem('domainScores') || '{}'); }
  catch (e) { return {}; }
}
function setDomainScore(domain, score) {
  const scores = getDomainScores();
  scores[domain] = Math.max(scores[domain] || 0, score);
  localStorage.setItem('domainScores', JSON.stringify(scores));
}
function getCheckIn() {
  try { return JSON.parse(localStorage.getItem('checkInData') || '{}'); }
  catch (e) { return {}; }
}
function recordCheckIn() {
  const today = new Date().toISOString().split('T')[0];
  const data = getCheckIn();
  data[today] = true;
  localStorage.setItem('checkInData', JSON.stringify(data));
}
function getStreak() {
  const data = getCheckIn();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (data[key]) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ==================== 5 域诊断流程 ====================

let diagState = { round: 0, results: {}, quiz: null };

async function startDiagnosis() {
  diagState = { round: 0, results: {}, quiz: null };
  if (typeof window.addMessage !== 'function') {
    alert('扫描页未就绪');
    return;
  }
  window.addMessage('🧭 欢迎进入 5 域认知扫盲。我会用 5 道题判断你的认知水平，再为你规划学习路径。', false);
  try {
    const res = await fetch('./assets/diagnostic-quiz.json');
    diagState.quiz = await res.json();
  } catch (e) {
    window.addMessage('⚠️ 诊断题库加载失败，请检查 assets/diagnostic-quiz.json', false, true);
    return;
  }
  setTimeout(() => askNextDomain(), 1200);
}

function askNextDomain() {
  if (diagState.round >= DOMAINS.length) return finishDiagnosis();
  const domain = DOMAINS[diagState.round];
  const questions = (diagState.quiz && diagState.quiz[domain]) || [];
  if (questions.length === 0) {
    diagState.round++;
    return askNextDomain();
  }
  const q = questions[0];
  const energy = localStorage.getItem('currentEnergy') || 'high';
  const hint = energy === 'low' ? '（轻量判断）' : energy === 'high' ? '（深度思辨）' : '';

  let text = `\n📚 第 ${diagState.round + 1} 域：${domain} ${hint}\n\n${q.question}\n\n`;
  q.options.forEach((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    text += `${letter}. ${opt.text}\n`;
  });
  text += `\n回复 A / B / C / D 即可`;
  window.addMessage(text, false);
}

function handleDiagnosisAnswer(userInput) {
  if (!diagState.quiz) return false;
  if (diagState.round >= DOMAINS.length) return false;

  const letter = (userInput || '').trim().toUpperCase().charAt(0);
  if (!['A', 'B', 'C', 'D'].includes(letter)) return false;

  const domain = DOMAINS[diagState.round];
  const q = (diagState.quiz[domain] || [])[0];
  const opt = q.options[letter.charCodeAt(0) - 65];
  const score = opt ? opt.score : 0;

  setDomainScore(domain, score);
  diagState.results[domain] = score;

  let feedback = '';
  if (score === 0) feedback = '🚧 还没入门，让我们从基础开始';
  else if (score <= 50) feedback = '🌱 知道一些概念，可以深入一点';
  else if (score < 100) feedback = '🌿 已能复述，建议用应用加深';
  else feedback = '🌳 已经会应用，保持';

  window.addMessage(`\n${domain} 能力值：${score} / 100 ${feedback}\n`, false);

  diagState.round++;
  if (diagState.round >= DOMAINS.length) {
    setTimeout(() => finishDiagnosis(), 1200);
  } else {
    setTimeout(() => askNextDomain(), 1200);
  }
  return true;
}

function finishDiagnosis() {
  const scores = getDomainScores();
  const sorted = DOMAINS.map(d => ({ domain: d, score: scores[d] || 0 }))
    .sort((a, b) => a.score - b.score);

  let summary = '📋 **5 域认知画像**\n\n';
  sorted.forEach((s, i) => {
    const filled = Math.floor(s.score / 20);
    const bar = '▓'.repeat(filled) + '░'.repeat(5 - filled);
    summary += `${i + 1}. ${s.domain} ${bar} ${s.score}/100\n`;
  });
  summary += `\n🎯 **最薄弱领域**：${sorted[0].domain}（${sorted[0].score}/100）`;
  summary += `\n📖 **推荐学习**：从「${sorted[0].domain}」的入门节点开始`;
  summary += `\n\n🚀 自动跳转到「学习」页面...`;

  window.addMessage(summary, false);

  setTimeout(() => {
    if (window.showScreen) {
      window.showScreen('feeder');
    } else {
      document.querySelector('[data-screen="feeder"]')?.click();
    }
    setTimeout(() => {
      if (window.selectEnergy) {
        window.selectEnergy('normal');
        setTimeout(() => renderRecommendedNode(sorted[0].domain), 600);
      }
    }, 300);
  }, 2500);
}

function renderRecommendedNode(domain) {
  const data = (window.knowledgeData || []);
  const node = data
    .filter(n => n.domainName === domain && n.level === '入门')
    .sort((a, b) => a.duration - b.duration)[0];
  if (!node) return;
  // 找到匹配卡片
  setTimeout(() => {
    const card = document.querySelector(`.node-card[data-node-id="${node.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.style.transition = 'box-shadow 0.4s';
    card.style.boxShadow = '0 0 0 4px #D4A574';
    setTimeout(() => { card.style.boxShadow = ''; }, 2500);
  }, 400);
}

// ==================== 5 域雷达图（纯 SVG） ====================

function renderRadar() {
  const svg = document.getElementById('radar-svg');
  if (!svg) return;
  const scores = getDomainScores();
  const cx = 0, cy = 0, R = 130;
  const N = DOMAINS.length;
  const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI / N);

  // 5 圈参考线
  let html = '';
  for (let r = 1; r <= 5; r++) {
    const rr = R * r / 5;
    const pts = DOMAINS.map((_, i) => {
      const x = cx + rr * Math.cos(angle(i));
      const y = cy + rr * Math.sin(angle(i));
      return `${x},${y}`;
    }).join(' ');
    html += `<polygon points="${pts}" fill="none" stroke="#E5E5E5" stroke-width="1"/>`;
  }
  // 5 条轴线
  DOMAINS.forEach((_, i) => {
    const x = cx + R * Math.cos(angle(i));
    const y = cy + R * Math.sin(angle(i));
    html += `<line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#E5E5E5" stroke-width="1"/>`;
  });
  // 数据多边形
  const dataPts = DOMAINS.map((d, i) => {
    const s = scores[d] || 0;
    const rr = R * s / 100;
    const x = cx + rr * Math.cos(angle(i));
    const y = cy + rr * Math.sin(angle(i));
    return `${x},${y}`;
  }).join(' ');
  html += `<polygon points="${dataPts}" fill="rgba(212,165,116,0.30)" stroke="#D4A574" stroke-width="2"/>`;
  // 数据点
  DOMAINS.forEach((d, i) => {
    const s = scores[d] || 0;
    const rr = R * s / 100;
    const x = cx + rr * Math.cos(angle(i));
    const y = cy + rr * Math.sin(angle(i));
    html += `<circle cx="${x}" cy="${y}" r="3" fill="#D4A574"/>`;
  });
  // 5 个标签
  DOMAINS.forEach((d, i) => {
    const s = scores[d] || 0;
    const lx = cx + (R + 18) * Math.cos(angle(i));
    const ly = cy + (R + 18) * Math.sin(angle(i));
    const anchor = Math.abs(Math.cos(angle(i))) < 0.1 ? 'middle' : (Math.cos(angle(i)) > 0 ? 'start' : 'end');
    html += `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" font-size="12" fill="#333" font-weight="600">${d}</text>`;
    html += `<text x="${lx}" y="${ly + 14}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="#D4A574">${s}</text>`;
  });
  svg.innerHTML = html;
}

// ==================== 进度页：4 项统计 + 日历 ====================

function calculateOverallProgress() {
  const map = JSON.parse(localStorage.getItem('learningProgress') || '{}');
  const data = (window.knowledgeData || []);
  const nodeCount = data.length || 15;
  const mastered = Object.values(map).filter(s => {
    if (!s) return false;
    if (s === 'mastered') return true;
    if (typeof s === 'object' && s.completed) return true;
    return false;
  }).length;
  const read = Object.values(map).filter(s => {
    if (!s) return false;
    if (s === 'read' || s === 'mastered') return true;
    if (typeof s === 'object' && (s.step1 || s.completed)) return true;
    return false;
  }).length;
  const scores = getDomainScores();
  const avgScore = DOMAINS.reduce((s, d) => s + (scores[d] || 0), 0) / DOMAINS.length;

  const p1 = (mastered / nodeCount) * 30;       // 节点掌握 30%
  const p2 = (read / nodeCount) * 30;           // 节点已读 30%
  const p3 = (avgScore / 100) * 25;             // 能力分数 25%
  const p4 = Math.min(getStreak() / 7, 1) * 10; // 连续打卡 10%
  const p5 = 0;                                  // 书籍阅读 5%（暂未实现）
  return Math.round(p1 + p2 + p3 + p4 + p5);
}

function getTotalDuration() {
  const map = JSON.parse(localStorage.getItem('learningProgress') || '{}');
  const data = (window.knowledgeData || []);
  let total = 0;
  Object.entries(map).forEach(([id, s]) => {
    if (!s) return;
    const isRead = (typeof s === 'string' && (s === 'read' || s === 'mastered'))
      || (typeof s === 'object' && (s.step1 || s.completed));
    if (isRead) {
      const node = data.find(n => n.id === id);
      if (node) total += node.duration || 0;
    }
  });
  return total;
}

function renderSummaryCards() {
  const overall = calculateOverallProgress();
  const map = JSON.parse(localStorage.getItem('learningProgress') || '{}');
  const mastered = Object.values(map).filter(s => {
    if (!s) return false;
    if (s === 'mastered') return true;
    if (typeof s === 'object' && s.completed) return true;
    return false;
  }).length;

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('summary-overall', overall + '%');
  el('summary-overall-bar').style.width = overall + '%';
  el('summary-mastered', mastered + ' / 15');
  el('summary-streak', getStreak() + ' 天');
  el('summary-duration', getTotalDuration() + ' 分钟');
}

function renderCalendar() {
  const el = document.getElementById('calendar-grid');
  if (!el) return;
  const data = getCheckIn();
  const today = new Date();
  let html = '';
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const isToday = i === 0;
    const done = !!data[key];
    html += `<div class="calendar-day ${done ? 'done' : ''} ${isToday ? 'today' : ''}" title="${key}">${d.getDate()}</div>`;
  }
  el.innerHTML = html;
}

function renderProgressDashboard() {
  renderSummaryCards();
  renderRadar();
  renderCalendar();
}

// ==================== 跨 tab 同步 ====================

// 进度页进入时刷新
function onProgressTabEnter() {
  if (window.knowledgeData && window.knowledgeData.length > 0) {
    renderProgressDashboard();
  } else {
    setTimeout(onProgressTabEnter, 200);
  }
}

// 监听所有进度 tab 入口
document.querySelectorAll('[data-screen="progress"], [data-tab="进度"]').forEach(t => {
  t.addEventListener('click', () => setTimeout(onProgressTabEnter, 150));
});

// 监听进度更新事件（feeder 完成节点时 dispatch）
window.addEventListener('progress:update', () => {
  renderProgressDashboard();
});

// 暴露到全局
window.startDiagnosis = startDiagnosis;
window.handleDiagnosisAnswer = handleDiagnosisAnswer;
window.renderRadar = renderRadar;
window.renderSummaryCards = renderSummaryCards;
window.renderCalendar = renderCalendar;
window.renderProgressDashboard = renderProgressDashboard;
window.getDomainScores = getDomainScores;
window.setDomainScore = setDomainScore;
window.recordCheckIn = recordCheckIn;
window.DOMAINS = DOMAINS;

// 初次进入进度页时也渲染
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const prog = document.getElementById('progress');
    if (prog && prog.classList.contains('active')) onProgressTabEnter();
  }, 500);
});

})();
