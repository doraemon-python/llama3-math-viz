// Llama 3 8B Parameters and Mathematical Models
export const Llama3Config = {
  vocab_size: 128256,
  dim: 4096,
  n_layers: 32,
  n_heads: 32,
  n_kv_heads: 8,
  multiple_of: 1024,
  ffn_dim: 14336,
  norm_eps: 1e-5,
  rope_theta: 500000,
  max_seq_len: 8192,
  head_dim: 128
};

// Help helper functions for math
export function vectorNorm(x) {
  return Math.sqrt(x.reduce((sum, val) => sum + val * val, 0) / x.length);
}

export function matrixVectorMul(matrix, vector) {
  // matrix: array of rows, vector: array of numbers
  return matrix.map(row => row.reduce((sum, val, idx) => sum + val * (vector[idx] || 0), 0));
}

// Simulated Tokenizer database for visual purposes
export const mockVocabulary = {
  "hello": 15339,
  " llama": 49052,
  " 3": 220,
  " is": 374,
  " awesome": 12431,
  " math": 8392,
  " transformer": 56499,
  " deep": 5752,
  " learning": 4673,
  " ai": 9845,
  " artificial": 23490,
  " intelligence": 9231,
  " data": 1003,
  " sequence": 14932,
  " attention": 8103
};

export function tokenizeText(text) {
  // Simple BPE mock tokenizer
  const words = text.toLowerCase().match(/\w+|\s+|[^\w\s]+/g) || [];
  const tokens = [];
  
  for (let word of words) {
    // Check if word has leading space or starts with a space
    let cleanWord = word;
    if (cleanWord.startsWith(" ")) {
      cleanWord = " " + cleanWord.trim();
    }
    
    // Check direct match
    if (mockVocabulary[cleanWord] !== undefined) {
      tokens.push({ text: cleanWord, id: mockVocabulary[cleanWord] });
    } else {
      // split into character level tokens for visualization
      for (let char of cleanWord) {
        const charCode = char.charCodeAt(0);
        tokens.push({ text: char, id: 100000 + charCode });
      }
    }
  }
  return tokens;
}

// Generate deterministic pseudo-random embedding vector for display
export function getMockEmbedding(tokenId, dim = 8) {
  const seed = tokenId;
  const vec = [];
  for (let i = 0; i < dim; i++) {
    // Simple LCG pseudo-random generator
    const val = Math.sin(seed + i) * 1.5;
    vec.push(parseFloat(val.toFixed(4)));
  }
  return vec;
}

// Component configurations, descriptions, LaTeX, shapes, and codes
export const modelComponents = {
  tokenizer: {
    id: "tokenizer",
    name: "1. BPE Tokenizer (トークナイザー)",
    description: "入力されたテキスト（文字列）をモデルが処理可能なトークン（IDのシーケンス）に変換します。Llama 3では、約12.8万（128,256）の語彙サイズを持つByte Pair Encoding (BPE) トークナイザーが採用されており、日本語やコード等の表現効率が前世代（Llama 2の3.2万）より大幅に向上しています。",
    latex: `\\text{Tokens} = \\text{BPETokenize}(\\text{Text}) \\\\
\\text{Token IDs} = \\{t_1, t_2, \\dots, t_T\\} \\quad \\text{where } t_t \\in [0, V-1], \\, V = 128{,}256`,
    shapes: [
      { label: "入力", shape: "文字列 (例: \"Llama 3\")" },
      { label: "出力", shape: "[SeqLen] (例: [49052, 220])" },
      { label: "語彙サイズ ($V$)", shape: "128,256" }
    ],
    pytorch: `import tiktoken

# Llama 3 tokenizer is based on tiktoken (cl100k_base-like custom)
# To load:
# tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B")
# tokens = tokenizer.encode("Llama 3 is awesome!")
# print(tokens) # Output list of integer IDs`,
    sandbox: {
      title: "トークナイザー・シミュレーター",
      inputs: [
        { id: "text", type: "text", label: "入力テキスト", default: "Llama 3 is awesome" }
      ]
    }
  },
  
  embedding: {
    id: "embedding",
    name: "2. Token Embedding (埋め込みレイヤー)",
    description: "離散値であるトークンIDを高次元のベクトル空間（隠れ次元 $d_{\\text{model}} = 4096$）に射影します。これにより、単語間の意味的な類似度がベクトルの内積（コサイン類似度）などで表現されるようになります。Llama 3では埋め込み層の重み $W_{\\text{embed}}$ は出力層の重みと共有せず独立（Untied）に持っています。",
    latex: `\\mathbf{X}_0 = \\text{Embedding}(t_t) = \\mathbf{E}[t_t, :] \\\\
\\mathbf{E} \\in \\mathbb{R}^{V \\times d_{\\text{model}}}, \\quad d_{\\text{model}} = 4096`,
    shapes: [
      { label: "入力 (Token IDs)", shape: "[Batch, SeqLen]" },
      { label: "埋め込み行列 ($W_{\\text{embed}}$)", shape: "[128256, 4096]" },
      { label: "出力ベクトル ($\\mathbf{X}_0$)", shape: "[Batch, SeqLen, 4096]" }
    ],
    pytorch: `import torch
import torch.nn as nn

class LlamaEmbedding(nn.Module):
    def __init__(self, vocab_size: int = 128256, dim: int = 4096):
        super().__init__()
        # Llama 3 uses untied embeddings (separate embedding and output weight tables)
        self.tok_embeddings = nn.Embedding(vocab_size, dim)

    def forward(self, tokens: torch.Tensor) -> torch.Tensor:
        # tokens: [batch_size, seq_len]
        # returns: [batch_size, seq_len, dim]
        return self.tok_embeddings(tokens)`,
    sandbox: {
      title: "埋め込みルックアップ",
      inputs: [
        { id: "token_text", type: "select", label: "トークンを選択", options: Object.keys(mockVocabulary) }
      ]
    }
  },
  
  rmsnorm: {
    id: "rmsnorm",
    name: "3. RMSNorm (二乗平均平方根正規化)",
    description: "LayerNormのバリアントで、平均を引く処理を省略し、二乗平均平方根 (RMS) のみで正規化を行うことで計算コストを削減します。Llama 3はプレ正規化 (Pre-LN) を採用しており、各アテンションブロックおよびMLPブロックの直前に適用されます。学習を安定させるためのスケール係数 $\\gamma$ (重み) を含みます。",
    latex: `\\text{RMSNorm}(\\mathbf{x}) = \\frac{\\mathbf{x}}{\\sqrt{\\frac{1}{d} \\sum_{i=1}^{d} x_i^2 + \\epsilon}} \\odot \\boldsymbol{\\gamma} \\\\
\\boldsymbol{\\gamma} \\in \\mathbb{R}^d, \\quad \\epsilon = 10^{-5}`,
    shapes: [
      { label: "入力ベクトルの形状 ($\\mathbf{x}$)", shape: "[Batch, SeqLen, 4096]" },
      { label: "スケールパラメータ ($\\boldsymbol{\\gamma}$)", shape: "[4096]" },
      { label: "出力ベクトルの形状", shape: "[Batch, SeqLen, 4096]" }
    ],
    pytorch: `import torch
import torch.nn as nn

class RMSNorm(nn.Module):
    def __init__(self, dim: int = 4096, eps: float = 1e-5):
        super().__init__()
        self.eps = eps
        # Scale parameter gamma (initialized to 1.0)
        self.weight = nn.Parameter(torch.ones(dim))

    def _norm(self, x: torch.Tensor) -> torch.Tensor:
        # Compute RMS along the last dimension
        # rsqrt is 1 / sqrt(mean(x^2) + eps)
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Scale the normalized tensor element-wise by self.weight (gamma)
        return self._norm(x.float()).type_as(x) * self.weight`,
    sandbox: {
      title: "RMSNorm 計算シミュレーター",
      inputs: [
        { id: "vector", type: "array", label: "入力ベクトル x", default: "1.2, -0.5, 2.3, 0.1" },
        { id: "gamma", type: "array", label: "スケール係数 \u03b3", default: "1.0, 1.2, 0.8, 1.0" },
        { id: "eps", type: "number", label: "\u03b5 (Epsilon)", default: 1e-5 }
      ]
    }
  },
  
  rope: {
    id: "rope",
    name: "4. RoPE (回転位置埋め込み)",
    description: "トークンの絶対位置ではなく、二つのトークン間の相対的な距離（相対位置）を考慮できるように設計された位置エンコーディング手法です。アテンションのQueryとKeyに対し、2次元のサブ空間ごとに回転行列を掛けることで回転を施します。Llama 3ではベース周波数 $\\theta$ を 500,000 に引き上げることで、最大8,192トークンのコンテキスト窓において高精度な位置表現を実現しています。",
    latex: `\\mathbf{R}_{\\Theta, m}^{2d} \\begin{pmatrix} x_{2i} \\\\ x_{2i+1} \\end{pmatrix} = 
\\begin{pmatrix} 
\\cos m\\theta_i & -\\sin m\\theta_i \\\\ 
\\sin m\\theta_i & \\cos m\\theta_i 
\\end{pmatrix} 
\\begin{pmatrix} x_{2i} \\\\ x_{2i+1} \\end{pmatrix} \\\\
\\theta_i = \\theta_{\\text{base}}^{-2i/d_{\\text{head}}}, \\quad \\theta_{\\text{base}} = 500{,}000, \\quad i \\in \\left[0, \\frac{d_{\\text{head}}}{2}-1\\right]`,
    shapes: [
      { label: "入力ベクトル (Q または K)", shape: "[Batch, SeqLen, Heads, 128]" },
      { label: "回転角度行列 (Cos, Sin)", shape: "[SeqLen, 64] (64組の2D次元対に対応)" },
      { label: "出力位置情報付加ベクトル", shape: "[Batch, SeqLen, Heads, 128]" }
    ],
    pytorch: `import torch
import torch.nn as nn

def precompute_freqs_cis(dim: int = 128, end: int = 8192, theta: float = 500000.0):
    # Dim is head_dim (128)
    freqs = 1.0 / (theta ** (torch.arange(0, dim, 2)[: (dim // 2)].float() / dim))
    t = torch.arange(end, device=freqs.device)
    freqs = torch.outer(t, freqs).float()
    # polar coordinates rotation parameters
    freqs_cis = torch.polar(torch.ones_like(freqs), freqs) # complex number representation
    return freqs_cis

def apply_rotary_emb(xq: torch.Tensor, xk: torch.Tensor, freqs_cis: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
    # xq: [B, T, H, d_head], xk: [B, T, H_kv, d_head]
    # View as complex numbers
    xq_ = torch.view_as_complex(xq.float().reshape(*xq.shape[:-1], -1, 2))
    xk_ = torch.view_as_complex(xk.float().reshape(*xk.shape[:-1], -1, 2))
    
    # Broadcast precomputed rotation parameters to [T, 1, d_head // 2]
    freqs_cis = freqs_cis[:xq.shape[1]].unsqueeze(0).unsqueeze(2)
    
    # Complex multiplication rotates the vectors
    xq_out = torch.view_as_real(xq_ * freqs_cis).flatten(3)
    xk_out = torch.view_as_real(xk_ * freqs_cis).flatten(3)
    return xq_out.type_as(xq), xk_out.type_as(xk)`,
    sandbox: {
      title: "RoPE 回転シミュレーター (2次元ペア)",
      inputs: [
        { id: "vector2d", type: "array", label: "入力2Dベクトル [x0, x1]", default: "1.0, 0.5" },
        { id: "position", type: "number", label: "トークン位置 m", default: 2 },
        { id: "dim_index", type: "number", label: "次元インデックス i (0 ~ 63)", default: 0 },
        { id: "theta_base", type: "number", label: "\u03b8_base", default: 500000 },
        { id: "head_dim", type: "number", label: "ヘッド次元 d_head", default: 128 }
      ]
    }
  },
  
  gqa: {
    id: "gqa",
    name: "5. Grouped-Query Attention (グループクエリアテンション)",
    description: "従来のMulti-Head Attention (MHA) と Multi-Query Attention (MQA) の中間的なアーキテクチャです。Llama 3 8Bでは、Query (Q) が32ヘッドあるのに対し、Key (K) とValue (V) は8ヘッドのみです。つまり4つのQヘッドが1つのK, Vヘッドを共有します。これにより、推論時のボトルネックとなるKVキャッシュのメモリ占有量を大幅に削減し、高スループットかつ省メモリな推論を実現しています。",
    latex: `\\text{Attention}(\\mathbf{Q}_j, \\mathbf{K}_k, \\mathbf{V}_k) = \\text{Softmax}\\left( \\frac{\\mathbf{Q}_j \\mathbf{K}_k^T}{\\sqrt{d_{\\text{head}}}} \\right) \\mathbf{V}_k \\\\
j \\in [0, 31], \\quad k = \\lfloor j / 4 \\rfloor \\in [0, 7] \\\\
\\text{GQA}(\\mathbf{X}) = \\text{Concat}(\\text{Head}_0, \\dots, \\text{Head}_{31}) \\mathbf{W}_O \\quad \\mathbf{W}_O \\in \\mathbb{R}^{d_{\\text{model}} \\times d_{\\text{model}}}`,
    shapes: [
      { label: "Query 投影 ($\\mathbf{Q}$)", shape: "[Batch, SeqLen, 32, 128]" },
      { label: "Key 投影 ($\\mathbf{K}$)", shape: "[Batch, SeqLen, 8, 128]" },
      { label: "Value 投影 ($\\mathbf{V}$)", shape: "[Batch, SeqLen, 8, 128]" },
      { label: "出力投影重み ($\\mathbf{W}_O$)", shape: "[4096, 4096]" },
      { label: "出力ベクトルの形状", shape: "[Batch, SeqLen, 4096]" }
    ],
    pytorch: `import torch
import torch.nn as nn
import math

class GroupedQueryAttention(nn.Module):
    def __init__(self, dim: int = 4096, n_heads: int = 32, n_kv_heads: int = 8):
        super().__init__()
        self.n_heads = n_heads
        self.n_kv_heads = n_kv_heads
        self.head_dim = dim // n_heads # 128
        self.num_queries_per_kv = n_heads // n_kv_heads # 4 (group size)
        
        self.wq = nn.Linear(dim, n_heads * self.head_dim, bias=False)
        self.wk = nn.Linear(dim, n_kv_heads * self.head_dim, bias=False)
        self.wv = nn.Linear(dim, n_kv_heads * self.head_dim, bias=False)
        self.wo = nn.Linear(n_heads * self.head_dim, dim, bias=False)

    def forward(self, x: torch.Tensor, freqs_cis: torch.Tensor) -> torch.Tensor:
        bsz, seqlen, _ = x.shape
        xq, xk, xv = self.wq(x), self.wk(x), self.wv(x)
        
        xq = xq.view(bsz, seqlen, self.n_heads, self.head_dim)
        xk = xk.view(bsz, seqlen, self.n_kv_heads, self.head_dim)
        xv = xv.view(bsz, seqlen, self.n_kv_heads, self.head_dim)
        
        # Apply RoPE positional embeddings
        xq, xk = apply_rotary_emb(xq, xk, freqs_cis)
        
        # Expand Key and Value heads for GQA (group ratio calculation)
        # Repeat KV heads 'num_queries_per_kv' times (4 times)
        keys = torch.repeat_interleave(xk, self.num_queries_per_kv, dim=2) # [B, T, 32, 128]
        values = torch.repeat_interleave(xv, self.num_queries_per_kv, dim=2) # [B, T, 32, 128]
        
        # Transpose to [B, H, T, d_head] for attention matrix multiplication
        xq = xq.transpose(1, 2)
        keys = keys.transpose(1, 2)
        values = values.transpose(1, 2)
        
        # Scaled dot-product attention
        scores = torch.matmul(xq, keys.transpose(-2, -1)) / math.sqrt(self.head_dim)
        scores = torch.softmax(scores.float(), dim=-1).type_as(xq)
        output = torch.matmul(scores, values) # [B, H, T, d_head]
        
        # Reshape and project out
        output = output.transpose(1, 2).contiguous().view(bsz, seqlen, -1)
        return self.wo(output)`,
    sandbox: {
      title: "GQA アテンションスコア Softmax 計算",
      inputs: [
        { id: "q_head_idx", type: "number", label: "Queryヘッド番号 (0 ~ 31)", default: 5 },
        { id: "raw_scores", type: "array", label: "生の類似度スコア (Q K^T / \u221ad_head)", default: "4.2, 1.5, 0.2, -1.8" }
      ]
    }
  },
  
  swiglu: {
    id: "swiglu",
    name: "6. SwiGLU MLP (フィードフォワード・ネットワーク)",
    description: "Transformerブロック後半に位置する2層構造のMLPを、Gated Linear Unit (GLU) の活性化関数をSwish（SiLU）にしたものに拡張したネットワークです。Llama 3では、3つの異なる投影行列 $W_{\\text{gate}}, W_{\\text{up}}, W_{\\text{down}}$ を用いて構成されています。中間層のチャネル数 $d_{\\text{ff}}$ は、パラメータ数8Bモデルで14,336に設定されています。従来のReLU等に比べて表現能力が高く、パラメータ効率が良いことが特徴です。",
    latex: `\\text{SwiGLU}(\\mathbf{x}) = \\left( \\text{SiLU}(\\mathbf{x} \\mathbf{W}_{\\text{gate}}) \\odot (\\mathbf{x} \\mathbf{W}_{\\text{up}}) \\right) \\mathbf{W}_{\\text{down}} \\\\
\\text{SiLU}(z) = z \\cdot \\sigma(z) = \\frac{z}{1 + e^{-z}} \\\\
\\mathbf{W}_{\\text{gate}}, \\mathbf{W}_{\\text{up}} \\in \\mathbb{R}^{d_{\\text{model}} \\times d_{\\text{ff}}}, \\quad \\mathbf{W}_{\\text{down}} \\in \\mathbb{R}^{d_{\\text{ff}} \\times d_{\\text{model}}}, \\quad d_{\\text{ff}} = 14{,}336`,
    shapes: [
      { label: "入力ベクトルの形状 ($\\mathbf{x}$)", shape: "[Batch, SeqLen, 4096]" },
      { label: "Gate 投影重み ($\\mathbf{W}_{\\text{gate}}$)", shape: "[4096, 14336]" },
      { label: "Up 投影重み ($\\mathbf{W}_{\\text{up}}$)", shape: "[4096, 14336]" },
      { label: "Down 投影重み ($\\mathbf{W}_{\\text{down}}$)", shape: "[14336, 4096]" },
      { label: "出力ベクトルの形状", shape: "[Batch, SeqLen, 4096]" }
    ],
    pytorch: `import torch
import torch.nn as nn
import torch.nn.functional as F

class FeedForward(nn.Module):
    def __init__(self, dim: int = 4096, hidden_dim: int = 14336):
        super().__init__()
        # Three weights matrices instead of standard two for SwiGLU
        self.w1 = nn.Linear(dim, hidden_dim, bias=False) # W_gate
        self.w2 = nn.Linear(hidden_dim, dim, bias=False) # W_down
        self.w3 = nn.Linear(dim, hidden_dim, bias=False) # W_up

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # F.silu(self.w1(x)) is the Swish-activated gate path
        # self.w3(x) is the linear path
        # Multiply them element-wise, then project down with self.w2
        return self.w2(F.silu(self.w1(x)) * self.w3(x))`,
    sandbox: {
      title: "SwiGLU 計算シミュレーター (低次元モデル)",
      inputs: [
        { id: "mlp_input", type: "array", label: "入力ベクトル x (2次元)", default: "0.8, -0.4" },
        { id: "w_gate", type: "matrix", label: "W_gate 重み (2x3)", default: "1.2, -0.5, 0.1; -0.3, 0.8, 1.5" },
        { id: "w_up", type: "matrix", label: "W_up 重み (2x3)", default: "-0.5, 1.0, -0.8; 0.6, -1.2, 0.2" },
        { id: "w_down", type: "matrix", label: "W_down 重み (3x2)", default: "0.5, -0.6; -1.2, 0.8; 0.3, 0.1" }
      ]
    }
  },
  
  output: {
    id: "output",
    name: "7. Output Layer (出力投影層 & Softmax)",
    description: "Transformerの32個のブロックの最終的な出力を最終RMSNormで正規化し、その後、線形投影（Linear Classifier）を用いて128,256次元の語彙スコア（Logits）に変換します。最後に、Softmax関数によって各語彙トークンが次のトークンとして出現する予測確率（0〜1）に変換されます。最も高い確率を持つトークンを選択（Greedy法）するか、確率分布に従ってサンプリングを行うことで、次の単語が生成されます。",
    latex: `\\mathbf{x}_{\\text{final}} = \\text{RMSNorm}(\\mathbf{X}_{32}) \\\\
\\text{Logits} = \\mathbf{x}_{\\text{final}} \\mathbf{W}_{\\text{output}}^T \\quad \\mathbf{W}_{\\text{output}} \\in \\mathbb{R}^{V \\times d_{\\text{model}}} \\\\
P(y_{t} \\mid y_{<t}) = \\text{Softmax}(\\text{Logits}) = \\frac{e^{\\text{Logits}_i}}{\\sum_{j=1}^{V} e^{\\text{Logits}_j}}`,
    shapes: [
      { label: "最終ブロック出力 ($\\mathbf{X}_{32}$)", shape: "[Batch, SeqLen, 4096]" },
      { label: "出力重み ($\\mathbf{W}_{\\text{output}}$)", shape: "[128256, 4096]" },
      { label: "出力確率分布 ($P$)", shape: "[Batch, 128256]" }
    ],
    pytorch: `import torch
import torch.nn as nn

class LlamaOutput(nn.Module):
    def __init__(self, dim: int = 4096, vocab_size: int = 128256):
        super().__init__()
        # Final norm
        self.norm = RMSNorm(dim)
        # Linear classifier projecting back to vocabulary space
        self.output = nn.Linear(dim, vocab_size, bias=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x is the output of the 32nd LayerBlock
        x = self.norm(x)
        logits = self.output(x) # [Batch, SeqLen, VocabSize]
        
        # During generation, we take logits[-1] for next token prediction:
        # probabilities = torch.softmax(logits[:, -1, :], dim=-1)
        return logits`,
    sandbox: {
      title: "出力 Softmax & トークン選択",
      inputs: [
        { id: "logit_tokens", type: "array_string", label: "トークン候補", default: "llama, transformer, model, data" },
        { id: "logit_values", type: "array", label: "語彙Logitsスコア", default: "8.5, 7.2, 5.0, 3.1" },
        { id: "temperature", type: "number", label: "温度パラメータ (T)", default: 1.0 }
      ]
    }
  }
};
