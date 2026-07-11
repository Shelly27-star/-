let scannerState = {
  step: 'initial',
  node: null,
  round: 0,        // 对话轮次
  maxRounds: 4,    // 最大对话轮次
  userAnswers: [],
  messages: [],
  probesHit: []    // 已触及的探针
};

// 语音识别相关
let recognition = null;
let isRecording = false;

// 防止重复初始化的标志
let scannerInitialized = false;
let startNewTopicRetryCount = 0;

function initSpeechRecognition() {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const input = document.getElementById('scanner-input');
      input.value = transcript;
      // 自动发送
      handleUserAnswer();
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      updateVoiceButton(false);
      if (event.error === 'no-speech') {
        addMessage('没有检测到语音，请重试', false);
      } else {
        addMessage('语音识别出错：' + event.error, false);
      }
    };

    recognition.onend = () => {
      updateVoiceButton(false);
    };
  }
}

function toggleVoiceInput() {
  if (!recognition) {
    addMessage('您的浏览器不支持语音输入，请使用 Chrome 浏览器', false);
    return;
  }

  if (isRecording) {
    recognition.stop();
    updateVoiceButton(false);
  } else {
    recognition.start();
    updateVoiceButton(true);
    addMessage('🎤 正在聆听...', false);
  }
}

function updateVoiceButton(recording) {
  isRecording = recording;
  const btn = document.getElementById('btn-voice');
  if (btn) {
    btn.classList.toggle('recording', recording);
    btn.innerHTML = recording ? '⏹️ 停止' : '🎤 语音';
  }
}

function getRandomNode() {
  const nodes = knowledgeData;
  if (nodes.length === 0) return null;
  const shuffled = [...nodes].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

function addMessage(text, isUser, isError = false) {
  const container = document.getElementById('scanner-messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
  if (isError) {
    messageDiv.innerHTML = `
      <div class="message-content">
        <p style="color: var(--danger);">${text}</p>
        <button class="btn-secondary" onclick="initScanner()" style="margin-top: 12px; padding: 8px 16px;">重新扫描</button>
      </div>
    `;
  } else {
    messageDiv.innerHTML = `<div class="message-content"><p>${text}</p></div>`;
  }
  container.appendChild(messageDiv);
  container.scrollTop = container.scrollHeight;
}

function updateProgress() {
  const roundInfo = `第 ${scannerState.round}/${scannerState.maxRounds} 轮对话`;
  const probesHitCount = scannerState.probesHit ? scannerState.probesHit.length : 0;
  const probeInfo = `已触及 ${probesHitCount}/${scannerState.node?.probes?.length || 5} 个关键探针`;

  let progressDiv = document.getElementById('scanner-progress');
  if (!progressDiv) {
    const chatBox = document.getElementById('scanner-chat');
    progressDiv = document.createElement('div');
    progressDiv.id = 'scanner-progress';
    progressDiv.className = 'scanner-progress';
    chatBox.insertBefore(progressDiv, chatBox.firstChild.nextSibling);
  }

  progressDiv.innerHTML = `
    <span>${roundInfo}</span>
    <span>${probeInfo}</span>
  `;
}

function showTyping(show) {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    const parent = indicator.closest('.message');
    if (parent) {
      parent.style.display = show ? 'flex' : 'none';
    }
  }

  // 如果没有 typing indicator，创建一个
  if (show && !indicator) {
    const container = document.getElementById('scanner-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message';
    messageDiv.innerHTML = `
      <div class="message-content">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }
}

function hideLastTyping() {
  const container = document.getElementById('scanner-messages');
  const lastMessage = container.lastElementChild;
  if (lastMessage && lastMessage.classList.contains('ai-message')) {
    const content = lastMessage.querySelector('.message-content p');
    if (!content || content.textContent === '') {
      container.removeChild(lastMessage);
    }
  }
}

function clearMessages() {
  const container = document.getElementById('scanner-messages');
  container.innerHTML = '';
}

function initScanner() {
  // ✅ 如果已经初始化，立即返回
  if (scannerInitialized) {
    console.log('Scanner 已初始化，跳过');
    return;
  }

  scannerInitialized = true;
  
  scannerState = {
    step: 'initial',
    node: null,
    round: 0,
    maxRounds: 4,
    userAnswers: [],
    messages: [],
    probesHit: []
  };
  
  clearMessages();
  initSpeechRecognition();
  startNewTopic();
}

function startNewTopic() {
  console.log('🎯 startNewTopic 调用');
  
  // ✅ 直接检查知识库数据，简化逻辑
  const nodes = window.knowledgeData || [];
  
  if (nodes.length === 0) {
    startNewTopicRetryCount++;
    console.log('⚠️ 知识库未加载，重试次数:', startNewTopicRetryCount);

    // 最多重试 3 次，避免无限循环
    if (startNewTopicRetryCount > 3) {
      console.log('❌ 知识库加载失败，停止重试');
      addMessage('知识库加载失败，请刷新页面重试', false, true);
      return;
    }

    addMessage('知识库加载中，请稍候...', false);
    const timeoutId = setTimeout(startNewTopic, 1000);
    console.log('⏱️ 创建重试定时器:', timeoutId);
    return;
  }

  // ✅ 知识库已加载，立即获取节点并显示问题
  startNewTopicRetryCount = 0;
  
  const shuffled = [...nodes].sort(() => Math.random() - 0.5);
  const node = shuffled[0];
  
  if (!node) {
    console.log('❌ 无法获取节点，知识库可能为空');
    addMessage('知识库为空，请检查数据', false, true);
    return;
  }

  console.log('✅ 成功获取节点:', node.id, node.title);

  scannerState.node = node;
  window.setCurrentSessionNode(node);
  scannerState.round = 0;
  scannerState.userAnswers = [];
  scannerState.probesHit = [];

  // 构建对话系统 prompt
  const systemPrompt = `你是认知盲区分析专家，正在通过对话诊断用户的认知盲区。

当前话题：${node.domainName} - ${node.title}
话题引导问题：${node.topic}
预设追问：${node.followUp}

关键理解探针（判断用户是否理解的核心维度）：${node.probes.join('、')}

对话规则：
1. 每次用户回答后，你需要判断是否需要继续追问
2. 如果用户的回答过于简单、偏离主题、或没有触及关键探针，请提出针对性的追问
3. 如果用户回答已经触及 3 个以上探针，或对话已进行 4 轮，请结束对话并给出分析
4. 追问要具体、有引导性，帮助用户深入思考

输出格式：
- 如果需要继续追问：输出 JSON {"action": "followup", "question": "追问内容", "probesHit": ["已触及的探针"]}
- 如果可以结束分析：输出 JSON {"action": "analyze", "overall": "整体评价", "probesHit": ["已触及的探针"], "blindSpots": ["你在'XXX'维度存在认知空白"], "suggestedNode": "${node.id}"}`;

  scannerState.messages = [
    { role: 'system', content: systemPrompt }
  ];

  // 显示进度
  updateProgress();
  
  // ✅ 立即显示问题，系统主动提问
  addMessage(node.topic, false);
  scannerState.messages.push({ role: 'assistant', content: node.topic });
  scannerState.step = 'questioning';
  
  console.log('✅ 已显示第一个问题:', node.topic);
}

async function handleUserAnswer() {
  console.log('💬 handleUserAnswer 调用');
  const input = document.getElementById('scanner-input');
  const answer = input.value.trim();

  if (!answer) {
    console.log('⚠️ 用户输入为空，跳过');
    return;
  }

  // ✅ 优先判断：是否在 5 域诊断中？
  if (window.handleDiagnosisAnswer && /^[A-Da-d]$/.test(answer.trim())) {
    if (window.handleDiagnosisAnswer(answer)) {
      input.value = '';
      return;
    }
  }

  input.value = '';
  addMessage(answer, true);
  scannerState.userAnswers.push(answer);
  scannerState.messages.push({ role: 'user', content: answer });
  scannerState.round++;

  console.log('📊 当前对话状态:', {
    round: scannerState.round,
    maxRounds: scannerState.maxRounds,
    step: scannerState.step,
    userAnswersCount: scannerState.userAnswers.length,
    probesHit: scannerState.probesHit
  });

  updateProgress();
  showTyping(true);

  // 判断是否需要 AI 追问或分析
  await processAIResponse();
}

async function processAIResponse() {
  console.log('🤖 processAIResponse 调用');
  console.log('📊 当前轮次:', scannerState.round, '/', scannerState.maxRounds);

  // 如果超过最大轮次，直接分析
  if (scannerState.round >= scannerState.maxRounds) {
    console.log('⏹️ 达到最大轮次，开始分析');
    await performBlindSpotAnalysis();
    return;
  }

  // 调用 AI 判断是否需要追问
  console.log('📡 调用 Deepseek API');
  const result = await window.callDeepseek(scannerState.messages);
  console.log('📥 API 返回结果:', result);

  hideLastTyping();

  // ✅ 如果API失败，使用本地关键词匹配降级逻辑
  if (!result) {
    console.log('❌ API 返回空结果，启用本地关键词匹配降级逻辑');
    const fallbackResult = analyzeFallback();
    
    if (scannerState.round < 2 && scannerState.node.followUp) {
      // 前2轮使用预设追问
      addMessage(scannerState.node.followUp, false);
      scannerState.messages.push({ role: 'assistant', content: scannerState.node.followUp });
    } else {
      // 达到一定轮次或无追问时，直接显示分析结果
      console.log('📊 使用降级分析结果:', fallbackResult);
      showAnalysisResult(fallbackResult);
    }
    return;
  }

  // 更新探针命中状态
  if (result.probesHit) {
    scannerState.probesHit = result.probesHit;
    console.log('🎯 探针命中更新:', result.probesHit);
    updateProgress();
  }

  console.log('📊 AI 决策:', result.action);

  if (result.action === 'followup' && result.question) {
    // AI 决定继续追问
    console.log('🔄 AI 继续追问:', result.question);
    addMessage(result.question, false);
    scannerState.messages.push({ role: 'assistant', content: result.question });
    scannerState.step = 'questioning';
  } else if (result.action === 'analyze') {
    // AI 决定结束并分析
    console.log('📊 AI 决定分析');
    await performBlindSpotAnalysis(result);
  } else {
    // 降级处理：使用预设追问或分析
    console.log('⚠️ 降级处理');
    if (scannerState.round < 2 && scannerState.node.followUp) {
      addMessage(scannerState.node.followUp, false);
      scannerState.messages.push({ role: 'assistant', content: scannerState.node.followUp });
    } else {
      await performBlindSpotAnalysis();
    }
  }
}

async function performBlindSpotAnalysis(partialResult) {
  const node = scannerState.node;

  // 如果已有部分分析结果，直接使用
  if (partialResult && partialResult.blindSpots) {
    showAnalysisResult(partialResult);
    return;
  }

  // 否则调用完整的分析
  const systemPrompt = `你是认知盲区分析专家。用户已完成关于${node.domainName}话题的对话。

关键理解探针：${node.probes.join('、')}
用户回答记录：${scannerState.userAnswers.join('\n')}

请分析用户的认知状态：
输出 JSON：
{
  "overall": "用户整体理解程度的评价（1-2句话）",
  "probesHit": ["用户已理解触及的探针"],
  "blindSpots": ["用户在'XXX维度'存在认知空白（最多2个，格式必须为：你在'XXX'维度存在认知空白）"],
  "suggestedNode": "${node.id}"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...scannerState.messages.filter(m => m.role !== 'system')
  ];

  const result = await window.callDeepseek(messages);

  hideLastTyping();

  if (result) {
    showAnalysisResult(result);
  } else {
    // ✅ API 调用失败，使用本地关键词匹配降级逻辑
    console.log('❌ API 分析失败，启用本地关键词匹配降级逻辑');
    const fallbackResult = analyzeFallback();
    console.log('📊 使用降级分析结果:', fallbackResult);
    showAnalysisResult(fallbackResult);
  }
}

function analyzeFallback() {
  const node = scannerState.node;
  const answers = scannerState.userAnswers.join(' ');

  // ✅ 使用关键词匹配检测探针命中
  const probesHit = node.probes.filter(p => answers.includes(p));
  const probesMiss = node.probes.filter(p => !answers.includes(p));

  // ✅ 生成符合格式的盲区描述
  const blindSpots = probesMiss.slice(0, 2).map(p => `你在 '${p}' 维度存在认知空白`);

  return {
    overall: `用户在${scannerState.round}轮对话中，触及了${probesHit.length}/${node.probes.length}个关键探针。`,
    probesHit: probesHit,
    blindSpots: blindSpots.length > 0 ? blindSpots : ['无明显盲区，已掌握关键概念'],
    suggestedNode: node.id
  };
}

function showAnalysisResult(result) {
  document.getElementById('analysis-overall').textContent = result.overall || '分析完成';

  // 显示盲区描述（优化格式）
  const blindspotsList = document.getElementById('blindspots-list');
  blindspotsList.innerHTML = '';
  (result.blindSpots || []).forEach(spot => {
    const li = document.createElement('li');
    // 确保 blindSpots 格式为 "你在'XXX'维度存在认知空白"
    if (!spot.includes('你在') && !spot.includes('维度存在认知空白')) {
      spot = `你在 '${spot}' 维度存在认知空白`;
    }
    li.textContent = spot;
    blindspotsList.appendChild(li);
  });

  // 显示探针命中状态
  renderProbesStatus(result.probesHit || []);

  renderCognitiveMap(result.suggestedNode);

  window.showScreen('scanner-result');
}

function renderProbesStatus(probesHit) {
  const probesContainer = document.getElementById('probes-status');
  if (!probesContainer) return;

  const allProbes = scannerState.node?.probes || [];
  probesContainer.innerHTML = '';

  allProbes.forEach(probe => {
    const isHit = probesHit.includes(probe);
    const probeDiv = document.createElement('div');
    probeDiv.className = 'probe-status';
    probeDiv.innerHTML = `
      <span class="probe-name">${probe}</span>
      <span class="probe-tag ${isHit ? 'hit' : 'miss'}">${isHit ? '命中' : '未命中'}</span>
    `;
    probesContainer.appendChild(probeDiv);
  });
}

function renderCognitiveMap(suggestedNodeId) {
  const mapContainer = document.getElementById('map-nodes');
  const cognitiveMap = JSON.parse(localStorage.getItem('cognitiveMap') || '{}');

  mapContainer.innerHTML = '';

  knowledgeData.forEach(node => {
    const status = cognitiveMap[node.id]?.status || 'blank';
    const isSuggested = node.id === suggestedNodeId;

    const nodeDiv = document.createElement('div');
    nodeDiv.className = `map-node`;

    let domainClass = '';
    switch (node.domain) {
      case 'politics': domainClass = 'politics'; break;
      case 'military': domainClass = 'military'; break;
      case 'history': domainClass = 'history'; break;
      case 'philosophy': domainClass = 'philosophy'; break;
      case 'finance': domainClass = 'finance'; break;
    }

    let statusLabel = '';
    switch (status) {
      case 'established': statusLabel = '已建立'; break;
      case 'consolidate': statusLabel = '需巩固'; break;
      default: statusLabel = '空白'; break;
    }

    nodeDiv.innerHTML = `
      <div class="map-node-info">
        <span class="map-node-domain domain-tag ${domainClass}">${node.domainName}</span>
        <span class="map-node-title">${node.title}</span>
      </div>
      <span class="status-tag ${status}">${statusLabel}</span>
    `;

    if (isSuggested) {
      nodeDiv.style.background = 'var(--beige)';
      nodeDiv.querySelector('.status-tag').textContent = '待补全';
      nodeDiv.querySelector('.status-tag').className = 'status-tag blank';
    }

    mapContainer.appendChild(nodeDiv);
  });
}

// 暴露给外部调用
window.startScanner = initScanner;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-send-scan')?.addEventListener('click', handleUserAnswer);

  // 语音按钮
  document.getElementById('btn-voice')?.addEventListener('click', toggleVoiceInput);

  document.getElementById('scanner-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleUserAnswer();
    }
  });

  document.getElementById('btn-back-scanner')?.addEventListener('click', () => {
    // 重置初始化标志，允许重新扫描
    scannerInitialized = false;
    initScanner();
  });

  const scannerScreen = document.getElementById('scanner');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        // 只在首次激活时初始化，防止重复触发
        if (scannerScreen.classList.contains('active') && !scannerInitialized) {
          initScanner();
        }
      }
    });
  });

  observer.observe(scannerScreen, { attributes: true });
});