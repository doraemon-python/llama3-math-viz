import { modelComponents, tokenizeText, getMockEmbedding, mockVocabulary, Llama3Config } from './llama3_model.js';

// State management
let activeNodeId = 'tokenizer';

// Elements
const moduleNav = document.getElementById('module-nav');
const pipelineSvg = document.getElementById('pipeline-svg');
const detailsTitle = document.getElementById('details-title');
const detailsDesc = document.getElementById('details-desc');
const mathContainer = document.getElementById('math-latex-container');
const shapesTableBody = document.getElementById('shapes-table-body');
const codeSnippetContainer = document.getElementById('code-snippet-container');
const btnCopyCode = document.getElementById('btn-copy-code');
const tokenizerInput = document.getElementById('tokenizer-input');
const tokenizerOutputChips = document.getElementById('tokenizer-output-chips');
const sandboxTitle = document.getElementById('sandbox-title');
const sandboxInputsContainer = document.getElementById('sandbox-inputs-container');
const sandboxStepsOutput = document.getElementById('sandbox-steps-output');

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initTokenizer();
  initNavigation();
  initSvgInteraction();
  selectNode(activeNodeId);
  initCopyCode();
  initStoryStepper();
  
  // Refresh Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// 1. Tokenizer functions
function initTokenizer() {
  tokenizerInput.addEventListener('input', (e) => {
    renderTokenizerChips(e.target.value);
    renderStoryStep(activeStoryStep);
  });
  renderTokenizerChips(tokenizerInput.value);
}

function renderTokenizerChips(text) {
  if (!text) {
    tokenizerOutputChips.innerHTML = '<span class="placeholder-text text-muted" style="font-size:11px;">テキストなし</span>';
    return;
  }
  const tokens = tokenizeText(text);
  tokenizerOutputChips.innerHTML = tokens.map(tok => `
    <div class="token-chip">
      <span class="token-text">${escapeHtml(tok.text)}</span>
      <span class="token-id">${tok.id}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 2. Navigation rendering
function initNavigation() {
  moduleNav.innerHTML = '';
  Object.keys(modelComponents).forEach((key) => {
    const comp = modelComponents[key];
    const navItem = document.createElement('button');
    navItem.className = `nav-item ${key === activeNodeId ? 'active' : ''}`;
    navItem.id = `nav-${key}`;
    navItem.innerHTML = `
      <span>${comp.name.split(' ')[1]}</span>
      <span class="node-badge">${comp.id.toUpperCase()}</span>
    `;
    navItem.addEventListener('click', () => selectNode(key));
    moduleNav.appendChild(navItem);
  });
}

// 3. SVG Nodes interaction
function initSvgInteraction() {
  const nodes = pipelineSvg.querySelectorAll('.svg-node');
  nodes.forEach(node => {
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      const nodeId = node.id.replace('node-', '');
      if (modelComponents[nodeId]) {
        selectNode(nodeId);
      }
    });
  });
}

// 4. Select node logic
function selectNode(nodeId) {
  if (!modelComponents[nodeId]) return;
  activeNodeId = nodeId;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  const activeNavItem = document.getElementById(`nav-${nodeId}`);
  if (activeNavItem) activeNavItem.classList.add('active');
  
  // Update SVG active state
  const svgNodes = pipelineSvg.querySelectorAll('.svg-node');
  svgNodes.forEach(node => {
    node.classList.remove('active');
  });
  const activeSvgNode = pipelineSvg.getElementById(`node-${nodeId}`);
  if (activeSvgNode) activeSvgNode.classList.add('active');
  
  // Render Details
  const comp = modelComponents[nodeId];
  detailsTitle.innerText = comp.name;
  detailsDesc.innerText = comp.description;
  
  // Render LaTeX using KaTeX
  if (window.katex) {
    try {
      window.katex.render(comp.latex, mathContainer, {
        throwOnError: false,
        displayMode: true
      });
    } catch (err) {
      mathContainer.innerHTML = `<pre>${comp.latex}</pre>`;
    }
  } else {
    mathContainer.innerHTML = `<pre>${comp.latex}</pre>`;
  }
  
  // Render Shapes
  shapesTableBody.innerHTML = comp.shapes.map(s => `
    <tr>
      <td>${s.label}</td>
      <td>${s.shape}</td>
    </tr>
  `).join('');
  
  // Render Code
  codeSnippetContainer.innerText = comp.pytorch;
  
  // Render Sandbox
  sandboxTitle.innerText = `${comp.name.split('. ')[1]} - 数値計算サンドボックス`;
  buildSandboxInputs(comp.sandbox);
  calculateSandbox(nodeId);
}

// 5. Code Copy
function initCopyCode() {
  btnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(codeSnippetContainer.innerText).then(() => {
      btnCopyCode.classList.add('copied');
      btnCopyCode.querySelector('span').innerText = 'コピー済';
      setTimeout(() => {
        btnCopyCode.classList.remove('copied');
        btnCopyCode.querySelector('span').innerText = 'コピー';
      }, 2000);
    });
  });
}

// 6. Build Sandbox UI
function buildSandboxInputs(sandboxConf) {
  sandboxInputsContainer.innerHTML = '';
  
  sandboxConf.inputs.forEach(input => {
    const wrapper = document.createElement('div');
    wrapper.className = 'input-field';
    
    const label = document.createElement('label');
    label.innerText = input.label;
    label.setAttribute('for', `sb-${input.id}`);
    wrapper.appendChild(label);
    
    if (input.type === 'text') {
      const el = document.createElement('input');
      el.type = 'text';
      el.id = `sb-${input.id}`;
      el.value = input.default;
      wrapper.appendChild(el);
    } else if (input.type === 'number') {
      const el = document.createElement('input');
      el.type = 'number';
      el.id = `sb-${input.id}`;
      el.value = input.default;
      el.step = 'any';
      wrapper.appendChild(el);
    } else if (input.type === 'select') {
      const el = document.createElement('select');
      el.id = `sb-${input.id}`;
      input.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.innerText = opt;
        el.appendChild(o);
      });
      el.value = input.default || input.options[0];
      wrapper.appendChild(el);
    } else if (input.type === 'array') {
      const el = document.createElement('input');
      el.type = 'text';
      el.className = 'array-input';
      el.id = `sb-${input.id}`;
      el.value = input.default;
      wrapper.appendChild(el);
    } else if (input.type === 'matrix') {
      const el = document.createElement('input');
      el.type = 'text';
      el.className = 'array-input';
      el.id = `sb-${input.id}`;
      el.value = input.default;
      wrapper.appendChild(el);
    } else if (input.type === 'array_string') {
      const el = document.createElement('input');
      el.type = 'text';
      el.id = `sb-${input.id}`;
      el.value = input.default;
      wrapper.appendChild(el);
    }
    
    sandboxInputsContainer.appendChild(wrapper);
    
    // Add real-time event listener to input
    const targetEl = wrapper.querySelector('input') || wrapper.querySelector('select');
    targetEl.addEventListener('input', () => {
      calculateSandbox(activeNodeId);
    });
  });
}

// 7. Calculate Sandbox Values
function calculateSandbox(nodeId) {
  sandboxStepsOutput.innerHTML = '';
  
  try {
    switch (nodeId) {
      case 'tokenizer': {
        const text = document.getElementById('sb-text').value;
        const tokens = tokenizeText(text);
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. 入力テキスト分割</div>
            <div class="step-desc">テキストをBPEに基づく最小単位に分割します。</div>
            <div class="step-calc">"${text}" → [${tokens.map(t => `'${t.text}'`).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 語彙IDルックアップ</div>
            <div class="step-desc">Llama 3 vocabulary table (大きさ 128,256) からIDを引きます。</div>
            <div class="step-calc">${JSON.stringify(tokens.map(t => ({ token: t.text, id: t.id })), null, 2)}</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'embedding': {
        const selectedToken = document.getElementById('sb-token_text').value;
        const id = mockVocabulary[selectedToken] || 999;
        const vec = getMockEmbedding(id, 8);
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. 選択されたトークンの情報</div>
            <div class="step-calc">Token: "${selectedToken}" \nVocab ID: ${id}</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 重みテーブルルックアップ (W_embed[${id}, :])</div>
            <div class="step-desc">Embedding matrix E (128256 × 4096) から ${id} 行目を取得します。</div>
            <div class="step-desc">※以下は可視化用ダミー次元 (最初の8次元) の抽出値です。</div>
            <div class="step-calc">[${vec.join(', ')}]</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'rmsnorm': {
        const rawVec = document.getElementById('sb-vector').value.split(',').map(Number);
        const rawGamma = document.getElementById('sb-gamma').value.split(',').map(Number);
        const eps = Number(document.getElementById('sb-eps').value);
        
        if (rawVec.some(isNaN) || rawGamma.some(isNaN) || rawVec.length === 0) {
          throw new Error("数値またはカンマ区切りにエラーがあります");
        }
        
        // Align vector sizes
        const n = rawVec.length;
        const gamma = rawGamma.slice(0, n);
        while (gamma.length < n) gamma.push(1.0);
        
        // Step 1: Mean of Squares
        const sqSum = rawVec.reduce((sum, v) => sum + v * v, 0);
        const meanSq = sqSum / n;
        
        // Step 2: RMS
        const rms = Math.sqrt(meanSq + eps);
        
        // Step 3: Norm
        const norm = rawVec.map(v => v / rms);
        
        // Step 4: Scale
        const output = norm.map((v, i) => v * gamma[i]);
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. 二乗平均 (Mean of Squares)</div>
            <div class="step-calc">Mean(x²) = (${rawVec.map(v => v.toFixed(3) + '²').join(' + ')}) / ${n}\n          = ${meanSq.toFixed(5)}</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 二乗平均平方根 (RMS + ε)</div>
            <div class="step-calc">RMS = √(${meanSq.toFixed(5)} + ${eps})\n    = ${rms.toFixed(5)}</div>
          </div>
          <div class="step-block">
            <div class="step-title">3. 標準化 (x / RMS)</div>
            <div class="step-calc">x_norm = [${norm.map(v => v.toFixed(4)).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">4. スケーリング (x_norm ⊙ γ)</div>
            <div class="step-desc">γ = [${gamma.map(g => g.toFixed(2)).join(', ')}]</div>
            <div class="step-calc">Output = [${output.map(v => v.toFixed(4)).join(', ')}]</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'rope': {
        const vec2d = document.getElementById('sb-vector2d').value.split(',').map(Number);
        const m = Number(document.getElementById('sb-position').value);
        const i = Number(document.getElementById('sb-dim_index').value);
        const thetaBase = Number(document.getElementById('sb-theta_base').value);
        const headDim = Number(document.getElementById('sb-head_dim').value);
        
        if (vec2d.length !== 2 || vec2d.some(isNaN)) {
          throw new Error("2Dベクトルは2つの数値を入力してください (例: 1.0, 0.5)");
        }
        
        // Calculations
        const theta_i = Math.pow(thetaBase, -(2 * i) / headDim);
        const angle = m * theta_i;
        const cosVal = Math.cos(angle);
        const sinVal = Math.sin(angle);
        
        const out0 = vec2d[0] * cosVal - vec2d[1] * sinVal;
        const out1 = vec2d[0] * sinVal + vec2d[1] * cosVal;
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. 周波数 θ_i の計算</div>
            <div class="step-calc">θ_i = ${thetaBase}^(-2 * ${i} / ${headDim})\n    = ${theta_i.toExponential(6)}</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 回転角度 ω の計算 (m × θ_i)</div>
            <div class="step-calc">ω = ${m} * ${theta_i.toExponential(4)}\n  = ${angle.toFixed(6)} rad (${(angle * 180 / Math.PI).toFixed(2)}°)</div>
          </div>
          <div class="step-block">
            <div class="step-title">3. 三角関数値 (Cos / Sin)</div>
            <div class="step-calc">cos(ω) = ${cosVal.toFixed(6)}\nsin(ω) = ${sinVal.toFixed(6)}</div>
          </div>
          <div class="step-block">
            <div class="step-title">4. 回転行列適用 (R × x)</div>
            <div class="step-desc">2次元座標を時計回りに ω 回転させます。</div>
            <div class="step-calc">y0 = x0·cos(ω) - x1·sin(ω) = ${out0.toFixed(4)}\ny1 = x0·sin(ω) + x1·cos(ω) = ${out1.toFixed(4)}\nOutput = [${out0.toFixed(4)}, ${out1.toFixed(4)}]</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'gqa': {
        const qIdx = Number(document.getElementById('sb-q_head_idx').value);
        const rawScores = document.getElementById('sb-raw_scores').value.split(',').map(Number);
        
        if (qIdx < 0 || qIdx > 31 || isNaN(qIdx)) {
          throw new Error("Queryヘッド番号は0〜31で入力してください");
        }
        if (rawScores.some(isNaN) || rawScores.length === 0) {
          throw new Error("スコアに誤りがあります");
        }
        
        // Group size is 4 in Llama 3 8B (32 / 8 = 4)
        const kvIdx = Math.floor(qIdx / 4);
        
        // Softmax
        const maxScore = Math.max(...rawScores);
        const exps = rawScores.map(s => Math.exp(s - maxScore)); // numerical stability
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const softmaxProbs = exps.map(e => e / sumExps);
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. KVヘッドのマッピング (GQAグループ化)</div>
            <div class="step-desc">Llama 3 8BのQ/KVヘッド比率は4:1です。</div>
            <div class="step-calc">Query Head [${qIdx}] → KV Head [${kvIdx}] (Group ${kvIdx})</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. アテンションSoftmaxの適用</div>
            <div class="step-desc">式: Softmax(raw_scores)</div>
            <div class="step-calc">入力スコア: [${rawScores.join(', ')}]\n確率分布: [${softmaxProbs.map(p => (p * 100).toFixed(1) + '%').join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">3. 加重和の実行</div>
            <div class="step-desc">KV Head [${kvIdx}] のValue行列 V_head に対し確率で加重平均を行います。</div>
            <div class="step-calc">Attention Output = Σ P_t × V_t (Head [${qIdx}])</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'swiglu': {
        const x = document.getElementById('sb-mlp_input').value.split(',').map(Number);
        
        // Parse matrices from inputs
        const parseMatrix = (str) => {
          return str.split(';').map(row => row.split(',').map(Number));
        };
        
        const wGate = parseMatrix(document.getElementById('sb-w_gate').value);
        const wUp = parseMatrix(document.getElementById('sb-w_up').value);
        const wDown = parseMatrix(document.getElementById('sb-w_down').value);
        
        if (x.length !== 2 || x.some(isNaN)) {
          throw new Error("入力xは2つの数値を指定してください");
        }
        
        // Matrix multiplications helpers
        const matMul = (vector, matrix) => {
          // vector is 2D, matrix is [2 x 3]
          const out = [];
          const cols = matrix[0].length;
          for (let c = 0; c < cols; c++) {
            let val = 0;
            for (let r = 0; r < vector.length; r++) {
              val += vector[r] * matrix[r][c];
            }
            out.push(val);
          }
          return out;
        };
        
        const matMulDown = (vector, matrix) => {
          // vector is 3D, matrix is [3 x 2]
          const out = [];
          const cols = matrix[0].length;
          for (let c = 0; c < cols; c++) {
            let val = 0;
            for (let r = 0; r < vector.length; r++) {
              val += vector[r] * matrix[r][c];
            }
            out.push(val);
          }
          return out;
        };
        
        // Projections
        const gateProj = matMul(x, wGate); // 3D
        const upProj = matMul(x, wUp); // 3D
        
        // SiLU
        const silu = gateProj.map(v => v * (1 / (1 + Math.exp(-v))));
        
        // Multiplied
        const mult = silu.map((v, i) => v * upProj[i]); // 3D
        
        // Project down
        const output = matMulDown(mult, wDown); // 2D
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. ゲート射影 (x W_gate) & リニア射影 (x W_up)</div>
            <div class="step-calc">Gate = [${gateProj.map(v => v.toFixed(3)).join(', ')}]\nUp   = [${upProj.map(v => v.toFixed(3)).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 活性化関数 SiLU(Gate)</div>
            <div class="step-calc">SiLU = [${silu.map(v => v.toFixed(3)).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">3. 要素積 (SiLU ⊙ Up)</div>
            <div class="step-calc">Mult = [${mult.map(v => v.toFixed(3)).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">4. 出力射影 (Mult W_down)</div>
            <div class="step-desc">中間表現次元を元の隠れ次元に戻します。</div>
            <div class="step-calc">Output = [${output.map(v => v.toFixed(4)).join(', ')}]</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'output': {
        const tokens = document.getElementById('sb-logit_tokens').value.split(',').map(s => s.trim());
        const logits = document.getElementById('sb-logit_values').value.split(',').map(Number);
        const temp = Number(document.getElementById('sb-temperature').value);
        
        if (tokens.length !== logits.length || logits.some(isNaN) || logits.length === 0) {
          throw new Error("トークンとスコアの配列の個数は等しく、数値である必要があります");
        }
        if (temp <= 0) {
          throw new Error("温度は0より大きい必要があります");
        }
        
        // Scale by temp
        const scaledLogits = logits.map(l => l / temp);
        
        // Softmax
        const maxLogit = Math.max(...scaledLogits);
        const exps = scaledLogits.map(l => Math.exp(l - maxLogit));
        const sumExps = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map(e => e / sumExps);
        
        // Find max
        let maxIdx = 0;
        let maxProb = -1;
        for (let idx = 0; idx < probs.length; idx++) {
          if (probs[idx] > maxProb) {
            maxProb = probs[idx];
            maxIdx = idx;
          }
        }
        
        let stepsHtml = `
          <div class="step-block">
            <div class="step-title">1. 温度スケーリング (Logits / T)</div>
            <div class="step-calc">Temp T = ${temp}\nScaled = [${scaledLogits.map((l, i) => tokens[i] + ': ' + l.toFixed(2)).join(', ')}]</div>
          </div>
          <div class="step-block">
            <div class="step-title">2. 確率分布の計算 (Softmax)</div>
            <div class="step-calc">${probs.map((p, i) => tokens[i] + ': ' + (p * 100).toFixed(2) + '%').join('\n')}</div>
          </div>
          <div class="step-block">
            <div class="step-title">3. Greedy トークン選択</div>
            <div class="step-desc">確率が最も高い次の単語を選択します。</div>
            <div class="step-calc" style="color: var(--color-emerald)">★選択: "${tokens[maxIdx]}" (確率: ${(maxProb * 100).toFixed(2)}%)</div>
          </div>
        `;
        sandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
    }
  } catch (err) {
    sandboxStepsOutput.innerHTML = `<div class="step-block" style="border-left-color: var(--color-amber);">
      <div class="step-title" style="color: var(--color-amber)">計算エラー</div>
      <div class="step-calc" style="color: var(--text-muted)">${err.message}</div>
    </div>`;
  }
}

// 8. Story Stepper Controller
let activeStoryStep = 1;

function initStoryStepper() {
  const steps = document.querySelectorAll('.story-step');
  steps.forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.getAttribute('data-step'));
      selectStoryStep(stepNum);
    });
  });
  selectStoryStep(activeStoryStep);
}

function selectStoryStep(stepNum) {
  activeStoryStep = stepNum;
  document.querySelectorAll('.story-step').forEach(step => {
    step.classList.remove('active');
  });
  const activeStepEl = document.querySelector(`.story-step[data-step="${stepNum}"]`);
  if (activeStepEl) activeStepEl.classList.add('active');
  
  // Render the story step content
  renderStoryStep(stepNum);
  
  // Proactively select the corresponding pipeline block for the user to sync views
  const stepToNodeMap = {
    1: 'tokenizer',
    2: 'embedding',
    3: 'rmsnorm',
    4: 'gqa',
    5: 'swiglu',
    6: 'output'
  };
  const nodeId = stepToNodeMap[stepNum];
  if (nodeId && nodeId !== activeNodeId) {
    selectNode(nodeId);
  }
}

function renderStoryStep(stepNum) {
  const text = tokenizerInput.value || "Llama 3 is awesome";
  const tokens = tokenizeText(text);
  const tokenIds = tokens.map(t => t.id);
  const contentBox = document.getElementById('story-content-box');
  if (!contentBox) return;
  
  let html = '';
  
  switch (stepNum) {
    case 1:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 1: テキスト入力からトークン化へ (BPE Tokenizer)</h3>
        <p class="description-text">
          モデルのデータ処理は、ユーザーが入力したテキストをバイトペアエンコーディング（BPE）で細分化された「トークンID」の並びに置き換えるところからスタートします。
          Llama 3では128,256語の辞書を用いており、日本語やコード等も効率良く圧縮されます。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag" style="background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); color: #60a5fa;">入力テキスト: "${escapeHtml(text)}"</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">トークンID: [${tokenIds.join(', ')}]</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          この変換によって、自然言語がニューラルネットワークが処理可能な「離散数値の配列（形状: <code>[Sequence_Length]</code> = <code>[${tokens.length}]</code>）」に整えられ、Embedding層へ引き渡されます。
        </p>
      `;
      break;
    case 2:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 2: トークンIDを高次元意味ベクトルに変換 (Embedding)</h3>
        <p class="description-text">
          ステップ1で得られたトークンID <code>[${tokenIds.slice(0, 3).join(', ')}${tokenIds.length > 3 ? '...' : ''}]</code> をキーとして、巨大な単語埋め込み行列 <code>W_embed</code>（サイズ 128,256 × 4096）から対応する行ベクトルを引き出します。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag">トークンID: [${tokens.length}個]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag" style="color:#22d3ee; background:rgba(6,182,212,0.15); border-color:rgba(6,182,212,0.3);">Embeddingテンソル 形状: [${tokens.length}, 4096]</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          これにより、意味のないただのID番号が、「4096次元の意味空間座標」を持つ連続値テンソルに変化します。この高次元ベクトルがアテンション層やMLP層を伝搬していく「モデルの隠れ状態」になります。
        </p>
      `;
      break;
    case 3:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 3: 学習安定化のための分布補正 (Pre-RMSNorm)</h3>
        <p class="description-text">
          高次元化された各トークンの4096次元ベクトルは、Transformer層に入る直前に <strong>RMSNorm</strong> レイヤーを通されます。
          Llama 3では計算効率を上げるため、平均値の減算を省き、要素の二乗平均平方根 (RMS) のみを使ってベクトルの分散を均一化（ノルムを1付近に制限）します。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag" style="color:#22d3ee; background:rgba(6,182,212,0.15); border-color:rgba(6,182,212,0.3);">入力形状: [${tokens.length}, 4096]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">正規化処理 (RMSNorm)</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag" style="color:#22d3ee; background:rgba(6,182,212,0.15); border-color:rgba(6,182,212,0.3);">出力形状: [${tokens.length}, 4096]</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          式： $\\text{RMSNorm}(\\mathbf{x}) = \\frac{\\mathbf{x}}{\\sqrt{\\frac{1}{d}\\sum x_i^2 + \\epsilon}} \\odot \\gamma$ 。各トークンのスケールが揃うことで、勾配消失や勾配爆発を防ぎ、深いモデルでの安定した学習を実現しています。
        </p>
      `;
      break;
    case 4:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 4: トークン間の相関分析と相対位置の考慮 (GQA Attention + RoPE)</h3>
        <p class="description-text">
          正規化された隠れ状態から、W_q, W_k, W_v 投影行列を介して各ヘッドのテンソルを作成します。ここで <strong>RoPE (回転位置埋め込み)</strong> を適用し、2次元のペアごとに回転を加えることで「文脈内の相対位置関係」をベクトル自体に組み込みます。
          その後、<strong>GQA (Grouped-Query Attention)</strong> に従い、4つのQueryヘッドにつき1つのKVヘッドのペアがアテンションマップを作り、文脈を織り交ぜた加重和を算出します。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag">Q: [${tokens.length}, 32, 128] / K,V: [${tokens.length}, 8, 128]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag" style="color:#a78bfa; background:rgba(139,92,246,0.15); border-color:rgba(139,92,246,0.3);">RoPE回転 → GQA積 → 加重和</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">結合 & W_o投影 → [${tokens.length}, 4096]</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          計算された結果は、入力（アテンション前のテンソル）と<strong>残差接続 (Residual Connection)</strong> で足し合わされます。
          これにより情報が劣化せずに多層を通り抜けることができます。
        </p>
      `;
      break;
    case 5:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 5: 高次特徴の非線形抽出と変換 (SwiGLU MLP)</h3>
        <p class="description-text">
          アテンションを終えた隠れ状態は、再度 RMSNorm で正規化され、<strong>SwiGLU MLP</strong> ネットワークへ送られます。
          従来のMLPに比べ、Llama 3では <code>W_gate</code>, <code>W_up</code>, <code>W_down</code> の3つの投影行列を用います。中間層でチャネル数を 14,336 次元まで広げて表現力を高め、ゲート側には高精度な SiLU (Swish) 活性化を施します。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag">入力: [${tokens.length}, 4096]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">中間次元拡張: [${tokens.length}, 14336]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">SiLUゲート積 & 圧縮: [${tokens.length}, 4096]</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          式： $(SiLU(x W_{\\text{gate}}) \\odot x W_{\\text{up}}) W_{\\text{down}}$。この高度な非線形射影により、単なる線形和（アテンション）では捉えきれない複雑な事実、論理関係、知識表現が獲得されます。こちらも最後は入力と残差接続で足されます。
        </p>
      `;
      break;
    case 6:
      html = `
        <h3 class="text-violet" style="font-size:16px; font-weight:600; margin-bottom: 8px;">Step 6: 層の積み重ねの終着点と次のトークン予測 (Final RMSNorm & Softmax)</h3>
        <p class="description-text">
          ステップ3〜5のTransformerブロック処理が<strong>計32回（32レイヤー）</strong>繰り返された後、テンソルは最終RMSNormを通されます。
          そして <code>W_output</code> 投影行列（サイズ 4096 × 128,256）によって語彙サイズに射影され、各トークンの予測スコア（Logits）が算出されます。
        </p>
        <div class="story-meta-flow">
          <span class="flow-tag">最終出力: [${tokens.length}, 4096]</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag">語彙射影: [128256] Logits</span>
          <span class="flow-arrow"><i data-lucide="arrow-right" style="width:14px; height:14px; vertical-align:middle;"></i></span>
          <span class="flow-tag" style="color:#10b981; background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.3);">Softmax 確率確率分布 → 次の単語決定</span>
        </div>
        <p class="description-text" style="font-size: 13px; margin-top: 8px;">
          文章の最後のトークン位置にあたる Logits に対し、<strong>Softmax関数</strong>を適用することで合計値1.0の確率分布に変換します。
          最も確率の高いトークンを取り出すことで次の1トークンが出力されます。この出力トークンを入力文に追加して同様のプロセスを繰り返す（自動回帰生成）ことで、長文が生成されていきます。
        </p>
      `;
      break;
  }
  
  contentBox.innerHTML = html;
  
  // Re-render KaTeX if there are LaTeX formulas
  if (window.katex) {
    const mathElements = contentBox.querySelectorAll('strong, p');
    mathElements.forEach(el => {
      const text = el.innerHTML;
      if (text.includes('$')) {
        const parts = text.split('$');
        let newHtml = '';
        for (let idx = 0; idx < parts.length; idx++) {
          if (idx % 2 === 1) {
            try {
              const tempSpan = document.createElement('span');
              window.katex.render(parts[idx], tempSpan, { throwOnError: false, displayMode: false });
              newHtml += tempSpan.innerHTML;
            } catch (e) {
              newHtml += '$' + parts[idx] + '$';
            }
          } else {
            newHtml += parts[idx];
          }
        }
        el.innerHTML = newHtml;
      }
    });
  }
  
  // Re-create icons inside the story content box
  if (window.lucide) {
    window.lucide.createIcons();
  }
}
