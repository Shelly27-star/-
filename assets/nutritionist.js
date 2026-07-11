function showAnalysisResult(show) {
  const result = document.getElementById('analysis-result');
  result.classList.toggle('show', show);
}

function setDensity(density) {
  const dots = document.querySelectorAll('#density-dots .dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('filled', index < density);
  });
}

function setBias(bias) {
  const tag = document.getElementById('bias-tag');
  tag.textContent = bias === 'low' ? '低' : bias === 'medium' ? '中' : '高';
  tag.className = `bias-tag ${bias}`;
}

function setRelatedDomains(domains) {
  const container = document.getElementById('related-domains');
  container.innerHTML = '';

  const domainMap = {
    '政治学': 'politics',
    '军事学': 'military',
    '历史学': 'history',
    '哲学': 'philosophy',
    '金融学': 'finance'
  };

  domains.forEach(domain => {
    const tag = document.createElement('span');
    const domainKey = domainMap[domain] || 'military';
    tag.className = `domain-tag ${domainKey}`;
    tag.textContent = domain;
    container.appendChild(tag);
  });
}

function setLearnable(learnable) {
  const tag = document.getElementById('learnable-tag');
  tag.textContent = learnable ? '是' : '否';
  tag.className = `learnable-tag ${learnable ? 'yes' : 'no'}`;
}

function resetAnalysis() {
  showAnalysisResult(false);
  document.getElementById('nutritionist-input').value = '';
  setDensity(0);
  setBias('medium');
  setRelatedDomains([]);
  setLearnable(false);
  document.getElementById('density-reason').textContent = '';
  document.getElementById('bias-reason').textContent = '';
  document.getElementById('related-reason').textContent = '';
  document.getElementById('learnable-reason').textContent = '';
  document.getElementById('recommendation-text').textContent = '';
}

async function analyzeContent() {
  const input = document.getElementById('nutritionist-input');
  const content = input.value.trim();

  // 检测 URL 链接
  const urlPattern = /https?:\/\/[^\s]+/;
  if (urlPattern.test(content)) {
    const hint = document.getElementById('input-hint');
    hint.textContent = '请粘贴内容文字，暂不支持链接直接解析。你可以复制文章内容后粘贴。';
    hint.style.display = 'block';
    return;
  }

  // 清除提示
  const hint = document.getElementById('input-hint');
  hint.style.display = 'none';

  if (!content) {
    alert('请输入要分析的内容');
    return;
  }

  const btn = document.getElementById('btn-analyze');
  const originalText = btn.textContent;
  btn.textContent = '分析中...';
  btn.disabled = true;

  const systemPrompt = `你是信息价值分析专家。请分析用户粘贴的内容，从以下维度评估：

1. 信息密度（1-5分）：内容中干货/事实的比例
2. 偏见指数（低/中/高）：作者是否有明显立场倾向
3. 关联领域：这条内容与哪些知识领域相关（政治学/军事学/历史学/哲学/金融学）
4. 可学性：普通读者能否从中学到可复用的认知框架

输出格式必须是JSON：
{
  "density": 3,
  "densityReason": "信息密度评分理由（1句话）",
  "bias": "中",
  "biasReason": "偏见指数评分理由（1句话）",
  "relatedDomains": ["军事学"],
  "relatedReason": "为什么与这些领域相关",
  "learnable": true/false,
  "learnableReason": "是否值得花时间学习的理由",
  "recommendation": "给用户的具体建议：是否建议阅读，如果读应该关注什么"
}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: content }
  ];

  const result = await window.callDeepseek(messages);

  btn.textContent = originalText;
  btn.disabled = false;

  if (result) {
    renderAnalysisResult(result);
  } else {
    // API 调用失败，显示失败提示
    const hint = document.getElementById('input-hint');
    hint.textContent = '分析服务暂时不可用，请稍后重试';
    hint.style.color = 'var(--danger)';
    hint.style.display = 'block';
    showAnalysisResult(false);
  }
}

function renderAnalysisResult(result) {
  setDensity(result.density || 3);
  document.getElementById('density-reason').textContent = result.densityReason || '';

  // 确保 bias 使用正确的英文格式
  const biasValue = result.bias === '低' ? 'low' : result.bias === '中' ? 'medium' : result.bias === '高' ? 'high' : result.bias || 'medium';
  setBias(biasValue);
  document.getElementById('bias-reason').textContent = result.biasReason || '';

  setRelatedDomains(result.relatedDomains || []);
  document.getElementById('related-reason').textContent = result.relatedReason || '';

  setLearnable(result.learnable || false);
  document.getElementById('learnable-reason').textContent = result.learnableReason || '';

  document.getElementById('recommendation-text').textContent = result.recommendation || '无法提供具体建议';

  showAnalysisResult(true);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-analyze')?.addEventListener('click', analyzeContent);

  const nutritionistScreen = document.getElementById('nutritionist');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (nutritionistScreen.classList.contains('active')) {
          resetAnalysis();
        }
      }
    });
  });
  
  observer.observe(nutritionistScreen, { attributes: true });
});