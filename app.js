import { modelComponents, tokenizeText, getMockEmbedding, mockVocabulary, Llama3Config } from './llama3_model.js';

// State management
let activeNodeId = null;
let activeLayerIndex = 1;

// Elements
const modalOverlay = document.getElementById('details-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalMathLatex = document.getElementById('modal-math-latex');
const modalShapesTableBody = document.getElementById('modal-shapes-table-body');
const modalSandboxInputs = document.getElementById('modal-sandbox-inputs');
const modalSandboxStepsOutput = document.getElementById('modal-sandbox-steps-output');
const modalBtnCopyCode = document.getElementById('modal-btn-copy-code');
const modalCodeSnippet = document.getElementById('modal-code-snippet');
const layerSelector = document.getElementById('layer-selector');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  initBlocks();
  initModalClose();
  initCopyCode();
  initLayerSelector();
  initTabs();
  
  // Refresh Lucide Icons
  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// 1. Bind block clicks
function initBlocks() {
  const blocks = document.querySelectorAll('.flow-block');
  blocks.forEach(block => {
    block.addEventListener('click', () => {
      const nodeId = block.getAttribute('data-node');
      if (nodeId) {
        openModal(nodeId);
      }
    });
  });
}

// 2. Layer Selector Init
function initLayerSelector() {
  if (!layerSelector) return;
  
  for (let i = 1; i <= 32; i++) {
    const opt = document.createElement('option');
    opt.value = i;
    opt.innerText = `Layer ${i}`;
    layerSelector.appendChild(opt);
  }
  
  layerSelector.addEventListener('change', (e) => {
    activeLayerIndex = parseInt(e.target.value);
  });
}

// 3. Modal Tabs Init
function initTabs() {
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const targetContent = document.getElementById(`tab-${tabId}`);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

// Helper to compile inline LaTeX math expressions
function renderTextWithMath(text) {
  if (!text) return "";
  return text.replace(/\$(.*?)\$/g, (match, formula) => {
    try {
      if (window.katex) {
        return window.katex.renderToString(formula, {
          throwOnError: false,
          displayMode: false
        });
      }
      return match;
    } catch (e) {
      return match;
    }
  });
}

// 4. Modal open logic
function openModal(nodeId) {
  if (!modelComponents[nodeId]) return;
  activeNodeId = nodeId;
  
  // Reset tabs to default (first tab: math)
  tabButtons.forEach(b => b.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  if (tabButtons[0]) tabButtons[0].classList.add('active');
  const defaultTabContent = document.getElementById('tab-math');
  if (defaultTabContent) defaultTabContent.classList.add('active');
  
  const comp = modelComponents[nodeId];
  
  // Dynamic Title showing active layer if applicable
  const loopNodes = ['rmsnorm', 'gqa', 'rmsnorm2', 'swiglu'];
  let titleText = comp.name;
  if (loopNodes.includes(nodeId)) {
    titleText += ` (Layer ${activeLayerIndex}/32)`;
  }
  modalTitle.innerText = titleText;
  
  modalDesc.innerText = comp.description;
  
  // Render LaTeX using KaTeX
  if (window.katex) {
    try {
      window.katex.render(comp.latex, modalMathLatex, {
        throwOnError: false,
        displayMode: true
      });
    } catch (err) {
      modalMathLatex.innerHTML = `<pre>${comp.latex}</pre>`;
    }
  } else {
    modalMathLatex.innerHTML = `<pre>${comp.latex}</pre>`;
  }
  
  // Render Shapes (with KaTeX compile)
  modalShapesTableBody.innerHTML = comp.shapes.map(s => `
    <tr>
      <td>${renderTextWithMath(s.label)}</td>
      <td>${renderTextWithMath(s.shape)}</td>
    </tr>
  `).join('');
  
  // Render Code
  modalCodeSnippet.innerText = comp.pytorch;
  
  // Render Sandbox
  buildSandboxInputs(comp.sandbox);
  calculateSandbox(nodeId);
  
  // Show Modal overlay
  modalOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden'; // Lock background scrolling
  
  // Refresh Lucide Icons inside modal
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// 3. Modal close logic
function initModalClose() {
  modalCloseBtn.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
  
  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalOverlay.classList.contains('hidden')) {
      closeModal();
    }
  });
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  document.body.style.overflow = 'auto'; // Enable background scrolling
  activeNodeId = null;
}

// 4. Code Copy
function initCopyCode() {
  modalBtnCopyCode.addEventListener('click', () => {
    navigator.clipboard.writeText(modalCodeSnippet.innerText).then(() => {
      modalBtnCopyCode.classList.add('copied');
      modalBtnCopyCode.querySelector('span').innerText = 'コピー済';
      setTimeout(() => {
        modalBtnCopyCode.classList.remove('copied');
        modalBtnCopyCode.querySelector('span').innerText = 'コピー';
      }, 2000);
    });
  });
}

// 5. Build Sandbox UI inside modal
function buildSandboxInputs(sandboxConf) {
  modalSandboxInputs.innerHTML = '';
  
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
    
    modalSandboxInputs.appendChild(wrapper);
    
    // Add real-time event listener to input
    const targetEl = wrapper.querySelector('input') || wrapper.querySelector('select');
    targetEl.addEventListener('input', () => {
      calculateSandbox(activeNodeId);
    });
  });
}

// 6. Calculate Sandbox Values inside modal
function calculateSandbox(nodeId) {
  modalSandboxStepsOutput.innerHTML = '';
  
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
      
      case 'rmsnorm':
      case 'rmsnorm2': {
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
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
        modalSandboxStepsOutput.innerHTML = stepsHtml;
        break;
      }
    }
  } catch (err) {
    modalSandboxStepsOutput.innerHTML = `<div class="step-block" style="border-left-color: var(--color-amber);">
      <div class="step-title" style="color: var(--color-amber)">計算エラー</div>
      <div class="step-calc" style="color: var(--text-muted)">${err.message}</div>
    </div>`;
  }
}

// 7. HTML Utility Escape
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
