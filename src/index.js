// whatstrending.ai — Cloudflare Worker
// Premium AI news dashboard with D1 database API, AI news aggregation, tool directory
import { OG_IMAGE_BASE64 } from './og-image.js';

// MiniMax via Hermes — retry up to 5 times, no CF AI fallback
async function callLLM(env, messages, max_tokens = 1024) {
  // ROOT-CAUSE GUARD: MiniMax-M2.7 is a REASONING model — it emits a hidden
  // <think>...</think> block before its visible answer, which we strip below.
  // A small max_tokens (e.g. 10 for a one-word category) gets entirely consumed
  // by the think block, leaving an empty answer after stripping. Enforce a floor
  // so no caller can accidentally starve the model. This is what silently broke
  // news categorization (every article fell back to 'Industry') after the model
  // was switched to MiniMax. Floor of 512 leaves room to think AND answer.
  const effectiveMaxTokens = Math.max(max_tokens || 0, 512);
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch('https://api-minimax-hermes.moonraids.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer hermes-secret-token-2026' },
        body: JSON.stringify({ model: 'MiniMax-M2.7-highspeed', messages, max_tokens: effectiveMaxTokens }),
      });
      if (!res.ok) throw new Error(`Hermes ${res.status}`);
      const data = await res.json();
      let text = data.choices?.[0]?.message?.content || '';
      text = text.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();
      if (text) return { response: text };
      throw new Error('Empty response');
    } catch (e) {
      if (attempt < 5) { await new Promise(r => setTimeout(r, 2000 * attempt)); continue; }
    }
  }
  return { response: '' };
}

// ===== FULL ARTICLE EXTRACTION =====
async function fetchFullArticle(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsTrending-Bot/1.0)' }, signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    let text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<nav[\s\S]*?<\/nav>/gi, '').replace(/<footer[\s\S]*?<\/footer>/gi, '').replace(/<header[\s\S]*?<\/header>/gi, '').replace(/<aside[\s\S]*?<\/aside>/gi, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
    if (text.length > 300) text = text.slice(200);
    return text.slice(0, 3000) || null;
  } catch (e) { return null; }
}

// API key loaded from Cloudflare Worker secret (env.API_KEY)
// Fallback only for local dev — production MUST use wrangler secret
const API_KEY_FALLBACK = 'wt_sk_local_dev_only';

const SAMPLE_ARTICLES = [
  {
    id: 1,
    category: 'Models',
    title: 'OpenAI Announces GPT-5 With Breakthrough Reasoning Capabilities',
    slug: 'openai-announces-gpt-5-with-breakthrough-reasoning-capabilities',
    summary: 'The latest model demonstrates significant improvements in mathematical reasoning, code generation, and multi-step problem solving across benchmarks.',
    body: `OpenAI has officially unveiled GPT-5, its most capable language model to date, marking a significant leap forward in artificial intelligence reasoning. The model achieves near-human performance on graduate-level mathematics and demonstrates a 40% improvement over GPT-4o on complex multi-step coding tasks.

In internal evaluations shared with select researchers, GPT-5 showed remarkable gains in logical consistency, reducing hallucination rates by over 60% compared to its predecessor. The model also introduces a new "deliberative alignment" mechanism that allows it to reason through ethical considerations before generating responses.

Industry analysts expect GPT-5 to accelerate adoption across enterprise use cases, particularly in legal analysis, scientific research, and financial modeling. OpenAI plans to roll out the model through its API over the coming weeks, with consumer access following shortly after.`,
    source: 'TechCrunch',
    time: '2 hours ago',
    featured: true,
  },
  {
    id: 2,
    category: 'Tools',
    title: 'Cursor Raises $900M as AI-Native IDEs Reshape Development',
    slug: 'cursor-raises-900m-as-ai-native-ides-reshape-development',
    summary: 'The AI code editor reaches unicorn status as developers increasingly adopt AI-assisted coding workflows.',
    body: `Cursor, the AI-powered code editor built on VS Code, has closed a massive $900 million funding round that values the company at over $9 billion. The round was led by Thrive Capital with participation from Andreessen Horowitz and existing investors.

The funding reflects a broader shift in how software is written. Cursor reports that its most active users accept AI-generated code suggestions for over 60% of their keystrokes, fundamentally changing the developer workflow from writing code to reviewing and guiding AI output.

Competitors including GitHub Copilot, Windsurf, and Zed are also racing to integrate deeper AI capabilities, but Cursor's purpose-built approach has resonated with developers who want AI at the core of their editing experience rather than as an add-on. The company plans to use the funding to expand its model training infrastructure and hire aggressively across engineering and research.`,
    source: 'The Verge',
    time: '4 hours ago',
  },
  {
    id: 3,
    category: 'Research',
    title: 'DeepMind Publishes Open Source Framework for AI Safety Testing',
    slug: 'deepmind-publishes-open-source-framework-for-ai-safety-testing',
    summary: 'New evaluation suite provides standardized benchmarks for measuring AI alignment and safety properties.',
    body: `Google DeepMind has released SafeEval, a comprehensive open-source framework designed to standardize how the industry measures AI safety and alignment. The toolkit includes over 200 evaluation scenarios covering deception detection, power-seeking behavior, and value alignment.

The release comes at a critical time as frontier AI labs face increasing pressure from regulators and the research community to demonstrate that their models are safe. SafeEval provides reproducible benchmarks that allow independent researchers to verify safety claims made by model developers.

Early adopters including Anthropic, Meta, and Mistral have already begun integrating SafeEval into their evaluation pipelines. DeepMind researchers note that standardized safety testing is essential for building public trust and enabling meaningful regulation of advanced AI systems.`,
    source: 'Ars Technica',
    time: '5 hours ago',
  },
  {
    id: 4,
    category: 'Industry',
    title: 'EU AI Act Enforcement Begins: What Companies Need to Know',
    slug: 'eu-ai-act-enforcement-begins-what-companies-need-to-know',
    summary: 'Businesses face new compliance requirements as the European Union starts enforcing its landmark AI regulation.',
    body: `The European Union has begun enforcing the first provisions of its AI Act, the world's most comprehensive artificial intelligence regulation. Companies deploying AI systems in the EU now face mandatory transparency requirements and risk assessments for high-risk applications.

The initial enforcement phase focuses on prohibited AI practices, including social scoring systems, real-time biometric surveillance in public spaces, and AI systems designed to manipulate human behavior. Violations can result in fines of up to 35 million euros or 7% of global annual revenue.

Legal experts say the regulation will have ripple effects far beyond Europe, as multinational companies are likely to adopt EU-compliant practices globally rather than maintain separate systems. Several major US tech companies have already announced compliance programs, signaling that the AI Act is becoming a de facto global standard.`,
    source: 'Reuters',
    time: '6 hours ago',
  },
  {
    id: 5,
    category: 'Models',
    title: 'Anthropic Claude 4.5 Sets New Standard for Agentic Coding',
    slug: 'anthropic-claude-4-5-sets-new-standard-for-agentic-coding',
    summary: 'Latest Claude model shows state-of-the-art performance on real-world software engineering benchmarks.',
    body: `Anthropic has released Claude 4.5, which achieves breakthrough performance on software engineering tasks that require autonomous multi-step reasoning. The model tops the SWE-bench Verified leaderboard with a 72% solve rate, significantly outperforming all previous models.

What sets Claude 4.5 apart is its ability to handle complex, real-world codebases rather than isolated programming puzzles. The model can navigate large repositories, understand architectural patterns, and make coordinated changes across multiple files while maintaining consistency.

Developers using Claude 4.5 through tools like Claude Code report that the model can independently resolve GitHub issues that would typically require hours of human engineering time. Anthropic attributes the improvement to a new training approach that emphasizes long-horizon planning and tool use in realistic development environments.`,
    source: 'VentureBeat',
    time: '8 hours ago',
  },
  {
    id: 6,
    category: 'Startups',
    title: 'AI Video Generation Startup Runway Launches Gen-4 Turbo',
    slug: 'ai-video-generation-startup-runway-launches-gen-4-turbo',
    summary: 'New model generates cinematic-quality video clips with unprecedented temporal consistency and prompt adherence.',
    body: `Runway has launched Gen-4 Turbo, its most advanced video generation model, capable of producing 30-second cinematic clips that maintain consistent characters, lighting, and physics throughout. The model represents a major step toward AI-generated content that is indistinguishable from professionally produced footage.

Gen-4 Turbo introduces several technical innovations, including a new temporal coherence architecture that eliminates the flickering and morphing artifacts common in earlier AI video models. The system can also maintain character identity across multiple generated clips, enabling basic narrative storytelling.

The release has generated significant interest from advertising agencies and independent filmmakers who see AI video as a way to prototype creative concepts rapidly. Runway reports that over 10,000 creators signed up for the Gen-4 Turbo beta within the first 24 hours of its announcement.`,
    source: 'Wired',
    time: '10 hours ago',
  },
];

// Real 2026 LMSYS Arena data from AgileWoW/lmsys-arena-leaderboard-tracker + known recent scores
// Auto-fetch URL: https://raw.githubusercontent.com/AgileWoW/lmsys-arena-leaderboard-tracker/main/data/historical-elo-2026.csv
const SAMPLE_MODELS = [
  { rank: 1, name: 'Claude Opus 4.6 (Thinking)', provider: 'Anthropic', score: 1506, context: '1M', pricing: '$15/$75', category: 'Proprietary', change: '0' },
  { rank: 2, name: 'Gemini 3.1 Pro', provider: 'Google', score: 1505, context: '2M', pricing: '$1.25/$5', category: 'Proprietary', change: '+1' },
  { rank: 3, name: 'Claude Opus 4.6', provider: 'Anthropic', score: 1490, context: '1M', pricing: '$15/$75', category: 'Proprietary', change: '-1' },
  { rank: 4, name: 'Gemini 3 Pro', provider: 'Google', score: 1486, context: '2M', pricing: '$1.25/$5', category: 'Proprietary', change: '0' },
  { rank: 5, name: 'Grok-4.1 (Thinking)', provider: 'xAI', score: 1475, context: '128K', pricing: '$5/$15', category: 'Proprietary', change: '+2' },
  { rank: 6, name: 'GPT-5.1 High', provider: 'OpenAI', score: 1457, context: '256K', pricing: '$15/$60', category: 'Proprietary', change: '0' },
  { rank: 7, name: 'Gemini 2.5 Pro', provider: 'Google', score: 1446, context: '1M', pricing: '$1.25/$5', category: 'Proprietary', change: '-2' },
  { rank: 8, name: 'DeepSeek-R1-0528', provider: 'DeepSeek', score: 1418, context: '128K', pricing: '$0.55/$2.19', category: 'Open Source', change: '+3' },
  { rank: 9, name: 'Gemini 2.5 Flash', provider: 'Google', score: 1418, context: '1M', pricing: '$0.15/$0.60', category: 'Proprietary', change: '0' },
  { rank: 10, name: 'GPT-5 (Standard)', provider: 'OpenAI', score: 1413, context: '256K', pricing: '$10/$40', category: 'Proprietary', change: '-1' },
  { rank: 11, name: 'o3', provider: 'OpenAI', score: 1409, context: '200K', pricing: '$10/$40', category: 'Proprietary', change: '-2' },
  { rank: 12, name: 'ChatGPT-4o', provider: 'OpenAI', score: 1404, context: '128K', pricing: '$2.50/$10', category: 'Proprietary', change: '0' },
  { rank: 13, name: 'Grok 3', provider: 'xAI', score: 1398, context: '128K', pricing: '$3/$15', category: 'Proprietary', change: '-1' },
  { rank: 14, name: 'Llama 4 Maverick', provider: 'Meta', score: 1394, context: '1M', pricing: 'Free', category: 'Open Source', change: '0' },
  { rank: 15, name: 'GPT-4.5', provider: 'OpenAI', score: 1394, context: '128K', pricing: '$75/$150', category: 'Proprietary', change: '-3' },
  { rank: 16, name: 'DeepSeek V3', provider: 'DeepSeek', score: 1367, context: '128K', pricing: '$0.27/$1.10', category: 'Open Source', change: '+2' },
  { rank: 17, name: 'GPT-4.1', provider: 'OpenAI', score: 1365, context: '1M', pricing: '$2/$8', category: 'Proprietary', change: '0' },
  { rank: 18, name: 'Claude Sonnet 4.6', provider: 'Anthropic', score: 1355, context: '200K', pricing: '$3/$15', category: 'Proprietary', change: '0' },
  { rank: 19, name: 'Llama 4 Scout', provider: 'Meta', score: 1350, context: '10M', pricing: 'Free', category: 'Open Source', change: 'new' },
  { rank: 20, name: 'Claude Haiku 4.5', provider: 'Anthropic', score: 1320, context: '200K', pricing: '$0.80/$4', category: 'Proprietary', change: '0' },
];

const TRENDING_TOPICS = [
  { name: 'AI Agents', slug: 'ai-agents', keywords: 'agent,agentic,autonomous,multi-agent' },
  { name: 'Open Source LLMs', slug: 'open-source-llms', keywords: 'llama,mistral,open source,open-source,deepseek,qwen' },
  { name: 'AI Regulation', slug: 'ai-regulation', keywords: 'regulation,policy,safety,governance,law,compliance,ban' },
  { name: 'Code Generation', slug: 'code-generation', keywords: 'code,coding,copilot,cursor,developer,programming,IDE' },
  { name: 'AI Safety', slug: 'ai-safety', keywords: 'safety,alignment,guardrail,responsible,ethics,bias' },
  { name: 'Multimodal AI', slug: 'multimodal-ai', keywords: 'multimodal,vision,image,video,audio,speech,visual' },
  { name: 'AI Startups', slug: 'ai-startups', keywords: 'startup,funding,raises,series,seed,valuation,unicorn,YC' },
  { name: 'RAG & Search', slug: 'rag-search', keywords: 'RAG,retrieval,search,vector,embedding,knowledge' },
  { name: 'AI Infrastructure', slug: 'ai-infrastructure', keywords: 'infrastructure,GPU,chip,cloud,deploy,scale,training' },
  { name: 'MCP & Tools', slug: 'mcp-tools', keywords: 'MCP,tool,plugin,integration,server,protocol' },
];

// ---------------------------------------------------------------------------
// SEO TRENDING TOPIC PAGES — programmatic pages for "What's trending in [X]"
// ---------------------------------------------------------------------------
const SEO_TRENDING_TOPICS = [
  { slug: 'ai', label: 'AI', keywords: 'ai,artificial intelligence,machine learning,deep learning,neural' },
  { slug: 'crypto', label: 'Crypto', keywords: 'crypto,cryptocurrency,blockchain,token,defi,web3' },
  { slug: 'bitcoin', label: 'Bitcoin', keywords: 'bitcoin,btc,satoshi,lightning network' },
  { slug: 'ethereum', label: 'Ethereum', keywords: 'ethereum,eth,solidity,evm,layer 2' },
  { slug: 'tech', label: 'Tech', keywords: 'tech,technology,software,hardware,silicon' },
  { slug: 'programming', label: 'Programming', keywords: 'programming,developer,code,coding,software engineering,algorithm' },
  { slug: 'startups', label: 'Startups', keywords: 'startup,founder,funding,series,seed,venture,unicorn,YC,accelerator' },
  { slug: 'web3', label: 'Web3', keywords: 'web3,decentralized,dapp,dao,smart contract,wallet' },
  { slug: 'defi', label: 'DeFi', keywords: 'defi,decentralized finance,yield,liquidity,dex,lending,staking' },
  { slug: 'nft', label: 'NFT', keywords: 'nft,non-fungible,digital collectible,token,opensea' },
  { slug: 'machine-learning', label: 'Machine Learning', keywords: 'machine learning,ML,training,model,dataset,neural network,transformer' },
  { slug: 'robotics', label: 'Robotics', keywords: 'robotics,robot,automation,humanoid,actuator,embodied' },
  { slug: 'cybersecurity', label: 'Cybersecurity', keywords: 'cybersecurity,security,hack,vulnerability,zero-day,malware,ransomware,encryption' },
  { slug: 'cloud-computing', label: 'Cloud Computing', keywords: 'cloud,aws,azure,gcp,serverless,kubernetes,docker,infrastructure' },
  { slug: 'open-source', label: 'Open Source', keywords: 'open source,open-source,github,oss,foss,community,contributor' },
  { slug: 'gaming', label: 'Gaming', keywords: 'gaming,game,esports,console,steam,unity,unreal,playstation,xbox,nintendo' },
  { slug: 'fintech', label: 'Fintech', keywords: 'fintech,financial technology,payment,banking,neobank,stripe,plaid' },
  { slug: 'healthtech', label: 'HealthTech', keywords: 'healthtech,health tech,medical ai,biotech,telemedicine,diagnostics,wearable' },
  { slug: 'edtech', label: 'EdTech', keywords: 'edtech,education,learning,online course,tutoring,LMS,e-learning' },
  { slug: 'climate-tech', label: 'Climate Tech', keywords: 'climate,clean energy,carbon,sustainability,renewable,solar,EV,electric vehicle,green' },
];

// ---------------------------------------------------------------------------
// NEWS TOPIC HUB PAGES — /news/[topic] for topic-specific news aggregation
// ---------------------------------------------------------------------------
const NEWS_TOPIC_HUBS = [
  { slug: 'openai', label: 'OpenAI', keywords: 'openai,open ai,sam altman' },
  { slug: 'anthropic', label: 'Anthropic', keywords: 'anthropic,dario amodei,daniela amodei' },
  { slug: 'google-ai', label: 'Google AI', keywords: 'google ai,deepmind,google brain,google gemini' },
  { slug: 'meta-ai', label: 'Meta AI', keywords: 'meta ai,llama,meta llama,yann lecun' },
  { slug: 'chatgpt', label: 'ChatGPT', keywords: 'chatgpt,chat gpt,gpt-4,gpt-5,gpt4,gpt5' },
  { slug: 'claude', label: 'Claude', keywords: 'claude,claude 4,claude opus,claude sonnet,claude haiku,claude code' },
  { slug: 'gemini', label: 'Gemini', keywords: 'gemini,gemini pro,gemini flash,gemini ultra' },
  { slug: 'llama', label: 'Llama', keywords: 'llama,llama 3,llama 4,llama 2,meta llama' },
  { slug: 'autonomous-agents', label: 'Autonomous Agents', keywords: 'autonomous agent,agentic,multi-agent,agent framework,ai agent,auto-gpt,autogpt' },
  { slug: 'coding-agents', label: 'Coding Agents', keywords: 'coding agent,code agent,copilot,cursor,windsurf,devin,claude code,codex,cline,aider' },
  { slug: 'robotics', label: 'Robotics', keywords: 'robotics,robot,humanoid,embodied ai,actuator,boston dynamics,figure,optimus' },
  { slug: 'open-source-ai', label: 'Open Source AI', keywords: 'open source,open-source,oss,hugging face,huggingface,ollama,vllm' },
  { slug: 'ai-regulation', label: 'AI Regulation', keywords: 'regulation,ai act,executive order,policy,governance,compliance,ban,legislation' },
  { slug: 'ai-startups', label: 'AI Startups', keywords: 'startup,funding,raises,series a,series b,seed round,valuation,unicorn,yc,y combinator' },
  { slug: 'ai-hardware', label: 'AI Hardware', keywords: 'gpu,nvidia,h100,b200,tpu,chip,semiconductor,groq,cerebras,asic,hardware' },
];

// ---------------------------------------------------------------------------
// AI GLOSSARY — /glossary/[term] targeting "what is [term]" searches
// ---------------------------------------------------------------------------
const GLOSSARY_TERMS = [
  { slug: 'llm', term: 'LLM (Large Language Model)', short: 'Large Language Model',
    definition: 'A Large Language Model (LLM) is a type of artificial intelligence trained on massive amounts of text data to understand, generate, and reason about human language. LLMs use transformer architectures with billions of parameters, enabling them to perform tasks like writing, translation, coding, summarization, and question answering. Examples include GPT-4, Claude, Gemini, and Llama. LLMs work by predicting the next token in a sequence, learning statistical patterns across language during pre-training, then being fine-tuned for specific tasks or aligned with human preferences through techniques like RLHF.',
    related: ['transformer', 'token', 'fine-tuning', 'inference', 'context-window'],
    faqs: [{ q: 'What is an LLM?', a: 'An LLM (Large Language Model) is an AI system trained on vast text datasets to understand and generate human-like text. They power tools like ChatGPT, Claude, and Gemini.' }, { q: 'How do LLMs work?', a: 'LLMs predict the next word (token) in a sequence using transformer neural networks. They learn language patterns from billions of text examples during training.' }] },
  { slug: 'rag', term: 'RAG (Retrieval-Augmented Generation)', short: 'Retrieval-Augmented Generation',
    definition: 'Retrieval-Augmented Generation (RAG) is an AI architecture pattern that enhances LLM responses by first retrieving relevant documents from an external knowledge base, then using those documents as context when generating answers. RAG solves key LLM limitations including hallucination, outdated knowledge, and lack of domain expertise. The retrieval step typically uses vector embeddings and similarity search to find relevant passages, which are then injected into the LLM prompt. RAG is widely used in enterprise AI applications where accuracy and up-to-date information are critical.',
    related: ['embedding', 'vector-database', 'llm', 'hallucination'],
    faqs: [{ q: 'What is RAG in AI?', a: 'RAG (Retrieval-Augmented Generation) is a technique that improves AI responses by retrieving relevant documents from a knowledge base before generating an answer, reducing hallucinations and enabling access to current information.' }, { q: 'Why is RAG important?', a: 'RAG grounds LLM responses in real data, dramatically reducing hallucinations and enabling AI systems to access proprietary or up-to-date information without retraining.' }] },
  { slug: 'fine-tuning', term: 'Fine-Tuning', short: 'Fine-Tuning',
    definition: 'Fine-tuning is the process of further training a pre-trained AI model on a smaller, task-specific dataset to adapt it for particular use cases. Unlike training from scratch, fine-tuning starts with a model that already understands language and adjusts its weights to excel at specific tasks like medical diagnosis, legal analysis, or customer support. Common approaches include full fine-tuning, LoRA (Low-Rank Adaptation), and QLoRA, which reduce computational costs. Fine-tuning can improve accuracy, reduce latency, and lower costs compared to using general-purpose models with complex prompts.',
    related: ['llm', 'prompt-engineering', 'distillation', 'reinforcement-learning'],
    faqs: [{ q: 'What is fine-tuning in AI?', a: 'Fine-tuning is adapting a pre-trained AI model for specific tasks by training it further on specialized data. It is faster and cheaper than training from scratch.' }, { q: 'When should I fine-tune vs use prompting?', a: 'Fine-tune when you need consistent performance on a specific task, lower latency, or reduced costs at scale. Use prompting for prototyping, diverse tasks, or when you lack training data.' }] },
  { slug: 'transformer', term: 'Transformer', short: 'Transformer',
    definition: 'The Transformer is a neural network architecture introduced in the 2017 paper "Attention Is All You Need" that revolutionized natural language processing and now powers virtually all modern LLMs. Its key innovation is the self-attention mechanism, which allows the model to weigh the importance of different parts of the input when processing each element. Unlike previous recurrent architectures, Transformers process all tokens in parallel, enabling much faster training on large datasets. The architecture consists of encoder and decoder stacks, though many modern LLMs use decoder-only variants. Transformers also power vision models (ViT), audio models, and multimodal systems.',
    related: ['llm', 'token', 'context-window', 'multimodal'],
    faqs: [{ q: 'What is a Transformer in AI?', a: 'A Transformer is a neural network architecture that uses self-attention to process sequences in parallel. It is the foundation of all modern large language models including GPT, Claude, and Gemini.' }, { q: 'Why are Transformers important?', a: 'Transformers enabled training on much larger datasets than previous architectures, leading to breakthrough AI capabilities in language, vision, and multimodal understanding.' }] },
  { slug: 'prompt-engineering', term: 'Prompt Engineering', short: 'Prompt Engineering',
    definition: 'Prompt engineering is the practice of designing and optimizing input text (prompts) to get desired outputs from AI language models. It encompasses techniques like few-shot learning (providing examples), chain-of-thought prompting (asking the model to reason step by step), role assignment (instructing the model to act as an expert), and structured output formatting. Effective prompt engineering can dramatically improve response quality without model modification. As models become more capable, prompt engineering has evolved from simple instruction writing to complex system prompt design, multi-turn conversation architecture, and tool-use orchestration.',
    related: ['chain-of-thought', 'llm', 'token', 'context-window'],
    faqs: [{ q: 'What is prompt engineering?', a: 'Prompt engineering is the skill of crafting effective instructions for AI models to produce better, more accurate, and more useful responses. It includes techniques like few-shot examples and chain-of-thought reasoning.' }, { q: 'Is prompt engineering still relevant?', a: 'Yes. While models improve at understanding intent, prompt engineering remains crucial for complex tasks, system design, agent orchestration, and extracting maximum model capability.' }] },
  { slug: 'hallucination', term: 'AI Hallucination', short: 'Hallucination',
    definition: 'An AI hallucination occurs when a language model generates information that sounds plausible but is factually incorrect, fabricated, or not grounded in its training data or provided context. Hallucinations happen because LLMs are trained to produce statistically likely text, not verified facts. They can manifest as invented citations, false statistics, non-existent people or events, and confidently wrong answers. Mitigation strategies include RAG (retrieval-augmented generation), grounding with external data sources, chain-of-thought reasoning, and human verification. Reducing hallucination rates is a major research focus across all AI labs.',
    related: ['rag', 'llm', 'chain-of-thought', 'fine-tuning'],
    faqs: [{ q: 'What is AI hallucination?', a: 'AI hallucination is when a language model generates plausible-sounding but factually incorrect information, such as invented citations, false statistics, or fabricated events.' }, { q: 'How can you reduce AI hallucinations?', a: 'Common strategies include RAG (retrieval-augmented generation), fact-checking with external sources, chain-of-thought prompting, lower temperature settings, and human review.' }] },
  { slug: 'token', term: 'Token', short: 'Token',
    definition: 'A token is the basic unit of text that AI language models process. Rather than reading individual characters or whole words, LLMs break text into tokens, which can be words, parts of words, or punctuation. For English, one token is roughly 3/4 of a word, so 100 tokens equals approximately 75 words. Tokenization is performed by algorithms like BPE (Byte Pair Encoding) or SentencePiece. Token counts matter because they determine API costs (priced per input/output token), context window limits, and processing speed. Different models use different tokenizers, so the same text may produce different token counts across models.',
    related: ['llm', 'context-window', 'inference', 'embedding'],
    faqs: [{ q: 'What is a token in AI?', a: 'A token is the basic unit of text an AI model processes. It can be a word, part of a word, or punctuation. One token is roughly 3/4 of an English word.' }, { q: 'Why do tokens matter?', a: 'Tokens determine API pricing, context window limits, and processing speed. Understanding token counts helps optimize cost and performance when using AI models.' }] },
  { slug: 'embedding', term: 'Embedding', short: 'Embedding',
    definition: 'An embedding is a numerical representation of data (text, images, audio) as a dense vector of floating-point numbers, typically with hundreds or thousands of dimensions. Embeddings capture semantic meaning, so similar concepts have vectors close together in the embedding space. Text embeddings are fundamental to semantic search, RAG systems, recommendation engines, and clustering. They are generated by specialized embedding models like OpenAI text-embedding-3, Cohere Embed, or open-source alternatives like BGE and E5. Embeddings enable machines to understand meaning rather than just matching keywords.',
    related: ['vector-database', 'rag', 'token', 'inference'],
    faqs: [{ q: 'What is an embedding in AI?', a: 'An embedding is a numerical vector that represents the meaning of text, images, or other data. Similar concepts have similar embeddings, enabling semantic search and comparison.' }, { q: 'How are embeddings used?', a: 'Embeddings power semantic search, RAG systems, recommendation engines, duplicate detection, and clustering. They convert meaning into numbers that machines can compare.' }] },
  { slug: 'vector-database', term: 'Vector Database', short: 'Vector Database',
    definition: 'A vector database is a specialized database designed to store, index, and query high-dimensional vector embeddings efficiently. Unlike traditional databases that search by exact match or keyword, vector databases perform similarity search, finding the most semantically similar vectors to a query. They are essential infrastructure for RAG systems, semantic search, recommendation engines, and AI applications. Popular vector databases include Pinecone, Weaviate, Milvus, Qdrant, Chroma, and pgvector (PostgreSQL extension). Key features include approximate nearest neighbor (ANN) search algorithms, metadata filtering, and horizontal scaling.',
    related: ['embedding', 'rag', 'inference'],
    faqs: [{ q: 'What is a vector database?', a: 'A vector database stores and searches high-dimensional embeddings efficiently, enabling semantic similarity search. It is essential infrastructure for RAG, search, and AI applications.' }, { q: 'When do I need a vector database?', a: 'Use a vector database when building RAG systems, semantic search, recommendation engines, or any application that needs to find similar items based on meaning rather than keywords.' }] },
  { slug: 'inference', term: 'Inference', short: 'Inference',
    definition: 'Inference is the process of using a trained AI model to generate predictions or outputs from new inputs. In the context of LLMs, inference means sending a prompt to the model and receiving a generated response. Inference is distinct from training: training adjusts model weights using data, while inference uses fixed weights to produce outputs. Inference cost, speed (latency), and throughput are major considerations for AI deployment. Optimization techniques include quantization, speculative decoding, batching, KV-cache optimization, and purpose-built inference hardware like Groq LPUs. The term "inference-time compute" refers to giving models more processing time to reason.',
    related: ['llm', 'token', 'fine-tuning'],
    faqs: [{ q: 'What is inference in AI?', a: 'Inference is running a trained AI model to generate outputs from new inputs. When you send a message to ChatGPT or Claude, the model performs inference to generate a response.' }, { q: 'What affects inference speed?', a: 'Model size, hardware (GPU/TPU), quantization, batching strategy, and context length all affect inference speed. Specialized chips like Groq LPUs can dramatically increase throughput.' }] },
  { slug: 'gpt', term: 'GPT (Generative Pre-trained Transformer)', short: 'GPT',
    definition: 'GPT (Generative Pre-trained Transformer) is a family of large language models developed by OpenAI. The architecture uses decoder-only transformers that are first pre-trained on large text corpora to predict the next token, then fine-tuned with RLHF (Reinforcement Learning from Human Feedback) for instruction following. Major versions include GPT-2 (2019), GPT-3 (2020), GPT-3.5 (2022, powering the original ChatGPT), GPT-4 (2023), and GPT-5 (2025). GPT models pioneered the scaling paradigm in AI, demonstrating that larger models trained on more data exhibit emergent capabilities. The GPT architecture has influenced virtually every subsequent LLM.',
    related: ['llm', 'transformer', 'fine-tuning', 'chain-of-thought'],
    faqs: [{ q: 'What does GPT stand for?', a: 'GPT stands for Generative Pre-trained Transformer. It is a family of large language models created by OpenAI that can generate human-like text.' }, { q: 'What is the latest GPT model?', a: 'As of 2026, the latest GPT model is GPT-5.1, which features enhanced reasoning, longer context windows, and improved multimodal capabilities.' }] },
  { slug: 'diffusion-model', term: 'Diffusion Model', short: 'Diffusion Model',
    definition: 'A diffusion model is a type of generative AI that creates images, video, or audio by learning to reverse a gradual noising process. During training, the model learns to remove noise from data step by step. During generation, it starts with pure random noise and iteratively denoises it into coherent output. Diffusion models power leading image generators like Stable Diffusion, DALL-E 3, Midjourney, and Flux, as well as video generators like Sora and Runway Gen-4. Key innovations include classifier-free guidance, latent diffusion (operating in compressed latent space for efficiency), and ControlNet for precise control over generated outputs.',
    related: ['multimodal', 'transformer', 'inference'],
    faqs: [{ q: 'What is a diffusion model?', a: 'A diffusion model generates images or video by learning to remove noise from data. It starts with random noise and progressively refines it into a coherent output, step by step.' }, { q: 'How is a diffusion model different from a GAN?', a: 'Diffusion models generate images through iterative denoising, producing more diverse and controllable results than GANs. They are slower but generally produce higher quality outputs.' }] },
  { slug: 'reinforcement-learning', term: 'Reinforcement Learning (RL)', short: 'Reinforcement Learning',
    definition: 'Reinforcement Learning (RL) is a machine learning paradigm where an agent learns optimal behavior by interacting with an environment and receiving rewards or penalties. In AI language models, RLHF (Reinforcement Learning from Human Feedback) is used to align model outputs with human preferences after pre-training. RL has also driven breakthroughs in game playing (AlphaGo, AlphaZero), robotics, and autonomous systems. Recent developments include RLAIF (RL from AI Feedback), DPO (Direct Preference Optimization) as a simpler alternative to PPO-based RLHF, and RL-based reasoning training that enables models to "think" before answering.',
    related: ['fine-tuning', 'llm', 'agentic-ai'],
    faqs: [{ q: 'What is reinforcement learning?', a: 'Reinforcement learning is a type of machine learning where an agent learns by trial and error, receiving rewards for good actions and penalties for bad ones, optimizing behavior over time.' }, { q: 'What is RLHF?', a: 'RLHF (Reinforcement Learning from Human Feedback) trains AI models to produce outputs that humans prefer. It is a key technique used to align LLMs like ChatGPT and Claude.' }] },
  { slug: 'multimodal', term: 'Multimodal AI', short: 'Multimodal AI',
    definition: 'Multimodal AI refers to artificial intelligence systems that can process, understand, and generate multiple types of data including text, images, audio, and video. Modern multimodal models like GPT-4V, Gemini, and Claude 3+ can analyze images, understand charts, read documents, and reason across different data types simultaneously. This contrasts with unimodal models that handle only one data type. Multimodal capabilities enable applications like visual question answering, document analysis, image generation from text descriptions, video understanding, and real-time audio conversation. The trend toward multimodality is considered a key step toward more general AI.',
    related: ['llm', 'transformer', 'diffusion-model', 'context-window'],
    faqs: [{ q: 'What is multimodal AI?', a: 'Multimodal AI can process multiple data types (text, images, audio, video) simultaneously. Models like GPT-4V, Gemini, and Claude can see images, hear audio, and reason across modalities.' }, { q: 'Why is multimodal AI important?', a: 'Multimodal AI enables more natural human-computer interaction and unlocks applications impossible with text-only models, like visual analysis, document understanding, and video comprehension.' }] },
  { slug: 'context-window', term: 'Context Window', short: 'Context Window',
    definition: 'The context window is the maximum amount of text (measured in tokens) that an AI language model can process in a single interaction, including both the input prompt and the generated output. Larger context windows allow models to handle longer documents, maintain conversation history, and process more information at once. Context window sizes have grown dramatically: GPT-3 supported 4K tokens, while models in 2026 support up to 2M tokens (Gemini) and 1M tokens (Claude). Larger contexts enable use cases like full codebase analysis, book-length document processing, and extended conversations. However, model performance can degrade with very long contexts ("lost in the middle" phenomenon).',
    related: ['token', 'llm', 'rag', 'prompt-engineering'],
    faqs: [{ q: 'What is a context window?', a: 'The context window is the maximum number of tokens an AI model can process at once, including your input and the model response. Larger windows allow processing more information.' }, { q: 'How big are modern context windows?', a: 'As of 2026, leading models offer context windows from 128K to 2M tokens. Gemini supports 2M, Claude supports 1M, and GPT-5 supports 256K tokens.' }] },
  { slug: 'agentic-ai', term: 'Agentic AI', short: 'Agentic AI',
    definition: 'Agentic AI refers to AI systems that can autonomously plan, reason, and take actions to accomplish goals with minimal human intervention. Unlike simple chatbots that respond to individual prompts, AI agents can break down complex tasks, use tools (web browsing, code execution, API calls), maintain state across steps, and adapt their approach based on results. Examples include coding agents (Claude Code, Devin, Cursor), research agents, and workflow automation agents. Key capabilities include tool use, multi-step planning, error recovery, and memory. The agentic paradigm represents a shift from AI as a text generator to AI as an autonomous worker.',
    related: ['tool-use', 'mcp', 'chain-of-thought', 'llm'],
    faqs: [{ q: 'What is agentic AI?', a: 'Agentic AI refers to AI systems that can autonomously plan, use tools, and take multi-step actions to accomplish goals, going beyond simple question-answering to independent task completion.' }, { q: 'What are examples of AI agents?', a: 'Examples include Claude Code (autonomous coding), Devin (software engineering), research agents that browse the web, and workflow agents that automate multi-step business processes.' }] },
  { slug: 'mcp', term: 'MCP (Model Context Protocol)', short: 'Model Context Protocol',
    definition: 'The Model Context Protocol (MCP) is an open standard created by Anthropic that provides a universal way for AI models to connect with external data sources, tools, and services. MCP follows a client-server architecture where AI applications (clients) connect to MCP servers that expose capabilities like database access, API calls, file system operations, and web browsing. The protocol standardizes how AI agents discover available tools, understand their parameters, and invoke them safely. MCP is analogous to USB for AI: a single standard that replaces custom integrations. Major adopters include development tools, IDEs, and enterprise platforms.',
    related: ['tool-use', 'agentic-ai', 'llm'],
    faqs: [{ q: 'What is MCP in AI?', a: 'MCP (Model Context Protocol) is an open standard by Anthropic that lets AI models connect to external tools, databases, and services through a universal protocol, similar to how USB standardized device connections.' }, { q: 'Why does MCP matter?', a: 'MCP eliminates the need for custom integrations between AI models and tools. One MCP server works with any MCP-compatible AI client, creating an interoperable ecosystem.' }] },
  { slug: 'tool-use', term: 'Tool Use (Function Calling)', short: 'Tool Use',
    definition: 'Tool use, also called function calling, is the ability of AI language models to invoke external tools, APIs, and functions as part of generating a response. Instead of only producing text, the model can decide to call a calculator, search the web, execute code, query a database, or interact with any external system. The model outputs a structured function call with parameters, the system executes it, and the result is fed back to the model. Tool use is fundamental to building AI agents and is supported by all major model providers. It enables models to overcome limitations like lack of real-time data, inability to perform precise calculations, and no access to private systems.',
    related: ['mcp', 'agentic-ai', 'llm'],
    faqs: [{ q: 'What is tool use in AI?', a: 'Tool use (function calling) allows AI models to invoke external tools like APIs, calculators, databases, and web searches as part of generating responses, extending their capabilities beyond text generation.' }, { q: 'How does function calling work?', a: 'The AI model outputs a structured request to call a specific function with parameters. The system executes the function, returns the result, and the model incorporates it into its response.' }] },
  { slug: 'chain-of-thought', term: 'Chain-of-Thought (CoT)', short: 'Chain-of-Thought',
    definition: 'Chain-of-Thought (CoT) is a prompting and reasoning technique where an AI model explicitly works through intermediate reasoning steps before arriving at a final answer. Rather than jumping to a conclusion, the model breaks down complex problems into logical steps, dramatically improving accuracy on math, logic, coding, and multi-step reasoning tasks. CoT can be elicited through prompting ("think step by step") or trained into models directly. Extended thinking models like Claude with thinking, GPT o1/o3, and DeepSeek-R1 use internal CoT reasoning that may be hidden from the user. CoT is considered one of the most important discoveries in making LLMs more capable.',
    related: ['prompt-engineering', 'llm', 'agentic-ai', 'reinforcement-learning'],
    faqs: [{ q: 'What is chain-of-thought prompting?', a: 'Chain-of-thought prompting instructs an AI to reason step by step before answering, dramatically improving accuracy on complex tasks like math, logic, and multi-step problems.' }, { q: 'What are thinking models?', a: 'Thinking models (like Claude with thinking and GPT o1) are trained to perform internal chain-of-thought reasoning automatically, using extended compute time to solve harder problems.' }] },
  { slug: 'distillation', term: 'Model Distillation', short: 'Distillation',
    definition: 'Model distillation (or knowledge distillation) is a technique for transferring knowledge from a large, powerful AI model (the "teacher") to a smaller, more efficient model (the "student"). The student model is trained to mimic the teacher outputs rather than learning from raw data, allowing it to achieve near-teacher performance at a fraction of the size and computational cost. Distillation is widely used to create fast, cheap models suitable for production deployment. Examples include distilling GPT-4 level capabilities into smaller models, or creating specialized models from general-purpose ones. Distillation is a key technique behind the trend of increasingly capable small models.',
    related: ['fine-tuning', 'llm', 'inference'],
    faqs: [{ q: 'What is model distillation?', a: 'Model distillation transfers knowledge from a large AI model (teacher) to a smaller one (student), creating efficient models that approach the performance of much larger ones at lower cost.' }, { q: 'Why use distillation instead of the original model?', a: 'Distilled models are smaller, faster, and cheaper to run while retaining most capabilities. This makes them practical for production, edge deployment, and cost-sensitive applications.' }] },
];

const CATEGORY_COLORS = {
  Models: '#00ffa3',
  Tools: '#06B6D4',
  Research: '#F59E0B',
  Industry: '#EC4899',
  Startups: '#8B5CF6',
};

// ---------------------------------------------------------------------------
// AI TOOLS SEED DATA
// ---------------------------------------------------------------------------

const TOOL_EXTRAS = {
  'ChatGPT': { pros: ['Largest plugin ecosystem','Excellent at creative writing and brainstorming','GPT-4o handles text, image, audio, and code','Free tier is very capable','Web browsing and code execution built in'], cons: ['Can hallucinate facts confidently','Privacy concerns with conversation data','Rate limits on free tier','GPT-4 can be slow on complex tasks','Plugins can be unreliable'], useCases: ['General Q&A and research','Writing drafts and editing','Code generation and debugging','Data analysis with Code Interpreter','Image generation with DALL-E'], faq: [{q:'Is ChatGPT free?',a:'Yes, ChatGPT offers a free tier with GPT-4o mini. ChatGPT Plus ($20/mo) gives access to GPT-4o, DALL-E, and higher rate limits.'},{q:'Is ChatGPT safe for work?',a:'ChatGPT processes conversations on OpenAI servers. For sensitive business data, use the API with data retention controls or ChatGPT Enterprise which offers data privacy guarantees.'}] },
  'Claude': { pros: ['Best-in-class at long document analysis (200K context)','Strongest coding performance on benchmarks','Safety-first design reduces harmful outputs','Excellent at nuanced reasoning and analysis','Artifacts feature for interactive content'], cons: ['No web browsing in free tier','Smaller plugin ecosystem than ChatGPT','Rate limits can be restrictive','No image generation','Knowledge cutoff limitations'], useCases: ['Long document summarization and analysis','Complex coding tasks and debugging','Research and academic writing','Legal and medical document review','Technical writing and documentation'], faq: [{q:'How does Claude compare to ChatGPT?',a:'Claude excels at long-context tasks, coding, and nuanced analysis. ChatGPT has a larger ecosystem with plugins, web browsing, and image generation. Many users use both for different tasks.'},{q:'What is Claude Code?',a:'Claude Code is Anthropic\'s CLI tool that lets Claude autonomously navigate codebases, write code, run tests, and deploy applications from the terminal.'}] },
  'Cursor': { pros: ['Deep VS Code integration (familiar environment)','Multi-file editing with Composer','Excellent autocomplete and suggestions','Supports multiple AI models (Claude, GPT)','Fast tab completion'], cons: ['$20/mo for Pro (can be expensive)','Heavy resource usage','Can suggest incorrect code confidently','Learning curve for AI features','Occasional lag on large codebases'], useCases: ['Daily software development','Refactoring large codebases','Learning new frameworks','Rapid prototyping','Code review assistance'], faq: [{q:'Is Cursor better than GitHub Copilot?',a:'Cursor offers deeper IDE integration with multi-file editing (Composer) and chat. Copilot focuses on inline completions. Cursor is generally better for complex, multi-file tasks.'},{q:'Can I use Cursor for free?',a:'Cursor offers a free tier with limited AI requests. The Pro plan ($20/mo) includes significantly more requests and access to premium models.'}] },
  'Midjourney': { pros: ['Best aesthetic quality among image generators','Consistent artistic style','Full web app and Discord interface','Regular model updates','Excellent at photorealism'], cons: ['No free tier','Slow generation compared to competitors','Limited editing capabilities','No public API for developers','Expensive for heavy users'], useCases: ['Concept art and illustration','Marketing and advertising visuals','Social media content creation','Product mockups','Artistic exploration'], faq: [{q:'How much does Midjourney cost?',a:'Plans start at $10/mo (Basic) with ~200 generations. Standard ($30/mo) offers unlimited relaxed generations. Pro ($60/mo) adds stealth mode and more fast hours.'},{q:'Can I use Midjourney images commercially?',a:'Yes, paid subscribers own the rights to their generated images and can use them commercially. Free trial images are CC-BY-NC.'}] },
  'GitHub Copilot': { pros: ['Seamless IDE integration (VS Code, JetBrains, Neovim)','Fast inline completions','Copilot Chat for explanations','Enterprise features for teams','Backed by GitHub/Microsoft'], cons: ['$10-19/mo subscription','Can suggest copyrighted code','Less capable at multi-file edits than Cursor','Chat is less powerful than dedicated AI tools','Privacy concerns with code telemetry'], useCases: ['Inline code completion while typing','Writing boilerplate code','Unit test generation','Code documentation','Learning unfamiliar APIs'], faq: [{q:'Is GitHub Copilot worth it?',a:'For professional developers writing code daily, the time savings typically justify the $10-19/mo cost. It excels at boilerplate, tests, and repetitive patterns.'},{q:'Does Copilot steal code?',a:'Copilot was trained on public GitHub repositories. It can sometimes suggest code similar to training data. GitHub offers an IP indemnity for business/enterprise users.'}] },
  'Perplexity': { pros: ['Real-time web search with citations','Clean, distraction-free interface','Pro Search for deep research','Collection feature for organizing research','API available for developers'], cons: ['Pro plan ($20/mo) needed for best results','Can hallucinate sources occasionally','Limited creative capabilities','Not ideal for coding tasks','Smaller model selection than Poe'], useCases: ['Research with source verification','Quick factual lookups','Academic research','Market research and analysis','News monitoring'], faq: [{q:'Is Perplexity better than Google?',a:'For research questions requiring synthesized answers with sources, Perplexity is often faster and more useful. For quick lookups, navigation, and local search, Google is still better.'},{q:'Is Perplexity free?',a:'Yes, Perplexity offers a free tier with basic search. Pro ($20/mo) adds Pro Search mode with deeper analysis and access to premium models.'}] },
  'Stable Diffusion': { pros: ['Completely free and open source','Can run locally (no internet needed)','Unlimited generations','Highly customizable with LoRAs and fine-tuning','No content restrictions'], cons: ['Requires powerful GPU to run locally','Steep learning curve','Quality gap vs Midjourney for aesthetics','Complex setup and configuration','VRAM requirements can be prohibitive'], useCases: ['Unlimited batch image generation','Custom model training','Privacy-sensitive image generation','Game and app asset creation','Research and experimentation'], faq: [{q:'Can I run Stable Diffusion on my computer?',a:'Yes, you need a GPU with at least 6GB VRAM (8GB+ recommended). NVIDIA GPUs work best. Use tools like Automatic1111 or ComfyUI for a web interface.'},{q:'Is Stable Diffusion really free?',a:'Yes, the models are open source and free to use, even commercially. You only pay for hardware/cloud GPU if you don\'t have a local GPU.'}] },
  'Gemini': { pros: ['Integrated with Google ecosystem (Search, Gmail, Docs)','2M token context window','Strong multimodal capabilities','Free tier is generous','Google Workspace integration'], cons: ['Can be overly cautious with responses','Less capable at coding than Claude','Hallucination rate is higher','Gemini Advanced requires Google One AI Premium','Limited tool/plugin ecosystem'], useCases: ['Google Workspace productivity','Research with Google Search integration','Multimodal analysis (images, video)','Email and document summarization','Coding assistance'], faq: [{q:'Is Gemini free?',a:'Gemini offers a free tier with Gemini Flash. Gemini Advanced ($20/mo via Google One AI Premium) gives access to the latest Pro and Ultra models.'},{q:'How does Gemini compare to ChatGPT?',a:'Gemini\'s strength is Google integration and long context. ChatGPT has a larger ecosystem and stronger coding. Gemini is better for Google Workspace users.'}] },
  'Runway': { pros: ['Best-in-class video quality with Gen-4 Turbo','Text-to-video and image-to-video','Motion brush for precise control','Inpainting and green screen tools','Growing creative community'], cons: ['Expensive credits system','Short clips only (10-15 seconds)','Queue times during peak hours','Watermark on free tier','Limited character consistency'], useCases: ['Short-form video ads','Social media content','Music video production','Concept visualization','Film prototyping'], faq: [{q:'How much does Runway cost?',a:'Free tier gives limited credits. Standard ($12/mo) and Pro ($28/mo) plans offer more generation credits. Credits are consumed per second of video generated.'},{q:'Can Runway make long videos?',a:'Individual generations are limited to 10-15 seconds. You can extend by generating sequential clips, but maintaining consistency across clips requires careful prompting.'}] },
  'Bolt': { pros: ['Full-stack app generation from prompts','Instant preview and deployment','Supports React, Next.js, and more','Built-in terminal and package management','Free tier available'], cons: ['Generated code can be messy','Complex apps need heavy editing','Limited to web applications','Can struggle with state management','Token limits on free tier'], useCases: ['Rapid prototyping','MVP development','Landing page creation','Internal tools','Learning web development'], faq: [{q:'Is Bolt better than v0?',a:'Bolt generates full-stack apps with backend logic. v0 focuses on UI components. Bolt is better for complete apps, v0 is better for design-focused components.'},{q:'Can I deploy Bolt apps to production?',a:'Yes, Bolt can deploy directly to Netlify. For production use, you should review and clean up the generated code first.'}] },
  'v0': { pros: ['Excellent UI component generation','React/Tailwind output ready to use','Image-to-code capability','Clean, well-structured code','Free tier generous'], cons: ['UI only, no backend logic','Requires React/Tailwind knowledge to customize','Can produce overly complex components','Limited to web technologies','No full app generation'], useCases: ['UI component prototyping','Design-to-code conversion','Landing page sections','Dashboard layouts','Component library building'], faq: [{q:'Is v0 free?',a:'v0 offers a free tier with limited generations. Premium plans offer more generations and priority access.'},{q:'What framework does v0 use?',a:'v0 generates React components with Tailwind CSS and shadcn/ui by default. The output is production-ready and can be dropped into any Next.js or React project.'}] },
  'Replit': { pros: ['Full cloud IDE, no local setup','AI agent builds complete apps','Instant deployment','Collaborative editing','Supports 50+ languages'], cons: ['Performance can be slow','Limited compute on free tier','Code quality varies','Vendor lock-in risk','Advanced features require paid plan'], useCases: ['Learning to code','Quick prototypes','Hackathon projects','Teaching and education','Collaborative development'], faq: [{q:'Is Replit good for beginners?',a:'Yes, Replit is one of the best platforms for beginners. The AI agent can build apps from descriptions, and the cloud IDE means no setup required.'},{q:'Can I use Replit for production apps?',a:'Yes, Replit offers deployment features. For high-traffic production apps, you may want to export and host elsewhere for better performance and control.'}] },
  'Claude Code': { pros: ['Autonomous multi-file editing','Runs tests and deploys code','Deep codebase understanding','Excellent at complex refactors','Terminal-native workflow'], cons: ['Requires Anthropic API subscription','CLI only (no GUI)','Can make unintended changes','High token usage on large tasks','Learning curve for optimal prompting'], useCases: ['Large codebase refactoring','Autonomous bug fixing','Test generation','Code review','Multi-file feature implementation'], faq: [{q:'How is Claude Code different from Cursor?',a:'Claude Code is a CLI tool that works autonomously in your terminal - it can read files, run commands, and make changes across your entire project. Cursor is an IDE with AI assistance. Claude Code is more autonomous, Cursor is more interactive.'},{q:'How much does Claude Code cost?',a:'Claude Code requires a Claude Pro ($20/mo) or API subscription. Usage is metered by tokens. Heavy users may spend $50-200/mo depending on usage.'}] },
  'Notion AI': { pros: ['Seamlessly integrated into Notion workspace','Q&A across all your docs','Writing assistance and summarization','Action item extraction','No separate app needed'], cons: ['$10/mo per member add-on','Only works within Notion','Less capable than dedicated AI tools','Can be slow on large workspaces','Limited customization'], useCases: ['Meeting notes summarization','Writing and editing docs','Finding information across workspace','Generating action items','Drafting project briefs'], faq: [{q:'Is Notion AI worth the extra cost?',a:'If you already use Notion heavily and frequently need to search, summarize, or write within your workspace, the $10/mo add-on saves significant time. For occasional use, free AI tools may suffice.'}] },
  'Sora': { pros: ['Most realistic AI video generation','Complex scene understanding','Multiple camera angles','Physics-aware motion','OpenAI ecosystem integration'], cons: ['Very expensive','Long generation times','Limited access','Short clip duration','Content policy restrictions'], useCases: ['Film and advertising concepts','Product visualization','Educational content','Creative storytelling','Visual effects prototyping'], faq: [{q:'Is Sora available to everyone?',a:'Sora is available through ChatGPT Plus and Pro subscriptions, but with limited generation quotas. Enterprise access offers higher limits.'}] },
};

const AI_TOOLS_SEED = [
  // Coding
  { name: 'Cursor', tagline: 'The AI-first code editor', description: 'AI-powered code editor built on VS Code with deep integration for code generation, editing, and chat.', url: 'https://cursor.com', category: 'coding', pricing: 'freemium' },
  { name: 'GitHub Copilot', tagline: 'Your AI pair programmer', description: 'AI coding assistant that suggests code completions and entire functions in real-time within your editor.', url: 'https://github.com/features/copilot', category: 'coding', pricing: 'freemium' },
  { name: 'Windsurf', tagline: 'AI-powered IDE by Codeium', description: 'Full-featured AI IDE with Cascade flow for multi-file editing and intelligent code suggestions.', url: 'https://windsurf.com', category: 'coding', pricing: 'freemium' },
  { name: 'Cody', tagline: 'AI coding assistant by Sourcegraph', description: 'Context-aware AI assistant that understands your entire codebase for accurate code generation and answers.', url: 'https://sourcegraph.com/cody', category: 'coding', pricing: 'freemium' },
  { name: 'Tabnine', tagline: 'AI code completion for teams', description: 'Privacy-focused AI code assistant with personalized completions trained on your codebase.', url: 'https://www.tabnine.com', category: 'coding', pricing: 'freemium' },
  { name: 'Replit', tagline: 'Build software collaboratively with AI', description: 'Cloud-based IDE with AI agent that can build, deploy, and iterate on full applications from prompts.', url: 'https://replit.com', category: 'coding', pricing: 'freemium' },
  { name: 'Claude Code', tagline: 'Agentic coding in the terminal', description: 'Command-line AI coding tool by Anthropic that navigates codebases, writes code, and runs tests autonomously.', url: 'https://docs.anthropic.com/en/docs/claude-code', category: 'coding', pricing: 'paid' },
  { name: 'Aider', tagline: 'AI pair programming in your terminal', description: 'Open-source command-line tool for AI-assisted coding that works with any LLM and integrates with git.', url: 'https://aider.chat', category: 'coding', pricing: 'free' },
  // Writing
  { name: 'Jasper', tagline: 'AI content platform for marketing', description: 'Enterprise AI content creation platform for marketing teams with brand voice control and templates.', url: 'https://www.jasper.ai', category: 'writing', pricing: 'paid' },
  { name: 'Copy.ai', tagline: 'AI-powered copywriting assistant', description: 'Generate marketing copy, blog posts, emails, and social media content with AI automation workflows.', url: 'https://www.copy.ai', category: 'writing', pricing: 'freemium' },
  { name: 'Writesonic', tagline: 'AI writer for SEO content', description: 'AI content generation platform optimized for SEO-friendly blog posts, ads, and product descriptions.', url: 'https://writesonic.com', category: 'writing', pricing: 'freemium' },
  { name: 'Grammarly', tagline: 'AI writing assistant', description: 'AI-powered writing assistant that checks grammar, tone, clarity, and now generates text with generative AI.', url: 'https://www.grammarly.com', category: 'writing', pricing: 'freemium' },
  { name: 'QuillBot', tagline: 'AI paraphrasing and writing tool', description: 'AI writing platform with paraphrasing, grammar checking, summarization, and citation generation tools.', url: 'https://quillbot.com', category: 'writing', pricing: 'freemium' },
  { name: 'Rytr', tagline: 'AI writing assistant for everyone', description: 'Affordable AI writing tool that generates content in 30+ languages with multiple tones and use cases.', url: 'https://rytr.me', category: 'writing', pricing: 'freemium' },
  // Image
  { name: 'Midjourney', tagline: 'AI image generation', description: 'Leading AI art generator known for highly aesthetic, photorealistic, and artistic image outputs. Web app and Discord.', url: 'https://www.midjourney.com', category: 'image', pricing: 'paid' },
  { name: 'DALL-E', tagline: 'AI image generation by OpenAI', description: 'OpenAI image generator integrated into ChatGPT, creating and editing images from natural language prompts.', url: 'https://openai.com/dall-e', category: 'image', pricing: 'freemium' },
  { name: 'Stable Diffusion', tagline: 'Open source image generation', description: 'Open-source AI image model by Stability AI that can run locally or via API for unrestricted generation.', url: 'https://stability.ai', category: 'image', pricing: 'free' },
  { name: 'Leonardo', tagline: 'AI-powered creative suite', description: 'AI image and video generation platform with fine-tuned models for game assets, design, and art.', url: 'https://leonardo.ai', category: 'image', pricing: 'freemium' },
  { name: 'Ideogram', tagline: 'AI image generation with text rendering', description: 'AI image generator known for exceptional text rendering accuracy within generated images.', url: 'https://ideogram.ai', category: 'image', pricing: 'freemium' },
  { name: 'Flux', tagline: 'Next-gen open image model', description: 'State-of-the-art open-source image generation model by Black Forest Labs with excellent prompt adherence.', url: 'https://blackforestlabs.ai', category: 'image', pricing: 'free' },
  // Video
  { name: 'Runway', tagline: 'AI creative tools for video', description: 'Leading AI video generation platform with Gen-4 Turbo model for creating and editing cinematic video from text and images.', url: 'https://runway.com', category: 'video', pricing: 'freemium' },
  { name: 'Pika', tagline: 'AI video generation made simple', description: 'AI video creation platform that generates and edits video clips from text prompts with cinematic quality.', url: 'https://pika.art', category: 'video', pricing: 'freemium' },
  { name: 'Kling', tagline: 'AI video by Kuaishou', description: 'Advanced AI video generation model producing high-quality, physics-aware video from text and image inputs.', url: 'https://klingai.com', category: 'video', pricing: 'freemium' },
  { name: 'Sora', tagline: 'AI video generation by OpenAI', description: 'OpenAI text-to-video model capable of generating realistic scenes with complex motion and camera movements.', url: 'https://openai.com/sora', category: 'video', pricing: 'paid' },
  { name: 'HeyGen', tagline: 'AI video avatars for business', description: 'AI video creation platform with realistic avatar presenters for marketing, training, and communications.', url: 'https://www.heygen.com', category: 'video', pricing: 'freemium' },
  { name: 'Synthesia', tagline: 'AI video with digital avatars', description: 'Enterprise AI video platform creating professional presenter videos from text in 130+ languages.', url: 'https://www.synthesia.io', category: 'video', pricing: 'paid' },
  // Chat
  { name: 'ChatGPT', tagline: 'AI chat assistant by OpenAI', description: 'The most popular AI chatbot with GPT-4o, code execution, image generation, web browsing, and plugins.', url: 'https://chat.openai.com', category: 'chat', pricing: 'freemium' },
  { name: 'Claude', tagline: 'AI assistant by Anthropic', description: 'Advanced AI assistant known for nuanced analysis, long-context understanding, and safety-first design.', url: 'https://claude.ai', category: 'chat', pricing: 'freemium' },
  { name: 'Gemini', tagline: 'AI assistant by Google', description: 'Google multimodal AI assistant with access to Search, Gmail, Docs, and real-time information.', url: 'https://gemini.google.com', category: 'chat', pricing: 'freemium' },
  { name: 'Perplexity', tagline: 'AI-powered answer engine', description: 'AI search and chat tool that provides cited, up-to-date answers by searching the web in real-time.', url: 'https://www.perplexity.ai', category: 'chat', pricing: 'freemium' },
  { name: 'Poe', tagline: 'Multi-model AI chat platform', description: 'Platform by Quora offering access to multiple AI models including GPT-4, Claude, Gemini, and custom bots.', url: 'https://poe.com', category: 'chat', pricing: 'freemium' },
  { name: 'Character.ai', tagline: 'AI character conversations', description: 'Platform for creating and chatting with AI characters and personalities for entertainment and roleplay.', url: 'https://character.ai', category: 'chat', pricing: 'freemium' },
  // Productivity
  { name: 'Notion AI', tagline: 'AI-powered workspace', description: 'AI integrated into Notion for writing, summarization, action items, and knowledge Q&A across your workspace.', url: 'https://www.notion.so/product/ai', category: 'productivity', pricing: 'paid' },
  { name: 'Otter.ai', tagline: 'AI meeting transcription', description: 'AI-powered meeting assistant that transcribes, summarizes, and generates action items from conversations.', url: 'https://otter.ai', category: 'productivity', pricing: 'freemium' },
  { name: 'Gamma', tagline: 'AI-powered presentations', description: 'AI tool that generates beautiful presentations, documents, and webpages from a simple prompt.', url: 'https://gamma.app', category: 'productivity', pricing: 'freemium' },
  { name: 'Beautiful.ai', tagline: 'AI presentation design', description: 'Smart presentation software that uses AI to apply design rules and create professional slides automatically.', url: 'https://www.beautiful.ai', category: 'productivity', pricing: 'paid' },
  { name: 'Tome', tagline: 'AI storytelling and presentations', description: 'AI-native format for creating compelling narratives, presentations, and visual stories from prompts.', url: 'https://tome.app', category: 'productivity', pricing: 'freemium' },
  // Search
  { name: 'You.com', tagline: 'AI search engine', description: 'AI-powered search engine with conversational answers, code generation, and multimodal understanding.', url: 'https://you.com', category: 'search', pricing: 'freemium' },
  { name: 'Phind', tagline: 'AI search for developers', description: 'AI search engine optimized for developers, providing code solutions and technical answers with sources.', url: 'https://www.phind.com', category: 'search', pricing: 'freemium' },
  { name: 'Kagi', tagline: 'Premium AI search', description: 'Ad-free premium search engine with AI summarization, fast results, and privacy-first approach.', url: 'https://kagi.com', category: 'search', pricing: 'paid' },
  // Dev Tools
  { name: 'v0', tagline: 'AI UI generation by Vercel', description: 'AI tool that generates React UI components and full pages from text descriptions and screenshots.', url: 'https://v0.dev', category: 'devtools', pricing: 'freemium' },
  { name: 'Bolt', tagline: 'AI full-stack app builder', description: 'AI-powered development environment that generates, runs, and deploys full-stack web applications.', url: 'https://bolt.new', category: 'devtools', pricing: 'freemium' },
  { name: 'Lovable', tagline: 'AI app builder for non-coders', description: 'No-code AI platform that builds production-ready web applications from natural language descriptions.', url: 'https://lovable.dev', category: 'devtools', pricing: 'freemium' },
  { name: 'Supabase AI', tagline: 'AI-powered backend development', description: 'Open-source Firebase alternative with AI-assisted SQL generation, schema design, and edge functions.', url: 'https://supabase.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Vercel AI SDK', tagline: 'Build AI apps with TypeScript', description: 'Open-source TypeScript toolkit for building AI-powered streaming chat UIs and generative applications.', url: 'https://sdk.vercel.ai', category: 'devtools', pricing: 'free' },
  // Extra to reach 50
  { name: 'Anthropic API', tagline: 'Claude models via API', description: 'Direct API access to Claude models for building AI applications with tool use, vision, and long context.', url: 'https://docs.anthropic.com', category: 'devtools', pricing: 'paid' },
  { name: 'Descript', tagline: 'AI video and audio editing', description: 'AI-powered media editor where you edit video by editing text transcript, with AI voice cloning and filler word removal.', url: 'https://www.descript.com', category: 'video', pricing: 'freemium' },
  { name: 'ElevenLabs', tagline: 'AI voice generation', description: 'Leading AI voice synthesis platform with ultra-realistic text-to-speech and voice cloning capabilities.', url: 'https://elevenlabs.io', category: 'productivity', pricing: 'freemium' },
  { name: 'Canva AI', tagline: 'AI-powered design platform', description: 'Visual design platform with Magic Studio AI features for image generation, editing, and layout suggestions.', url: 'https://www.canva.com', category: 'image', pricing: 'freemium' },
  { name: 'Fireflies.ai', tagline: 'AI meeting notes', description: 'AI notetaker that records, transcribes, and summarizes meetings with searchable conversation intelligence.', url: 'https://fireflies.ai', category: 'productivity', pricing: 'freemium' },
  // Additional tools for comparison page coverage
  { name: 'GPT-5', tagline: 'OpenAI flagship model', description: 'OpenAI most capable language model with breakthrough reasoning, 256K context, and multimodal support.', url: 'https://openai.com', category: 'chat', pricing: 'paid' },
  { name: 'Claude Opus', tagline: 'Anthropic flagship model', description: 'Anthropic most powerful model. Best-in-class for agentic coding, long documents, and complex reasoning.', url: 'https://claude.ai', category: 'chat', pricing: 'paid' },
  { name: 'Gemini 3', tagline: 'Google latest AI model', description: 'Google most capable AI model with 2M token context, native multimodal, and deep Google ecosystem integration.', url: 'https://gemini.google.com', category: 'chat', pricing: 'freemium' },
  { name: 'Claude Sonnet', tagline: 'Anthropic best coding model', description: 'Anthropic balanced model optimized for coding, instruction following, and developer workflows at moderate cost.', url: 'https://claude.ai', category: 'chat', pricing: 'paid' },
  { name: 'Llama', tagline: 'Meta open source LLM', description: 'Meta family of open-source large language models. Free to use and self-host with competitive performance.', url: 'https://llama.meta.com', category: 'chat', pricing: 'free' },
  { name: 'Llama 4', tagline: 'Meta latest open source LLM', description: 'Meta latest open-source model with 1M context window. Llama 4 Maverick and Scout variants available.', url: 'https://llama.meta.com', category: 'chat', pricing: 'free' },
  { name: 'DeepSeek', tagline: 'Cost-efficient AI models', description: 'Chinese AI lab producing high-performance models at fraction of the cost. DeepSeek V3 and R1 series.', url: 'https://deepseek.com', category: 'chat', pricing: 'freemium' },
  { name: 'Grok', tagline: 'xAI language model', description: 'Elon Musk xAI model with real-time X/Twitter data access and unfiltered response style.', url: 'https://x.ai', category: 'chat', pricing: 'paid' },
  { name: 'Codex', tagline: 'OpenAI coding agent', description: 'OpenAI autonomous coding agent that runs in the cloud, executes code, and manages development tasks.', url: 'https://openai.com/codex', category: 'coding', pricing: 'paid' },
  { name: 'Devin', tagline: 'Autonomous AI software engineer', description: 'Cognition AI autonomous coding agent that can plan, write, debug, and deploy code independently.', url: 'https://devin.ai', category: 'coding', pricing: 'paid' },
  { name: 'Dify', tagline: 'Open source LLM app platform', description: 'Production-ready platform for building AI applications with visual workflow builder, RAG, and multi-model support.', url: 'https://dify.ai', category: 'devtools', pricing: 'freemium' },
  { name: 'LangChain', tagline: 'LLM application framework', description: 'Open-source framework for building LLM-powered applications with chains, agents, RAG, and tool integrations.', url: 'https://langchain.com', category: 'devtools', pricing: 'free' },
  { name: 'n8n', tagline: 'Workflow automation platform', description: 'Open-source workflow automation tool with AI integrations, self-hostable, with 400+ integrations.', url: 'https://n8n.io', category: 'productivity', pricing: 'freemium' },
  { name: 'Zapier', tagline: 'No-code automation platform', description: 'Leading no-code automation platform connecting 6,000+ apps with AI-powered workflow building.', url: 'https://zapier.com', category: 'productivity', pricing: 'freemium' },
  { name: 'Supabase', tagline: 'Open source Firebase alternative', description: 'Open-source backend platform with PostgreSQL, auth, storage, edge functions, and vector embeddings for AI.', url: 'https://supabase.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Firebase', tagline: 'Google app development platform', description: 'Google backend platform with real-time database, auth, hosting, cloud functions, and ML integrations.', url: 'https://firebase.google.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Vercel', tagline: 'Frontend cloud platform', description: 'Frontend deployment platform with serverless functions, edge runtime, and AI SDK for building AI apps.', url: 'https://vercel.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Netlify', tagline: 'Web development platform', description: 'Web deployment and hosting platform with serverless functions, forms, and edge computing.', url: 'https://netlify.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Anthropic', tagline: 'AI safety company', description: 'AI research company building Claude. Focus on AI safety, constitutional AI, and responsible deployment.', url: 'https://anthropic.com', category: 'devtools', pricing: 'paid' },
  { name: 'OpenAI', tagline: 'AI research company', description: 'Creator of GPT, ChatGPT, DALL-E, and Codex. Leading AI lab focused on developing safe AGI.', url: 'https://openai.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Mistral', tagline: 'European open AI models', description: 'French AI company building efficient open-weight models. Mistral Large, Medium, and Small series.', url: 'https://mistral.ai', category: 'chat', pricing: 'freemium' },
  { name: 'Notion', tagline: 'Connected workspace', description: 'All-in-one workspace for notes, docs, wikis, projects, and databases with AI assistant built in.', url: 'https://notion.so', category: 'productivity', pricing: 'freemium' },
  { name: 'Obsidian', tagline: 'Private knowledge base', description: 'Markdown-based note-taking app with graph view, local-first storage, and extensive plugin ecosystem.', url: 'https://obsidian.md', category: 'productivity', pricing: 'freemium' },
  { name: 'Linear', tagline: 'Modern project management', description: 'Fast, streamlined issue tracking and project management tool built for modern software teams.', url: 'https://linear.app', category: 'productivity', pricing: 'freemium' },
  { name: 'Jira', tagline: 'Enterprise project tracking', description: 'Atlassian project management and issue tracking platform for agile software development teams.', url: 'https://www.atlassian.com/software/jira', category: 'productivity', pricing: 'freemium' },
  { name: 'Veo 3', tagline: 'Google AI video generation', description: 'Google video generation model with native audio generation and cinematic quality output.', url: 'https://deepmind.google/technologies/veo/', category: 'video', pricing: 'paid' },
  { name: 'Suno', tagline: 'AI music generation', description: 'AI platform that generates full songs with vocals, instruments, and lyrics from text prompts.', url: 'https://suno.com', category: 'productivity', pricing: 'freemium' },
  { name: 'Udio', tagline: 'AI music creation', description: 'AI music generation platform creating high-quality songs across genres from text descriptions.', url: 'https://udio.com', category: 'productivity', pricing: 'freemium' },
  { name: 'LlamaIndex', tagline: 'Data framework for LLMs', description: 'Open-source data framework for connecting custom data sources to large language models for RAG and agents.', url: 'https://llamaindex.ai', category: 'devtools', pricing: 'free' },
  { name: 'Pinecone', tagline: 'Vector database', description: 'Managed vector database for building high-performance AI applications with semantic search and RAG.', url: 'https://pinecone.io', category: 'devtools', pricing: 'freemium' },
  { name: 'Weaviate', tagline: 'Open source vector database', description: 'Open-source vector database with built-in ML modules for semantic search, classification, and RAG.', url: 'https://weaviate.io', category: 'devtools', pricing: 'freemium' },
  { name: 'Hugging Face', tagline: 'AI model hub', description: 'The GitHub of machine learning. Host, share, and deploy ML models, datasets, and applications.', url: 'https://huggingface.co', category: 'devtools', pricing: 'freemium' },
  { name: 'Replicate', tagline: 'Run ML models in the cloud', description: 'Platform for running open-source ML models via API. Deploy any model with one line of code.', url: 'https://replicate.com', category: 'devtools', pricing: 'paid' },
  { name: 'Ollama', tagline: 'Run LLMs locally', description: 'Run large language models locally on your machine. Simple CLI for downloading and running open-source models.', url: 'https://ollama.com', category: 'devtools', pricing: 'free' },
  { name: 'LM Studio', tagline: 'Desktop LLM runner', description: 'Desktop app for discovering, downloading, and running local LLMs with a chat interface and OpenAI-compatible API.', url: 'https://lmstudio.ai', category: 'devtools', pricing: 'free' },
  { name: 'Groq', tagline: 'Fast AI inference', description: 'AI inference company with custom LPU chips delivering the fastest token generation speeds in the industry.', url: 'https://groq.com', category: 'devtools', pricing: 'freemium' },
  { name: 'Fireworks', tagline: 'Fast model inference API', description: 'AI inference platform for running open-source and custom models with low latency and high throughput.', url: 'https://fireworks.ai', category: 'devtools', pricing: 'freemium' },
  { name: 'OpenRouter', tagline: 'Unified AI model API', description: 'Single API to access 100+ AI models from OpenAI, Anthropic, Google, Meta, and more with unified billing.', url: 'https://openrouter.ai', category: 'devtools', pricing: 'paid' },
  { name: 'Together AI', tagline: 'Open source model cloud', description: 'Cloud platform for running, fine-tuning, and deploying open-source AI models at scale.', url: 'https://together.ai', category: 'devtools', pricing: 'freemium' },
  { name: 'Adobe Firefly', tagline: 'Adobe AI image generation', description: 'Adobe generative AI integrated into Creative Cloud. Commercially safe image generation trained on licensed content.', url: 'https://firefly.adobe.com', category: 'image', pricing: 'freemium' },
  { name: 'Figma AI', tagline: 'AI-powered design', description: 'AI features built into Figma for auto-layout suggestions, content generation, and design-to-code conversion.', url: 'https://figma.com', category: 'devtools', pricing: 'freemium' },
  { name: 'PlayHT', tagline: 'AI voice generation', description: 'AI text-to-speech platform with ultra-realistic voices, voice cloning, and API access for developers.', url: 'https://play.ht', category: 'productivity', pricing: 'freemium' },
  { name: 'Google', tagline: 'Search engine', description: 'The world dominant search engine, now augmented with AI Overviews and Gemini-powered search results.', url: 'https://google.com', category: 'search', pricing: 'free' },
  { name: 'Warp', tagline: 'AI-powered terminal', description: 'Modern terminal with AI command suggestions, intelligent autocomplete, and collaborative features.', url: 'https://warp.dev', category: 'devtools', pricing: 'freemium' },
  { name: 'iTerm', tagline: 'macOS terminal emulator', description: 'Feature-rich terminal emulator for macOS with split panes, search, autocomplete, and extensive customization.', url: 'https://iterm2.com', category: 'devtools', pricing: 'free' },
  { name: 'Raycast', tagline: 'Productivity launcher', description: 'Extendable productivity launcher for macOS with AI chat, snippets, clipboard history, and 1000+ extensions.', url: 'https://raycast.com', category: 'productivity', pricing: 'freemium' },
  { name: 'Alfred', tagline: 'macOS productivity app', description: 'Powerful macOS launcher with custom workflows, clipboard history, snippets, and file navigation.', url: 'https://alfredapp.com', category: 'productivity', pricing: 'freemium' },
  { name: 'Whisper', tagline: 'OpenAI speech recognition', description: 'OpenAI open-source automatic speech recognition model supporting 99 languages with high accuracy.', url: 'https://openai.com/research/whisper', category: 'productivity', pricing: 'free' },
  { name: 'Deepgram', tagline: 'AI speech-to-text API', description: 'Enterprise speech recognition API with real-time transcription, speaker diarization, and language detection.', url: 'https://deepgram.com', category: 'productivity', pricing: 'freemium' },
  { name: 'Stripe', tagline: 'Payment infrastructure', description: 'Financial infrastructure platform for internet businesses. Payment processing, billing, and financial tools.', url: 'https://stripe.com', category: 'devtools', pricing: 'paid' },
  { name: 'LemonSqueezy', tagline: 'Digital commerce platform', description: 'All-in-one platform for selling digital products, subscriptions, and SaaS with built-in tax compliance.', url: 'https://lemonsqueezy.com', category: 'devtools', pricing: 'freemium' },
];

// ---------------------------------------------------------------------------
// MODEL DETAIL DATA (for /models/:slug pages)
// ---------------------------------------------------------------------------

const MODEL_DETAILS = {
  'claude-opus-4': { slug: 'claude-opus-4', name: 'Claude Opus 4.6', provider: 'Anthropic', category: 'Proprietary', score: 1506, context: '1M', pricing: '$15/$75', description: 'Claude Opus 4.6 with Thinking is Anthropic flagship model released in April 2026. It tops the LMSYS Chatbot Arena with a score of 1506 and achieves 80.8% on SWE-bench Verified, making it the best model for agentic coding tasks. It features 1M token context with 76% recall on MRCR v2 (8-needle), adaptive thinking with effort controls, and 128K max output tokens. Opus 4.6 excels at complex reasoning, long document analysis, and autonomous multi-step workflows via Claude Code.', benchmarks: { 'SWE-bench Verified': '80.8%', 'MRCR v2 (1M, 8-needle)': '76%', 'Terminal-Bench 2.0': '65.4%', 'LMSYS Arena': '1506' }, relatedComparisons: ['chatgpt-vs-claude', 'gpt-5-vs-claude-opus', 'claude-vs-gemini', 'deepseek-vs-claude'] },
  'gpt-5': { slug: 'gpt-5', name: 'GPT-5', provider: 'OpenAI', category: 'Proprietary', score: 1413, context: '256K', pricing: '$10/$40', description: 'GPT-5 is OpenAI flagship model with breakthrough reasoning capabilities. It demonstrates significant improvements in mathematical reasoning, code generation, and multi-step problem solving. With a 256K context window and support for text, image, audio, and video inputs, GPT-5 is one of the most versatile models available. It powers ChatGPT and is available through the OpenAI API.', benchmarks: { 'LMSYS Arena': '1413', 'SWE-bench': '80.0%', 'Context Window': '256K' }, relatedComparisons: ['chatgpt-vs-claude', 'gpt-5-vs-claude-opus', 'gemini-3-vs-gpt-5', 'gemini-vs-gpt-5'] },
  'gemini-3': { slug: 'gemini-3', name: 'Gemini 3.1 Pro', provider: 'Google', category: 'Proprietary', score: 1505, context: '2M', pricing: '$1.25/$5', description: 'Gemini 3.1 Pro is Google latest and most capable AI model, nearly tying Claude Opus 4.6 on the LMSYS Arena. It features native multimodal support across text, image, video, audio, and code. With a massive 2M token context window and competitive pricing at $1.25/$5 per MTok, Gemini 3 offers excellent value for enterprise and developer use cases. Deep integration with Google Workspace, Android, and Search makes it the go-to choice for Google ecosystem users.', benchmarks: { 'LMSYS Arena': '1505', 'Context Window': '2M', 'Price (input/output)': '$1.25/$5' }, relatedComparisons: ['chatgpt-vs-gemini', 'claude-vs-gemini', 'gemini-3-vs-gpt-5', 'gemini-vs-gpt-5'] },
  'llama-4': { slug: 'llama-4', name: 'Llama 4 Maverick', provider: 'Meta', category: 'Open Source', score: 1394, context: '1M', pricing: 'Free', description: 'Llama 4 Maverick is Meta open-source large language model and the highest-ranking open model on the LMSYS Arena. With a 1M token context window and completely free to use, Llama 4 is the top choice for developers who want to self-host or fine-tune a state-of-the-art model. It excels at code generation, multilingual tasks, and can be deployed on-premise for data sovereignty requirements.', benchmarks: { 'LMSYS Arena': '1394', 'Context Window': '1M', 'License': 'Open Source' }, relatedComparisons: ['llama-4-vs-claude-sonnet', 'claude-vs-llama', 'mistral-vs-llama'] },
  'deepseek-r1': { slug: 'deepseek-r1', name: 'DeepSeek-R1-0528', provider: 'DeepSeek', category: 'Open Source', score: 1418, context: '128K', pricing: '$0.55/$2.19', description: 'DeepSeek-R1 is a reasoning-focused model that delivers exceptional performance relative to its cost. At just $0.55/$2.19 per MTok, it scores 1418 on the LMSYS Arena, outperforming many models that cost 10x more. The R1 series introduced the thinking/reasoning approach that was later adopted by other labs. It is available as open weights for self-hosting.', benchmarks: { 'LMSYS Arena': '1418', 'Context Window': '128K', 'Price (input/output)': '$0.55/$2.19' }, relatedComparisons: ['deepseek-vs-claude'] },
  'grok-4': { slug: 'grok-4', name: 'Grok-4.1 (Thinking)', provider: 'xAI', category: 'Proprietary', score: 1475, context: '128K', pricing: '$5/$15', description: 'Grok-4.1 with Thinking is xAI flagship model that has climbed rapidly on the LMSYS Arena. Built by Elon Musk team, Grok features real-time access to X/Twitter data, an unfiltered response style, and strong reasoning capabilities. The Thinking variant uses chain-of-thought reasoning for improved accuracy on complex problems.', benchmarks: { 'LMSYS Arena': '1475', 'Context Window': '128K', 'Price (input/output)': '$5/$15' }, relatedComparisons: ['grok-vs-chatgpt'] },
  'claude-sonnet-4': { slug: 'claude-sonnet-4', name: 'Claude Sonnet 4.6', provider: 'Anthropic', category: 'Proprietary', score: 1355, context: '200K', pricing: '$3/$15', description: 'Claude Sonnet 4.6 is Anthropic best coding model and the recommended choice for most development workflows. At $3/$15 per MTok, it offers an excellent balance of capability and cost. Sonnet 4.6 powers most Claude Code sessions and excels at agentic coding, instruction following, and nuanced writing tasks.', benchmarks: { 'LMSYS Arena': '1355', 'Context Window': '200K', 'Price (input/output)': '$3/$15' }, relatedComparisons: ['llama-4-vs-claude-sonnet', 'chatgpt-vs-claude'] },
  'o3': { slug: 'o3', name: 'o3', provider: 'OpenAI', category: 'Proprietary', score: 1409, context: '200K', pricing: '$10/$40', description: 'OpenAI o3 is a reasoning-focused model designed for complex problem solving. It uses chain-of-thought reasoning to break down difficult problems step by step, excelling at mathematics, logic puzzles, and scientific reasoning. While slower than standard models due to its deliberative process, o3 achieves significantly higher accuracy on hard benchmarks.', benchmarks: { 'LMSYS Arena': '1409', 'Context Window': '200K', 'Price (input/output)': '$10/$40' }, relatedComparisons: ['chatgpt-vs-claude', 'gpt-5-vs-claude-opus'] },
  'gemini-2-5-flash': { slug: 'gemini-2-5-flash', name: 'Gemini 2.5 Flash', provider: 'Google', category: 'Proprietary', score: 1418, context: '1M', pricing: '$0.15/$0.60', description: 'Gemini 2.5 Flash is Google cost-optimized model offering remarkable performance per dollar. At just $0.15/$0.60 per MTok with a 1M token context window, it delivers arena scores rivaling models that cost 50x more. Flash is ideal for high-volume applications, chatbots, and use cases where latency and cost matter more than peak reasoning ability.', benchmarks: { 'LMSYS Arena': '1418', 'Context Window': '1M', 'Price (input/output)': '$0.15/$0.60' }, relatedComparisons: ['chatgpt-vs-gemini', 'claude-vs-gemini'] },
  'claude-haiku-4': { slug: 'claude-haiku-4', name: 'Claude Haiku 4.5', provider: 'Anthropic', category: 'Proprietary', score: 1320, context: '200K', pricing: '$0.80/$4', description: 'Claude Haiku 4.5 is Anthropic fastest and most affordable model, delivering 90% of Sonnet capability at a fraction of the cost. At $0.80/$4 per MTok, Haiku is ideal for high-volume applications, pair programming assistants, and worker agents in multi-agent systems. It supports a 200K context window and maintains Anthropic safety-first design principles.', benchmarks: { 'LMSYS Arena': '1320', 'Context Window': '200K', 'Price (input/output)': '$0.80/$4' }, relatedComparisons: ['chatgpt-vs-claude', 'claude-vs-gemini'] },
  'gemini-2-5-pro': { slug: 'gemini-2-5-pro', name: 'Gemini 2.5 Pro', provider: 'Google', category: 'Proprietary', score: 1446, context: '1M', pricing: '$1.25/$5', description: 'Gemini 2.5 Pro is Google previous-generation flagship model that remains highly competitive. With a 1M token context window and strong multimodal capabilities across text, image, video, and code, it offers excellent value at $1.25/$5 per MTok. Gemini 2.5 Pro integrates deeply with Google Workspace, Android, and Search, making it the default choice for developers in the Google ecosystem.', benchmarks: { 'LMSYS Arena': '1446', 'Context Window': '1M', 'Price (input/output)': '$1.25/$5' }, relatedComparisons: ['chatgpt-vs-gemini', 'claude-vs-gemini'] },
  'chatgpt-4o': { slug: 'chatgpt-4o', name: 'ChatGPT-4o', provider: 'OpenAI', category: 'Proprietary', score: 1404, context: '128K', pricing: '$2.50/$10', description: 'GPT-4o is OpenAI versatile multimodal model that processes text, image, audio, and video natively. At $2.50/$10 per MTok with a 128K context window, it balances capability and cost for most use cases. GPT-4o powers the ChatGPT interface and supports real-time audio conversation, making it the most accessible frontier model for consumers.', benchmarks: { 'LMSYS Arena': '1404', 'Context Window': '128K', 'Price (input/output)': '$2.50/$10' }, relatedComparisons: ['chatgpt-vs-claude', 'chatgpt-vs-gemini'] },
  'grok-3': { slug: 'grok-3', name: 'Grok 3', provider: 'xAI', category: 'Proprietary', score: 1398, context: '128K', pricing: '$3/$15', description: 'Grok 3 is xAI large language model with real-time access to X/Twitter data and an unfiltered response style. At $3/$15 per MTok, it offers strong reasoning capabilities and a distinctive personality. Grok 3 is available through the xAI API and integrated into X Premium subscriptions.', benchmarks: { 'LMSYS Arena': '1398', 'Context Window': '128K', 'Price (input/output)': '$3/$15' }, relatedComparisons: ['grok-vs-chatgpt'] },
  'gpt-4-5': { slug: 'gpt-4-5', name: 'GPT-4.5', provider: 'OpenAI', category: 'Proprietary', score: 1394, context: '128K', pricing: '$75/$150', description: 'GPT-4.5 is OpenAI largest and most expensive model, positioned as a research-grade system with the deepest world knowledge. At $75/$150 per MTok, it is significantly more expensive than other models but excels at tasks requiring broad knowledge, nuanced understanding, and reduced hallucination. It is best suited for high-stakes applications where accuracy is paramount.', benchmarks: { 'LMSYS Arena': '1394', 'Context Window': '128K', 'Price (input/output)': '$75/$150' }, relatedComparisons: ['gpt-5-vs-claude-opus', 'chatgpt-vs-claude'] },
  'deepseek-v3': { slug: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', category: 'Open Source', score: 1367, context: '128K', pricing: '$0.27/$1.10', description: 'DeepSeek V3 is an open-source model that delivers remarkable performance at extremely low cost. At just $0.27/$1.10 per MTok, it is one of the most cost-effective frontier models available. DeepSeek V3 is widely used for high-volume applications, fine-tuning, and self-hosting where budget efficiency matters.', benchmarks: { 'LMSYS Arena': '1367', 'Context Window': '128K', 'Price (input/output)': '$0.27/$1.10' }, relatedComparisons: ['deepseek-vs-claude'] },
  'gpt-4-1': { slug: 'gpt-4-1', name: 'GPT-4.1', provider: 'OpenAI', category: 'Proprietary', score: 1365, context: '1M', pricing: '$2/$8', description: 'GPT-4.1 is OpenAI developer-focused model optimized for coding, instruction following, and long-context tasks. With a 1M token context window at $2/$8 per MTok, it offers the best value in OpenAI lineup for professional development workflows. GPT-4.1 excels at processing entire codebases and long documents.', benchmarks: { 'LMSYS Arena': '1365', 'Context Window': '1M', 'Price (input/output)': '$2/$8' }, relatedComparisons: ['chatgpt-vs-claude', 'gpt-5-vs-claude-opus'] },
  'llama-4-scout': { slug: 'llama-4-scout', name: 'Llama 4 Scout', provider: 'Meta', category: 'Open Source', score: 1350, context: '10M', pricing: 'Free', description: 'Llama 4 Scout is Meta smaller, more efficient open-source model with an industry-leading 10M token context window. Completely free to use and self-host, Scout is designed for applications requiring massive context processing like entire codebases, long documents, and multi-session conversations. It trades some reasoning capability for efficiency and context length.', benchmarks: { 'LMSYS Arena': '1350', 'Context Window': '10M', 'License': 'Open Source' }, relatedComparisons: ['llama-4-vs-claude-sonnet', 'claude-vs-llama'] },
};

function modelSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Map from SAMPLE_MODELS names to MODEL_DETAILS keys
const MODEL_NAME_TO_DETAIL = {
  'Claude Opus 4.6 (Thinking)': 'claude-opus-4',
  'Claude Opus 4.6': 'claude-opus-4',
  'GPT-5 (Standard)': 'gpt-5',
  'GPT-5.1 High': 'gpt-5',
  'Gemini 3.1 Pro': 'gemini-3',
  'Gemini 3 Pro': 'gemini-3',
  'Llama 4 Maverick': 'llama-4',
  'DeepSeek-R1-0528': 'deepseek-r1',
  'Grok-4.1 (Thinking)': 'grok-4',
  'Claude Sonnet 4.6': 'claude-sonnet-4',
  'o3': 'o3',
  'Gemini 2.5 Flash': 'gemini-2-5-flash',
  'Claude Haiku 4.5': 'claude-haiku-4',
  'Gemini 2.5 Pro': 'gemini-2-5-pro',
  'ChatGPT-4o': 'chatgpt-4o',
  'Grok 3': 'grok-3',
  'GPT-4.5': 'gpt-4-5',
  'DeepSeek V3': 'deepseek-v3',
  'GPT-4.1': 'gpt-4-1',
  'Llama 4 Scout': 'llama-4-scout',
};

function getModelDetailSlug(modelName) {
  return MODEL_NAME_TO_DETAIL[modelName] || null;
}

function renderModelDetailPage(model) {
  const benchmarkRows = model.benchmarks ? Object.entries(model.benchmarks).map(function(entry) {
    return '<tr><td style="padding:10px 16px;border-bottom:1px solid var(--border);font-size:14px;color:var(--text-secondary);">' + entry[0] + '</td><td style="padding:10px 16px;border-bottom:1px solid var(--border);font-family:JetBrains Mono,monospace;font-size:14px;font-weight:600;color:var(--accent);">' + entry[1] + '</td></tr>';
  }).join('') : '';

  const relatedCompareLinks = (model.relatedComparisons || []).map(function(slug) {
    var c = COMPARISONS.find(function(comp) { return comp.slug === slug; });
    return c ? '<a href="/compare/' + c.slug + '" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-secondary);transition:all 0.2s;">' + c.a + ' vs ' + c.b + '</a>' : '';
  }).filter(Boolean).join('');

  return renderPageHead(
    model.name + ' Review, Benchmarks & Pricing 2026 | whatstrending.ai',
    model.name + ' by ' + model.provider + ' - arena score ' + model.score + ', ' + model.context + ' context, ' + model.pricing + ' per MTok. Benchmarks, pricing, and comparison with other AI models.',
    '/models/' + model.slug
  ) + `
  <style>
    .md-page{max-width:720px;margin:0 auto;padding:40px 20px 80px;}
    .md-provider{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;}
    .md-name{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:16px;}
    .md-meta{display:flex;gap:24px;margin-bottom:32px;flex-wrap:wrap;}
    .md-meta-item{display:flex;flex-direction:column;gap:4px;}
    .md-meta-label{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-tertiary);}
    .md-meta-value{font-size:14px;color:var(--text-primary);font-weight:600;}
    .md-desc{font-size:16px;color:var(--text-secondary);line-height:1.8;margin-bottom:32px;}
    .md-bench{width:100%;border-collapse:collapse;margin-bottom:32px;}
    .md-bench th{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);text-align:left;padding:12px 16px;border-bottom:1px solid var(--border);}
    .md-section-title{font-size:18px;font-weight:600;margin:32px 0 16px;color:var(--text-primary);}
    .md-links{display:flex;gap:10px;flex-wrap:wrap;}
    .back-link{display:inline-block;margin-top:32px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);}
    @media(max-width:768px){.md-name{font-size:24px;}.md-meta{flex-direction:column;gap:12px;}}
  </style>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": model.name,
    "description": model.description,
    "applicationCategory": "WebApplication",
    "author": { "@type": "Organization", "name": model.provider },
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": model.pricing === 'Free' ? '0' : '', "priceCurrency": "USD" }
  })}</script>
</head>
<body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Models', url: 'https://whatstrending.ai/models' },
    { name: model.name, url: 'https://whatstrending.ai/models/' + model.slug }
  ])}
  ${renderNav('models')}
  <section class="md-page" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/models" style="color:var(--text-tertiary);">Models</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${model.name}</span></nav>
    <div class="md-provider">${model.provider}</div>
    <h1 class="md-name">${model.name}</h1>
    <div class="md-meta">
      <div class="md-meta-item"><span class="md-meta-label">Arena Score</span><span class="md-meta-value" style="color:var(--accent);">${model.score}</span></div>
      <div class="md-meta-item"><span class="md-meta-label">Context Window</span><span class="md-meta-value">${model.context}</span></div>
      <div class="md-meta-item"><span class="md-meta-label">Pricing (in/out)</span><span class="md-meta-value">${model.pricing}</span></div>
      <div class="md-meta-item"><span class="md-meta-label">Category</span><span class="md-meta-value">${model.category}</span></div>
    </div>
    <p class="md-desc">${model.description}</p>
    ${benchmarkRows ? '<h2 class="md-section-title">Benchmarks</h2><table class="md-bench"><thead><tr><th>Benchmark</th><th>Score</th></tr></thead><tbody>' + benchmarkRows + '</tbody></table>' : ''}
    ${relatedCompareLinks ? '<h2 class="md-section-title">Compare ' + model.name + '</h2><div class="md-links">' + relatedCompareLinks + '</div>' : ''}
    <a href="/models" class="back-link">&larr; Back to Model Leaderboard</a>
  </section>
  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// COMPARISONS DATA
// ---------------------------------------------------------------------------

const COMPARISONS = [
  { a: 'ChatGPT', b: 'Claude', slug: 'chatgpt-vs-claude' },
  { a: 'Cursor', b: 'GitHub Copilot', slug: 'cursor-vs-copilot' },
  { a: 'Midjourney', b: 'DALL-E', slug: 'midjourney-vs-dall-e' },
  { a: 'Runway', b: 'Pika', slug: 'runway-vs-pika' },
  { a: 'ChatGPT', b: 'Gemini', slug: 'chatgpt-vs-gemini' },
  { a: 'Claude', b: 'Gemini', slug: 'claude-vs-gemini' },
  { a: 'Stable Diffusion', b: 'Midjourney', slug: 'stable-diffusion-vs-midjourney' },
  { a: 'Notion AI', b: 'Gamma', slug: 'notion-ai-vs-gamma' },
  { a: 'Perplexity', b: 'ChatGPT', slug: 'perplexity-vs-chatgpt' },
  { a: 'Cursor', b: 'Windsurf', slug: 'cursor-vs-windsurf' },
  { a: 'Sora', b: 'Runway', slug: 'sora-vs-runway' },
  { a: 'Claude Code', b: 'GitHub Copilot', slug: 'claude-code-vs-copilot' },
  { a: 'v0', b: 'Bolt', slug: 'v0-vs-bolt' },
  { a: 'Jasper', b: 'Copy.ai', slug: 'jasper-vs-copy-ai' },
  { a: 'Grammarly', b: 'QuillBot', slug: 'grammarly-vs-quillbot' },
  { a: 'HeyGen', b: 'Synthesia', slug: 'heygen-vs-synthesia' },
  { a: 'Replit', b: 'Bolt', slug: 'replit-vs-bolt' },
  { a: 'Kagi', b: 'Perplexity', slug: 'kagi-vs-perplexity' },
  { a: 'Leonardo', b: 'Midjourney', slug: 'leonardo-vs-midjourney' },
  { a: 'Kling', b: 'Sora', slug: 'kling-vs-sora' },
  { a: 'GPT-5', b: 'Claude Opus', slug: 'gpt-5-vs-claude-opus' },
  { a: 'Gemini 3', b: 'GPT-5', slug: 'gemini-3-vs-gpt-5' },
  { a: 'Llama 4', b: 'Claude Sonnet', slug: 'llama-4-vs-claude-sonnet' },
  { a: 'Cursor', b: 'Claude Code', slug: 'cursor-vs-claude-code' },
  { a: 'Windsurf', b: 'Bolt', slug: 'windsurf-vs-bolt' },
  // chatgpt-vs-perplexity removed (reverse of perplexity-vs-chatgpt)
  { a: 'Lovable', b: 'v0', slug: 'lovable-vs-v0' },
  { a: 'Devin', b: 'Cursor', slug: 'devin-vs-cursor' },
  { a: 'ElevenLabs', b: 'PlayHT', slug: 'elevenlabs-vs-playht' },
  { a: 'Veo 3', b: 'Sora', slug: 'veo-3-vs-sora' },
  { a: 'Claude', b: 'Llama', slug: 'claude-vs-llama' },
  // gemini-vs-claude removed (reverse of claude-vs-gemini)
  { a: 'Replit', b: 'Cursor', slug: 'replit-vs-cursor' },
  { a: 'Dify', b: 'LangChain', slug: 'dify-vs-langchain' },
  { a: 'n8n', b: 'Zapier', slug: 'n8n-vs-zapier' },
  { a: 'Supabase', b: 'Firebase', slug: 'supabase-vs-firebase' },
  { a: 'Vercel', b: 'Netlify', slug: 'vercel-vs-netlify' },
  { a: 'Flux', b: 'Stable Diffusion', slug: 'flux-vs-stable-diffusion' },
  // codex-vs-claude-code removed (reverse of claude-code-vs-codex)
  { a: 'Grok', b: 'ChatGPT', slug: 'grok-vs-chatgpt' },
  { a: 'Anthropic', b: 'OpenAI', slug: 'anthropic-vs-openai' },
  { a: 'Mistral', b: 'Llama', slug: 'mistral-vs-llama' },
  { a: 'DeepSeek', b: 'Claude', slug: 'deepseek-vs-claude' },
  { a: 'Otter.ai', b: 'Fireflies.ai', slug: 'otter-vs-fireflies' },
  { a: 'Canva AI', b: 'Adobe Firefly', slug: 'canva-ai-vs-adobe-firefly' },
  { a: 'Notion AI', b: 'ChatGPT', slug: 'notion-ai-vs-chatgpt' },
  { a: 'Linear', b: 'Jira', slug: 'linear-vs-jira' },
  { a: 'Warp', b: 'iTerm', slug: 'warp-vs-iterm' },
  { a: 'Raycast', b: 'Alfred', slug: 'raycast-vs-alfred' },
  { a: 'Perplexity', b: 'Google', slug: 'perplexity-vs-google' },
  { a: 'Claude Code', b: 'Codex', slug: 'claude-code-vs-codex' },
  { a: 'Gemini', b: 'GPT-5', slug: 'gemini-vs-gpt-5' },
  { a: 'Notion', b: 'Obsidian', slug: 'notion-vs-obsidian' },
  { a: 'Figma AI', b: 'v0', slug: 'figma-ai-vs-v0' },
  { a: 'Suno', b: 'Udio', slug: 'suno-vs-udio' },
  { a: 'LangChain', b: 'LlamaIndex', slug: 'langchain-vs-llamaindex' },
  { a: 'Pinecone', b: 'Weaviate', slug: 'pinecone-vs-weaviate' },
  { a: 'Hugging Face', b: 'Replicate', slug: 'huggingface-vs-replicate' },
  { a: 'Stable Diffusion', b: 'DALL-E', slug: 'stable-diffusion-vs-dall-e' },
  // claude-vs-chatgpt removed (reverse of chatgpt-vs-claude)
  // bolt-vs-v0 removed (reverse of v0-vs-bolt)
  { a: 'Aider', b: 'Cursor', slug: 'aider-vs-cursor' },
  { a: 'OpenRouter', b: 'Together AI', slug: 'openrouter-vs-together-ai' },
  { a: 'Groq', b: 'Fireworks', slug: 'groq-vs-fireworks' },
  { a: 'Ollama', b: 'LM Studio', slug: 'ollama-vs-lm-studio' },
  { a: 'Midjourney', b: 'Flux', slug: 'midjourney-vs-flux' },
  { a: 'Whisper', b: 'Deepgram', slug: 'whisper-vs-deepgram' },
  { a: 'Stripe', b: 'LemonSqueezy', slug: 'stripe-vs-lemonsqueezy' },
];

const TOOL_CATEGORIES = ['coding', 'writing', 'image', 'video', 'chat', 'productivity', 'search', 'devtools'];

// ---------------------------------------------------------------------------
// RSS Feed URLs for scheduled news fetching
// ---------------------------------------------------------------------------

const RSS_FEEDS = [
  { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
  { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
  { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', source: 'Ars Technica' },
  { url: 'https://openai.com/blog/rss.xml', source: 'OpenAI Blog' },
  { url: 'https://blog.google/technology/ai/rss/', source: 'Google AI Blog' },
  { url: 'https://www.wired.com/feed/tag/ai/latest/rss', source: 'WIRED' },
  { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
  { url: 'https://www.technologyreview.com/feed/', source: 'MIT Tech Review' },
  { url: 'https://huggingface.co/blog/feed.xml', source: 'Hugging Face' },
  { url: 'https://www.anthropic.com/feed.xml', source: 'Anthropic' },
  { url: 'https://deepmind.google/blog/rss.xml', source: 'DeepMind' },
  { url: 'https://www.marktechpost.com/feed/', source: 'MarkTechPost' },
  { url: 'https://the-decoder.com/feed/', source: 'The Decoder' },
  { url: 'https://www.artificialintelligence-news.com/feed/', source: 'AI News' },
  { url: 'https://syncedreview.com/feed/', source: 'Synced' },
  { url: 'https://www.unite.ai/feed/', source: 'Unite.AI' },
  { url: 'https://www.infoworld.com/category/artificial-intelligence/feed/', source: 'InfoWorld' },
  { url: 'https://machinelearningmastery.com/feed/', source: 'ML Mastery' },
  { url: 'https://towardsdatascience.com/feed', source: 'Towards Data Science' },
  { url: 'https://www.zdnet.com/topic/artificial-intelligence/rss.xml', source: 'ZDNet AI' },
];

// ---------------------------------------------------------------------------
// CORS & API helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function successResponse(data, status = 200) {
  return jsonResponse({ success: true, data }, status);
}

function errorResponse(error, status = 400) {
  return jsonResponse({ success: false, error }, status);
}

function isAuthorized(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const key = (env && env.API_KEY) || API_KEY_FALLBACK;
  return auth === `Bearer ${key}`;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// D1 is used ONLY for: tools directory, email signups, submissions, repos cache
// Articles and models are served from KV (news_index, model_rankings)
// ---------------------------------------------------------------------------

// Convert a DB row to the shape used by the HTML templates
function dbRowToArticle(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    body: row.body,
    source: row.source || '',
    source_url: row.source_url || '',
    image_url: row.image_url || '',
    time: row.published_at ? formatRelativeTime(row.published_at) : '',
    featured: Boolean(row.featured),
  };
}

function formatRelativeTime(isoString) {
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  } catch {
    return '';
  }
}

// Get articles for HTML pages — KV first, sample fallback
async function getArticlesForDisplay(env) {
  if (env.NEWS_KV) {
    try {
      const raw = await env.NEWS_KV.get('news_index', 'json');
      if (raw && Array.isArray(raw) && raw.length > 0) return raw;
    } catch {}
  }
  return SAMPLE_ARTICLES;
}

// ---------------------------------------------------------------------------
// D1 Tools data access
// ---------------------------------------------------------------------------

async function initDB(env) {
  if (!env.DB) return;
  try {
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS tools (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tagline TEXT,
        description TEXT,
        url TEXT NOT NULL,
        category TEXT DEFAULT 'other',
        pricing TEXT DEFAULT 'free',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();

    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS repos (
        full_name TEXT PRIMARY KEY,
        description TEXT,
        stars INTEGER DEFAULT 0,
        language TEXT,
        url TEXT,
        topics TEXT,
        source TEXT,
        trust TEXT DEFAULT 'new',
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now')),
        peak_stars INTEGER DEFAULT 0
      )
    `).run();

    // Check if tools are seeded
    const count = await env.DB.prepare('SELECT COUNT(*) as cnt FROM tools').first();
    if (count && count.cnt === 0) {
      // Seed tools
      for (const tool of AI_TOOLS_SEED) {
        await env.DB.prepare(
          'INSERT INTO tools (name, tagline, description, url, category, pricing) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(tool.name, tool.tagline, tool.description, tool.url, tool.category, tool.pricing).run();
      }
    }
  } catch (e) {
    console.error('initDB error:', e.message);
  }
}

async function getToolsFromDB(env, category) {
  try {
    if (!env.DB) return AI_TOOLS_SEED;
    let query = 'SELECT * FROM tools';
    const params = [];
    if (category && category !== 'all') {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY name ASC';
    const result = await env.DB.prepare(query).bind(...params).all();
    if (result.results && result.results.length > 0) return result.results;
    return AI_TOOLS_SEED.filter(t => !category || category === 'all' || t.category === category);
  } catch {
    return AI_TOOLS_SEED.filter(t => !category || category === 'all' || t.category === category);
  }
}

async function getToolBySlug(env, slug) {
  const name = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  try {
    if (env.DB) {
      // Try exact match by lowercased name
      const tools = await env.DB.prepare('SELECT * FROM tools').all();
      if (tools.results) {
        const match = tools.results.find(t => toolSlug(t.name) === slug);
        if (match) return match;
      }
    }
  } catch { /* fallback */ }
  return AI_TOOLS_SEED.find(t => toolSlug(t.name) === slug) || null;
}

function toolSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// ---------------------------------------------------------------------------
// API route handlers
// ---------------------------------------------------------------------------

async function handleApiArticlesList(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category') || '';
  const lim = Number(url.searchParams.get('limit') || '50');
  const off = Number(url.searchParams.get('offset') || '0');

  // Read from KV (live news source) instead of stale D1
  let articles = [];
  if (env.NEWS_KV) {
    try {
      const raw = await env.NEWS_KV.get('news_index', 'json');
      if (raw && Array.isArray(raw)) articles = raw;
    } catch {}
  }

  // Fallback to sample data if KV empty
  if (!articles.length) articles = SAMPLE_ARTICLES;

  // Filter by category
  if (category) {
    articles = articles.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
  }

  return successResponse(articles.slice(off, off + lim));
}

async function handleApiArticleGet(slug, env) {
  // Try KV individual article first, then KV index
  if (env.NEWS_KV) {
    try {
      let article = await env.NEWS_KV.get(`news:${slug}`, 'json');
      if (article) return successResponse(article);

      const idx = await env.NEWS_KV.get('news_index', 'json');
      if (idx && Array.isArray(idx)) {
        article = idx.find(a => a.slug === slug);
        if (article) return successResponse(article);
      }
    } catch {}
  }

  // Fallback to sample data
  const sample = SAMPLE_ARTICLES.find(a => a.slug === slug);
  if (sample) return successResponse(sample);

  return errorResponse('Article not found', 404);
}

// Article CRUD removed — articles are managed via KV by the cron pipeline

// ---------------------------------------------------------------------------
// Models API
// ---------------------------------------------------------------------------


function safeParseJSON(text) {
  try {
    return { data: JSON.parse(text), error: null };
  } catch (e) {
    return { data: null, error: 'Invalid JSON: ' + e.message };
  }
}

// getModelsFromDB removed — models served from KV model_rankings

async function handleApiModelsList(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const lim = Number(url.searchParams.get('limit') || '50');
    const off = Number(url.searchParams.get('offset') || '0');

    // Read from KV (live model rankings) instead of D1
    if (env.NEWS_KV) {
      try {
        const kvModels = await env.NEWS_KV.get('model_rankings', 'json');
        if (kvModels && kvModels.categories && kvModels.categories.overall) {
          let models = kvModels.categories.overall;
          if (category) models = models.filter(m => m.category === category);
          return successResponse(models.slice(off, off + lim));
        }
      } catch {}
    }

    // Fallback to sample data
    let models = SAMPLE_MODELS;
    if (category) models = models.filter(m => m.category === category);
    return successResponse(models.slice(off, off + lim));
  } catch (err) {
    return errorResponse('Failed to fetch models: ' + err.message, 500);
  }
}

async function handleApiModelGet(modelId, env) {
  // Read from KV model_rankings
  if (env.NEWS_KV) {
    try {
      const kvModels = await env.NEWS_KV.get('model_rankings', 'json');
      if (kvModels && kvModels.categories && kvModels.categories.overall) {
        const model = kvModels.categories.overall.find(m => (m.name || '').toLowerCase().replace(/\s+/g, '-') === modelId);
        if (model) return successResponse(model);
      }
    } catch {}
  }
  // Fallback to SAMPLE_MODELS
  const model = SAMPLE_MODELS.find(m => m.name.toLowerCase().replace(/\s+/g, '-') === modelId);
  return model ? successResponse(model) : errorResponse('Model not found', 404);
}

// Model CRUD (create/update/delete) removed — models managed via KV by the cron pipeline

// Stub handlers for removed CRUD — return 410 Gone
async function handleApiModelCreate() { return errorResponse('Model CRUD removed — models managed by cron pipeline', 410); }
async function handleApiModelUpdate() { return errorResponse('Model CRUD removed — models managed by cron pipeline', 410); }
async function handleApiModelDelete() { return errorResponse('Model CRUD removed — models managed by cron pipeline', 410); }

// Stub handlers for removed article CRUD
async function handleApiArticleCreate() { return errorResponse('Article CRUD removed — articles managed by cron pipeline', 410); }
async function handleApiArticleUpdate() { return errorResponse('Article CRUD removed — articles managed by cron pipeline', 410); }
async function handleApiArticleDelete() { return errorResponse('Article CRUD removed — articles managed by cron pipeline', 410); }

// Keep these for reference but they now return 410

// ---------------------------------------------------------------------------
// RSS Feed Parsing & Scheduled Handler
// ---------------------------------------------------------------------------

function parseRSSItems(xmlText) {
  const items = [];
  // Match both <item> (RSS 2.0) and <entry> (Atom)
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = itemRegex.exec(xmlText)) !== null) {
    const block = match[1] || match[2];
    const title = (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (block.match(/<link[^>]*href="([^"]+)"/) || block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || block.match(/<published>([\s\S]*?)<\/published>/) || block.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1] || '';
    const desc = (block.match(/<description>([\s\S]*?)<\/description>/) || block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || block.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || '';

    // Clean CDATA and HTML tags from title/desc
    const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim();
    const cleanDesc = desc.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

    if (cleanTitle && link) {
      items.push({
        title: cleanTitle,
        link: link.trim(),
        date: pubDate.trim(),
        description: cleanDesc,
      });
    }
  }
  return items;
}

function makeSlug(title) {
  return title
    .replace(/&#\d+;/g, '')
    .replace(/&\w+;/g, '')
    .replace(/[\u2018\u2019\u201C\u201D\u2013\u2014]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

async function fetchAndProcessFeeds(env) {
  if (!env.NEWS_KV) return;

  // Get existing articles index
  let existingIndex = [];
  try {
    const raw = await env.NEWS_KV.get('news_index', 'json');
    if (raw && Array.isArray(raw)) existingIndex = raw;
  } catch { /* empty */ }

  const existingSlugs = new Set(existingIndex.map(a => a.slug));
  const newArticles = [];
  const failedArticles = [];

  let aiProcessed = 0;
  const MAX_AI_PER_RUN = 2;
  for (const feed of RSS_FEEDS) {
    if (aiProcessed >= MAX_AI_PER_RUN) break;
    try {
      const resp = await fetch(feed.url, {
        headers: { 'User-Agent': 'WhatsTrending-Bot/1.0' },
      });
      if (!resp.ok) continue;
      const xml = await resp.text();
      const items = parseRSSItems(xml);

      for (const item of items.slice(0, 5)) {
        const slug = makeSlug(item.title);
        if (existingSlugs.has(slug)) continue;

        // Fetch full article from source
        const fullText = item.link ? await fetchFullArticle(item.link) : null;
        const sourceContent = fullText || item.description;
        const sourceType = fullText ? 'full' : 'rss';

        // Generate AI rewrite + category
        let aiSummary = item.description.slice(0, 200);
        let aiCategory = '';
        let aiHeadline = '';
        if ((sourceContent || '').length > 100) {
          try {
            // Step 1: Classify category
            const catResult = await callLLM(env, [{
                role: 'user',
                content: `Classify this AI news into exactly ONE category. Reply with just the category name, nothing else.

Categories (prefer the most specific; use Industry only as a last resort):
- Models: a specific AI model release, update, benchmark, or capability
- Tools: a specific product, app, feature, or integration launching or updating
- Research: papers, studies, scientific findings, or new techniques
- Startups: funding rounds, new company launches, or startup milestones
- Regulation: laws, policy, government action, lawsuits, trials, or bans
- Open Source: open-source model or tool releases specifically
- Industry: business/corporate news ONLY if it fits nothing above (M&A, exec moves, market commentary, partnerships)

Title: ${item.title}`
              }], 512);
            if (catResult && catResult.response) {
              const cat = catResult.response.trim().replace(/[^a-zA-Z ]/g, '');
              if (['Models','Tools','Research','Industry','Startups','Regulation','Open Source'].includes(cat)) {
                aiCategory = cat;
              }
            }

            // Step 2: Rewrite the article
            const rewriteResult = await callLLM(env, [
                {
                  role: 'system',
                  content: 'You are a tech journalist. Rewrite news articles in your own words. Be specific, include names and numbers. Write 3-4 paragraphs. No preamble — start directly with the news.'
                },
                {
                  role: 'user',
                  content: `Rewrite this article in your own words:\n\n${item.title}\n\n${sourceContent.slice(0, 2500)}`
                }
              ], 768);
            if (rewriteResult && rewriteResult.response) {
              let body = rewriteResult.response.trim();
              // Strip preambles
              body = body.replace(/^(Here is|Here's|Below is|This is|The article|A summary|Sure|Certainly)[^.]*[.:]\s*/i, '');
              body = body.replace(/^(Rewritten|Rewrite|Summary)[.:]\s*/i, '');
              if (body.length > 100) aiSummary = body;
            }

            // Step 3: Generate headline
            const headlineResult = await callLLM(env, [{
                role: 'user',
                content: `Write a short, compelling news headline (max 80 characters) for this article. Reply with just the headline, no quotes:\n\n${item.title}\n\n${aiSummary.slice(0, 300)}`
              }], 512);
            if (headlineResult && headlineResult.response) {
              let h = headlineResult.response.trim().replace(/^["']|["']$/g, '').replace(/^Headline:\s*/i, '');
              if (h.length > 10 && h.length < 120) aiHeadline = h;
            }
          } catch { /* use fallback desc */ }
        }

        const article = {
          title: aiHeadline || item.title,
          originalTitle: item.title,
          slug,
          link: item.link,
          source: feed.source,
          category: aiCategory || 'Industry',
          date: item.date || new Date().toISOString(),
          summary: aiSummary,
          sourceType,
        };

        // Quality gate — reject low-quality or off-topic articles
        const isLongEnough = aiSummary.length > 200;
        const hasMultipleSentences = (aiSummary.match(/\./g) || []).length >= 3;
        const notSpammy = !/(click here|subscribe|sign up|buy now|discount|coupon|% off)/i.test(aiSummary);
        const notMeta = !/(here is|here's|below is|I'll|I will|as an AI|we've compiled|we have compiled|in this article)/i.test(aiSummary);
        const hasGoodTitle = (aiHeadline || item.title).length > 15;
        const AI_TOPIC_KEYWORDS = /\b(ai|artificial intelligence|machine learning|deep learning|llm|gpt|claude|model|neural|transformer|openai|anthropic|google ai|meta ai|diffusion|chatbot|agent|automat|robot|compute|gpu|chip|semiconductor|data center|training|inference|benchmark|open.?source|startup|funding|vc|regulation|safety)\b/i;
        const isOnTopic = AI_TOPIC_KEYWORDS.test(aiHeadline || item.title) || AI_TOPIC_KEYWORDS.test(aiSummary.slice(0, 300));

        if (isLongEnough && hasMultipleSentences && notSpammy && notMeta && hasGoodTitle && isOnTopic) {
          newArticles.push(article);
          existingSlugs.add(slug);
        } else if (isOnTopic && hasGoodTitle) {
          // Track failed articles for retry pass (had good topic but AI rewrite failed)
          failedArticles.push({ item, feed, sourceContent, slug });
        }
        aiProcessed++;
        if (aiProcessed >= MAX_AI_PER_RUN) break;
      }
    } catch { /* skip broken feed */ }
  }

  // === RETRY PASS: re-attempt failed articles with MiniMax ===
  if (failedArticles.length > 0) {
    for (const fa of failedArticles) {
      if (existingSlugs.has(fa.slug)) continue;
      try {
        let retryCategory = '';
        let retrySummary = '';
        let retryHeadline = '';

        const catR = await callLLM(env, [{ role: 'user', content: `Classify this AI news into exactly ONE category. Reply with just the category name, nothing else.\n\nCategories (prefer the most specific; use Industry only as a last resort):\n- Models: a specific AI model release, update, benchmark, or capability\n- Tools: a specific product, app, feature, or integration launching or updating\n- Research: papers, studies, scientific findings, or new techniques\n- Startups: funding rounds, new company launches, or startup milestones\n- Regulation: laws, policy, government action, lawsuits, trials, or bans\n- Open Source: open-source model or tool releases specifically\n- Industry: business/corporate news ONLY if it fits nothing above (M&A, exec moves, market commentary, partnerships)\n\nTitle: ${fa.item.title}` }], 512);
        if (catR?.response) {
          const cat = catR.response.trim().replace(/[^a-zA-Z ]/g, '');
          if (['Models','Tools','Research','Industry','Startups','Regulation','Open Source'].includes(cat)) retryCategory = cat;
        }

        const rwR = await callLLM(env, [
          { role: 'system', content: 'You are a tech journalist. Rewrite news articles in your own words. Be specific, include names and numbers. Write 3-4 paragraphs. No preamble — start directly with the news.' },
          { role: 'user', content: `Rewrite this article in your own words:\n\n${fa.item.title}\n\n${(fa.sourceContent || '').slice(0, 2500)}` }
        ], 768);
        if (rwR?.response) {
          let body = rwR.response.trim();
          body = body.replace(/^(Here is|Here's|Below is|This is|The article|A summary|Sure|Certainly)[^.]*[.:]\s*/i, '');
          body = body.replace(/^(Rewritten|Rewrite|Summary)[.:]\s*/i, '');
          if (body.length > 100) retrySummary = body;
        }

        const hlR = await callLLM(env, [{ role: 'user', content: `Write a short, compelling news headline (max 80 characters) for this article. Reply with just the headline, no quotes:\n\n${fa.item.title}\n\n${(retrySummary || fa.item.description || '').slice(0, 300)}` }], 512);
        if (hlR?.response) {
          let h = hlR.response.trim().replace(/^["']|["']$/g, '').replace(/^Headline:\s*/i, '');
          if (h.length > 10 && h.length < 120) retryHeadline = h;
        }

        if (retrySummary.length > 200 && (retrySummary.match(/\./g) || []).length >= 3) {
          newArticles.push({
            title: retryHeadline || fa.item.title,
            originalTitle: fa.item.title,
            slug: fa.slug,
            link: fa.item.link,
            source: fa.feed.source,
            category: retryCategory || 'Industry',
            date: fa.item.date || new Date().toISOString(),
            summary: retrySummary,
            sourceType: fa.sourceContent ? 'full' : 'rss',
          });
          existingSlugs.add(fa.slug);
        }
      } catch { /* skip on retry failure */ }
    }
  }

  if (newArticles.length > 0) {
    // Keep ALL existing articles — never remove indexed content (causes 404s in Google Search Console)
    const merged = [...newArticles, ...existingIndex];
    await env.NEWS_KV.put('news_index', JSON.stringify(merged));

    // Also store individual articles
    for (const article of newArticles) {
      await env.NEWS_KV.put(`news:${article.slug}`, JSON.stringify(article));
    }
  }
}

// ---------------------------------------------------------------------------
// LMSYS Model Rankings Fetcher
// ---------------------------------------------------------------------------

async function fetchModelRankings(env) {
  if (!env.NEWS_KV) return;

  try {
    // Fetch from BenchLM.ai — free, no auth, updated weekly, has latest 2026 models
    const resp = await fetch('https://benchlm.ai/api/data/leaderboard?limit=50', {
      headers: { 'User-Agent': 'WhatsTrending-Bot/1.0' },
    });
    if (!resp.ok) return;
    const data = await resp.json();

    if (!data.models || data.models.length === 0) return;

    const rankings = {
      date: data.lastUpdated || new Date().toISOString().split('T')[0],
      source: 'BenchLM.ai',
      categories: {
        overall: data.models
          .map(m => ({
            name: m.model,
            score: m.overallScore,
            provider: m.creator,
            pricing: m.inputPrice ? `$${m.inputPrice}/$${m.outputPrice}` : 'N/A',
          }))
          .sort((a, b) => b.score - a.score)
          .map((m, i) => ({ ...m, rank: i + 1 })),
      }
    };

    // Also try to get category-specific data
    for (const cat of ['coding', 'reasoning', 'math']) {
      try {
        const catResp = await fetch(`https://benchlm.ai/api/data/leaderboard?category=${cat}&limit=20`, {
          headers: { 'User-Agent': 'WhatsTrending-Bot/1.0' },
        });
        if (catResp.ok) {
          const catData = await catResp.json();
          if (catData.models) {
            rankings.categories[cat] = catData.models
              .map(m => ({
                name: m.model,
                score: m.overallScore || m.categoryScores?.[cat] || 0,
                provider: m.creator,
              }))
              .sort((a, b) => b.score - a.score)
              .map((m, i) => ({ ...m, rank: i + 1 }));
          }
        }
      } catch (e) {}
    }

    await env.NEWS_KV.put('model_rankings', JSON.stringify(rankings));
  } catch (e) {
    console.error('fetchModelRankings error:', e.message);
  }
}

// ---------------------------------------------------------------------------
// GitHub Trending AI Repos Fetcher
// ---------------------------------------------------------------------------

async function fetchTrendingRepos(env) {
  if (!env.NEWS_KV) return;

  try {
    const allRepos = new Map();
    const debugInfo = [];
    const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsTrending/1.0)' };

    // Source 1: GitHub Trending JSON API (daily + weekly, multiple languages)
    const trendingUrls = [
      { url: 'https://githubtrending.lessx.xyz/trending?since=daily', label: 'trending-daily' },
      { url: 'https://githubtrending.lessx.xyz/trending?since=weekly', label: 'trending-weekly' },
      { url: 'https://githubtrending.lessx.xyz/trending?since=daily&language=python', label: 'trending-python' },
      { url: 'https://githubtrending.lessx.xyz/trending?since=daily&language=typescript', label: 'trending-ts' },
    ];

    for (const src of trendingUrls) {
      try {
        const resp = await fetch(src.url, { headers });
        if (!resp.ok) { debugInfo.push({ source: src.label, status: resp.status }); continue; }
        const data = await resp.json();
        if (Array.isArray(data)) {
          for (const r of data) {
            const name = r.name || r.repository?.replace('https://github.com/', '') || '';
            if (name && !allRepos.has(name)) {
              allRepos.set(name, {
                name,
                description: r.description || '',
                stars: parseInt(r.stars?.toString().replace(/,/g, '') || '0', 10),
                language: r.language || 'Unknown',
                url: r.repository || `https://github.com/${name}`,
                created_at: '',
                source: src.label,
                starsToday: r.increased || r.starsInPeriod || '',
              });
            }
          }
          debugInfo.push({ source: src.label, status: 200, count: data.length });
        }
      } catch (e) { debugInfo.push({ source: src.label, error: e.message }); }
    }

    // Source 2: GitHub Search API — expanded queries for AI/ML repos
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const searchQueries = [
      `AI agent stars:>100 created:>${oneMonthAgo}`,
      `LLM framework stars:>50 created:>${oneWeekAgo}`,
      `MCP server stars:>20 created:>${oneMonthAgo}`,
      `RAG retrieval augmented stars:>30 created:>${oneMonthAgo}`,
      `fine-tuning LLM stars:>30 created:>${oneWeekAgo}`,
      `AI coding assistant stars:>50 created:>${oneMonthAgo}`,
      `chatbot open source stars:>50 created:>${oneMonthAgo}`,
      `text-to-image generation stars:>30 created:>${oneMonthAgo}`,
      `vector database stars:>50 created:>${oneMonthAgo}`,
      `AI workflow automation stars:>30 created:>${oneWeekAgo}`,
    ];

    for (const q of searchQueries) {
      try {
        const resp = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=15`,
          { headers: { ...headers, 'Accept': 'application/vnd.github.v3+json' } }
        );
        if (!resp.ok) { debugInfo.push({ source: 'gh-search', query: q, status: resp.status }); continue; }
        const result = await resp.json();
        if (result.items) {
          for (const repo of result.items) {
            if (!allRepos.has(repo.full_name)) {
              allRepos.set(repo.full_name, {
                name: repo.full_name,
                description: repo.description || '',
                stars: repo.stargazers_count,
                language: repo.language || 'Unknown',
                url: repo.html_url,
                created_at: repo.created_at,
                source: 'github-search',
              });
            }
          }
          debugInfo.push({ source: 'gh-search', query: q, status: 200, count: result.items.length });
        }
      } catch (e) { debugInfo.push({ source: 'gh-search', query: q, error: e.message }); }
    }

    // Source 3: ClaudeAtlas registry (top AI skills/tools)
    try {
      const resp = await fetch('https://claudeatlas.com/registry.json', { headers });
      if (resp.ok) {
        const data = await resp.json();
        if (data.skills && Array.isArray(data.skills)) {
          for (const s of data.skills.slice(0, 50)) {
            if (s.repo_full_name && !allRepos.has(s.repo_full_name)) {
              allRepos.set(s.repo_full_name, {
                name: s.repo_full_name,
                description: s.description || '',
                stars: s.repo_stars || 0,
                language: '',
                url: s.repo_url || `https://github.com/${s.repo_full_name}`,
                created_at: '',
                source: 'claudeatlas',
                category: s.category || '',
              });
            }
          }
          debugInfo.push({ source: 'claudeatlas', status: 200, count: Math.min(data.skills.length, 50) });
        }
      }
    } catch (e) { debugInfo.push({ source: 'claudeatlas', error: e.message }); }

    // Source 4: AgentSkill.work — AI tools with enriched metadata
    const agentSkillQueries = ['AI agent', 'MCP server', 'LLM tool', 'coding assistant'];
    for (const q of agentSkillQueries) {
      try {
        const resp = await fetch(`https://agentskill.work/api/skills?q=${encodeURIComponent(q)}&sort=stars&limit=15`, { headers });
        if (!resp.ok) { debugInfo.push({ source: 'agentskill', query: q, status: resp.status }); continue; }
        const data = await resp.json();
        if (data.items && Array.isArray(data.items)) {
          for (const r of data.items) {
            if (r.full_name && !allRepos.has(r.full_name)) {
              allRepos.set(r.full_name, {
                name: r.full_name,
                description: r.description || r.summary_en || '',
                stars: r.stargazers_count || r.stars || 0,
                language: r.language || 'Unknown',
                url: `https://github.com/${r.full_name}`,
                created_at: r.created_at || '',
                source: 'agentskill',
                topics: Array.isArray(r.topics) ? r.topics.slice(0, 5).join(', ') : '',
              });
            }
          }
          debugInfo.push({ source: 'agentskill', query: q, status: 200, count: data.items.length });
        }
      } catch (e) { debugInfo.push({ source: 'agentskill', query: q, error: e.message }); }
    }

    // Quality scoring — flag and filter suspicious repos
    const scoredRepos = Array.from(allRepos.values()).map(r => {
      let quality = 0;
      // Stars score (0-40)
      if (r.stars >= 10000) quality += 40;
      else if (r.stars >= 1000) quality += 30;
      else if (r.stars >= 100) quality += 20;
      else if (r.stars >= 20) quality += 10;
      // Description quality (0-20)
      if (r.description && r.description.length > 50) quality += 20;
      else if (r.description && r.description.length > 20) quality += 10;
      // Has language (0-10)
      if (r.language && r.language !== 'Unknown') quality += 10;
      // Trending bonus (0-20)
      if (r.source && r.source.startsWith('trending')) quality += 20;
      else if (r.source === 'agentskill') quality += 10;
      // Trust vetting
      const verifiedOrgs = ['microsoft','google','meta','anthropic','openai','huggingface','cloudflare','vercel','github','bytedance','apple','nvidia','aws','mozilla','stripe','supabase','langchain-ai','langgenius','n8n-io','modelcontextprotocol'];
      const owner = (r.name || '').split('/')[0].toLowerCase();
      const isVerifiedOrg = verifiedOrgs.includes(owner);
      const hasGoodDesc = r.description && r.description.length > 20;
      const suspicious = !r.description || r.description.length < 10 || r.stars < 5;

      let trust = 'new';
      if (isVerifiedOrg) trust = 'verified';
      else if (r.stars >= 1000 && hasGoodDesc) trust = 'trusted';
      else if (r.stars >= 100 && hasGoodDesc) trust = 'community';
      else if (r.stars < 20 || !hasGoodDesc) trust = 'caution';

      return { ...r, quality, suspicious, trust };
    });

    // Filter out suspicious, sort by quality then stars, take top 100
    const repos = scoredRepos
      .filter(r => !r.suspicious)
      .sort((a, b) => b.quality - a.quality || b.stars - a.stars)
      .slice(0, 100);

    await env.NEWS_KV.put('trending_repos', JSON.stringify(repos));
    await env.NEWS_KV.put('repos_debug', JSON.stringify({ fetched: new Date().toISOString(), count: repos.length, sources: debugInfo.length, debugInfo }));

    // Archive repos permanently in D1
    if (env.DB) {
      for (const r of repos) {
        try {
          await env.DB.prepare(`
            INSERT INTO repos (full_name, description, stars, language, url, topics, source, trust, peak_stars)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(full_name) DO UPDATE SET
              description = CASE WHEN length(excluded.description) > length(repos.description) THEN excluded.description ELSE repos.description END,
              stars = excluded.stars,
              language = COALESCE(NULLIF(excluded.language, 'Unknown'), repos.language),
              url = excluded.url,
              source = excluded.source,
              trust = excluded.trust,
              last_seen = datetime('now'),
              peak_stars = MAX(repos.peak_stars, excluded.stars)
          `).bind(r.name, r.description, r.stars, r.language, r.url, r.topics || '', r.source, r.trust, r.stars).run();
        } catch {}
      }
    }
  } catch (e) {
    console.error('fetchTrendingRepos error:', e.message);
    if (env.NEWS_KV) await env.NEWS_KV.put('repos_debug', JSON.stringify({ error: e.message, ts: new Date().toISOString() }));
  }
}

// ---------------------------------------------------------------------------
// HTML rendering helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trending Score Calculator
// ---------------------------------------------------------------------------

const PRESTIGE_SOURCES = ['TechCrunch', 'The Verge', 'Ars Technica', 'WIRED', 'Reuters', 'MIT Tech Review', 'VentureBeat', 'Anthropic', 'OpenAI Blog', 'Google AI Blog', 'DeepMind'];

function calculateTrendingScore(article) {
  let score = 100;
  // Decay: -10 per hour since published
  const dateStr = article.published_at || article.date || article.time || '';
  if (dateStr) {
    try {
      const published = new Date(dateStr);
      if (!isNaN(published.getTime())) {
        const hoursAgo = (Date.now() - published.getTime()) / 3600000;
        score -= Math.floor(hoursAgo) * 10;
      }
    } catch {}
  }
  // Source prestige bonus
  const source = article.source || '';
  if (PRESTIGE_SOURCES.some(s => source.toLowerCase().includes(s.toLowerCase()))) {
    score += 20;
  }
  return Math.max(0, Math.min(120, score));
}

function renderTrendingPill(score) {
  let color, label;
  if (score >= 90) { color = '#ef4444'; label = 'HOT'; }
  else if (score >= 50) { color = '#f59e0b'; label = 'WARM'; }
  else { color = '#6b7280'; label = 'COOL'; }
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;letter-spacing:0.5px;padding:3px 8px;border-radius:10px;background:${color}18;color:${color};border:1px solid ${color}33;">${score} ${label}</span>`;
}

function formatDate() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

function renderCategoryPill(category) {
  const color = CATEGORY_COLORS[category] || '#00ffa3';
  return `<span class="category-pill" style="background: ${color}15; color: ${color}">${category}</span>`;
}

function renderFeaturedCard(article) {
  return `
    <a href="/news/${article.slug}" class="featured-card">
      <div class="featured-card-inner">
        ${renderCategoryPill(article.category || article.source || '')}
        <h2 class="featured-title">${article.title}</h2>
        <p class="featured-summary">${(article.summary || article.description || "").split('\n')[0].slice(0, 300)}</p>
        <div class="card-meta">
          <span class="meta-source">${article.source}</span>
          <span class="meta-divider"></span>
          <span class="meta-time">${formatShortDate(article.time || article.date)}</span>
        </div>
      </div>
    </a>`;
}

function renderNewsCard(article) {
  const tScore = calculateTrendingScore(article);
  return `
    <a href="/news/${article.slug}" class="news-card" style="display:block;text-decoration:none;color:inherit;">
      <div class="news-card-inner">
        <div class="news-card-header">
          ${renderCategoryPill(article.category || article.source || '')}
          <div style="display:flex;align-items:center;gap:8px;">
            ${renderTrendingPill(tScore)}
            <span class="meta-time">${formatShortDate(article.time || article.date)}</span>
          </div>
        </div>
        <h3 class="news-title">${article.title}</h3>
        <p class="news-summary">${(article.summary || article.description || "").split('\n')[0].slice(0, 200)}</p>
        <div class="card-meta">
          <span class="meta-source">${article.source}</span>
        </div>
      </div>
    </a>`;
}

function renderModelRow(model) {
  const rank = model.elo_rank || model.rank;
  const score = model.elo_score || model.score;
  return `
    <div class="model-row">
      <span class="model-rank">${rank}</span>
      <div class="model-info">
        <span class="model-name">${model.name}</span>
        <span class="model-provider">${model.provider}</span>
      </div>
      <div class="model-score-wrap">
        <div class="model-score-bar">
          <div class="model-score-fill" style="width: ${score}%"></div>
        </div>
        <span class="model-score-num">${score}</span>
      </div>
    </div>`;
}

function render404Page() {
  return `${renderPageHead(
    'Page Not Found — whatstrending.ai',
    'The page you are looking for could not be found.',
    '/404',
    { noindex: true }
  )}
  <style>
    .not-found { max-width: 560px; margin: 0 auto; padding: 100px 24px 120px; text-align: center; }
    .nf-code { font-family: 'JetBrains Mono', monospace; font-size: 80px; font-weight: 700; background: linear-gradient(135deg, #00c8ff, #00ffa3); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin-bottom: 16px; }
    .nf-title { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px; }
    .nf-desc { font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin-bottom: 32px; }
    .nf-links { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .nf-link { display: inline-block; padding: 10px 20px; border: 1px solid var(--border); border-radius: 8px; font-size: 14px; color: var(--text-secondary); transition: all var(--transition); }
    .nf-link:hover { border-color: var(--accent); color: var(--accent); }
    .nf-link-primary { background: var(--accent); border-color: var(--accent); color: white; font-weight: 600; }
    .nf-link-primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); color: white; }
  </style>
</head>
<body>
  ${renderNav('')}
  <section class="not-found">
    <div class="nf-code">404</div>
    <h1 class="nf-title">Page Not Found</h1>
    <p class="nf-desc">The page you are looking for does not exist, has been moved, or is temporarily unavailable.</p>
    <div class="nf-links">
      <a href="/" class="nf-link nf-link-primary">Go Home</a>
      <a href="/search" class="nf-link">Search</a>
      <a href="/news" class="nf-link">News</a>
      <a href="/tools" class="nf-link">Tools</a>
    </div>
  </section>
  ${renderFooter()}
</body>
</html>`;
}

function renderNav(activePage) {
  const pages = [
    { key: 'trending', label: 'Trending', href: '/' },
    { key: 'models', label: 'Models', href: '/models' },
    { key: 'repos', label: 'Repos', href: '/repos' },
    { key: 'news', label: 'News', href: '/news' },
    { key: 'tools', label: 'Tools', href: '/tools' },
    { key: 'alternatives', label: 'Alternatives', href: '/alternatives' },
    { key: 'compare', label: 'Compare', href: '/compare' },
    { key: 'glossary', label: 'Glossary', href: '/glossary' },
  ];
  const navLinks = pages.map(p => {
    const cls = activePage === p.key ? ' class="active"' : '';
    return `<li><a href="${p.href}"${cls}>${p.label}</a></li>`;
  }).join('\n          ');

  const mobileLinks = pages.map(p => `<a href="${p.href}">${p.label}</a>`).join('\n    ');

  return `
  <nav class="nav">
    <div class="container nav-inner">
      <div class="nav-left">
        <a href="/" class="logo">
          <div class="logo-mark"><svg viewBox="0 0 120 120" fill="none"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#00ffa3"/><stop offset="100%" stop-color="#00c8ff"/></linearGradient></defs><circle cx="60" cy="60" r="52" stroke="url(#lg)" stroke-width="2.5" fill="none"/><circle cx="60" cy="60" r="36" stroke="#00ffa3" stroke-width="1" fill="none" opacity="0.08"/><circle cx="60" cy="60" r="24" stroke="#00ffa3" stroke-width="1" fill="none" opacity="0.12"/><path d="M60 24 A36 36 0 0 1 96 60" stroke="#00ffa3" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/><path d="M60 36 A24 24 0 0 1 84 60" stroke="#00ffa3" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.5"/><circle cx="60" cy="60" r="5" fill="#00ffa3"/></svg></div>
          <span class="logo-text">whatstrending<span>.ai</span></span>
        </a>
        <div class="nav-divider"></div>
        <ul class="nav-links">
          ${navLinks}
        </ul>
      </div>
      <div class="nav-right">
        <a href="/about" class="nav-btn-ghost">About</a>
        <button class="nav-hamburger" onclick="this.classList.toggle('open');document.getElementById('mobileMenu').classList.toggle('open')"><span></span><span></span><span></span></button>
      </div>
    </div>
  </nav>
  <div id="mobileMenu" class="nav-mobile-menu">
    ${mobileLinks}
    <a href="/about">About</a>
  </div>`;
}

function renderFooter() {
  const trendingLinks = SEO_TRENDING_TOPICS.slice(0, 10).map(t => `<a href="/trending/${t.slug}" style="color:var(--text-tertiary);font-size:12px;transition:color 0.2s;">${t.label}</a>`).join(' · ');
  const newsTopicLinks = NEWS_TOPIC_HUBS.slice(0, 8).map(h => `<a href="/news/${h.slug}" style="color:var(--text-tertiary);font-size:12px;transition:color 0.2s;">${h.label}</a>`).join(' · ');
  const glossaryLinks = GLOSSARY_TERMS.slice(0, 10).map(t => `<a href="/glossary/${t.slug}" style="color:var(--text-tertiary);font-size:12px;transition:color 0.2s;">${t.short}</a>`).join(' · ');
  return `
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-left"><span>whatstrending.ai</span> &copy; ${new Date().getFullYear()}</div>
      <ul class="footer-links">
        <li><a href="/about">About</a></li>
        <li><a href="/glossary">Glossary</a></li>
        <li><a href="/alternatives">Alternatives</a></li>
        <li><a href="https://github.com/CodeLong888/awesome-ai-tools-2026" target="_blank" rel="noopener">Awesome AI Tools</a></li>
        <li><a href="/about#privacy">Privacy</a></li>
        <li><a href="/about#terms">Terms</a></li>
        <li><a href="https://x.com" target="_blank" rel="noopener">X / Twitter</a></li>
      </ul>
    </div>
    <div class="container" style="padding-top:12px;padding-bottom:8px;border-top:1px solid var(--border);text-align:center;line-height:2;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:8px;opacity:0.6;">News Topics</div>
      ${newsTopicLinks}
    </div>
    <div class="container" style="padding-top:8px;padding-bottom:8px;text-align:center;line-height:2;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:8px;opacity:0.6;">Glossary</div>
      ${glossaryLinks}
    </div>
    <div class="container" style="padding-top:8px;padding-bottom:16px;text-align:center;line-height:2;">
      <div style="font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:8px;opacity:0.6;">Trending</div>
      ${trendingLinks}
    </div>
  </footer>`;
}

function organizationJsonLd() {
  return '<script type="application/ld+json">' + JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "whatstrending.ai",
    "url": "https://whatstrending.ai",
    "logo": "https://whatstrending.ai/og-preview.jpg",
    "description": "AI Intelligence Dashboard tracking the latest in AI news, model rankings, tools, and trends.",
    "sameAs": ["https://x.com/0xvibly"]
  }) + '</script>';
}

function renderPageHead(title, description, canonicalPath, options = {}) {
  const robotsContent = options.noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#06090f">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <meta name="robots" content="${robotsContent}">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-STQ0SLHD1S"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-STQ0SLHD1S');
  </script>

  <meta property="og:type" content="${options.ogType || 'website'}">
  <meta property="og:url" content="https://whatstrending.ai${canonicalPath}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${options.ogImage || 'https://whatstrending.ai/og-preview.jpg'}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="whatstrending.ai">
  ${options.ogType === 'article' && options.publishedTime ? `<meta property="article:published_time" content="${options.publishedTime}">` : ''}

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@0xvibly">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${options.ogImage || 'https://whatstrending.ai/og-preview.jpg'}">

  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2300ffa3'/><stop offset='100%25' stop-color='%2300c8ff'/></linearGradient></defs><circle cx='60' cy='60' r='52' stroke='url(%23fg)' stroke-width='2.5' fill='none'/><circle cx='60' cy='60' r='36' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.08'/><circle cx='60' cy='60' r='24' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.12'/><path d='M60 24 A36 36 0 0 1 96 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.8'/><path d='M60 36 A24 24 0 0 1 84 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.5'/><circle cx='60' cy='60' r='5' fill='%2300ffa3'/></svg>">
  <link rel="canonical" href="https://whatstrending.ai${canonicalPath}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="dns-prefetch" href="https://www.googletagmanager.com">
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="whatstrending.ai RSS" href="https://whatstrending.ai/feed.xml">
  ${options.prevPage ? `<link rel="prev" href="https://whatstrending.ai${options.prevPage}">` : ''}
  ${options.nextPage ? `<link rel="next" href="https://whatstrending.ai${options.nextPage}">` : ''}
  ${organizationJsonLd()}
  <style>${baseCSS()}</style>`;
}

function jsonEsc(s) { return (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, ''); }

function websiteJsonLd() {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "whatstrending.ai",
    "url": "https://whatstrending.ai",
    "description": "AI Intelligence Dashboard — latest AI news, model rankings, trending repos, and tool discovery.",
    "potentialAction": { "@type": "SearchAction", "target": "https://whatstrending.ai/search?q={search_term_string}", "query-input": "required name=search_term_string" }
  })}</script>`;
}

function articleJsonLd(article) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": article.title,
    "description": (article.summary || '').split('\n')[0].slice(0, 200),
    "datePublished": article.date || new Date().toISOString(),
    "dateModified": article.date || new Date().toISOString(),
    "image": article.image || "https://whatstrending.ai/og-preview.jpg",
    "author": { "@type": "Organization", "name": "whatstrending.ai" },
    "publisher": { "@type": "Organization", "name": "whatstrending.ai", "url": "https://whatstrending.ai" },
    "mainEntityOfPage": "https://whatstrending.ai/news/" + article.slug,
    "articleSection": article.category || "Industry",
    "isAccessibleForFree": true
  })}</script>`;
}

function breadcrumbJsonLd(items) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": item.name,
      "item": item.url
    }))
  })}</script>`;
}

// ---------------------------------------------------------------------------
// SEO PAGE RENDERERS — Trending Topics, Fact-Check, Daily Digest
// ---------------------------------------------------------------------------

function renderBreadcrumbNav(items) {
  return `<nav aria-label="breadcrumb" style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
    ${items.map((item, i) => i < items.length - 1
      ? `<a href="${item.url.replace('https://whatstrending.ai', '')}" style="color:var(--text-tertiary);text-decoration:none;">${item.name}</a><span style="opacity:0.4;">/</span>`
      : `<span style="color:var(--text-secondary);">${item.name}</span>`
    ).join('')}
  </nav>`;
}

function faqJsonLd(items) {
  return `<script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": { "@type": "Answer", "text": faq.a }
    }))
  })}</script>`;
}

function renderTrendingTopicLinks() {
  return `<div style="margin-top:40px;padding-top:24px;border-top:1px solid var(--border);">
    <div style="font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;">Trending Topics</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">${SEO_TRENDING_TOPICS.map(t => `<a href="/trending/${t.slug}" style="font-size:12px;color:var(--text-secondary);border:1px solid var(--border);padding:4px 12px;border-radius:6px;text-decoration:none;transition:border-color 0.2s;">${t.label}</a>`).join('')}</div>
  </div>`;
}

function renderSeoTrendingPage(topic, articles) {
  const topicLabel = topic.label;
  const title = "What's Trending in " + topicLabel + " Today | WhatsTrending.ai";
  const description = "See what's trending in " + topicLabel + " right now. Latest " + topicLabel + " news, analysis, and updates curated by AI. Updated every 6 hours.";
  const faqs = [
    { q: "What is trending in " + topicLabel + " right now?", a: "WhatsTrending.ai tracks the latest " + topicLabel + " news from dozens of sources. Visit the " + topicLabel + " trending page for real-time updates on the most important stories, updated every 6 hours." },
    { q: "Where can I find the latest " + topicLabel + " news?", a: "WhatsTrending.ai aggregates " + topicLabel + " news from top tech publications, research papers, and industry sources. All articles are AI-summarized for quick reading." }
  ];

  return `${renderPageHead(title, description, '/trending/' + topic.slug, { ogType: 'website' })}
  <style>
    .seo-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
    .seo-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
    .seo-sub{font-size:15px;color:var(--text-secondary);line-height:1.7;max-width:640px;}
    .seo-section{margin-bottom:48px;}
    .seo-section-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid var(--border);}
    .seo-item{display:block;padding:16px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:all 0.2s;}
    .seo-item:hover{padding-left:8px;}
    .si-title{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;}
    .si-summary{font-size:13px;color:var(--text-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.6;}
    .si-meta{font-size:12px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;margin-top:4px;}
    .seo-empty{color:var(--text-tertiary);font-size:14px;padding:24px 0;}
    .seo-faq{margin-top:48px;padding-top:32px;border-top:1px solid var(--border);}
    .faq-item{margin-bottom:24px;}
    .faq-q{font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px;}
    .faq-a{font-size:14px;color:var(--text-secondary);line-height:1.7;}
    .seo-stats{display:flex;gap:24px;margin-top:16px;}
    .seo-stat{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);}
    .seo-stat strong{color:var(--accent);}
    @media(max-width:768px){.seo-title{font-size:24px;}}
  </style>
  ${faqJsonLd(faqs)}
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"What's Trending in "+topicLabel,"description":description,"url":"https://whatstrending.ai/trending/"+topic.slug})}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Trending', url: 'https://whatstrending.ai/' },
    { name: topicLabel, url: 'https://whatstrending.ai/trending/' + topic.slug }
  ])}
  ${renderNav('trending')}
  <section class="seo-hero"><div class="container" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/trending/${topic.slug}" style="color:var(--text-secondary);">${topicLabel}</a>
    </nav>
    <h1 class="seo-title">What's Trending in ${topicLabel}</h1>
    <p class="seo-sub">The latest ${topicLabel} news and developments, curated from top sources and AI-summarized. Updated every 6 hours.</p>
    <div class="seo-stats">
      <span class="seo-stat"><strong>${articles.length}</strong> articles</span>
      <span class="seo-stat">Updated <strong>${formatShortDate(new Date().toISOString())}</strong></span>
    </div>
  </div></section>
  <div class="container" style="position:relative;z-index:1;">
    <div class="seo-section">
      <div class="seo-section-title">Latest ${topicLabel} News</div>
      ${articles.length > 0 ? articles.map(a => `<a href="/news/${a.slug}" class="seo-item">
        <div class="si-title">${a.title}</div>
        <div class="si-summary">${(a.summary || a.description || '').split('\\n')[0].slice(0, 200)}</div>
        <div class="si-meta">${a.source || ''} &middot; ${formatShortDate(a.date)}</div>
      </a>`).join('') : '<div class="seo-empty">No articles matching "' + topicLabel + '" found yet. Check back soon as new content is added every 6 hours.</div>'}
    </div>
    <div class="seo-faq">
      <div class="seo-section-title">Frequently Asked Questions</div>
      ${faqs.map(f => `<div class="faq-item"><h2 class="faq-q">${f.q}</h2><p class="faq-a">${f.a}</p></div>`).join('')}
    </div>
    ${renderTrendingTopicLinks()}
  </div>
  ${renderFooter()}
  </body></html>`;
}

// ---------------------------------------------------------------------------
// NEWS TOPIC HUB PAGE RENDERER — /news/[topic]
// ---------------------------------------------------------------------------
function renderNewsTopicHubPage(hub, articles) {
  const label = hub.label;
  const title = 'AI News About ' + label + ' | WhatsTrending.ai';
  const description = 'Latest AI news about ' + label + '. Read AI-curated articles, updates, and analysis about ' + label + ', updated every 6 hours.';
  const faqs = [
    { q: 'Where can I find the latest ' + label + ' news?', a: 'WhatsTrending.ai aggregates and summarizes the latest ' + label + ' news from 20+ top tech publications. Articles are AI-curated and updated every 6 hours.' },
    { q: 'How often is ' + label + ' news updated?', a: 'Our ' + label + ' news hub is updated automatically every 6 hours with the latest articles from sources like TechCrunch, The Verge, Wired, Ars Technica, and more.' },
    { q: 'What topics are covered in ' + label + ' news?', a: 'We cover product launches, research breakthroughs, funding rounds, partnerships, regulatory developments, and industry analysis related to ' + label + '.' }
  ];

  const articleCards = articles.map(a => {
    const dateStr = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `<a href="/news/${a.slug}" class="hub-article">
      <h3 class="hub-article-title">${a.title}</h3>
      <p class="hub-article-summary">${(a.summary || '').split('\\n')[0].slice(0, 200)}</p>
      <div class="hub-article-meta"><span>${a.source || ''}</span><span>${dateStr}</span></div>
    </a>`;
  }).join('');

  const otherHubs = NEWS_TOPIC_HUBS.filter(h => h.slug !== hub.slug).map(h =>
    `<a href="/news/${h.slug}" class="hub-pill">${h.label}</a>`
  ).join('');

  return `${renderPageHead(title, description, '/news/' + hub.slug)}
  <style>
    .hub-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
    .hub-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
    .hub-sub{font-size:15px;color:var(--text-secondary);line-height:1.7;max-width:640px;}
    .hub-stats{display:flex;gap:24px;margin-top:16px;}
    .hub-stat{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);}
    .hub-stat strong{color:var(--accent);}
    .hub-section{margin-bottom:48px;}
    .hub-section-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid var(--border);}
    .hub-article{display:block;padding:20px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:all 0.2s;}
    .hub-article:hover{padding-left:8px;}
    .hub-article-title{font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:6px;line-height:1.4;}
    .hub-article-summary{font-size:13px;color:var(--text-secondary);line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:8px;}
    .hub-article-meta{display:flex;gap:12px;font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);}
    .hub-empty{color:var(--text-tertiary);font-size:14px;padding:24px 0;line-height:1.7;}
    .hub-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px;}
    .hub-pill{font-size:12px;color:var(--text-secondary);border:1px solid var(--border);padding:5px 14px;border-radius:6px;text-decoration:none;transition:border-color 0.2s,color 0.2s;}
    .hub-pill:hover{border-color:var(--accent);color:var(--accent);}
    .hub-faq{margin-top:48px;padding-top:32px;border-top:1px solid var(--border);}
    .hfaq-item{margin-bottom:24px;}
    .hfaq-q{font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px;}
    .hfaq-a{font-size:14px;color:var(--text-secondary);line-height:1.7;}
    @media(max-width:768px){.hub-title{font-size:24px;}}
  </style>
  ${faqJsonLd(faqs)}
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI News About "+label,"description":description,"url":"https://whatstrending.ai/news/"+hub.slug})}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'News', url: 'https://whatstrending.ai/news' },
    { name: label, url: 'https://whatstrending.ai/news/' + hub.slug }
  ])}
  ${renderNav('news')}
  <section class="hub-hero"><div class="container" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/news" style="color:var(--text-tertiary);">News</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${label}</span>
    </nav>
    <h1 class="hub-title">AI News About ${label}</h1>
    <p class="hub-sub">The latest news, updates, and analysis about ${label}, curated from top tech publications and AI-summarized.</p>
    <div class="hub-stats">
      <span class="hub-stat"><strong>${articles.length}</strong> articles</span>
      <span class="hub-stat">Updated <strong>${formatShortDate(new Date().toISOString())}</strong></span>
    </div>
  </div></section>
  <div class="container" style="position:relative;z-index:1;">
    <div class="hub-section">
      <div class="hub-section-title">Latest ${label} News</div>
      ${articles.length > 0 ? articleCards : '<div class="hub-empty">No articles matching "' + label + '" found yet. New content is added every 6 hours, so check back soon.</div>'}
    </div>
    <div class="hub-faq">
      <div class="hub-section-title">Frequently Asked Questions</div>
      ${faqs.map(f => `<div class="hfaq-item"><h2 class="hfaq-q">${f.q}</h2><p class="hfaq-a">${f.a}</p></div>`).join('')}
    </div>
    <div class="hub-section" style="margin-top:40px;">
      <div class="hub-section-title">More AI News Topics</div>
      <div class="hub-pills">${otherHubs}</div>
    </div>
  </div>
  ${renderFooter()}
  </body></html>`;
}

// ---------------------------------------------------------------------------
// GLOSSARY PAGE RENDERERS — /glossary and /glossary/[term]
// ---------------------------------------------------------------------------
function renderGlossaryIndexPage() {
  const title = 'AI Glossary: Key AI & Machine Learning Terms Explained | WhatsTrending.ai';
  const description = 'Comprehensive AI glossary with clear definitions of key artificial intelligence and machine learning terms. Learn what LLM, RAG, fine-tuning, transformers, and 20+ AI concepts mean.';

  const sortedTerms = [...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term));

  // Group by first letter
  const grouped = {};
  for (const t of sortedTerms) {
    const letter = t.term[0].toUpperCase();
    if (!grouped[letter]) grouped[letter] = [];
    grouped[letter].push(t);
  }
  const letters = Object.keys(grouped).sort();

  const letterNav = letters.map(l => `<a href="#letter-${l}" class="gl-letter-link">${l}</a>`).join('');

  const sections = letters.map(l => {
    const items = grouped[l].map(t =>
      `<a href="/glossary/${t.slug}" class="gl-item">
        <span class="gl-item-term">${t.term}</span>
        <span class="gl-item-arrow">&rarr;</span>
      </a>`
    ).join('');
    return `<div id="letter-${l}" class="gl-group">
      <div class="gl-group-letter">${l}</div>
      ${items}
    </div>`;
  }).join('');

  return `${renderPageHead(title, description, '/glossary')}
  <style>
    .gl-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
    .gl-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
    .gl-sub{font-size:15px;color:var(--text-secondary);line-height:1.7;max-width:640px;}
    .gl-stats{display:flex;gap:24px;margin-top:16px;}
    .gl-stat{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);}
    .gl-stat strong{color:var(--accent);}
    .gl-letter-nav{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid var(--border);}
    .gl-letter-link{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-tertiary);text-decoration:none;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all 0.2s;}
    .gl-letter-link:hover{color:var(--accent);background:rgba(0,255,163,0.05);}
    .gl-group{margin-bottom:32px;}
    .gl-group-letter{font-family:'JetBrains Mono',monospace;font-size:20px;font-weight:700;color:var(--accent);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border);}
    .gl-item{display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid rgba(255,255,255,0.04);text-decoration:none;color:inherit;transition:all 0.2s;}
    .gl-item:hover{padding-left:8px;}
    .gl-item-term{font-size:15px;font-weight:500;color:var(--text-primary);}
    .gl-item-arrow{font-size:14px;color:var(--text-tertiary);transition:color 0.2s,transform 0.2s;}
    .gl-item:hover .gl-item-arrow{color:var(--accent);transform:translateX(4px);}
    @media(max-width:768px){.gl-title{font-size:24px;}}
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"DefinedTermSet","name":"AI Glossary","description":description,"url":"https://whatstrending.ai/glossary","hasDefinedTerm":sortedTerms.map(t=>({"@type":"DefinedTerm","name":t.term,"url":"https://whatstrending.ai/glossary/"+t.slug}))})}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Glossary', url: 'https://whatstrending.ai/glossary' }
  ])}
  ${renderNav('glossary')}
  <section class="gl-hero"><div class="container" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">Glossary</span>
    </nav>
    <h1 class="gl-title">AI Glossary</h1>
    <p class="gl-sub">Clear, concise definitions of key artificial intelligence and machine learning terms. From LLMs to RAG, transformers to embeddings.</p>
    <div class="gl-stats">
      <span class="gl-stat"><strong>${GLOSSARY_TERMS.length}</strong> terms defined</span>
    </div>
  </div></section>
  <div class="container" style="position:relative;z-index:1;">
    <div class="gl-letter-nav">${letterNav}</div>
    ${sections}
  </div>
  ${renderFooter()}
  </body></html>`;
}

function renderGlossaryTermPage(entry, relatedArticles) {
  const title = 'What is ' + entry.short + '? Definition & Explanation | WhatsTrending.ai';
  const description = entry.definition.slice(0, 155) + '...';

  const relatedTerms = (entry.related || []).map(slug => {
    const t = GLOSSARY_TERMS.find(g => g.slug === slug);
    return t ? `<a href="/glossary/${t.slug}" class="gterm-related-link">${t.term}</a>` : '';
  }).filter(Boolean).join('');

  const relatedArticleCards = (relatedArticles || []).slice(0, 5).map(a => {
    const dateStr = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `<a href="/news/${a.slug}" class="gterm-article">
      <span class="gterm-article-title">${a.title}</span>
      <span class="gterm-article-meta">${a.source || ''} ${dateStr ? '&middot; ' + dateStr : ''}</span>
    </a>`;
  }).join('');

  const allTermLinks = GLOSSARY_TERMS.filter(t => t.slug !== entry.slug).map(t =>
    `<a href="/glossary/${t.slug}" class="hub-pill">${t.short}</a>`
  ).join('');

  return `${renderPageHead(title, description, '/glossary/' + entry.slug)}
  <style>
    .gterm-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
    .gterm-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
    .gterm-label{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--accent);margin-bottom:12px;}
    .gterm-definition{font-size:16px;color:var(--text-secondary);line-height:1.8;max-width:720px;margin-bottom:32px;}
    .gterm-section{margin-bottom:40px;}
    .gterm-section-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border);}
    .gterm-related-links{display:flex;gap:8px;flex-wrap:wrap;}
    .gterm-related-link{font-size:13px;color:var(--text-secondary);border:1px solid var(--border);padding:6px 14px;border-radius:6px;text-decoration:none;transition:border-color 0.2s,color 0.2s;}
    .gterm-related-link:hover{border-color:var(--accent);color:var(--accent);}
    .gterm-article{display:flex;flex-direction:column;padding:14px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:all 0.2s;}
    .gterm-article:hover{padding-left:8px;}
    .gterm-article-title{font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;}
    .gterm-article-meta{font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);}
    .gterm-faq{margin-top:40px;padding-top:32px;border-top:1px solid var(--border);}
    .gfaq-item{margin-bottom:24px;}
    .gfaq-q{font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px;}
    .gfaq-a{font-size:14px;color:var(--text-secondary);line-height:1.7;}
    .gterm-all{margin-top:40px;}
    @media(max-width:768px){.gterm-title{font-size:24px;}.gterm-definition{font-size:15px;}}
  </style>
  ${faqJsonLd(entry.faqs || [])}
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"DefinedTerm","name":entry.term,"description":entry.definition,"url":"https://whatstrending.ai/glossary/"+entry.slug,"inDefinedTermSet":{"@type":"DefinedTermSet","name":"AI Glossary","url":"https://whatstrending.ai/glossary"}})}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Glossary', url: 'https://whatstrending.ai/glossary' },
    { name: entry.short, url: 'https://whatstrending.ai/glossary/' + entry.slug }
  ])}
  ${renderNav('glossary')}
  <section class="gterm-hero"><div class="container" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/glossary" style="color:var(--text-tertiary);">Glossary</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${entry.short}</span>
    </nav>
    <div class="gterm-label">AI Glossary</div>
    <h1 class="gterm-title">What is ${entry.short}?</h1>
  </div></section>
  <div class="container" style="position:relative;z-index:1;">
    <div class="gterm-definition">${entry.definition}</div>
    ${relatedTerms ? `<div class="gterm-section">
      <div class="gterm-section-title">Related Terms</div>
      <div class="gterm-related-links">${relatedTerms}</div>
    </div>` : ''}
    ${relatedArticleCards ? `<div class="gterm-section">
      <div class="gterm-section-title">Related Articles</div>
      ${relatedArticleCards}
    </div>` : ''}
    ${(entry.faqs && entry.faqs.length > 0) ? `<div class="gterm-faq">
      <div class="gterm-section-title">Frequently Asked Questions</div>
      ${entry.faqs.map(f => `<div class="gfaq-item"><h2 class="gfaq-q">${f.q}</h2><p class="gfaq-a">${f.a}</p></div>`).join('')}
    </div>` : ''}
    <div class="gterm-all">
      <div class="gterm-section-title">All Glossary Terms</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${allTermLinks}</div>
    </div>
  </div>
  ${renderFooter()}
  </body></html>`;
}

function renderVerifyPage(article) {
  const claim = article.title;
  const title = claim + ' - Fact Check | WhatsTrending.ai';
  const description = 'Is "' + claim.slice(0, 100) + '" true? Read our AI-powered fact check and verification analysis.';
  const dateStr = article.date ? new Date(article.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const summaryParagraphs = (article.summary || article.description || '').split('\\n').filter(function(p) { return p.trim(); });

  return `${renderPageHead(title, description, '/verify/' + article.slug, { ogType: 'article' })}
  <style>
    .verify-layout{max-width:720px;margin:0 auto;padding:40px 24px 80px;}
    .verify-badge{display:inline-flex;align-items:center;gap:6px;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase;color:#60a5fa;background:rgba(96,165,250,0.1);padding:6px 12px;border-radius:6px;margin-bottom:20px;}
    .verify-title{font-size:28px;font-weight:700;letter-spacing:-0.5px;line-height:1.3;margin-bottom:16px;color:var(--text-primary);}
    .verify-meta{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:32px;}
    .verify-body{font-size:16px;color:var(--text-secondary);line-height:1.8;margin-bottom:32px;}
    .verify-body p{margin-bottom:16px;}
    .verify-source{display:inline-block;padding:10px 20px;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--accent);font-family:'JetBrains Mono',monospace;transition:border-color 0.2s;margin-bottom:16px;}
    .verify-source:hover{border-color:var(--accent);}
    .verify-claim-box{border:1px solid var(--border);border-radius:var(--radius);padding:20px;margin-bottom:32px;background:rgba(255,255,255,0.02);}
    .verify-claim-label{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:8px;}
    .verify-claim-text{font-size:17px;font-weight:600;color:var(--text-primary);line-height:1.5;}
    @media(max-width:768px){.verify-title{font-size:22px;}}
  </style>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ClaimReview",
    "datePublished": article.date || new Date().toISOString(),
    "url": "https://whatstrending.ai/verify/" + article.slug,
    "claimReviewed": claim,
    "author": { "@type": "Organization", "name": "whatstrending.ai", "url": "https://whatstrending.ai" },
    "itemReviewed": {
      "@type": "Claim",
      "author": { "@type": "Organization", "name": article.source || "Unknown" },
      "datePublished": article.date || new Date().toISOString(),
      "name": claim
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": "3",
      "bestRating": "5",
      "worstRating": "1",
      "alternateName": "Under Review"
    }
  })}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Fact Check', url: 'https://whatstrending.ai/verify/' + article.slug },
    { name: claim.slice(0, 60), url: 'https://whatstrending.ai/verify/' + article.slug }
  ])}
  ${renderNav('news')}
  <div class="verify-layout" style="position:relative;z-index:1;">
    <div class="verify-badge">Fact Check</div>
    <h1 class="verify-title">${claim}</h1>
    <div class="verify-meta">${article.source || ''} &middot; ${dateStr} &middot; Category: ${article.category || 'Industry'}</div>
    <div class="verify-claim-box">
      <div class="verify-claim-label">Claim</div>
      <div class="verify-claim-text">${claim}</div>
    </div>
    <div class="verify-body">
      ${summaryParagraphs.map(function(p) { return '<p>' + p.trim() + '</p>'; }).join('')}
    </div>
    ${article.link ? '<a href="' + article.link + '" target="_blank" rel="noopener" class="verify-source">View Original Source &rarr;</a>' : ''}
    <a href="/news/${article.slug}" class="verify-source" style="margin-left:8px;">Read Full Article &rarr;</a>
    <br><br>
    <a href="/news" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);">&larr; Back to News</a>
    ${renderTrendingTopicLinks()}
  </div>
  ${renderFooter()}
  </body></html>`;
}

function renderDigestPage(dateStr, articles) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const readableDate = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const title = 'AI & Tech News Digest - ' + readableDate + ' | WhatsTrending.ai';
  const description = 'Complete digest of AI and tech news from ' + readableDate + '. ' + articles.length + ' stories covering models, tools, research, and industry developments.';

  // Get prev/next dates
  const prevDate = new Date(d);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const nextDate = new Date(d);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const prevStr = prevDate.toISOString().split('T')[0];
  const nextStr = nextDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  // Group by category
  const grouped = {};
  articles.forEach(function(a) {
    const cat = a.category || 'Industry';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  return `${renderPageHead(title, description, '/digest/' + dateStr, { ogType: 'article' })}
  <style>
    .digest-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
    .digest-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
    .digest-sub{font-size:15px;color:var(--text-secondary);line-height:1.7;}
    .digest-nav{display:flex;gap:16px;margin-top:20px;font-family:'JetBrains Mono',monospace;font-size:13px;}
    .digest-nav a{color:var(--accent);transition:color 0.2s;}
    .digest-nav a:hover{color:var(--accent-hover);}
    .digest-nav span{color:var(--text-tertiary);}
    .digest-section{margin-bottom:40px;}
    .digest-cat{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border);}
    .digest-item{display:block;padding:14px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:all 0.2s;}
    .digest-item:hover{padding-left:8px;}
    .di-title{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:3px;}
    .di-summary{font-size:13px;color:var(--text-secondary);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.6;}
    .di-meta{font-size:11px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;margin-top:4px;}
    .digest-empty{color:var(--text-tertiary);font-size:14px;padding:24px 0;}
    .digest-stats{display:flex;gap:24px;margin-top:16px;}
    .digest-stat{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);}
    .digest-stat strong{color:var(--accent);}
    @media(max-width:768px){.digest-title{font-size:24px;}}
  </style>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": "https://whatstrending.ai/digest/" + dateStr,
    "datePublished": dateStr + "T00:00:00Z",
    "publisher": { "@type": "Organization", "name": "whatstrending.ai", "url": "https://whatstrending.ai" }
  })}</script>
  </head><body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Digest', url: 'https://whatstrending.ai/digest/' + dateStr },
    { name: readableDate, url: 'https://whatstrending.ai/digest/' + dateStr }
  ])}
  ${renderNav('news')}
  <section class="digest-hero"><div class="container" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;">
      <a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">Digest</span>
    </nav>
    <h1 class="digest-title">AI & Tech News Digest</h1>
    <p class="digest-sub">${readableDate}</p>
    <div class="digest-stats">
      <span class="digest-stat"><strong>${articles.length}</strong> articles</span>
      <span class="digest-stat"><strong>${Object.keys(grouped).length}</strong> categories</span>
    </div>
    <div class="digest-nav">
      <a href="/digest/${prevStr}">&larr; Previous Day</a>
      <span>|</span>
      ${nextStr <= todayStr ? '<a href="/digest/' + nextStr + '">Next Day &rarr;</a>' : '<span style="opacity:0.3;">Next Day &rarr;</span>'}
    </div>
  </div></section>
  <div class="container" style="position:relative;z-index:1;">
    ${articles.length > 0 ? Object.keys(grouped).map(function(cat) {
      return '<div class="digest-section"><div class="digest-cat">' + cat + ' (' + grouped[cat].length + ')</div>' +
        grouped[cat].map(function(a) {
          return '<a href="/news/' + a.slug + '" class="digest-item"><div class="di-title">' + a.title + '</div><div class="di-summary">' + (a.summary || a.description || '').split('\\n')[0].slice(0, 200) + '</div><div class="di-meta">' + (a.source || '') + ' &middot; ' + formatShortDate(a.date) + '</div></a>';
        }).join('') +
        '</div>';
    }).join('') : '<div class="digest-empty">No articles found for ' + readableDate + '. Try checking a more recent date.</div>'}
    ${renderTrendingTopicLinks()}
  </div>
  ${renderFooter()}
  </body></html>`;
}

// ---------------------------------------------------------------------------
// Shared CSS (base styles used across all pages)
// ---------------------------------------------------------------------------

function baseCSS() {
  return `
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0A0A0A; --surface: #0A0A0A; --border: rgba(255,255,255,0.07);
      --border-hover: rgba(16,185,129,0.25); --text-primary: #EDEDED;
      --text-secondary: #888888; --text-tertiary: #555555;
      --accent: #34d399; --accent-hover: #6ee7b7; --radius: 12px; --transition: 0.2s ease;
    }
    html { font-size: 15px; -webkit-font-smoothing: antialiased; }
    body { font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: var(--bg); color: var(--text-primary); line-height: 1.7; min-height: 100vh; }
    a { color: inherit; text-decoration: none; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(10,10,10,0.6); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
    .nav-left { display: flex; align-items: center; gap: 28px; }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-mark { width: 24px; height: 24px; }
    .logo-mark svg { width: 24px; height: 24px; }
    .logo-text { font-weight: 600; font-size: 15px; color: var(--text-primary); letter-spacing: -0.4px; }
    .logo-text span { color: var(--text-tertiary); }
    .nav-divider { width: 1px; height: 20px; background: var(--border); }
    .nav-links { display: flex; align-items: center; gap: 6px; list-style: none; }
    .nav-links a { font-size: 13px; color: var(--text-secondary); transition: all var(--transition); font-weight: 400; padding: 6px 12px; border-radius: 6px; }
    .nav-links a:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
    .nav-links a.active { color: var(--text-primary); }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-btn-ghost { font-size: 13px; font-weight: 400; color: var(--text-primary); background: none; border: 1px solid var(--border); padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-btn-ghost:hover { color: var(--text-primary); border-color: var(--border-hover); background: rgba(255,255,255,0.04); }
    .nav-cta { font-size: 13px; font-weight: 500; color: white; background: var(--accent); border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-cta:hover { background: var(--accent-hover); }
    .nav-hamburger { display: none; align-items: center; justify-content: center; width: 32px; height: 32px; background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0; flex-direction: column; gap: 5px; }
    .nav-hamburger span { display: block; width: 18px; height: 1.5px; background: var(--text-secondary); border-radius: 1px; transition: all 0.3s ease; }
    .nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
    .nav-hamburger.open span:nth-child(2) { opacity: 0; }
    .nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }
    .nav-mobile-menu { display: none; position: fixed; top: 57px; left: 0; right: 0; background: rgba(10,10,10,0.97); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-bottom: 1px solid var(--border); flex-direction: column; padding: 8px 24px; z-index: 99; }
    .nav-mobile-menu a { display: block; padding: 14px 0; font-size: 14px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.04); }
    .nav-mobile-menu a:last-child { border-bottom: none; }
    .nav-mobile-menu a:hover { color: var(--text-primary); }
    .footer { border-top: 1px solid var(--border); padding: 48px 0; position: relative; }
    .footer::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(110,231,183,0.2), transparent); }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; }
    .footer-left { font-size: 13px; color: var(--text-tertiary); }
    .footer-left span { color: var(--text-secondary); font-weight: 500; }
    .footer-links { display: flex; gap: 20px; list-style: none; }
    .footer-links a { font-size: 13px; color: var(--text-tertiary); transition: color var(--transition); }
    .footer-links a:hover { color: var(--text-secondary); }
    .category-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; display: inline-block; }
    .page-hero { padding: 56px 0 40px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
    .page-hero-title { font-size: 32px; font-weight: 700; letter-spacing: -1px; color: var(--text-primary); margin-bottom: 8px; }
    .page-hero-sub { font-size: 15px; color: var(--text-secondary); }
    @media (max-width: 768px) {
      .page-hero-title { font-size: 24px; }
      .nav-divider { display: none; }
      .nav-links { display: none; }
      .nav-btn-ghost { display: none; }
      .nav-cta { display: none; }
      .nav-hamburger { display: flex; }
      .nav-mobile-menu.open { display: flex; }
      .logo-text { font-size: 13px; }
      .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
    }`;
}

// ---------------------------------------------------------------------------
// NEWS PAGE
// ---------------------------------------------------------------------------

function renderNewsPage(articles, currentPage, totalPages, totalArticles) {
  currentPage = currentPage || 1;
  totalPages = totalPages || 1;
  totalArticles = totalArticles || articles.length;
  const catColors = {
    'Models': { color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
    'Tools': { color: '#38bdf8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.25)' },
    'Research': { color: '#f472b6', bg: 'rgba(244,114,182,0.1)', border: 'rgba(244,114,182,0.25)' },
    'Industry': { color: '#fb923c', bg: 'rgba(251,146,60,0.1)', border: 'rgba(251,146,60,0.25)' },
    'Startups': { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
    'Regulation': { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
    'Open Source': { color: '#34d399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.25)' },
  };
  const defaultCat = { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' };

  const categories = ['All', ...new Set(articles.map(a => a.category || 'Industry').filter(Boolean))];
  const catPills = categories.map(c => {
    const cc = catColors[c] || defaultCat;
    const active = c === 'All' ? ' active' : '';
    return `<button class="cat-pill${active}" data-color="${cc.color}" onclick="filterNews('${c}', this)">${c}</button>`;
  }).join('');

  const featured = articles[0];
  const rest = articles.slice(1);

  const fc = catColors[featured?.category] || defaultCat;
  const featuredCard = featured ? `
    <a href="/news/${featured.slug}" class="nfeatured" style="border-left: 3px solid ${fc.color};">
      <span class="ncard-cat" style="color:${fc.color};border-color:${fc.border};background:${fc.bg};">${featured.category || 'Industry'}</span>
      <h2 class="nfeatured-title">${featured.title}</h2>
      <p class="nfeatured-preview">${(featured.summary || '').split('\\n')[0].slice(0, 280)}</p>
      <div class="ncard-meta"><span class="ncard-source">${featured.source}</span><span class="ncard-date">${featured.date ? new Date(featured.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span></div>
    </a>` : '';

  const articleCards = rest.map(a => {
    const cc = catColors[a.category] || defaultCat;
    const preview = (a.summary || '').split('\\n')[0].slice(0, 140);
    const dateStr = a.date ? new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    return `
    <a href="/news/${a.slug}" class="ncard" data-cat="${a.category || 'Industry'}">
      <div class="ncard-top">
        <span class="ncard-cat" style="color:${cc.color};border-color:${cc.border};background:${cc.bg};">${a.category || 'Industry'}</span>
        <span class="ncard-date">${dateStr}</span>
      </div>
      <h3 class="ncard-title">${a.title}</h3>
      <p class="ncard-preview">${preview}</p>
      <div class="ncard-meta">
        <span class="ncard-source">${a.source}</span>
      </div>
    </a>`;
  }).join('');

  const pageTitle = currentPage > 1
    ? `AI News 2026 - Page ${currentPage} | whatstrending.ai`
    : 'AI News 2026 - Latest AI Headlines & Summaries | whatstrending.ai';
  const canonicalPath = currentPage > 1 ? `/news?page=${currentPage}` : '/news';
  const prevPage = currentPage > 1 ? (currentPage === 2 ? '/news' : `/news?page=${currentPage - 1}`) : null;
  const nextPage = currentPage < totalPages ? `/news?page=${currentPage + 1}` : null;

  return `${renderPageHead(
    pageTitle,
    'Latest AI news in 2026 from TechCrunch, The Verge, Wired, and 20+ sources. AI-curated summaries updated every 6 hours. GPT-5, Claude, Gemini, and more.',
    canonicalPath,
    { noindex: currentPage > 1, prevPage, nextPage }
  )}
  <style>
    .cat-bar { display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
    .cat-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; padding: 6px 14px; border-radius: 20px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; }
    .cat-pill:hover { border-color: rgba(255,255,255,0.3); color: var(--text-primary); }
    .cat-pill.active { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.3); color: #fff; }
    .nfeatured { display: block; padding: 32px; margin-bottom: 32px; border-radius: 12px; background: rgba(255,255,255,0.02); text-decoration: none; color: inherit; transition: background 0.4s ease, box-shadow 0.4s ease, transform 0.3s ease; position: relative; overflow: hidden; }
    .nfeatured::after { content: ''; position: absolute; inset: 0; border-radius: 12px; opacity: 0; transition: opacity 0.4s ease; background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(255,255,255,0.04), transparent 40%); pointer-events: none; }
    .nfeatured:hover { background: rgba(255,255,255,0.03); box-shadow: 0 8px 32px rgba(0,0,0,0.2); transform: translateY(-2px); }
    .nfeatured:hover::after { opacity: 1; }
    .nfeatured-title { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.3; color: var(--text-primary); margin: 12px 0; }
    .nfeatured-preview { font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px; }
    .news-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; padding-bottom: 80px; }
    .ncard { display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 22px; text-decoration: none; color: inherit; transition: border-color 0.2s, transform 0.15s; }
    .ncard:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-1px); }
    .ncard-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .ncard-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; padding: 3px 8px; border: 1px solid; border-radius: 4px; }
    .ncard-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); }
    .ncard-title { font-size: 15px; font-weight: 600; line-height: 1.4; color: var(--text-primary); margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .ncard-preview { font-size: 13px; color: rgba(255,255,255,0.4); line-height: 1.55; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 14px; }
    .ncard-meta { display: flex; align-items: center; justify-content: space-between; }
    .ncard-source { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); }
    .empty-state { text-align: center; padding: 80px 24px; color: var(--text-tertiary); grid-column: 1 / -1; }
    .empty-state h3 { font-size: 20px; color: var(--text-secondary); margin-bottom: 8px; }
    @media (max-width: 768px) { .news-grid { grid-template-columns: 1fr; } .nfeatured-title { font-size: 20px; } }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI News","description":"Latest AI news with AI-generated summaries, updated every 6 hours","url":"https://whatstrending.ai/news","publisher":{"@type":"Organization","name":"whatstrending.ai"}})}</script>
</head>
<body>
  ${renderNav('news')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">AI News 2026</h1>
      <p class="page-hero-sub">AI-curated summaries from 20+ top tech sources. Updated every 6 hours.</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <div class="cat-bar">${catPills}</div>
    ${articles.length > 0 ? featuredCard : ''}
    <div class="news-grid">
      ${articles.length > 1 ? articleCards : articles.length === 0 ? `
      <div class="empty-state">
        <h3>News feed initializing</h3>
        <p>Articles will appear here after the next scheduled fetch. Check back soon.</p>
      </div>` : ''}
    </div>
  </section>

  <script>
    const feat = document.querySelector('.nfeatured');
    if (feat) {
      feat.addEventListener('mousemove', e => {
        const r = feat.getBoundingClientRect();
        feat.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        feat.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    }
    function filterNews(cat, el) {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      el.classList.add('active');
      document.querySelectorAll('.ncard').forEach(c => {
        c.style.display = (cat === 'All' || c.dataset.cat === cat) ? '' : 'none';
      });
      const feat = document.querySelector('.nfeatured');
      if (feat) feat.style.display = (cat === 'All') ? '' : 'none';
    }
  </script>

  ${totalPages > 1 ? `
  <div style="display:flex;justify-content:center;align-items:center;gap:12px;padding:32px 0;">
    ${currentPage > 1 ? `<a href="/news?page=${currentPage - 1}" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-secondary);text-decoration:none;">&larr; Prev</a>` : ''}
    <span style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);">Page ${currentPage} of ${totalPages} (${totalArticles} articles)</span>
    ${currentPage < totalPages ? `<a href="/news?page=${currentPage + 1}" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-secondary);text-decoration:none;">Next &rarr;</a>` : ''}
  </div>` : ''}

  ${renderFooter()}
</body>
</html>`;
}

function renderNewsArticlePage(article, relatedArticles) {
  const dateStr = article.date ? new Date(article.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const related = relatedArticles || [];
  return `${renderPageHead(
    article.title + ' — whatstrending.ai',
    (article.summary || article.description || "").split('\n')[0].slice(0, 200),
    '/news/' + article.slug,
    { ogType: 'article', publishedTime: article.date || '', ogImage: 'https://whatstrending.ai/og?slug=' + encodeURIComponent(article.slug) }
  )}
  <style>
    .article-layout { display: grid; grid-template-columns: 1fr 300px; gap: 48px; padding-top: 40px; padding-bottom: 80px; }
    .article-source { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; color: var(--accent); margin-bottom: 16px; }
    .article-title { font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 1.25; margin-bottom: 16px; color: var(--text-primary); }
    .article-date { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-tertiary); margin-bottom: 32px; }
    .article-body { font-size: 17px; color: var(--text-primary); line-height: 1.75; margin-bottom: 32px; padding-bottom: 32px; border-bottom: 1px solid var(--border); }
    .article-body p { margin-bottom: 16px; }
    .article-body p:last-child { margin-bottom: 0; }
    .article-original { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); margin-bottom: 24px; }
    .article-cta { display: inline-block; padding: 12px 24px; background: var(--accent); color: white; font-weight: 600; border-radius: 8px; transition: background var(--transition); }
    .article-cta:hover { background: var(--accent-hover); }
    .back-link { display: inline-block; margin-top: 32px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--accent); }
    .back-link:hover { color: var(--accent-hover); }
    .article-sidebar { position: sticky; top: 80px; align-self: start; }
    .sidebar-box { border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; }
    .sidebar-box-title { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 16px; }
    .related-item { display: block; padding: 10px 0; border-bottom: 1px solid var(--border); text-decoration: none; color: inherit; }
    .related-item:last-child { border-bottom: none; }
    .related-item:hover .ri-title { color: var(--accent); }
    .ri-title { font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.4; transition: color var(--transition); }
    .ri-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-tertiary); margin-top: 4px; }
    @media (max-width: 768px) { .article-layout { grid-template-columns: 1fr; } .article-title { font-size: 24px; } }
  </style>
</head>
<body>
  ${articleJsonLd(article)}
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'News', url: 'https://whatstrending.ai/news' },
    { name: article.title, url: 'https://whatstrending.ai/news/' + article.slug }
  ])}
  ${renderNav('news')}

  <div class="container article-layout" style="position:relative;z-index:1;">
    <main>
      <div class="article-source">${article.source} · ${article.category || 'Industry'}</div>
      <h1 class="article-title">${article.title}</h1>
      <div class="article-date">${dateStr}</div>
      ${article.originalTitle && article.originalTitle !== article.title ? `<div class="article-original">Originally: ${article.originalTitle}</div>` : ''}
      <div class="article-body">${(article.summary || article.description || "").split('\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('')}</div>
      <a href="${article.link}" target="_blank" rel="noopener" class="article-cta">Read Original Source</a>
      <br>
      <a href="/news" class="back-link">&larr; Back to AI News</a>
    </main>
    <aside class="article-sidebar">
      ${related.length > 0 ? `
      <div class="sidebar-box">
        <div class="sidebar-box-title">Related Articles</div>
        ${related.map(r => `
        <a href="/news/${r.slug}" class="related-item">
          <div class="ri-title">${r.title}</div>
          <div class="ri-meta">${r.source || ''} · ${formatShortDate(r.date)}</div>
        </a>`).join('')}
      </div>` : ''}
      <div class="sidebar-box">
        <div class="sidebar-box-title">Explore</div>
        ${article.relatedTool ? `<a href="${article.relatedTool}" style="display:block;padding:10px 0;border-bottom:1px solid var(--border);text-decoration:none;"><span style="font-size:13px;font-weight:600;color:var(--accent);">Related Guide &rarr;</span></a>` : ''}
        <a href="/models" style="display:block;padding:10px 0;border-bottom:1px solid var(--border);text-decoration:none;"><span style="font-size:13px;font-weight:500;color:var(--text-primary);">AI Model Rankings</span></a>
        <a href="/compare" style="display:block;padding:10px 0;border-bottom:1px solid var(--border);text-decoration:none;"><span style="font-size:13px;font-weight:500;color:var(--text-primary);">Compare AI Tools</span></a>
        <a href="/tools" style="display:block;padding:10px 0;text-decoration:none;"><span style="font-size:13px;font-weight:500;color:var(--text-primary);">AI Tools Directory</span></a>
      </div>
    </aside>
  </div>

  <script>
    // Track article view
    fetch('/api/track-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: '${article.slug}' })
    }).catch(function(){});
  </script>

  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// TOOLS PAGE
// ---------------------------------------------------------------------------

function renderToolsPage(tools, activeCategory) {
  const catTabs = ['all', ...TOOL_CATEGORIES].map(c => {
    const label = c === 'all' ? 'All' : c === 'devtools' ? 'Dev Tools' : c.charAt(0).toUpperCase() + c.slice(1);
    const active = (activeCategory || 'all') === c ? ' active' : '';
    return `<a href="/tools${c === 'all' ? '' : '?cat=' + c}" class="filter-pill${active}">${label}</a>`;
  }).join('\n      ');

  const toolCards = tools.map(t => {
    const slug = toolSlug(t.name);
    const pricingColor = t.pricing === 'free' ? '#00ffa3' : t.pricing === 'freemium' ? '#F59E0B' : '#EC4899';
    return `
    <a href="/tools/${slug}" class="tool-card">
      <div class="tool-card-header">
        <span class="tool-name">${t.name}</span>
        <span class="tool-pricing" style="color:${pricingColor}">${t.pricing}</span>
      </div>
      <p class="tool-tagline">${t.tagline}</p>
      <p class="tool-desc">${t.description}</p>
      <span class="tool-category">${t.category === 'devtools' ? 'Dev Tools' : t.category}</span>
    </a>`;
  }).join('');

  return `${renderPageHead(
    'Best AI Tools Directory 2026 - 50+ Tools Reviewed | whatstrending.ai',
    'Discover and compare 50+ AI tools for coding, writing, image generation, video, chat, and productivity in 2026. Pricing, features, and expert reviews.',
    '/tools'
  )}
  <style>
    .filter-pills { display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap; }
    .filter-pill { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; padding: 6px 16px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; transition: all var(--transition); text-decoration: none; }
    .filter-pill:hover { border-color: var(--border-hover); color: var(--text-primary); }
    .filter-pill.active { background: var(--accent); border-color: var(--accent); color: white; }
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 80px; }
    .tool-card { display: block; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 24px; transition: all 0.3s ease; text-decoration: none; color: inherit; }
    .tool-card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
    .tool-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .tool-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
    .tool-pricing { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .tool-tagline { font-size: 13px; color: var(--accent); margin-bottom: 8px; font-weight: 500; }
    .tool-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .tool-category { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-tertiary); }
    @media (max-width: 768px) { .tools-grid { grid-template-columns: 1fr; } }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI Tool Directory","description":"Discover the best AI tools for coding, writing, image generation, video, chat, and productivity","url":"https://whatstrending.ai/tools"})}</script>
</head>
<body>
  ${renderNav('tools')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">AI Tool Directory 2026</h1>
      <p class="page-hero-sub">Discover and compare 50+ AI tools across coding, writing, image, video, chat, and productivity</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <div class="filter-pills">
      ${catTabs}
    </div>
    <div class="tools-grid">
      ${toolCards}
    </div>

    <div style="margin-top:48px;padding-top:32px;border-top:1px solid var(--border);">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">AI Tool Guides</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;">
        <a href="/guide/best-ai-tools-for-coding" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Best AI Tools for Coding 2026</a>
        <a href="/guide/best-ai-tools-for-writing" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Best AI Tools for Writing 2026</a>
        <a href="/guide/best-ai-tools-for-image-generation" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Best AI Image Generators 2026</a>
        <a href="/guide/best-ai-tools-for-video" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Best AI Video Tools 2026</a>
        <a href="/guide/best-ai-tools-for-research" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Best AI Research Tools 2026</a>
        <a href="/compare" style="padding:14px 18px;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--text-secondary);transition:all 0.2s;">Compare AI Tools Side by Side</a>
      </div>
    </div>
  </section>

  ${renderFooter()}
</body>
</html>`;
}

function renderToolPage(tool) {
  const slug = toolSlug(tool.name);
  const pricingColor = tool.pricing === 'free' ? '#00ffa3' : tool.pricing === 'freemium' ? '#F59E0B' : '#EC4899';
  const catLabel = tool.category === 'devtools' ? 'Dev Tools' : tool.category.charAt(0).toUpperCase() + tool.category.slice(1);

  // Find comparisons involving this tool
  const toolComparisons = COMPARISONS.filter(function(c) {
    return c.a === tool.name || c.b === tool.name;
  }).slice(0, 6);

  // Find related tools in same category
  const relatedTools = AI_TOOLS_SEED.filter(function(t) {
    return t.category === tool.category && t.name !== tool.name;
  }).slice(0, 4);

  return `${renderPageHead(
    tool.name + ' Review 2026: Features, Pricing & Alternatives | whatstrending.ai',
    tool.name + ' review in 2026. ' + tool.description.slice(0, 120) + ' Compare pricing, features, and alternatives.',
    '/tools/' + slug
  )}
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": tool.name,
    "description": tool.description,
    "url": tool.url,
    "applicationCategory": tool.category === 'coding' ? 'DeveloperApplication' : tool.category === 'writing' ? 'BusinessApplication' : tool.category === 'image' ? 'MultimediaApplication' : tool.category === 'video' ? 'MultimediaApplication' : 'WebApplication',
    "offers": { "@type": "Offer", "price": tool.pricing === 'free' ? '0' : '', "priceCurrency": "USD", "availability": "https://schema.org/OnlineOnly" },
    "operatingSystem": "Web"
  })}</script>
  <style>
    .tool-detail { max-width: 720px; padding-top: 40px; padding-bottom: 80px; }
    .tool-detail-name { font-size: 32px; font-weight: 700; letter-spacing: -1px; color: var(--text-primary); margin-bottom: 8px; }
    .tool-detail-tagline { font-size: 17px; color: var(--accent); margin-bottom: 24px; font-weight: 500; }
    .tool-detail-meta { display: flex; gap: 24px; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
    .tool-meta-item { display: flex; flex-direction: column; gap: 4px; }
    .tool-meta-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-tertiary); }
    .tool-meta-value { font-size: 14px; color: var(--text-primary); font-weight: 500; }
    .tool-detail-desc { font-size: 16px; color: var(--text-secondary); line-height: 1.8; margin-bottom: 32px; }
    .tool-detail-cta { display: inline-block; padding: 12px 24px; background: var(--accent); color: white; font-weight: 600; border-radius: 8px; transition: background var(--transition); }
    .tool-detail-cta:hover { background: var(--accent-hover); }
    .back-link { display: inline-block; margin-top: 24px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--accent); }
    .back-link:hover { color: var(--accent-hover); }
    @media (max-width: 768px) { .tool-detail-name { font-size: 24px; } .tool-detail-meta { flex-direction: column; gap: 12px; } }
  </style>
</head>
<body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Tools', url: 'https://whatstrending.ai/tools' },
    { name: tool.name, url: 'https://whatstrending.ai/tools/' + slug }
  ])}
  ${renderNav('tools')}

  <section class="container tool-detail" style="position:relative;z-index:1;">
    <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);transition:color 0.2s;">Home</a><span style="opacity:0.5;">/</span><a href="/tools" style="color:var(--text-tertiary);transition:color 0.2s;">Tools</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${tool.name}</span></nav>
    <h1 class="tool-detail-name">${tool.name}</h1>
    <p class="tool-detail-tagline">${tool.tagline}</p>
    <div class="tool-detail-meta">
      <div class="tool-meta-item">
        <span class="tool-meta-label">Category</span>
        <span class="tool-meta-value">${catLabel}</span>
      </div>
      <div class="tool-meta-item">
        <span class="tool-meta-label">Pricing</span>
        <span class="tool-meta-value" style="color:${pricingColor}">${tool.pricing}</span>
      </div>
    </div>
    <p class="tool-detail-desc">${tool.description}</p>
    <a href="${tool.url}" target="_blank" rel="noopener" class="tool-detail-cta">Visit ${tool.name}</a>

    ${TOOL_EXTRAS[tool.name] ? `
    <div style="margin-top:40px;padding-top:32px;border-top:1px solid var(--border);">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
        <div>
          <h2 style="font-size:16px;font-weight:600;color:var(--accent);margin-bottom:12px;">Pros</h2>
          <ul style="list-style:none;padding:0;">${TOOL_EXTRAS[tool.name].pros.map(function(p) { return '<li style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;color:var(--text-secondary);display:flex;align-items:flex-start;gap:8px;"><span style="color:var(--accent);font-weight:700;">+</span> ' + p + '</li>'; }).join('')}</ul>
        </div>
        <div>
          <h2 style="font-size:16px;font-weight:600;color:#EC4899;margin-bottom:12px;">Cons</h2>
          <ul style="list-style:none;padding:0;">${TOOL_EXTRAS[tool.name].cons.map(function(c) { return '<li style="padding:8px 0;border-bottom:1px solid var(--border);font-size:14px;color:var(--text-secondary);display:flex;align-items:flex-start;gap:8px;"><span style="color:#EC4899;font-weight:700;">-</span> ' + c + '</li>'; }).join('')}</ul>
        </div>
      </div>
      <h2 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Best For</h2>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:32px;">${TOOL_EXTRAS[tool.name].useCases.map(function(u) { return '<span style="padding:6px 14px;border:1px solid var(--border);border-radius:20px;font-size:13px;color:var(--text-secondary);">' + u + '</span>'; }).join('')}</div>
      ${TOOL_EXTRAS[tool.name].faq ? `
      <h2 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">FAQ</h2>
      ${TOOL_EXTRAS[tool.name].faq.map(function(f) { return '<details style="margin-bottom:8px;padding:14px;border:1px solid var(--border);border-radius:8px;"><summary style="font-size:14px;font-weight:600;color:var(--text-primary);cursor:pointer;">' + f.q + '</summary><p style="margin-top:10px;font-size:14px;color:var(--text-secondary);line-height:1.7;">' + f.a + '</p></details>'; }).join('')}
      <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":TOOL_EXTRAS[tool.name].faq.map(function(f){return{"@type":"Question","name":f.q,"acceptedAnswer":{"@type":"Answer","text":f.a}}})})}</script>` : ''}
    </div>` : ''}

    ${toolComparisons.length > 0 ? `
    <div style="margin-top:40px;padding-top:32px;border-top:1px solid var(--border);">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">${tool.name} Comparisons</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${toolComparisons.map(function(c) { return '<a href="/compare/' + c.slug + '" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--text-secondary);transition:all 0.2s;">' + c.a + ' vs ' + c.b + '</a>'; }).join('')}
      </div>
    </div>` : ''}

    ${relatedTools.length > 0 ? `
    <div style="margin-top:32px;padding-top:24px;border-top:1px solid var(--border);">
      <h2 style="font-size:18px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">Similar ${catLabel} Tools</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">
        ${relatedTools.map(function(t) { return '<a href="/tools/' + toolSlug(t.name) + '" style="display:block;padding:14px;border:1px solid var(--border);border-radius:8px;transition:border-color 0.2s;"><div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">' + t.name + '</div><div style="font-size:12px;color:var(--text-tertiary);">' + t.tagline + '</div></a>'; }).join('')}
      </div>
    </div>` : ''}

    <br>
    <a href="/tools" class="back-link">&larr; Back to Tools Directory</a>
  </section>

  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// CATEGORY PAGE
// ---------------------------------------------------------------------------

function renderCategoryPage(category, tools) {
  const catLabel = category === 'devtools' ? 'Dev Tools' : category === 'open-source' ? 'Open Source' : category.charAt(0).toUpperCase() + category.slice(1);
  const toolCards = tools.map(t => {
    const slug = toolSlug(t.name);
    const pricingColor = t.pricing === 'free' ? '#00ffa3' : t.pricing === 'freemium' ? '#F59E0B' : '#EC4899';
    return `
    <a href="/tools/${slug}" class="tool-card">
      <div class="tool-card-header">
        <span class="tool-name">${t.name}</span>
        <span class="tool-pricing" style="color:${pricingColor}">${t.pricing}</span>
      </div>
      <p class="tool-tagline">${t.tagline}</p>
      <p class="tool-desc">${t.description}</p>
    </a>`;
  }).join('');

  const seoTitles = {
    coding: 'Best AI Coding Tools 2026 — Free & Paid Compared',
    writing: 'Best AI Writing Tools 2026 — Free & Paid Compared',
    image: 'Best AI Image Generators 2026 — Free & Paid Compared',
    video: 'Best AI Video Tools 2026 — Free & Paid Compared',
    chat: 'Best AI Chatbots & Assistants 2026 — Free & Paid Compared',
    productivity: 'Best AI Productivity Tools 2026 — Free & Paid Compared',
    search: 'Best AI Search Engines 2026 — Free & Paid Compared',
    devtools: 'Best AI Developer Tools 2026 — Free & Paid Compared',
    'open-source': 'Best Open Source AI Tools 2026 — GitHub Projects & Libraries',
  };
  const seoTitle = seoTitles[category] || (catLabel + ' AI Tools 2026 — whatstrending.ai');
  return `${renderPageHead(
    seoTitle + ' | whatstrending.ai',
    'Best AI tools in the ' + catLabel + ' category. Compare pricing, features, and capabilities.',
    '/category/' + category
  )}
  <style>
    .tools-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding-bottom: 80px; }
    .tool-card { display: block; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 24px; transition: all 0.3s ease; text-decoration: none; color: inherit; }
    .tool-card:hover { border-color: rgba(255,255,255,0.2); transform: translateY(-2px); }
    .tool-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .tool-name { font-size: 16px; font-weight: 600; color: var(--text-primary); }
    .tool-pricing { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
    .tool-tagline { font-size: 13px; color: var(--accent); margin-bottom: 8px; font-weight: 500; }
    .tool-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .back-link { display: inline-block; margin-bottom: 24px; font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--accent); }
    .back-link:hover { color: var(--accent-hover); }
    @media (max-width: 768px) { .tools-grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  ${renderNav('tools')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">${catLabel} AI Tools</h1>
      <p class="page-hero-sub">Best AI tools in the ${catLabel.toLowerCase()} category</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <a href="/tools" class="back-link">&larr; All Tools</a>
    <div class="tools-grid">
      ${toolCards}
    </div>
  </section>

  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// COMPARISON PAGE
// ---------------------------------------------------------------------------

const COMPARE_CONTENT = {
  'chatgpt-vs-claude': {verdict:'Claude for coding and deep analysis. ChatGPT for ecosystem breadth and multimodal tasks.',pros_a:['Massive plugin ecosystem and GPT Store','Native image generation with DALL-E','GPT-5.4 supports up to 1M context via API','Web browsing and real-time data access'],pros_b:['1M token context window (Opus 4.6/4.7)','Industry-leading agentic coding (Claude Code, SWE-bench 80.8%)','128K max output tokens','Adaptive thinking with effort controls'],best_a:'Best for: plugins, image generation, multimodal tasks, casual chat',best_b:'Best for: professional coding, long document analysis, agentic workflows',details:`<h3>Overview</h3><p>ChatGPT (by OpenAI) and Claude (by Anthropic) are the two most widely used AI assistants in 2026. OpenAI's latest is GPT-5.4, while Anthropic offers Claude Opus 4.7 (released April 2026). Both now support 1M token context windows via their APIs, but they serve fundamentally different user needs.</p><h3>Context Window</h3><p>Both models now support 1M token context windows at the API level. Claude Opus 4.6 scores 76% on the MRCR v2 benchmark (8-needle, 1M context), compared to Sonnet 4.5's 18.5% — demonstrating that Claude actually uses its full context effectively. GPT-5.4 also supports 1M context in the API, though ChatGPT's consumer product exposes smaller windows (196K-256K depending on tier and mode).</p><h3>Coding Capabilities</h3><p>Claude leads in agentic coding. Claude Opus 4.6 achieved 80.8% on SWE-bench Verified and 65.4% on Terminal-Bench 2.0. Claude Code, Anthropic's CLI, can autonomously navigate repositories, write tests, and implement multi-file features. OpenAI's Codex CLI and GPT-5.2-Codex are competitive (80.0% SWE-bench), but Claude Code's ecosystem with MCP integrations, worktrees, and agent teams gives it the edge for professional developers.</p><h3>Writing Quality</h3><p>Claude consistently produces more nuanced, well-structured writing. It follows complex instructions more precisely and avoids the generic, overly enthusiastic tone ChatGPT sometimes defaults to. ChatGPT is better at casual conversation and creative brainstorming.</p><h3>Ecosystem & Integrations</h3><p>ChatGPT wins on consumer ecosystem. The GPT Store, DALL-E integration, browsing, and MCP support make it the most versatile consumer AI. Claude's ecosystem is more developer-focused — MCP, tool use, computer use, and Claude Code — but increasingly powerful for technical workflows.</p><h3>Pricing (May 2026)</h3><p>Both offer free tiers. ChatGPT Plus is $20/month; Claude Pro is $20/month. API pricing: Claude Opus at $5/$25 per MTok (input/output), GPT-5 Chat at $1.25/$10 per MTok. Claude costs more per token but offers larger max output (128K vs 16K for GPT-5 Chat).</p><h3>Bottom Line</h3><p>Choose ChatGPT for an all-in-one assistant with browsing, image generation, and plugins. Choose Claude for professional coding, long document analysis, and agentic workflows. Many power users maintain both.</p>`},
  'cursor-vs-copilot': {verdict:'Cursor for AI-native coding. Copilot for seamless GitHub integration.',pros_a:['Full IDE with AI built into every feature','Multi-file editing and codebase-wide awareness','Supports Claude, GPT, Gemini, and custom models','Cloud agents run parallel tasks on isolated VMs'],pros_b:['Native GitHub integration with cloud agent','Free tier with 2000 completions/month','Copilot Pro at $10/month (half the price of Cursor Pro)','Access to Claude Opus 4.7 and GPT-5.5 on Pro+'],best_a:'Best for: AI-first developers who want maximum AI assistance and model flexibility',best_b:'Best for: developers in the GitHub ecosystem who want solid AI at lower cost',details:`<h3>Overview</h3><p>Cursor and GitHub Copilot are the two dominant AI coding tools in 2026. Cursor is a standalone AI-native IDE built on VS Code, while Copilot works as an extension inside VS Code, JetBrains, and other editors, plus a cloud agent on GitHub.com. The choice comes down to depth of AI integration vs. ecosystem convenience.</p><h3>AI Integration Depth</h3><p>Cursor treats AI as a first-class citizen. Tab completion predicts multi-line edits, Composer 2 (Cursor's own model) handles multi-file agentic changes, and Auto mode selects the best model for each task. Copilot now offers agent mode with cloud agents that run on isolated VMs — you can spin up 10-20 parallel agents, each building features and producing PRs. Both are now genuinely agentic, but Cursor's local integration feels deeper while Copilot's cloud agents excel at parallelism.</p><h3>Model Flexibility</h3><p>Cursor supports Claude Opus 4.7, GPT-5.5, Gemini, and custom models via API keys. Copilot Pro+ ($39/month) now also offers Claude Opus 4.7, GPT-5.5, and other premium models, narrowing the gap. On free/Pro tiers, Copilot defaults to GPT-5 mini while Cursor uses its Auto router.</p><h3>Pricing</h3><p>Copilot Free: 2000 completions + 50 chat requests/month. Copilot Pro: $10/month with 300 premium requests. Copilot Pro+: $39/month with 1500 premium requests and all models. Cursor Hobby: free with limited usage. Cursor Pro: $20/month with $20 in API credits + unlimited Auto mode. Cursor Business: $40/user/month. Copilot is cheaper at the entry level; Cursor offers more included AI usage on Pro.</p><h3>Cloud Agents</h3><p>Both now offer cloud-based autonomous agents. Cursor's Cloud Agents run on isolated VMs in parallel. Copilot's cloud agent integrates directly with GitHub — it can create branches, run CI, and open PRs. For teams already on GitHub, Copilot's cloud agent workflow is more seamless.</p><h3>Bottom Line</h3><p>Choose Cursor if AI-assisted coding is central to your workflow and you want the deepest local AI integration with model flexibility. Choose Copilot if you want solid AI at a lower price point with native GitHub integration, especially with the new cloud agents and Pro+ model access.</p>`},
  'chatgpt-vs-gemini': {verdict:'ChatGPT for ecosystem breadth. Gemini for native multimodal and Google integration.',pros_a:['GPT Store with thousands of specialized assistants','DALL-E image generation built in','GPT-5.4 with 1M context (API) and Deep Research','MCP support and extensive tool ecosystem'],pros_b:['Gemini 3 Pro with native multimodal (text, image, video, audio, code)','1M token context with Deep Think mode','Deep Google Workspace integration','Gemini 3 Flash: fast and cheap at $0.50/$3 per MTok'],best_a:'Best for: creative work, plugins, image generation, consumer AI workflows',best_b:'Best for: Google users, multimodal reasoning, long-context analysis, cost-efficient API usage',details:`<h3>Overview</h3><p>ChatGPT and Gemini represent two different philosophies in AI assistants. ChatGPT built its lead through first-mover advantage and a robust plugin ecosystem, while Google's Gemini leverages deep integration with Google Workspace, Android, and the world's largest search engine. With Gemini 3 now available, the gap between them has narrowed significantly.</p><h3>Multimodal Capabilities</h3><p>Gemini was designed as a multimodal model from the ground up, handling text, images, video, and audio natively. While ChatGPT added vision and DALL-E integration over time, Gemini's native multimodal architecture gives it an edge in tasks that combine multiple input types — like analyzing a video while referencing a document.</p><h3>Google Ecosystem Integration</h3><p>If you live in Google's ecosystem, Gemini is hard to beat. It integrates directly with Gmail, Google Docs, Sheets, and Drive. You can ask Gemini to summarize emails, draft documents, or analyze spreadsheets without leaving your workflow. ChatGPT requires plugins or copy-pasting to achieve similar integration.</p><h3>Free Tier Value</h3><p>Gemini offers a remarkably generous free tier that includes access to Gemini Pro and many advanced features. ChatGPT's free tier is more limited, nudging users toward the $20/month Plus subscription for GPT-5 access. For budget-conscious users, Gemini delivers more value at no cost.</p><h3>Creative and Writing Tasks</h3><p>ChatGPT maintains an edge in creative writing, brainstorming, and open-ended tasks. Its tone is more natural and engaging, and the GPT Store offers specialized writing assistants for specific genres or styles. Gemini is more factual and structured in its responses, which some users prefer but others find less dynamic.</p><h3>Search and Real-Time Information</h3><p>Gemini benefits from direct access to Google Search, providing more current and accurately sourced information. ChatGPT's browsing feature works well but occasionally struggles with source quality. For research tasks requiring up-to-date information, Gemini's search integration is a clear advantage.</p><h3>Bottom Line</h3><p>Choose ChatGPT if you want the most versatile AI assistant with the largest ecosystem of plugins and integrations. Choose Gemini if you are embedded in Google's ecosystem or need strong multimodal capabilities and real-time search access. Both are excellent — the best choice depends on your existing workflow.</p>`},
  'midjourney-vs-dall-e': {verdict:'Midjourney for artistic quality. DALL-E for ease of use and editing.',pros_a:['Superior artistic and aesthetic quality','Strong community and style inspiration','Better at photorealism and stylized art','Consistent high-quality outputs'],pros_b:['Built into ChatGPT (no separate app needed)','Better at text rendering in images','Inpainting and editing capabilities','More accessible for beginners'],best_a:'Best for: artists, designers, high-quality creative work',best_b:'Best for: quick generation, text in images, editing existing images',details:`<h3>Overview</h3><p>Midjourney and DALL-E are the two most popular AI image generators, each with distinct strengths. Midjourney produces stunning artistic imagery with a unique aesthetic, while DALL-E (integrated into ChatGPT) offers convenience and superior editing capabilities. The choice depends on whether you prioritize visual quality or workflow efficiency.</p><h3>Image Quality</h3><p>Midjourney v6 consistently produces more visually striking, aesthetically refined images. Its outputs have a cinematic quality that makes them immediately usable for professional work. DALL-E 3 has improved dramatically but still tends toward a slightly more "digital" look. For portfolio-quality artwork, Midjourney remains the gold standard.</p><h3>Text in Images</h3><p>DALL-E 3 has a clear advantage in rendering text within images. It can accurately generate signs, logos, and typography, which Midjourney still struggles with. If your use case involves text-heavy designs like posters, social media graphics, or mockups, DALL-E is the better choice.</p><h3>Editing and Control</h3><p>DALL-E offers inpainting (editing parts of an image) and outpainting (extending an image), giving users precise control over modifications. Midjourney's editing capabilities are more limited — you can create variations and upscale, but surgical edits require external tools like Photoshop.</p><h3>Accessibility</h3><p>DALL-E is built directly into ChatGPT, making it the most accessible AI image generator. Just describe what you want in a conversation. Midjourney requires using Discord (or their newer web interface), which has a steeper learning curve but offers more granular control through parameters and flags.</p><h3>Pricing</h3><p>Midjourney starts at $10/month for the Basic plan (200 generations). DALL-E is included with ChatGPT Plus at $20/month but has daily generation limits. For heavy usage, Midjourney's Standard plan at $30/month offers unlimited relaxed generations, making it more cost-effective for high-volume creators.</p><h3>Community and Inspiration</h3><p>Midjourney's Discord community is a massive source of inspiration. You can browse thousands of prompts and outputs from other users, learning techniques and discovering styles. DALL-E's community is more fragmented across social media. For creative professionals, the Midjourney community alone can justify the subscription.</p><h3>Bottom Line</h3><p>Choose Midjourney if you need the highest quality artistic imagery and enjoy being part of a creative community. Choose DALL-E if you want convenience, text rendering, image editing, or integration with your ChatGPT workflow. Many designers use both — Midjourney for hero images and DALL-E for quick iterations.</p>`},
  'perplexity-vs-chatgpt': {verdict:'Perplexity for research with sources. ChatGPT for general AI tasks.',pros_a:['Always cites sources with links','Real-time web search built in','Focused on accuracy and factual answers','Clean interface for research'],pros_b:['More versatile (writing, coding, analysis, images)','Plugin ecosystem','Better at creative and open-ended tasks','Stronger at code generation'],best_a:'Best for: research, fact-checking, finding sources',best_b:'Best for: creative work, coding, general-purpose AI assistance',details:`<h3>Overview</h3><p>Perplexity and ChatGPT represent two different visions for AI: Perplexity as an AI-powered search engine that always cites sources, and ChatGPT as a general-purpose assistant that can do almost anything. As of 2026, both have expanded beyond their original niches, but their core philosophies still define the user experience.</p><h3>Source Attribution</h3><p>Perplexity's defining feature is inline source citations. Every answer includes numbered references linking to the original sources, making it easy to verify claims. ChatGPT can browse the web and provide sources when asked, but it does not cite sources by default. For academic research, journalism, or any work requiring verifiable facts, Perplexity is the clear winner.</p><h3>Search Quality</h3><p>Perplexity is fundamentally a search engine enhanced with AI synthesis. It excels at finding current information, comparing options, and providing well-organized answers to factual questions. ChatGPT's browsing feature works but can sometimes hallucinate sources or provide outdated information. For time-sensitive queries, Perplexity's real-time search gives it an edge.</p><h3>Versatility</h3><p>ChatGPT is far more versatile. It handles creative writing, code generation, image creation (DALL-E), data analysis, and complex reasoning. Perplexity is focused on information retrieval and synthesis — it's excellent at answering questions but less capable for creative or generative tasks.</p><h3>Pro Features</h3><p>Perplexity Pro ($20/month) offers unlimited Pro searches with access to GPT-5, Claude, and other models, plus file upload and analysis. ChatGPT Plus ($20/month) includes GPT-5, DALL-E, browsing, plugins, and the GPT Store. Both offer strong value, but they serve different needs.</p><h3>Focus Modes</h3><p>Perplexity offers specialized Focus modes — Academic (searches scholarly papers), YouTube (finds relevant videos), Reddit (searches Reddit discussions), and more. These targeted search modes are invaluable for specific research tasks. ChatGPT lacks this kind of source-specific search capability.</p><h3>User Interface</h3><p>Perplexity's interface is optimized for quick answers — you get a synthesized response with sources right away, plus follow-up questions to go deeper. ChatGPT's conversational interface is better for extended, multi-turn interactions where you're iterating on ideas or building something over time.</p><h3>Bottom Line</h3><p>Choose Perplexity if your primary need is finding accurate, well-sourced information quickly. Choose ChatGPT if you need a versatile AI assistant for coding, writing, analysis, and creative work. The ideal setup for many users is Perplexity for research and ChatGPT for everything else.</p>`},
  'claude-vs-gemini': {verdict:'Claude for depth and accuracy. Gemini for Google integration and multimodal.',pros_a:['200K context window','Superior at following complex instructions','Better writing quality','More transparent about limitations'],pros_b:['Native multimodal (image, video, audio)','Google Workspace integration','Free tier with advanced features','Better at real-time information'],best_a:'Best for: long documents, coding, precise instructions',best_b:'Best for: multimodal tasks, Google users, real-time data'},
  'cursor-vs-windsurf': {verdict:'Cursor for power users. Windsurf for a smoother out-of-box experience.',pros_a:['More mature with larger community','Multi-model support (Claude, GPT, custom)','Deeper codebase awareness','More keyboard shortcuts and power features'],pros_b:['Cleaner UI and onboarding','Cascade feature for multi-step tasks','Better free tier','Smoother learning curve'],best_a:'Best for: experienced developers wanting maximum control',best_b:'Best for: developers who want a polished, easy-to-start experience'},
  'sora-vs-runway': {verdict:'Sora for cinematic quality. Runway for production workflows.',pros_a:['Higher visual quality and realism','Better physics simulation','Longer video generation','OpenAI ecosystem integration'],pros_b:['Available now with production tools','Video editing features built in','Image-to-video and video-to-video','Better for professional workflows'],best_a:'Best for: highest quality AI video, creative exploration',best_b:'Best for: professional video production, editing workflows'},
  'claude-vs-chatgpt': {verdict:'Claude for writing and code. ChatGPT for ecosystem and versatility.',pros_a:['200K token context (reads entire codebases)','Better at following complex prompts','Superior code generation and analysis','More honest and nuanced responses'],pros_b:['Plugins, GPT Store, DALL-E, browsing','Larger user community and resources','Better at casual conversation','More integrations with third-party tools'],best_a:'Best for: professional writing, coding, long document analysis',best_b:'Best for: general use, creative tasks, plugins, image generation'},
  'gpt-5-vs-claude-opus': {verdict:'Both are frontier models. GPT-5 for breadth, Opus for depth.',pros_a:['Multimodal native (text, image, audio, video)','Stronger at real-time web tasks','Larger training data and knowledge','Better plugin ecosystem'],pros_b:['Largest context window in the industry','Superior reasoning and instruction following','Better at code and technical analysis','More reliable and consistent outputs'],best_a:'Best for: multimodal tasks, real-time info, plugin workflows',best_b:'Best for: complex reasoning, coding, professional writing'},
  'runway-vs-pika': {verdict:'Runway for professional production. Pika for quick, fun video creation.',pros_a:['Industry-standard Gen-4 Turbo engine','Advanced video editing and inpainting tools','Better temporal consistency and longer clips','Professional workflow integrations'],pros_b:['Simpler interface with fast generation','More affordable pricing tiers','Fun stylization and lip-sync features','Generous free tier for experimentation'],best_a:'Best for: professional video production, filmmakers, agencies',best_b:'Best for: social media creators, quick prototyping, casual users'},
  'stable-diffusion-vs-midjourney': {verdict:'Stable Diffusion for control and customization. Midjourney for effortless quality.',pros_a:['Fully open source and free to run locally','Unlimited customization with LoRAs and ControlNet','No per-image cost once hardware is set up','Complete privacy with local generation'],pros_b:['Superior aesthetic quality out of the box','No hardware requirements (cloud-based)','Active community for prompt inspiration','Consistently stunning results with minimal effort'],best_a:'Best for: developers, tinkerers, privacy-focused users, bulk generation',best_b:'Best for: designers, artists, anyone wanting top-quality images fast'},
  'notion-ai-vs-gamma': {verdict:'Notion AI for knowledge management. Gamma for beautiful presentations.',pros_a:['Full workspace with docs, wikis, databases, and projects','AI integrated across all content types','Powerful relational databases and views','Large ecosystem of templates and integrations'],pros_b:['One-click AI-generated presentations and decks','Beautiful design templates without manual formatting','Faster for pitch decks and visual content','Built-in analytics for shared presentations'],best_a:'Best for: team wikis, project management, knowledge bases',best_b:'Best for: presentations, pitch decks, visual storytelling'},
  'claude-code-vs-copilot': {verdict:'Claude Code for autonomous engineering. Copilot for inline IDE assistance.',pros_a:['Autonomous multi-file refactoring and bug fixes','Terminal-native with full repo context','MCP integrations for GitHub, Jira, databases','Agent teams for parallel task execution'],pros_b:['Inline completions inside VS Code and JetBrains','Lower price at $10/mo for Copilot Pro','Cloud agents that create PRs automatically','Native GitHub integration for issues and reviews'],best_a:'Best for: senior engineers, complex refactors, autonomous coding agents',best_b:'Best for: inline autocomplete, GitHub-centric workflows, budget-conscious devs'},
  'v0-vs-bolt': {verdict:'v0 for polished UI components. Bolt for full-stack app scaffolding.',pros_a:['Generates production-ready React and Next.js components','Shadcn/UI and Tailwind integration by default','Iterative refinement with visual preview','Backed by Vercel with seamless deployment'],pros_b:['Full-stack app generation with backend logic','Supports multiple frameworks (React, Vue, Svelte)','Built-in database and auth scaffolding','One-click deploy to various platforms'],best_a:'Best for: frontend components, landing pages, UI prototyping',best_b:'Best for: full-stack MVPs, rapid prototyping with backend'},
  'jasper-vs-copy-ai': {verdict:'Jasper for enterprise marketing teams. Copy.ai for sales and workflow automation.',pros_a:['Brand voice and style guide enforcement','Enterprise-grade security and compliance','Campaign-level content planning','Deep integration with marketing tech stacks'],pros_b:['Strong sales copy and outreach generation','Workflow automation beyond just writing','More affordable pricing for small teams','GTM AI workflows for go-to-market teams'],best_a:'Best for: enterprise marketing teams, brand-consistent content at scale',best_b:'Best for: sales teams, startups, automated go-to-market workflows'},
  'grammarly-vs-quillbot': {verdict:'Grammarly for comprehensive writing assistance. QuillBot for paraphrasing and rewording.',pros_a:['Real-time grammar, tone, and clarity suggestions','Works across browsers, email, and desktop apps','AI-powered full rewrite and composition features','Enterprise team analytics and style guides'],pros_b:['Superior paraphrasing with multiple modes','Integrated summarizer and citation generator','More affordable premium plan','Better for academic writing and research'],best_a:'Best for: professionals, business writing, cross-platform grammar checking',best_b:'Best for: students, academics, paraphrasing, budget-conscious writers'},
  'heygen-vs-synthesia': {verdict:'HeyGen for marketing video at scale. Synthesia for enterprise training and L&D.',pros_a:['More natural avatar expressions and gestures','Real-time avatar streaming capability','Better lip-sync across 40+ languages','Faster rendering and turnaround times'],pros_b:['Stronger enterprise compliance and SOC 2','Larger library of professional avatars','Better integration with LMS platforms','More robust team collaboration features'],best_a:'Best for: marketing teams, personalized outreach, multilingual content',best_b:'Best for: corporate training, HR onboarding, enterprise L&D'},
  'replit-vs-bolt': {verdict:'Replit for collaborative cloud development. Bolt for AI-first app generation.',pros_a:['Full cloud IDE with multiplayer collaboration','Built-in hosting, databases, and deployment','Replit Agent for autonomous app building','Supports 50+ programming languages'],pros_b:['Faster AI-generated full-stack apps','Better at scaffolding complete projects from prompts','More framework options (React, Vue, Svelte)','Simpler UX for non-developers'],best_a:'Best for: learning to code, collaborative development, cloud-native projects',best_b:'Best for: rapid MVP generation, non-technical founders, quick prototypes'},
  'kagi-vs-perplexity': {verdict:'Kagi for ad-free private search. Perplexity for AI-synthesized research answers.',pros_a:['Zero ads and zero tracking by design','Customizable result rankings and website boosts','Faster traditional search when you want links','Universal Summarizer for any URL or document'],pros_b:['AI-synthesized answers with inline citations','Pro Search with multi-step reasoning','Focus modes for academic, Reddit, YouTube','Free tier available for casual use'],best_a:'Best for: privacy-focused users, power searchers, ad-free browsing',best_b:'Best for: research, fact-finding, AI-summarized answers with sources'},
  'leonardo-vs-midjourney': {verdict:'Leonardo for game assets and fine-tuned control. Midjourney for artistic excellence.',pros_a:['Real-time canvas for iterative editing','Fine-tune custom models on your own data','Built-in motion generation for game assets','More granular control with ControlNet features'],pros_b:['Superior overall aesthetic quality','Stronger community and style library','Better at photorealism and cinematic scenes','More consistent quality across styles'],best_a:'Best for: game developers, asset creation, fine-tuned custom models',best_b:'Best for: artists, designers, marketing visuals, portfolio work'},
  'kling-vs-sora': {verdict:'Kling for accessible AI video now. Sora for highest quality cinematic generation.',pros_a:['Available globally with generous free credits','Strong motion and physics handling','Faster generation times','More affordable pricing for creators'],pros_b:['Superior visual fidelity and realism','Better temporal consistency in long clips','Stronger prompt adherence for complex scenes','Deeper integration with OpenAI ecosystem'],best_a:'Best for: content creators, social media, budget-friendly video generation',best_b:'Best for: filmmakers, high-end production, cinematic-quality output'},
  'gemini-3-vs-gpt-5': {verdict:'Gemini 3 for multimodal and Google integration. GPT-5 for reasoning and ecosystem.',pros_a:['Native multimodal architecture (text, image, video, audio)','Deep Google Workspace and Android integration','Gemini Flash offers unbeatable cost efficiency','1M context with strong long-document performance'],pros_b:['Stronger complex reasoning and chain-of-thought','Larger plugin ecosystem and GPT Store','Better at code generation benchmarks','More polished conversational experience'],best_a:'Best for: Google users, multimodal tasks, cost-sensitive API usage',best_b:'Best for: complex reasoning, coding, plugin workflows, enterprise'},
  'llama-4-vs-claude-sonnet': {verdict:'Llama 4 for open-source flexibility. Claude Sonnet for production-grade quality.',pros_a:['Fully open source with permissive license','Run locally or on any cloud provider','No per-token API costs on self-hosted infra','Large community with extensive fine-tuning ecosystem'],pros_b:['Superior instruction following and accuracy','200K context with strong recall throughout','Better at nuanced writing and analysis','Managed API with enterprise SLAs and support'],best_a:'Best for: self-hosting, fine-tuning, cost control, open-source projects',best_b:'Best for: production apps, professional writing, reliable API service'},
  'cursor-vs-claude-code': {verdict:'Cursor for visual IDE experience. Claude Code for terminal-native autonomous coding.',pros_a:['Full GUI IDE with visual diff and preview','Multi-model support (Claude, GPT, Gemini)','Tab completions and inline suggestions','Background agents on cloud VMs'],pros_b:['Terminal-native with zero context-switching','Reads entire repos with 200K+ context','Autonomous multi-step task execution','MCP protocol for tool and service integration'],best_a:'Best for: developers who prefer visual IDEs and inline AI assistance',best_b:'Best for: terminal power users, large codebase refactoring, autonomous agents'},
  'windsurf-vs-bolt': {verdict:'Windsurf for AI-enhanced coding in an IDE. Bolt for instant app generation from prompts.',pros_a:['Full IDE with Cascade multi-step AI flows','Deeper code understanding and refactoring','Better for maintaining existing projects','Supports complex multi-file edits'],pros_b:['Generates complete apps from text descriptions','No coding experience required','Built-in preview and one-click deployment','Faster time from idea to working prototype'],best_a:'Best for: developers enhancing existing codebases with AI',best_b:'Best for: non-technical users, rapid prototyping, MVPs from scratch'},
  'chatgpt-vs-perplexity': {verdict:'ChatGPT for versatile AI assistance. Perplexity for sourced research.',pros_a:['Image generation, plugins, code execution','Broader creative and analytical capabilities','Larger ecosystem with GPT Store','Better at extended multi-turn conversations'],pros_b:['Every answer includes cited sources','Purpose-built for accurate information retrieval','Focus modes for academic, video, social search','Cleaner interface optimized for research'],best_a:'Best for: creative work, coding, general-purpose AI tasks',best_b:'Best for: research, fact-checking, academic work, sourced answers'},
  'lovable-vs-v0': {verdict:'Lovable for full-stack apps with backend. v0 for polished frontend components.',pros_a:['Generates full-stack apps with Supabase backend','Built-in auth, database, and API setup','Better at complete application scaffolding','Visual editor for iterating on generated apps'],pros_b:['Superior UI component quality and design','Tighter Tailwind and shadcn/ui integration','Backed by Vercel with instant deployment','Better for design-focused frontend work'],best_a:'Best for: full-stack MVPs, apps needing auth and databases',best_b:'Best for: frontend components, landing pages, design-first projects'},
  'devin-vs-cursor': {verdict:'Devin for fully autonomous engineering tasks. Cursor for human-AI pair programming.',pros_a:['Fully autonomous software engineer agent','Handles end-to-end tasks without supervision','Own cloud environment with browser and terminal','Can learn codebases and complete complex tickets'],pros_b:['Real-time collaboration with the developer','More control over code changes','Lower cost at $20/mo vs Devin $500/mo','Works with your existing local environment'],best_a:'Best for: delegating complete engineering tasks, async development',best_b:'Best for: pair programming, real-time coding, cost-effective AI assistance'},
  'elevenlabs-vs-playht': {verdict:'ElevenLabs for premium voice quality. PlayHT for affordable text-to-speech.',pros_a:['Industry-leading voice cloning fidelity','Superior emotional range and expressiveness','Voice library with thousands of options','Advanced dubbing and voice-over tools'],pros_b:['More competitive pricing for high volume','Wider language support','Better API documentation and developer tools','Ultra-realistic voices at lower cost tiers'],best_a:'Best for: premium content, audiobooks, voice cloning, media production',best_b:'Best for: high-volume TTS, developer integrations, budget-conscious teams'},
  'veo-3-vs-sora': {verdict:'Veo 3 for integrated Google AI video. Sora for standalone cinematic generation.',pros_a:['Native audio generation with video','Deeper integration with Google ecosystem','Strong physics and world understanding','Available through Google AI Studio API'],pros_b:['Higher visual fidelity for cinematic shots','Better prompt adherence for complex scenes','Storyboard mode for narrative control','Larger creative community and sharing platform'],best_a:'Best for: Google ecosystem users, video with synchronized audio',best_b:'Best for: filmmakers, cinematic content, standalone video production'},
  'claude-vs-llama': {verdict:'Claude for polished production use. Llama for open-source freedom and customization.',pros_a:['Superior instruction following and safety','200K context window with strong recall','Enterprise-grade API with SLAs','Better at nuanced reasoning and writing'],pros_b:['Fully open source and free to self-host','Fine-tune on custom data without restrictions','No vendor lock-in or per-token costs','Run on-premise for data sovereignty'],best_a:'Best for: production apps, enterprise, professional writing and coding',best_b:'Best for: self-hosting, fine-tuning, research, privacy-sensitive deployments'},
  'gemini-vs-claude': {verdict:'Gemini for multimodal and Google integration. Claude for depth, coding, and long context.',pros_a:['Native multimodal across text, image, video, audio','Deep Google Workspace integration','Generous free tier with advanced features','Strong real-time information via Google Search'],pros_b:['1M token context with superior recall (MRCR 76%)','Industry-leading agentic coding capabilities','Better at following complex, multi-step instructions','More transparent about uncertainty and limitations'],best_a:'Best for: Google users, multimodal tasks, real-time search',best_b:'Best for: coding, long document analysis, complex instruction following'},
  'replit-vs-cursor': {verdict:'Replit for cloud-native development. Cursor for local AI-powered coding.',pros_a:['Fully cloud-based with zero local setup','Built-in hosting, databases, and deployment','Multiplayer collaboration in real time','Replit Agent builds apps from natural language'],pros_b:['Deeper AI integration in the editing experience','Works with local files and existing projects','Multi-model support with model switching','Faster performance on large codebases'],best_a:'Best for: beginners, cloud development, collaborative coding',best_b:'Best for: professional developers, local projects, AI-first coding'},
  'dify-vs-langchain': {verdict:'Dify for visual no-code AI apps. LangChain for developer-first AI pipelines.',pros_a:['Visual drag-and-drop workflow builder','No-code RAG pipeline setup','Built-in prompt management and versioning','Self-hostable with Docker in minutes'],pros_b:['Maximum flexibility with code-first approach','Larger ecosystem of integrations and tools','Stronger community and documentation','Better for complex custom agent architectures'],best_a:'Best for: non-developers, rapid AI app prototyping, visual workflows',best_b:'Best for: developers building custom AI pipelines and agents'},
  'n8n-vs-zapier': {verdict:'n8n for self-hosted power automation. Zapier for ease of use and app coverage.',pros_a:['Self-hostable and open source','No per-task pricing on self-hosted plans','Advanced logic with code nodes and branching','Full data control and privacy'],pros_b:['7000+ app integrations out of the box','Simplest setup for non-technical users','Reliable cloud infrastructure with 99.9% uptime','Better AI-powered workflow suggestions'],best_a:'Best for: developers, privacy-focused teams, complex automations',best_b:'Best for: non-technical users, quick integrations, maximum app coverage'},
  'supabase-vs-firebase': {verdict:'Supabase for SQL and open source. Firebase for Google ecosystem and real-time.',pros_a:['Full Postgres database with SQL access','Open source and self-hostable','Row-level security with Postgres policies','Better for complex queries and joins'],pros_b:['Real-time sync optimized for mobile apps','Deeper integration with Google Cloud','More mature push notifications and analytics','Better offline-first support for mobile'],best_a:'Best for: SQL-first apps, open-source projects, complex data models',best_b:'Best for: mobile apps, real-time sync, Google Cloud ecosystem'},
  'vercel-vs-netlify': {verdict:'Vercel for Next.js and performance. Netlify for simplicity and static sites.',pros_a:['First-party Next.js support and optimization','Edge Functions with global distribution','Faster builds and preview deployments','v0 AI integration for frontend generation'],pros_b:['Simpler pricing with generous free tier','Better support for non-Next.js frameworks','Built-in form handling and identity','More straightforward configuration'],best_a:'Best for: Next.js apps, performance-critical sites, edge computing',best_b:'Best for: static sites, JAMstack, simple deployments, non-Next.js projects'},
  'flux-vs-stable-diffusion': {verdict:'Flux for cutting-edge quality. Stable Diffusion for ecosystem and customization.',pros_a:['Superior image quality on benchmarks','Better text rendering in images','Stronger prompt adherence out of the box','More efficient architecture with fewer steps'],pros_b:['Massive ecosystem of models, LoRAs, and extensions','ComfyUI and Automatic1111 workflow tools','More fine-tuning options and community models','Longer track record with proven workflows'],best_a:'Best for: highest quality generation, text in images, prompt accuracy',best_b:'Best for: customization, community models, established workflows'},
  'codex-vs-claude-code': {verdict:'Codex for cloud-sandboxed tasks. Claude Code for terminal-native autonomous coding.',pros_a:['Runs in secure cloud sandbox environment','Parallel task execution via ChatGPT interface','Integrated with OpenAI ecosystem','Good at isolated, well-defined coding tasks'],pros_b:['Terminal-native with full local repo access','1M context reads entire codebases','MCP integrations for external tools','Better at complex multi-file refactoring'],best_a:'Best for: sandboxed coding tasks, OpenAI ecosystem users',best_b:'Best for: local development, large repo refactors, terminal workflows'},
  'grok-vs-chatgpt': {verdict:'Grok for real-time X/Twitter data. ChatGPT for all-around AI assistance.',pros_a:['Real-time access to X/Twitter posts and trends','Unfiltered and edgier response style','DeepSearch with web and social data','Free tier on X platform'],pros_b:['Larger plugin ecosystem and GPT Store','Superior at coding and technical tasks','DALL-E image generation built in','More polished and reliable outputs'],best_a:'Best for: social media analysis, real-time trends, unfiltered chat',best_b:'Best for: coding, creative work, plugins, professional AI assistance'},
  'anthropic-vs-openai': {verdict:'Anthropic leads in safety and coding. OpenAI leads in ecosystem and multimodal.',pros_a:['Industry-leading AI safety research','Claude Code dominates agentic coding benchmarks','1M context with superior recall','MCP open protocol for tool integration'],pros_b:['Largest AI ecosystem (GPT Store, plugins, DALL-E)','Multimodal native (text, image, audio, video)','More enterprise partnerships and integrations','Broader consumer product reach'],best_a:'Best for: safety-conscious enterprises, professional coding, research',best_b:'Best for: consumer AI, multimodal apps, enterprise ecosystem'},
  'mistral-vs-llama': {verdict:'Mistral for efficient European AI. Llama for community and ecosystem breadth.',pros_a:['Strong performance-to-size ratio','EU-based with GDPR compliance focus','Mixture-of-experts architecture for efficiency','Competitive API pricing'],pros_b:['Larger open-source community and ecosystem','More fine-tuned variants available','Backed by Meta with massive training compute','Wider hardware and platform support'],best_a:'Best for: EU compliance, efficient inference, cost-sensitive deployments',best_b:'Best for: community support, fine-tuning, broad ecosystem compatibility'},
  'deepseek-vs-claude': {verdict:'DeepSeek for cost-efficient open models. Claude for reliability and enterprise use.',pros_a:['Extremely competitive pricing','Strong reasoning with R1 thinking model','Open-weight models available for self-hosting','Impressive benchmarks relative to cost'],pros_b:['Superior instruction following and safety','1M context with industry-best recall','Enterprise SLAs and compliance certifications','Better at nuanced writing and complex tasks'],best_a:'Best for: budget-conscious teams, cost-efficient inference, self-hosting',best_b:'Best for: enterprise production, professional writing, safety-critical apps'},
  'otter-vs-fireflies': {verdict:'Otter.ai for personal meeting notes. Fireflies.ai for team collaboration and CRM sync.',pros_a:['Real-time transcription with speaker ID','OtterPilot auto-joins and records meetings','Better free tier with 300 monthly minutes','Integrated chat and commenting on transcripts'],pros_b:['Superior CRM and sales tool integrations','AI-powered meeting analytics and coaching','Better team workspace and knowledge base','Custom vocabulary and topic tracking'],best_a:'Best for: individual professionals, students, personal meeting notes',best_b:'Best for: sales teams, CRM integration, team-wide meeting intelligence'},
  'canva-ai-vs-adobe-firefly': {verdict:'Canva AI for accessible design. Adobe Firefly for professional creative workflows.',pros_a:['All-in-one design platform with AI built in','Simpler learning curve for non-designers','Magic Studio for one-click design generation','Massive template library for quick starts'],pros_b:['Commercially safe training data','Deep Creative Cloud integration (Photoshop, Illustrator)','Superior fine control and professional features','Better for print and high-resolution output'],best_a:'Best for: social media, marketing teams, non-designers',best_b:'Best for: professional designers, Creative Cloud users, commercial projects'},
  'notion-ai-vs-chatgpt': {verdict:'Notion AI for workspace-integrated writing. ChatGPT for versatile standalone AI.',pros_a:['AI embedded directly in your workspace','Context-aware suggestions from your docs and databases','Better for team knowledge management','Integrated project and task management'],pros_b:['More versatile across coding, analysis, and creativity','Plugin ecosystem and GPT Store','Better at complex reasoning and long conversations','Image generation with DALL-E'],best_a:'Best for: teams using Notion, workspace-integrated AI assistance',best_b:'Best for: standalone AI tasks, coding, creative work, research'},
  'linear-vs-jira': {verdict:'Linear for speed and modern UX. Jira for enterprise scale and customization.',pros_a:['Lightning-fast keyboard-driven interface','Beautiful, opinionated design','Streamlined workflows without bloat','Built-in project and cycle management'],pros_b:['Massive customization and workflow options','Scales to thousands of users and projects','Deep integration ecosystem (1000+ apps)','Advanced reporting and compliance features'],best_a:'Best for: startups, engineering teams, speed-focused project management',best_b:'Best for: large enterprises, complex workflows, regulatory compliance'},
  'warp-vs-iterm': {verdict:'Warp for AI-powered modern terminal. iTerm2 for proven macOS terminal power.',pros_a:['AI command suggestions and error explanations','Modern UI with blocks-based output','Built-in collaborative features','Warp Drive for shared commands and workflows'],pros_b:['Decades of stability and reliability','Fully open source and free','Extensive customization and scripting','No account required, works offline'],best_a:'Best for: developers wanting AI in the terminal, team collaboration',best_b:'Best for: developers wanting a proven, customizable, offline-first terminal'},
  'raycast-vs-alfred': {verdict:'Raycast for modern all-in-one launcher. Alfred for lightweight macOS automation.',pros_a:['Built-in AI chat, snippets, and clipboard manager','Rich extension store with React-based plugins','Window management and emoji picker included','Modern design with frequent updates'],pros_b:['Lighter resource footprint','Powerful Workflows with visual editor','One-time purchase (no subscription needed)','Longer track record of reliability'],best_a:'Best for: developers wanting an all-in-one productivity tool with AI',best_b:'Best for: users wanting lightweight automation with a one-time purchase'},
  'perplexity-vs-google': {verdict:'Perplexity for AI-synthesized answers. Google for comprehensive web search.',pros_a:['AI-synthesized answers with source citations','Follow-up questions for deeper exploration','No ads cluttering search results','Focus modes for academic, social, video search'],pros_b:['Most comprehensive web index in existence','Superior for local search, maps, and shopping','Decades of search algorithm refinement','Integrated ecosystem (Maps, Images, Shopping, News)'],best_a:'Best for: research questions, fact-finding, ad-free search experience',best_b:'Best for: local search, shopping, maps, comprehensive web discovery'},
  'claude-code-vs-codex': {verdict:'Claude Code for local repo mastery. Codex for sandboxed cloud tasks.',pros_a:['Terminal-native with full local filesystem access','1M context reads entire large codebases','MCP protocol for external tool integration','Autonomous multi-file refactoring and testing'],pros_b:['Secure cloud sandbox execution','Parallel agents via ChatGPT interface','Good for isolated, well-scoped tasks','Integrated with OpenAI platform'],best_a:'Best for: local development, large codebases, autonomous engineering',best_b:'Best for: sandboxed tasks, OpenAI users, parallel cloud execution'},
  'gemini-vs-gpt-5': {verdict:'Gemini for multimodal and value. GPT-5 for reasoning depth and ecosystem.',pros_a:['Native multimodal (text, image, video, audio, code)','Deep Google integration (Workspace, Android, Search)','Gemini Flash at $0.50/$3 per MTok is unbeatable on cost','1M context window available on all tiers'],pros_b:['Stronger complex reasoning and problem solving','Larger plugin ecosystem via GPT Store','More polished conversational experience','Better code generation benchmarks'],best_a:'Best for: Google users, multimodal tasks, cost-efficient API usage',best_b:'Best for: complex reasoning, coding, plugins, enterprise applications'},
  'notion-vs-obsidian': {verdict:'Notion for team collaboration. Obsidian for private local-first knowledge.',pros_a:['Cloud-native with real-time team collaboration','Databases, kanban boards, and project views','AI features built into the workspace','All-in-one workspace for docs, tasks, and wikis'],pros_b:['Local-first with files stored as plain Markdown','700+ community plugins for any workflow','Complete data ownership and privacy','Works offline with no internet required'],best_a:'Best for: teams, project management, collaborative workspaces',best_b:'Best for: personal knowledge management, privacy, Markdown-first workflows'},
  'figma-ai-vs-v0': {verdict:'Figma AI for design-to-code. v0 for prompt-to-component generation.',pros_a:['AI integrated into the leading design tool','Design-to-code with full design context','Collaborative design with AI assistance','Works within existing Figma workflows'],pros_b:['Generate complete components from text prompts','Production-ready React and Next.js output','Iterative refinement through conversation','Faster from idea to working code'],best_a:'Best for: designers, design-to-development handoff, Figma users',best_b:'Best for: developers, rapid UI prototyping, prompt-to-code workflows'},
  'suno-vs-udio': {verdict:'Suno for catchy songs and vocals. Udio for production quality and instrumentals.',pros_a:['Better vocal generation and lyrics handling','Simpler interface for quick song creation','Stronger at pop, rock, and mainstream styles','Generous free tier with daily credits'],pros_b:['Higher audio fidelity and production quality','Better at complex instrumentals and arrangements','More genre versatility including classical and jazz','Finer control over song structure and mixing'],best_a:'Best for: songwriting, vocal tracks, quick music creation',best_b:'Best for: high-fidelity production, instrumentals, complex arrangements'},
  'langchain-vs-llamaindex': {verdict:'LangChain for complex agent chains. LlamaIndex for RAG and data retrieval.',pros_a:['More flexible agent and chain architectures','Larger ecosystem of integrations and tools','LangGraph for stateful multi-agent workflows','Stronger community and third-party support'],pros_b:['Purpose-built for RAG pipelines','Better document parsing and indexing','Simpler API for retrieval-focused apps','More efficient for knowledge base applications'],best_a:'Best for: complex AI agents, multi-step chains, diverse integrations',best_b:'Best for: RAG applications, document Q&A, knowledge base search'},
  'pinecone-vs-weaviate': {verdict:'Pinecone for managed simplicity. Weaviate for open-source flexibility.',pros_a:['Fully managed with zero infrastructure overhead','Serverless tier with pay-per-query pricing','Simple API optimized for production vector search','Strong uptime SLAs and enterprise support'],pros_b:['Open source and self-hostable','Built-in hybrid search (vector + keyword)','Native multimodal vectorization modules','No vendor lock-in with flexible deployment'],best_a:'Best for: teams wanting managed vector DB, production simplicity',best_b:'Best for: self-hosting, hybrid search, multimodal data, cost control'},
  'huggingface-vs-replicate': {verdict:'Hugging Face for ML ecosystem and models. Replicate for simple model deployment.',pros_a:['Largest open model hub with 500K+ models','Full ML lifecycle (datasets, training, inference)','Transformers library is the industry standard','Spaces for free model demos and apps'],pros_b:['One-line API to run any model','Simple pay-per-prediction pricing','Cog packaging for custom model deployment','Faster setup for non-ML engineers'],best_a:'Best for: ML engineers, model training, research, open-source AI',best_b:'Best for: developers wanting simple model APIs, quick deployment'},
  'stable-diffusion-vs-dall-e': {verdict:'Stable Diffusion for unlimited local generation. DALL-E for convenient quality.',pros_a:['Open source and free to run locally','Unlimited generations with no per-image cost','Massive ecosystem of custom models and extensions','Full control over generation pipeline'],pros_b:['Built into ChatGPT for seamless access','Better text rendering in images','No hardware or setup required','Consistent quality with minimal prompting'],best_a:'Best for: power users, bulk generation, custom workflows, privacy',best_b:'Best for: casual users, text in images, quick generation via ChatGPT'},
  'bolt-vs-v0': {verdict:'Bolt for full-stack app generation. v0 for frontend component excellence.',pros_a:['Generates complete apps with backend and database','Supports React, Vue, Svelte, and more','Built-in authentication and API scaffolding','One-click deployment to multiple platforms'],pros_b:['Superior UI component design quality','Tighter integration with shadcn/ui and Tailwind','Backed by Vercel with seamless Next.js deployment','Better iterative refinement of components'],best_a:'Best for: full-stack MVPs, apps with backend logic, multi-framework projects',best_b:'Best for: frontend components, design-focused work, Next.js projects'},
  'aider-vs-cursor': {verdict:'Aider for terminal-native git-integrated coding. Cursor for visual IDE experience.',pros_a:['Open source and free to use','Deep git integration with auto-commits','Works with any editor as a companion','Supports Claude, GPT, and local models via API keys'],pros_b:['Full visual IDE with inline suggestions','Tab completions and multi-file editing UI','Background agents and cloud VMs','Larger user base with more resources'],best_a:'Best for: open-source advocates, git-centric workflows, terminal users',best_b:'Best for: visual IDE users, teams wanting a polished AI coding experience'},
  'openrouter-vs-together-ai': {verdict:'OpenRouter for model variety and routing. Together AI for fast open-model inference.',pros_a:['Access 200+ models through one API','Smart routing between providers for cost/speed','Pay-per-token with no minimum commitment','Provider fallback for high availability'],pros_b:['Fastest inference for open-source models','Custom fine-tuning and training support','Dedicated endpoints for consistent latency','Better pricing on high-volume open models'],best_a:'Best for: model comparison, multi-provider access, flexibility',best_b:'Best for: fast open-model inference, fine-tuning, dedicated deployments'},
  'groq-vs-fireworks': {verdict:'Groq for blazing LPU inference speed. Fireworks for flexible model serving.',pros_a:['Custom LPU hardware for record-breaking speed','Sub-100ms latency on most models','Free tier for experimentation','Simple API with OpenAI compatibility'],pros_b:['Broader model selection and custom deployments','Better support for fine-tuned and custom models','More flexible scaling options','Competitive pricing at high volume'],best_a:'Best for: latency-critical apps, real-time AI, speed-first workflows',best_b:'Best for: custom model serving, fine-tuned deployments, flexible scaling'},
  'ollama-vs-lm-studio': {verdict:'Ollama for CLI-first local inference. LM Studio for GUI-based local models.',pros_a:['Simple CLI with one-command model pulls','Lightweight and scriptable for automation','Better for server and headless deployments','OpenAI-compatible API server built in'],pros_b:['Beautiful desktop GUI for model management','Visual chat interface for conversation','Easier model discovery and downloading','Better for users who prefer graphical interfaces'],best_a:'Best for: developers, CLI users, server deployments, automation scripts',best_b:'Best for: non-technical users, visual model exploration, desktop chat'},
  'midjourney-vs-flux': {verdict:'Midjourney for artistic mastery. Flux for open-source innovation and text rendering.',pros_a:['Superior aesthetic quality and consistency','Larger creative community for inspiration','Better at artistic and stylized imagery','More intuitive prompting for beginners'],pros_b:['Open-source with local deployment option','Superior text rendering in images','Faster generation with fewer steps needed','More transparent architecture and development'],best_a:'Best for: artists, designers, high-quality creative visuals',best_b:'Best for: text-heavy images, open-source workflows, technical users'},
  'whisper-vs-deepgram': {verdict:'Whisper for free open-source transcription. Deepgram for real-time production STT.',pros_a:['Fully open source and free to self-host','Excellent accuracy across 99 languages','No API costs when running locally','Large community with fine-tuned variants'],pros_b:['Real-time streaming transcription','Sub-300ms latency for live applications','Enterprise features (diarization, sentiment, topics)','Better accuracy on noisy audio and accents'],best_a:'Best for: batch transcription, self-hosting, multilingual, budget-conscious',best_b:'Best for: real-time transcription, live captioning, enterprise voice apps'},
  'stripe-vs-lemonsqueezy': {verdict:'Stripe for payment infrastructure at scale. LemonSqueezy for simple digital product sales.',pros_a:['Most comprehensive payment API available','Supports 135+ currencies and payment methods','Advanced fraud prevention with Radar','Massive ecosystem of integrations and tools'],pros_b:['Built-in tax compliance and merchant of record','Simpler setup for digital products and SaaS','No need to handle sales tax yourself','License key management included'],best_a:'Best for: complex payment flows, marketplaces, enterprise billing',best_b:'Best for: indie developers, SaaS, digital products, global tax compliance'},
};

function renderCompareHub() {
  const categories = {
    'Chat & LLMs': COMPARISONS.filter(c => ['chatgpt','claude','gemini','gpt-5','grok','perplexity','deepseek','llama','mistral'].some(k => c.slug.includes(k)) && !['cursor','copilot','windsurf','bolt','code'].some(k => c.slug.includes(k))),
    'Coding & Dev Tools': COMPARISONS.filter(c => ['cursor','copilot','windsurf','bolt','replit','devin','aider','v0','codex','claude-code','figma'].some(k => c.slug.includes(k))),
    'Image & Design': COMPARISONS.filter(c => ['midjourney','dall-e','stable-diffusion','flux','leonardo','canva','firefly'].some(k => c.slug.includes(k))),
    'Video & Audio': COMPARISONS.filter(c => ['sora','runway','pika','kling','veo','heygen','synthesia','elevenlabs','playht','suno','udio','whisper','deepgram'].some(k => c.slug.includes(k))),
    'Infrastructure & APIs': COMPARISONS.filter(c => ['supabase','firebase','vercel','netlify','openrouter','together','groq','fireworks','pinecone','weaviate','huggingface','replicate','langchain','llamaindex','dify','stripe','lemonsqueezy'].some(k => c.slug.includes(k))),
    'Productivity': COMPARISONS.filter(c => ['notion','obsidian','linear','jira','warp','iterm','raycast','alfred','grammarly','quillbot','jasper','copy-ai','otter','fireflies','n8n','zapier','ollama','lm-studio','kagi'].some(k => c.slug.includes(k))),
  };
  const categorized = new Set(Object.values(categories).flat().map(c => c.slug));
  const uncategorized = COMPARISONS.filter(c => !categorized.has(c.slug));
  if (uncategorized.length) categories['Other'] = uncategorized;

  return `${renderPageHead(
    'AI Tool Comparisons 2026 - 65+ Side-by-Side Reviews | whatstrending.ai',
    'Compare AI tools side by side in 2026. ChatGPT vs Claude, Cursor vs Copilot, Midjourney vs DALL-E, and 65+ more comparisons with detailed analysis, pricing, and expert verdicts.',
    '/compare'
  )}
  <style>
    .hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-bottom: 48px; }
    .hub-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border: 1px solid var(--border); border-radius: 8px; color: var(--text-secondary); font-size: 14px; transition: all var(--transition); }
    .hub-item:hover { border-color: var(--accent); color: var(--accent); background: rgba(0,255,163,0.03); }
    .hub-item .has-review { font-size: 10px; padding: 2px 8px; border-radius: 4px; background: rgba(0,255,163,0.1); color: var(--accent); font-weight: 600; letter-spacing: 0.5px; }
    .hub-cat { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 16px; margin-top: 40px; }
    .hub-count { font-size: 13px; color: var(--text-tertiary); margin-bottom: 24px; }
  </style>
  ${websiteJsonLd()}
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI Tool Comparisons","description":"Compare AI tools side by side — 65+ detailed comparisons","url":"https://whatstrending.ai/compare"})}</script>
</head>
<body>
  ${renderNav('compare')}
  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">AI Tool Comparisons 2026</h1>
      <p class="page-hero-sub">${COMPARISONS.length}+ side-by-side comparisons of popular AI tools, updated for 2026</p>
    </div>
  </section>
  <section class="container" style="position:relative;z-index:1;">
    ${Object.entries(categories).map(([cat, items]) => `
      <h2 class="hub-cat">${cat}</h2>
      <div class="hub-grid">
        ${items.map(c => `<a href="/compare/${c.slug}" class="hub-item">
          <span>${c.a} vs ${c.b}</span>
          ${COMPARE_CONTENT[c.slug] ? '<span class="has-review">REVIEWED</span>' : ''}
        </a>`).join('')}
      </div>
    `).join('')}
  </section>
  ${renderFooter()}
</body>
</html>`;
}

function getRelatedComparisons(currentSlug) {
  const current = COMPARISONS.find(function(c) { return c.slug === currentSlug; });
  if (!current) return [];
  var related = COMPARISONS.filter(function(c) {
    return c.slug !== currentSlug && (
      c.a === current.a || c.b === current.a || c.a === current.b || c.b === current.b
    );
  });
  return related.slice(0, 8);
}

function getToolLinksForComparison(comparison) {
  var links = {};
  var toolA = AI_TOOLS_SEED.find(function(t) { return t.name === comparison.a; });
  var toolB = AI_TOOLS_SEED.find(function(t) { return t.name === comparison.b; });
  if (toolA) links[comparison.a] = '/tools/' + toolSlug(toolA.name);
  if (toolB) links[comparison.b] = '/tools/' + toolSlug(toolB.name);
  return links;
}

function renderComparePage(comparison, toolA, toolB, compareContentOverride) {
  const titleText = `${comparison.a} vs ${comparison.b}`;
  const contentSource = compareContentOverride || COMPARE_CONTENT;
  const richContent = contentSource[comparison.slug];
  const pricingColor = (p) => p === 'free' ? '#00ffa3' : p === 'freemium' ? '#F59E0B' : '#EC4899';
  const relatedComparisons = getRelatedComparisons(comparison.slug);
  const toolLinks = getToolLinksForComparison(comparison);

  return `${renderPageHead(
    titleText + ' (2026) - Compare AI Tools Side by Side | whatstrending.ai',
    `${comparison.a} vs ${comparison.b} compared in 2026: which is better? See features, pricing, pros and cons side by side. Find the best AI tool for your needs.`,
    '/compare/' + comparison.slug,
    { noindex: !richContent }
  )}
  <style>
    .compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding-bottom: 80px; }
    .compare-card { background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 32px; }
    .compare-card:hover { border-color: rgba(255,255,255,0.15); }
    .compare-name { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-bottom: 8px; }
    .compare-tagline { font-size: 14px; color: var(--accent); margin-bottom: 16px; font-weight: 500; }
    .compare-field { margin-bottom: 16px; }
    .compare-label { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 4px; }
    .compare-value { font-size: 14px; color: var(--text-primary); }
    .compare-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.7; }
    .compare-cta { display: inline-block; margin-top: 20px; padding: 10px 20px; border: 1px solid var(--accent); color: var(--accent); border-radius: 6px; font-size: 13px; font-weight: 500; transition: all var(--transition); }
    .compare-cta:hover { background: var(--accent); color: white; }
    .compare-vs { display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; color: var(--text-tertiary); padding: 16px 0; }
    .other-comparisons { border-top: 1px solid var(--border); padding-top: 40px; margin-top: 40px; }
    .other-comparisons h3 { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 16px; }
    .compare-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .compare-link { font-size: 13px; padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; color: var(--text-secondary); transition: all var(--transition); }
    .compare-link:hover { border-color: var(--accent); color: var(--accent); }
    .share-bar { display: flex; gap: 10px; margin-bottom: 32px; }
    .share-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 6px; font-size: 13px; font-family: 'JetBrains Mono', monospace; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); background: none; text-decoration: none; }
    .share-btn:hover { border-color: var(--accent); color: var(--accent); background: rgba(0,255,163,0.03); }
    .share-btn svg { width: 16px; height: 16px; }
    .share-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: var(--accent); color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; z-index: 200; display: none; }
    @media (max-width: 768px) { .compare-grid { grid-template-columns: 1fr; } }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebPage","name":`${comparison.a} vs ${comparison.b}`,"description":`Compare ${comparison.a} and ${comparison.b} — features, pricing, and which AI tool is better for your needs`,"url":`https://whatstrending.ai/compare/${comparison.slug}`})}</script>
  ${richContent ? `<script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":`Which is better, ${comparison.a} or ${comparison.b}?`,"acceptedAnswer":{"@type":"Answer","text":richContent.verdict}},{"@type":"Question","name":`What is ${comparison.a} best for?`,"acceptedAnswer":{"@type":"Answer","text":richContent.best_a}},{"@type":"Question","name":`What is ${comparison.b} best for?`,"acceptedAnswer":{"@type":"Answer","text":richContent.best_b}}]})}</script>` : ''}
</head>
<body>
  ${breadcrumbJsonLd([
    { name: 'Home', url: 'https://whatstrending.ai/' },
    { name: 'Compare', url: 'https://whatstrending.ai/compare' },
    { name: comparison.a + ' vs ' + comparison.b, url: 'https://whatstrending.ai/compare/' + comparison.slug }
  ])}
  ${renderNav('compare')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/compare" style="color:var(--text-tertiary);">Compare</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${comparison.a} vs ${comparison.b}</span></nav>
      <h1 class="page-hero-title">${comparison.a} vs ${comparison.b}: Which Is Better in 2026?</h1>
      <p class="page-hero-sub">Side-by-side comparison of ${comparison.a} and ${comparison.b} with detailed analysis, pricing, and features</p>
      ${contentSource._lastUpdated ? `<p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-tertiary);margin-top:12px;">Last fact-checked: ${new Date(contentSource._lastUpdated).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>` : ''}
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <div class="share-bar">
      <a class="share-btn" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(comparison.a + ' vs ' + comparison.b + ' — side by side comparison on whatstrending.ai')}&url=${encodeURIComponent('https://whatstrending.ai/compare/' + comparison.slug)}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Share on X
      </a>
      <button class="share-btn" onclick="shareCompare()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy link
      </button>
    </div>
    <div id="shareToast" class="share-toast">Link copied!</div>
    <div class="compare-grid">
      <div class="compare-card">
        <h2 class="compare-name">${toolA ? toolA.name : comparison.a}</h2>
        <p class="compare-tagline">${toolA ? toolA.tagline : ''}</p>
        <div class="compare-field">
          <div class="compare-label">Category</div>
          <div class="compare-value">${toolA ? (toolA.category === 'devtools' ? 'Dev Tools' : toolA.category) : 'N/A'}</div>
        </div>
        <div class="compare-field">
          <div class="compare-label">Pricing</div>
          <div class="compare-value" style="color:${toolA ? pricingColor(toolA.pricing) : 'inherit'}">${toolA ? toolA.pricing : 'N/A'}</div>
        </div>
        <div class="compare-field">
          <div class="compare-label">Description</div>
          <p class="compare-desc">${toolA ? toolA.description : 'Tool information not available.'}</p>
        </div>
        ${toolA ? `<a href="${toolA.url}" target="_blank" rel="noopener" class="compare-cta">Visit ${toolA.name}</a>` : ''}
      </div>
      <div class="compare-card">
        <h2 class="compare-name">${toolB ? toolB.name : comparison.b}</h2>
        <p class="compare-tagline">${toolB ? toolB.tagline : ''}</p>
        <div class="compare-field">
          <div class="compare-label">Category</div>
          <div class="compare-value">${toolB ? (toolB.category === 'devtools' ? 'Dev Tools' : toolB.category) : 'N/A'}</div>
        </div>
        <div class="compare-field">
          <div class="compare-label">Pricing</div>
          <div class="compare-value" style="color:${toolB ? pricingColor(toolB.pricing) : 'inherit'}">${toolB ? toolB.pricing : 'N/A'}</div>
        </div>
        <div class="compare-field">
          <div class="compare-label">Description</div>
          <p class="compare-desc">${toolB ? toolB.description : 'Tool information not available.'}</p>
        </div>
        ${toolB ? `<a href="${toolB.url}" target="_blank" rel="noopener" class="compare-cta">Visit ${toolB.name}</a>` : ''}
      </div>
    </div>

    ${richContent ? `
    <div style="margin:48px 0;padding:32px;background:var(--surface);border:1px solid var(--border);border-radius:12px;">
      <h2 style="font-size:22px;font-weight:700;margin-bottom:20px;color:var(--text-primary);">The Verdict</h2>
      <p style="font-size:16px;color:var(--accent);font-weight:600;margin-bottom:24px;">${richContent.verdict}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">${comparison.a} Strengths</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            ${richContent.pros_a.map(function(p){return '<li style="font-size:13px;color:var(--text-secondary);line-height:1.8;padding-left:16px;position:relative;"><span style="position:absolute;left:0;color:var(--accent);">+</span>'+p+'</li>';}).join('')}
          </ul>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:12px;font-style:italic;">${richContent.best_a}</p>
        </div>
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;color:var(--text-primary);">${comparison.b} Strengths</h3>
          <ul style="list-style:none;padding:0;margin:0;">
            ${richContent.pros_b.map(function(p){return '<li style="font-size:13px;color:var(--text-secondary);line-height:1.8;padding-left:16px;position:relative;"><span style="position:absolute;left:0;color:#60a5fa;">+</span>'+p+'</li>';}).join('')}
          </ul>
          <p style="font-size:12px;color:var(--text-tertiary);margin-top:12px;font-style:italic;">${richContent.best_b}</p>
        </div>
      </div>
    </div>
    ${richContent.details ? `<div style="margin:32px 0;padding:32px;background:var(--surface);border:1px solid var(--border);border-radius:12px;font-size:15px;color:var(--text-secondary);line-height:1.8;" class="compare-details">${richContent.details}</div>` : ''}` : `
    <div style="margin:48px 0;padding:24px;text-align:center;color:var(--text-tertiary);font-size:13px;">
      Detailed comparison coming soon. Check back for in-depth analysis.
    </div>`}

    ${Object.keys(toolLinks).length > 0 ? `
    <div style="margin:32px 0;padding:24px;border:1px solid var(--border);border-radius:12px;">
      <h2 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--text-primary);">Learn More About These Tools</h2>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        ${Object.entries(toolLinks).map(function(entry) { return '<a href="' + entry[1] + '" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;font-size:13px;color:var(--accent);transition:all 0.2s;">' + entry[0] + ' Review</a>'; }).join('')}
      </div>
    </div>` : ''}

    <div class="other-comparisons">
      <h3>Related Comparisons</h3>
      <div class="compare-links">
        ${relatedComparisons.map(c =>
          `<a href="/compare/${c.slug}" class="compare-link">${c.a} vs ${c.b}</a>`
        ).join('')}
      </div>
      ${relatedComparisons.length < 6 ? `
      <h3 style="margin-top:24px;">Popular Comparisons</h3>
      <div class="compare-links" style="margin-top:12px;">
        ${COMPARISONS.filter(c => c.slug !== comparison.slug && !relatedComparisons.some(function(r){return r.slug===c.slug;})).slice(0, 6).map(c =>
          '<a href="/compare/' + c.slug + '" class="compare-link">' + c.a + ' vs ' + c.b + '</a>'
        ).join('')}
      </div>` : ''}
    </div>
  </section>

  <script>
    function shareCompare() {
      var url = window.location.href;
      var title = document.title;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(function() {
          var t = document.getElementById('shareToast');
          t.style.display = 'block';
          setTimeout(function() { t.style.display = 'none'; }, 2000);
        });
      }
    }
  </script>

  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Story page (unchanged logic, uses baseCSS)
// ---------------------------------------------------------------------------

function renderStoryPage(article, allArticles) {
  const related = allArticles.filter(a => a.id !== article.id).slice(0, 3);
  const bodyParagraphs = article.body.split('\n\n').filter(p => p.trim());

  return `${renderPageHead(
    article.title + ' — whatstrending.ai',
    article.summary || article.description || "",
    '/story/' + article.slug
  )}
  <style>
    .meta-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .breadcrumb { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-tertiary); margin-bottom: 32px; display: flex; align-items: center; gap: 8px; }
    .breadcrumb a { color: var(--text-tertiary); transition: color var(--transition); }
    .breadcrumb a:hover { color: var(--accent); }
    .breadcrumb .sep { color: var(--text-tertiary); opacity: 0.5; }
    .breadcrumb .current { color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 300px; }
    .story-header { margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid var(--border); }
    .story-meta-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .story-title { font-size: 32px; font-weight: 700; letter-spacing: -1px; line-height: 1.25; margin-bottom: 16px; color: var(--text-primary); }
    .story-source { font-size: 14px; color: var(--text-secondary); }
    .story-source a { color: var(--accent); transition: color var(--transition); }
    .story-source a:hover { color: var(--accent-hover); }
    .story-body { max-width: 720px; margin-bottom: 64px; }
    .story-body p { font-size: 16px; color: var(--text-secondary); line-height: 1.8; margin-bottom: 20px; }
    .story-body p:first-child { font-size: 17px; color: var(--text-primary); line-height: 1.75; }
    .related-section { border-top: 1px solid var(--border); padding-top: 40px; margin-bottom: 64px; }
    .related-header { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 24px; }
    .related-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .related-card { background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 24px; transition: all 0.3s ease; }
    .related-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
    .related-card-title { font-size: 15px; font-weight: 600; line-height: 1.4; margin: 12px 0 8px; color: var(--text-primary); }
    .related-card-title a { transition: color var(--transition); }
    .related-card-title a:hover { color: var(--accent-hover); }
    .related-card-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    @media (max-width: 768px) {
      .story-title { font-size: 24px; }
      .related-grid { grid-template-columns: 1fr; }
      .breadcrumb .current { max-width: 160px; }
    }
  </style>
</head>
<body>

  ${renderNav('trending')}

  <section class="container" style="padding-top: 40px; position: relative; z-index: 1;">
    <div class="breadcrumb">
      <a href="/">Home</a>
      <span class="sep">/</span>
      <a href="/">Trending</a>
      <span class="sep">/</span>
      <span class="current">${article.title}</span>
    </div>

    <div class="story-header">
      <div class="story-meta-row">
        ${renderCategoryPill(article.category)}
        <span class="meta-time">${formatShortDate(article.time || article.date)}</span>
      </div>
      <h1 class="story-title">${article.title}</h1>
      <div class="story-source">Source: <a href="#">${article.source}</a></div>
    </div>

    <div class="story-body">
      ${bodyParagraphs.map(p => `<p>${p.trim()}</p>`).join('\n      ')}
    </div>

    <div class="related-section">
      <div class="related-header">Related Stories</div>
      <div class="related-grid">
        ${related.map(r => `
        <div class="related-card">
          ${renderCategoryPill(r.category)}
          <div class="related-card-title"><a href="/story/${r.slug}">${r.title}</a></div>
          <p class="related-card-summary">${r.summary}</p>
        </div>`).join('')}
      </div>
    </div>
  </section>

  ${renderFooter()}

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Models Page
// ---------------------------------------------------------------------------

function renderModelsPage(rankings) {
  // rankings is either the KV data {date, categories} or null (fallback to SAMPLE_MODELS)
  const hasLMSYS = rankings && rankings.categories && rankings.categories.overall;
  const categoryLabels = { overall: 'Overall', coding: 'Coding', math: 'Math', creative_writing: 'Creative Writing' };

  let tabsHtml = '';
  let tablesHtml = '';

  if (hasLMSYS) {
    const cats = Object.keys(rankings.categories);
    tabsHtml = cats.map((cat, i) => {
      const active = i === 0 ? ' active' : '';
      return `<button class="filter-pill${active}" onclick="switchCategory('${cat}')">${categoryLabels[cat] || cat}</button>`;
    }).join('\n      ');

    tablesHtml = cats.map((cat, i) => {
      const display = i === 0 ? '' : ' style="display:none"';
      const models = rankings.categories[cat];
      const maxScore = models.length > 0 ? models[0].score : 1300;
      const rows = models.map(m => {
        const pct = Math.min(100, Math.max(0, ((m.score - 800) / (maxScore - 800)) * 100));
        return `
        <tr>
          <td class="lb-rank">${m.rank}</td>
          <td class="lb-model">${m.name}</td>
          <td>
            <div class="lb-score-wrap">
              <div class="lb-score-bar"><div class="lb-score-fill" style="width: ${pct.toFixed(1)}%"></div></div>
              <span class="lb-score-num">${m.score}</span>
            </div>
          </td>
        </tr>`;
      }).join('');

      return `
    <table class="leaderboard-table" id="cat-${cat}"${display}>
      <thead>
        <tr>
          <th>#</th>
          <th>Model Name</th>
          <th>Arena Score</th>
        </tr>
      </thead>
      <tbody>${rows}
      </tbody>
    </table>`;
    }).join('');
  } else {
    // Fallback to SAMPLE_MODELS
    tabsHtml = `
      <button class="filter-pill active" onclick="filterModels('all')">All</button>
      <button class="filter-pill" onclick="filterModels('proprietary')">Proprietary</button>
      <button class="filter-pill" onclick="filterModels('opensource')">Open Source</button>`;

    const normalizedModels = SAMPLE_MODELS.map(m => ({
      rank: m.elo_rank || m.rank,
      name: m.name,
      provider: m.provider,
      score: m.elo_score || m.score,
      context: m.context_window || m.context,
      pricing: m.pricing,
      category: m.category,
      change: m.change || '0',
    }));

    tablesHtml = `
    <table class="leaderboard-table" id="cat-fallback">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Model</th>
          <th>Provider</th>
          <th>Score</th>
          <th class="lb-hide-mobile">Context</th>
          <th class="lb-hide-mobile">Pricing</th>
          <th class="right">Trend</th>
        </tr>
      </thead>
      <tbody>
        ${normalizedModels.map(m => {
          const ch = String(m.change);
          const trendClass = ch.startsWith('+') ? 'trend-up' : ch === '0' ? 'trend-neutral' : 'trend-down';
          const trendIcon = ch.startsWith('+') ? '&#9650; ' + ch : ch === '0' ? '&#8212;' : '&#9660; ' + ch;
          const detailSlug = getModelDetailSlug(m.name);
          const modelNameHtml = detailSlug ? '<a href="/models/' + detailSlug + '" style="color:var(--text-primary);text-decoration:none;border-bottom:1px dashed var(--border);">' + m.name + '</a>' : m.name;
          return `
        <tr data-category="${m.category === 'Open Source' ? 'opensource' : 'proprietary'}">
          <td class="lb-rank">${m.rank}</td>
          <td class="lb-model">${modelNameHtml}</td>
          <td class="lb-provider">${m.provider}</td>
          <td>
            <div class="lb-score-wrap">
              <div class="lb-score-bar"><div class="lb-score-fill" style="width: ${m.score}%"></div></div>
              <span class="lb-score-num">${m.score}</span>
            </div>
          </td>
          <td class="lb-context lb-hide-mobile">${m.context}</td>
          <td class="lb-pricing lb-hide-mobile">${m.pricing}</td>
          <td class="lb-trend ${trendClass}">${trendIcon}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  }

  return `${renderPageHead(
    'AI Model Leaderboard 2026 - LMSYS Arena Rankings | whatstrending.ai',
    'Live AI model rankings 2026 from LMSYS Chatbot Arena. Compare GPT-5, Claude Opus, Gemini 3, Llama 4, and more by overall score, coding, and math.',
    '/models'
  )}
  <style>
    .models-hero { padding: 56px 0 40px; border-bottom: 1px solid var(--border); margin-bottom: 40px; }
    .models-hero-title { font-size: 32px; font-weight: 700; letter-spacing: -1px; color: var(--text-primary); margin-bottom: 8px; }
    .models-hero-sub { font-size: 15px; color: var(--text-secondary); }
    .filter-pills { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
    .filter-pill { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; padding: 6px 16px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; transition: all var(--transition); }
    .filter-pill:hover { border-color: var(--border-hover); color: var(--text-primary); }
    .filter-pill.active { background: var(--accent); border-color: var(--accent); color: white; }
    .leaderboard-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    .leaderboard-table th { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); text-align: left; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .leaderboard-table th.right { text-align: right; }
    .leaderboard-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); font-size: 14px; color: var(--text-secondary); vertical-align: middle; }
    .leaderboard-table tr:last-child td { border-bottom: none; }
    .leaderboard-table tr:hover td { background: rgba(255,255,255,0.02); }
    .lb-rank { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500; color: var(--text-tertiary); width: 48px; }
    .lb-model { font-weight: 600; color: var(--text-primary); }
    .lb-provider { color: var(--text-secondary); }
    .lb-score-wrap { display: flex; align-items: center; gap: 10px; }
    .lb-score-bar { width: 80px; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .lb-score-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #00c8ff); border-radius: 2px; }
    .lb-score-num { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500; color: var(--text-primary); }
    .lb-context { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .lb-pricing { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .lb-trend { text-align: right; font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .trend-up { color: var(--accent); }
    .trend-down { color: #EF4444; }
    .trend-neutral { color: var(--text-tertiary); }
    .leaderboard-note { font-size: 13px; color: var(--text-tertiary); margin-bottom: 64px; font-style: italic; }
    .models-back-section { border-top: 1px solid var(--border); padding-top: 40px; margin-bottom: 64px; }
    .models-back-section .related-header { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 16px; }
    .models-back-link { font-size: 14px; color: var(--accent); transition: color var(--transition); }
    .models-back-link:hover { color: var(--accent-hover); }
    @media (max-width: 768px) {
      .models-hero-title { font-size: 24px; }
      .lb-hide-mobile { display: none; }
    }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI Model Rankings","description":"Real-time AI model leaderboard with arena scores across Overall, Coding, Reasoning, and Math categories","url":"https://whatstrending.ai/models"})}</script>
  <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Top AI Models 2026",
    "description": "AI model leaderboard ranked by arena scores",
    "numberOfItems": SAMPLE_MODELS.length,
    "itemListElement": SAMPLE_MODELS.slice(0, 20).map(function(m, i) {
      return {
        "@type": "ListItem",
        "position": i + 1,
        "name": m.name,
        "description": m.provider + " - Arena Score: " + m.score + ", Context: " + m.context + ", Pricing: " + m.pricing
      };
    })
  })}</script>
</head>
<body>

  ${renderNav('models')}

  <section class="models-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="models-hero-title">AI Model Leaderboard 2026</h1>
      <p class="models-hero-sub">Live rankings from LMSYS Chatbot Arena${hasLMSYS ? ' (updated: ' + rankings.date + ')' : ''}</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <div class="filter-pills">
      ${tabsHtml}
    </div>

    ${tablesHtml}

    <p class="leaderboard-note">Data from <a href="https://lmarena.ai" target="_blank" rel="noopener" style="color:var(--accent)">LMSYS Chatbot Arena</a>. Rankings based on human preference votes.</p>

    <div class="models-back-section">
      <div class="related-header">Trending Stories</div>
      <a href="/" class="models-back-link">&#8592; Back to trending stories</a>
    </div>
  </section>

  ${renderFooter()}

  <script>
    function switchCategory(cat) {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.leaderboard-table').forEach(t => t.style.display = 'none');
      const el = document.getElementById('cat-' + cat);
      if (el) el.style.display = '';
    }
    function filterModels(cat) {
      document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.leaderboard-table tbody tr').forEach(row => {
        if (cat === 'all' || row.dataset.category === cat) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    }
  </script>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

function buildTickerItems(articles, models) {
  const modelItems = (models || SAMPLE_MODELS).slice(0, 6).map(m => {
    const rawName = m.name || m.model_id || '';
    const UPPER_WORDS = { gpt: 'GPT', ai: 'AI', llm: 'LLM', pro: 'Pro', api: 'API' };
    const name = rawName.includes('-') && !rawName.includes(' ')
      ? rawName.split('-').map(w => UPPER_WORDS[w] || (w.charAt(0).toUpperCase() + w.slice(1))).join(' ').replace(/ (\d) /g, ' $1.').replace(/ (\d)$/, ' $1')
      : rawName;
    const score = m.elo_score || m.score;
    const ch = String(m.change || '0');
    const dir = ch.startsWith('+') ? 'up' : ch === '0' ? 'neutral' : 'down';
    const arrow = dir === 'up' ? '&#9650;' : dir === 'down' ? '&#9660;' : '&#8212;';
    return `<span class="ticker-item"><span class="ticker-dot ${dir === 'neutral' ? 'up' : dir}"></span> ${name} ${arrow} ${score}</span>`;
  });

  const headlineItems = articles.slice(0, 5).map(a => {
    const label = a.featured ? 'FEATURED' : 'NEW';
    return `<span class="ticker-item"><span style="color:#F59E0B;font-weight:600;font-size:10px;letter-spacing:1px">${label}</span> ${a.title}</span>`;
  });

  const items = [];
  const max = Math.max(modelItems.length, headlineItems.length);
  for (let i = 0; i < max; i++) {
    if (i < modelItems.length) items.push(modelItems[i]);
    if (i < headlineItems.length) items.push(headlineItems[i]);
  }

  const html = items.join('');
  return html + html;
}

// ---------------------------------------------------------------------------
// HOMEPAGE DASHBOARD — pulls real data from KV + DB
// ---------------------------------------------------------------------------

function renderHomeDashboard({ newsLatest, modelRankings, trendingRepos, dashboardTools }) {
  const todayDate = formatDate();

  // Section 2: News (latest 5)
  const newsItems = (newsLatest || []).slice(0, 5);
  const newsSection = newsItems.length > 0
    ? newsItems.map(a => {
        const tScore = calculateTrendingScore(a);
        return `
      <a href="/news/${a.slug || ''}" class="dash-news-item">
        <div class="dash-news-top">
          <span class="dash-news-source">${a.source || ''}</span>
          ${renderTrendingPill(tScore)}
          <span class="dash-news-date">${a.published_at ? formatRelativeTime(a.published_at) : (a.time || '')}</span>
        </div>
        <h3 class="dash-news-title">${a.title}</h3>
        <p class="dash-news-summary">${(a.summary || '').slice(0, 120)}${(a.summary || '').length > 120 ? '...' : ''}</p>
      </a>`;
      }).join('')
    : '<p class="dash-empty">News coming soon</p>';

  // Section 3: Model Leaderboard (top 10)
  let modelItems = [];
  if (modelRankings && modelRankings.categories && modelRankings.categories.overall) {
    modelItems = modelRankings.categories.overall.slice(0, 10);
  } else if (modelRankings && modelRankings.overall && Array.isArray(modelRankings.overall)) {
    modelItems = modelRankings.overall.slice(0, 10);
  } else if (modelRankings && Array.isArray(modelRankings)) {
    modelItems = modelRankings.slice(0, 10);
  }
  const modelsSection = modelItems.length > 0
    ? `<div class="dash-model-list">${modelItems.map((m, i) => `
        <div class="dash-model-row">
          <span class="dash-model-rank">${m.elo_rank || m.rank || (i + 1)}</span>
          <span class="dash-model-name">${m.name}</span>
          <span class="dash-model-score">${m.elo_score || m.score || ''}</span>
        </div>`).join('')}</div>`
    : '<p class="dash-empty">Rankings loading...</p>';

  // Section 4: Trending Repos (top 8)
  const repoItems = (trendingRepos || []).slice(0, 8);
  const langColors = {
    Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a',
    Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
    Jupyter: '#DA5B0B', Kotlin: '#A97BFF', Swift: '#F05138',
  };
  const reposSection = repoItems.length > 0
    ? repoItems.map(r => {
        const starsFormatted = r.stars >= 1000 ? (r.stars / 1000).toFixed(1) + 'k' : r.stars;
        const langColor = langColors[r.language] || '#888';
        return `
        <a href="${r.url}" target="_blank" rel="noopener" class="dash-repo-item">
          <div class="dash-repo-header">
            <span class="dash-repo-name">${r.name}</span>
            <span class="dash-repo-stars">${starsFormatted}</span>
          </div>
          <p class="dash-repo-desc">${(r.description || '').slice(0, 90)}${(r.description || '').length > 90 ? '...' : ''}</p>
          <div class="dash-repo-meta">
            <span class="dash-repo-lang"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${langColor};margin-right:4px;"></span>${r.language || ''}</span>
          </div>
        </a>`;
      }).join('')
    : '<p class="dash-empty">Repos loading...</p>';

  // Section 5: Featured Tools (8)
  const toolItems = (dashboardTools || AI_TOOLS_SEED).slice(0, 8);
  const categoryIcons = {
    coding: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    writing: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
    image: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    video: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
    chat: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    productivity: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    devtools: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  };
  const toolsSection = toolItems.map(t => {
    const icon = categoryIcons[t.category] || categoryIcons.devtools;
    return `
    <div class="dash-tool-card">
      <div class="dash-tool-icon">${icon}</div>
      <div class="dash-tool-info">
        <span class="dash-tool-name">${t.name}</span>
        <span class="dash-tool-tagline">${t.tagline || ''}</span>
      </div>
      <span class="dash-tool-cat">${t.category}</span>
    </div>`;
  }).join('');

  // Section 6: Popular Comparisons (4)
  const compareItems = COMPARISONS.slice(0, 4);
  const comparisonsSection = compareItems.map(c => `
    <a href="/compare/${c.slug}" class="dash-compare-card">
      <span class="dash-compare-vs">${c.a} <span class="dash-vs-badge">vs</span> ${c.b}</span>
    </a>`).join('');

  // Ticker content: model names + scores, or AI_TOOLS_SEED names as fallback
  const tickerItems = modelItems.length > 0
    ? modelItems.map(m => `<span class="ticker-item">${m.name} <span class="ticker-score">${m.elo_score || m.score || ''}</span></span>`)
    : AI_TOOLS_SEED.slice(0, 12).map(t => `<span class="ticker-item">${t.name}</span>`);
  const tickerContent = tickerItems.join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>What's Trending in AI (2026) — AI Model Rankings, Tool Reviews & News | whatstrending.ai</title>
  <meta name="description" content="Live AI dashboard updated every 6 hours. Model rankings, 68+ tool comparisons, trending GitHub repos, and curated AI news. Free, no login.">
  <meta name="robots" content="index, follow">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-STQ0SLHD1S"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-STQ0SLHD1S');
  </script>

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://whatstrending.ai">
  <meta property="og:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta property="og:description" content="The latest AI news, model rankings, trending repos, and tool discovery. Updated every 6 hours.">
  <meta property="og:image" content="https://whatstrending.ai/og-preview.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@0xvibly">
  <meta name="twitter:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta name="twitter:description" content="The latest AI news, model rankings, trending repos, and tool discovery.">
  <meta name="twitter:image" content="https://whatstrending.ai/og-preview.jpg">

  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2300ffa3'/><stop offset='100%25' stop-color='%2300c8ff'/></linearGradient></defs><circle cx='60' cy='60' r='52' stroke='url(%23fg)' stroke-width='2.5' fill='none'/><circle cx='60' cy='60' r='5' fill='%2300ffa3'/></svg>">
  <link rel="canonical" href="https://whatstrending.ai">
  <link rel="alternate" type="application/rss+xml" title="whatstrending.ai RSS" href="https://whatstrending.ai/feed.xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0A0A0A; --surface: #0A0A0A; --surface-raised: #0A0A0A;
      --border: rgba(255,255,255,0.07); --border-hover: rgba(16,185,129,0.25);
      --text-primary: #EDEDED; --text-secondary: #888888; --text-tertiary: #555555;
      --accent: #34d399; --accent-hover: #6ee7b7; --success: #22C55E; --warning: #F59E0B;
      --radius: 12px; --transition: 0.2s ease;
    }
    html { font-size: 15px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: var(--bg); color: var(--text-primary); line-height: 1.7; min-height: 100vh; position: relative; }
    a { color: inherit; text-decoration: none; }
    .mono { font-family: 'JetBrains Mono', monospace; }

    /* Layout */
    .dash-container { max-width: 1100px; margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

    /* Nav (reuse) */
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(10,10,10,0.6); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
    .nav-left { display: flex; align-items: center; gap: 28px; }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-mark { width: 24px; height: 24px; position: relative; }
    .logo-mark svg { width: 24px; height: 24px; }
    .logo-text { font-weight: 600; font-size: 15px; color: var(--text-primary); letter-spacing: -0.4px; }
    .logo-text span { color: var(--text-tertiary); }
    .nav-divider { width: 1px; height: 20px; background: var(--border); }
    .nav-links { display: flex; align-items: center; gap: 6px; list-style: none; }
    .nav-links a { font-size: 13px; color: var(--text-secondary); transition: all var(--transition); font-weight: 400; padding: 6px 12px; border-radius: 6px; }
    .nav-links a:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
    .nav-links a.active { color: var(--text-primary); }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-btn-ghost { font-size: 13px; font-weight: 400; color: var(--text-primary); background: none; border: 1px solid var(--border); padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-btn-ghost:hover { color: var(--text-primary); border-color: var(--border-hover); background: rgba(255,255,255,0.04); }
    .nav-cta { font-size: 13px; font-weight: 500; color: white; background: var(--accent); border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-cta:hover { background: var(--accent-hover); box-shadow: 0 4px 16px rgba(110,231,183,0.2); }
    .nav-hamburger { display: none; align-items: center; justify-content: center; width: 32px; height: 32px; background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0; flex-direction: column; gap: 5px; }
    .nav-hamburger span { display: block; width: 18px; height: 1.5px; background: var(--text-secondary); border-radius: 1px; transition: all 0.3s ease; }
    .nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
    .nav-hamburger.open span:nth-child(2) { opacity: 0; }
    .nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }
    .nav-mobile-menu { display: none; position: fixed; top: 57px; left: 0; right: 0; background: rgba(10,10,10,0.97); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-bottom: 1px solid var(--border); flex-direction: column; padding: 8px 24px; z-index: 99; }
    .nav-mobile-menu a { display: block; padding: 14px 0; font-size: 14px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.04); transition: color var(--transition); }
    .nav-mobile-menu a:last-child { border-bottom: none; }
    .nav-mobile-menu a:hover, .nav-mobile-menu a:active { color: var(--text-primary); }

    /* Hero compact */
    .dash-hero { padding: 64px 0 56px; text-align: center; position: relative; overflow: hidden; border-bottom: 1px solid var(--border); }
    .dash-hero::before { content: ''; position: absolute; bottom: -200px; left: 50%; transform: translateX(-50%); width: 800px; height: 500px; background: radial-gradient(ellipse at center, rgba(0,200,163,0.15) 0%, rgba(0,200,255,0.06) 40%, transparent 70%); pointer-events: none; z-index: 0; filter: blur(80px); }
    .dash-hero-title { font-size: 40px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.15; margin-bottom: 16px; color: var(--text-primary); }
    .dash-hero-title .accent { background: linear-gradient(135deg, #00c8ff, #00ffa3, #00c8ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .dash-hero-subtitle { font-size: 14px; color: var(--text-secondary); max-width: 420px; margin: 0 auto; line-height: 1.6; font-weight: 400; }
    .dash-hero-stats { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 16px; }
    .dash-hero-stat { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.5px; }
    .dash-hero-stat .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px rgba(16,185,129,0.5); animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }

    /* Ticker */
    .ticker-wrap { width: 100%; overflow: hidden; background: rgba(0,0,0,0.6); border-bottom: 1px solid var(--border); padding: 8px 0; }
    .ticker { display: inline-flex; white-space: nowrap; animation: tickerScroll 20s linear infinite; will-change: transform; }
    .ticker-item { display: inline-flex; align-items: center; gap: 6px; padding: 0 24px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-secondary); }
    .ticker-item .ticker-score { color: var(--accent); font-weight: 500; }
    @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

    /* Section headers */
    .dash-section { padding: 40px 0; border-bottom: 1px solid var(--border); animation: fadeUp 0.5s ease both; }
    .dash-section:last-of-type { border-bottom: none; }
    .dash-section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .dash-section-title { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); }
    .dash-section-link { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent); transition: color var(--transition); }
    .dash-section-link:hover { color: var(--accent-hover); }

    /* Empty state */
    .dash-empty { font-size: 14px; color: var(--text-tertiary); padding: 24px 0; }

    /* News items */
    .dash-news-item { display: block; padding: 16px 0; border-bottom: 1px solid var(--border); transition: all var(--transition); text-decoration: none; color: inherit; }
    .dash-news-item:last-child { border-bottom: none; }
    .dash-news-item:hover .dash-news-title { color: var(--accent-hover); }
    .dash-news-top { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
    .dash-news-source { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; color: var(--accent); background: rgba(0,255,163,0.08); padding: 2px 8px; border-radius: 4px; }
    .dash-news-date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); }
    .dash-news-title { font-size: 16px; font-weight: 600; letter-spacing: -0.3px; line-height: 1.4; margin-bottom: 4px; color: var(--text-primary); transition: color var(--transition); }
    .dash-news-summary { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

    /* Model leaderboard */
    .dash-model-list { display: flex; flex-direction: column; }
    .dash-model-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .dash-model-row:last-child { border-bottom: none; }
    .dash-model-rank { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--text-tertiary); width: 24px; text-align: center; flex-shrink: 0; }
    .dash-model-name { flex: 1; font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .dash-model-score { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--accent); font-weight: 500; }

    /* Repos */
    .dash-repos-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .dash-repo-item { display: block; padding: 16px; border: 1px solid var(--border); border-radius: var(--radius); transition: all var(--transition); text-decoration: none; color: inherit; }
    .dash-repo-item:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.02); }
    .dash-repo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .dash-repo-name { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: var(--accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%; }
    .dash-repo-stars { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #F59E0B; }
    .dash-repo-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .dash-repo-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); display: flex; align-items: center; gap: 8px; }
    .dash-repo-lang { display: flex; align-items: center; }

    /* Tools */
    .dash-tools-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .dash-tool-card { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border); border-radius: var(--radius); transition: all var(--transition); }
    .dash-tool-card:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.02); }
    .dash-tool-icon { color: var(--accent); flex-shrink: 0; display: flex; align-items: center; }
    .dash-tool-info { flex: 1; min-width: 0; }
    .dash-tool-name { display: block; font-size: 14px; font-weight: 600; color: var(--text-primary); }
    .dash-tool-tagline { display: block; font-size: 12px; color: var(--text-tertiary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .dash-tool-cat { font-family: 'JetBrains Mono', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--text-tertiary); background: rgba(255,255,255,0.04); padding: 3px 8px; border-radius: 4px; flex-shrink: 0; }

    /* Comparisons */
    .dash-compare-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .dash-compare-card { display: flex; align-items: center; justify-content: center; padding: 20px 16px; border: 1px solid var(--border); border-radius: var(--radius); transition: all var(--transition); text-decoration: none; text-align: center; }
    .dash-compare-card:hover { border-color: var(--border-hover); background: rgba(255,255,255,0.02); }
    .dash-compare-vs { font-size: 14px; font-weight: 500; color: var(--text-primary); }
    .dash-vs-badge { display: inline-block; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: var(--accent); background: rgba(0,255,163,0.1); padding: 2px 6px; border-radius: 4px; margin: 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* Footer */
    .footer { border-top: 1px solid var(--border); padding: 48px 0; position: relative; }
    .footer::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(110,231,183,0.2), transparent); }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; }
    .footer-left { font-size: 13px; color: var(--text-tertiary); }
    .footer-left span { color: var(--text-secondary); font-weight: 500; }
    .footer-links { display: flex; gap: 20px; list-style: none; }
    .footer-links a { font-size: 13px; color: var(--text-tertiary); transition: color var(--transition); }
    .footer-links a:hover { color: var(--text-secondary); }

    /* Responsive */
    @media (max-width: 768px) {
      .dash-hero-title { font-size: 30px; }
      .dash-repos-grid, .dash-tools-grid, .dash-compare-grid { grid-template-columns: 1fr; }
      .nav-divider { display: none; }
      .nav-links { display: none; }
      .nav-btn-ghost { display: none; }
      .nav-cta { display: none; }
      .nav-hamburger { display: flex; }
      .nav-mobile-menu.open { display: flex; }
      .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
      .dash-hero-stats { flex-direction: column; gap: 8px; }
    }
    @media (max-width: 480px) {
      .dash-hero-title { font-size: 22px; }
      .dash-section { padding: 28px 0; }
    }
  </style>
</head>
<body>

  ${renderNav('trending')}

  <!-- Hero -->
  <section class="dash-hero">
    <div class="dash-container" style="position:relative;z-index:1;">
      <h1 class="dash-hero-title">What's Trending in <span class="accent">AI</span></h1>
      <p class="dash-hero-subtitle">The latest in AI models, tools, and industry moves.</p>
      <div class="dash-hero-stats">
        <span class="dash-hero-stat"><span class="dot"></span> Live</span>
        <span class="dash-hero-stat">${todayDate}</span>
      </div>
    </div>
  </section>

  <!-- Ticker -->
  <div class="ticker-wrap">
    <div class="ticker">
      ${tickerContent}${tickerContent}
    </div>
  </div>

  <!-- Trending News -->
  <div class="dash-container">
    <section class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Trending News</span>
        <a href="/news" class="dash-section-link">View all news &rarr;</a>
      </div>
      ${newsSection}
    </section>

    <!-- Model Leaderboard -->
    <section class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Model Leaderboard</span>
        <a href="/models" class="dash-section-link">Full rankings &rarr;</a>
      </div>
      ${modelsSection}
    </section>

    <!-- Trending Repos -->
    <section class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Trending Repos</span>
        <a href="/repos" class="dash-section-link">View all repos &rarr;</a>
      </div>
      <div class="dash-repos-grid">
        ${reposSection}
      </div>
    </section>

    <!-- Featured Tools -->
    <section class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Featured Tools</span>
        <a href="/tools" class="dash-section-link">Browse all tools &rarr;</a>
      </div>
      <div class="dash-tools-grid">
        ${toolsSection}
      </div>
    </section>

    <!-- Popular Comparisons -->
    <section class="dash-section">
      <div class="dash-section-header">
        <span class="dash-section-title">Popular Comparisons</span>
        <a href="/compare/${COMPARISONS[0].slug}" class="dash-section-link">All comparisons &rarr;</a>
      </div>
      <div class="dash-compare-grid">
        ${comparisonsSection}
      </div>
    </section>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div class="dash-container footer-inner">
      <div class="footer-left"><span>whatstrending.ai</span> &copy; ${new Date().getFullYear()}</div>
      <ul class="footer-links">
        <li><a href="/about">About</a></li>
        <li><a href="/about#privacy">Privacy</a></li>
        <li><a href="/about#terms">Terms</a></li>
        <li><a href="https://x.com" target="_blank" rel="noopener">X / Twitter</a></li>
      </ul>
    </div>
  </footer>

</body>
</html>`;
}

// ---------------------------------------------------------------------------
// OLD HOMEPAGE (kept for reference, no longer used for GET /)
// ---------------------------------------------------------------------------

function renderHTML(articles, models, trendingRepos) {
  const topModels = (models || SAMPLE_MODELS).slice(0, 5);
  const tickerHTML = buildTickerItems(articles, models);
  const featured = articles.find((a) => a.featured);
  const feed = articles.filter((a) => !a.featured);
  const todayDate = formatDate();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI News, Model Rankings & Trending AI Tools | whatstrending.ai</title>
  <meta name="description" content="Track what's trending in AI — latest news, model rankings, GitHub trending repos, tool comparisons. Auto-updated every 6 hours.">
  <meta name="robots" content="index, follow">

  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-STQ0SLHD1S"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-STQ0SLHD1S');
  </script>

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://whatstrending.ai">
  <meta property="og:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta property="og:description" content="The latest AI news, model rankings, and tool discovery. Updated every 6 hours.">
  <meta property="og:image" content="https://whatstrending.ai/og-preview.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@0xvibly">
  <meta name="twitter:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta name="twitter:description" content="The latest AI news, model rankings, and tool discovery. Updated every 6 hours.">
  <meta name="twitter:image" content="https://whatstrending.ai/og-preview.jpg">

  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2300ffa3'/><stop offset='100%25' stop-color='%2300c8ff'/></linearGradient></defs><circle cx='60' cy='60' r='52' stroke='url(%23fg)' stroke-width='2.5' fill='none'/><circle cx='60' cy='60' r='36' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.08'/><circle cx='60' cy='60' r='24' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.12'/><path d='M60 24 A36 36 0 0 1 96 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.8'/><path d='M60 36 A24 24 0 0 1 84 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.5'/><circle cx='60' cy='60' r='5' fill='%2300ffa3'/></svg>">
  <link rel="canonical" href="https://whatstrending.ai">
  <link rel="alternate" type="application/rss+xml" title="whatstrending.ai RSS" href="https://whatstrending.ai/feed.xml">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0A0A0A; --surface: #0A0A0A; --surface-raised: #0A0A0A;
      --border: rgba(255,255,255,0.07); --border-hover: rgba(16,185,129,0.25);
      --text-primary: #EDEDED; --text-secondary: #888888; --text-tertiary: #555555;
      --accent: #34d399; --accent-hover: #6ee7b7; --success: #22C55E; --warning: #F59E0B;
      --radius: 12px; --transition: 0.2s ease;
    }
    html { font-size: 15px; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
    body { font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: var(--bg); color: var(--text-primary); line-height: 1.7; min-height: 100vh; position: relative; }
    a { color: inherit; text-decoration: none; }
    .mono { font-family: 'JetBrains Mono', monospace; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .nav { position: sticky; top: 0; z-index: 100; background: rgba(10,10,10,0.6); backdrop-filter: saturate(180%) blur(20px); -webkit-backdrop-filter: saturate(180%) blur(20px); border-bottom: 1px solid var(--border); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 56px; }
    .nav-left { display: flex; align-items: center; gap: 28px; }
    .logo { display: flex; align-items: center; gap: 8px; }
    .logo-mark { width: 24px; height: 24px; position: relative; }
    .logo-mark svg { width: 24px; height: 24px; }
    .logo-text { font-weight: 600; font-size: 15px; color: var(--text-primary); letter-spacing: -0.4px; }
    .logo-text span { color: var(--text-tertiary); }
    .nav-divider { width: 1px; height: 20px; background: var(--border); }
    .nav-links { display: flex; align-items: center; gap: 6px; list-style: none; }
    .nav-links a { font-size: 13px; color: var(--text-secondary); transition: all var(--transition); font-weight: 400; padding: 6px 12px; border-radius: 6px; }
    .nav-links a:hover { color: var(--text-primary); background: rgba(255,255,255,0.05); }
    .nav-links a.active { color: var(--text-primary); }
    .nav-right { display: flex; align-items: center; gap: 12px; }
    .nav-btn-ghost { font-size: 13px; font-weight: 400; color: var(--text-primary); background: none; border: 1px solid var(--border); padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-btn-ghost:hover { color: var(--text-primary); border-color: var(--border-hover); background: rgba(255,255,255,0.04); }
    .nav-cta { font-size: 13px; font-weight: 500; color: white; background: var(--accent); border: none; padding: 6px 16px; border-radius: 6px; cursor: pointer; transition: all var(--transition); font-family: inherit; }
    .nav-cta:hover { background: var(--accent-hover); box-shadow: 0 4px 16px rgba(110,231,183,0.2); }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .hero { padding: 80px 0 64px; margin-bottom: 40px; text-align: center; position: relative; overflow: hidden; border-bottom: 1px solid var(--border); background: #050508; }
    .hero-mesh { position: absolute; inset: 0; }
    .hero-top-line { position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent 20%, rgba(110,231,183,0.12) 50%, transparent 80%); z-index: 2; }
    .hero-title { font-size: 40px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.15; margin-bottom: 16px; color: var(--text-primary); }
    .hero-title .accent { background: linear-gradient(135deg, #00c8ff, #00ffa3, #00c8ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .hero-subtitle { font-size: 15px; color: var(--text-secondary); max-width: 420px; margin: 0 auto 20px; line-height: 1.6; font-weight: 400; }
    .hero-stats { display: flex; align-items: center; justify-content: center; gap: 24px; margin-top: 24px; }
    .hero-stat { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-tertiary); letter-spacing: 0.5px; }
    .hero-stat .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 6px rgba(16,185,129,0.5); animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; box-shadow: 0 0 6px rgba(16,185,129,0.5); } 50% { opacity: 0.5; box-shadow: 0 0 12px rgba(16,185,129,0.8); } }
    @media (max-width: 600px) { .hero-title { font-size: 28px; letter-spacing: -1px; } .hero-stats { flex-direction: column; gap: 8px; } }
    .featured-card { margin-top: 16px; margin-bottom: 48px; animation: fadeUp 0.6s ease 0.4s both; }
    .featured-card-inner { position: relative; background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 40px; transition: all 0.3s ease; }
    .featured-card-inner:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-1px); }
    .featured-title { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.3; margin: 16px 0 12px; color: var(--text-primary); }
    .featured-summary { font-size: 15px; color: var(--text-secondary); line-height: 1.7; max-width: 720px; margin-bottom: 20px; }
    .category-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; display: inline-block; }
    .card-meta { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-tertiary); }
    .meta-source { font-weight: 500; color: var(--text-secondary); }
    .meta-divider::after { content: ''; display: inline-block; width: 3px; height: 3px; background: var(--text-tertiary); border-radius: 50%; vertical-align: middle; }
    .meta-time { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .main-layout { display: grid; grid-template-columns: 1fr 340px; gap: 48px; padding-bottom: 80px; }
    .feed-header { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 24px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
    .news-card { border-bottom: 1px solid var(--border); }
    .news-card:last-child { border-bottom: none; }
    .news-card-inner { padding: 24px 0; padding-left: 16px; border-left: 2px solid transparent; transition: all var(--transition); }
    .news-card-inner:hover { border-left-color: var(--accent); background: linear-gradient(90deg, rgba(110,231,183,0.03), transparent); }
    .news-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .news-title { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; line-height: 1.4; margin-bottom: 6px; color: var(--text-primary); cursor: pointer; transition: color var(--transition); }
    .news-title:hover { color: var(--accent-hover); }
    .news-card:nth-child(1) { animation: fadeUp 0.6s ease 0.5s both; }
    .news-card:nth-child(2) { animation: fadeUp 0.6s ease 0.55s both; }
    .news-card:nth-child(3) { animation: fadeUp 0.6s ease 0.6s both; }
    .news-card:nth-child(4) { animation: fadeUp 0.6s ease 0.65s both; }
    .news-card:nth-child(5) { animation: fadeUp 0.6s ease 0.7s both; }
    .news-summary { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 10px; }
    .sidebar-section { background: transparent; border: 1px solid rgba(255,255,255,0.08); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
    .sidebar-section:nth-child(1) { animation: fadeUp 0.6s ease 0.5s both; }
    .sidebar-section:nth-child(2) { animation: fadeUp 0.6s ease 0.6s both; }
    .sidebar-section:nth-child(3) { animation: fadeUp 0.6s ease 0.7s both; }
    .sidebar-title { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; letter-spacing: 2.5px; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 20px; }
    .topics-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
    .topic-pill { font-size: 12px; font-weight: 500; padding: 6px 16px; border-radius: 20px; background: linear-gradient(135deg, rgba(52,211,153,0.08), rgba(59,130,246,0.06)); border: 1px solid rgba(52,211,153,0.1); color: var(--text-secondary); transition: all 0.3s ease; cursor: pointer; text-decoration: none; display: inline-block; }
    .topic-pill:hover { background: linear-gradient(135deg, rgba(52,211,153,0.15), rgba(59,130,246,0.12)); border-color: rgba(52,211,153,0.25); color: var(--accent); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(52,211,153,0.1); }
    .model-row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
    .model-row:last-child { border-bottom: none; padding-bottom: 0; }
    .model-row:first-child { padding-top: 0; }
    .model-rank { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 500; color: var(--text-tertiary); width: 18px; text-align: center; flex-shrink: 0; }
    .model-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
    .model-name { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .model-provider { font-size: 11px; color: var(--text-tertiary); }
    .model-score-wrap { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
    .model-score-bar { width: 56px; height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
    .model-score-fill { height: 100%; background: linear-gradient(90deg, var(--accent), #00c8ff); border-radius: 2px; }
    .model-score-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; color: var(--text-secondary); width: 22px; text-align: right; }
    .newsletter-text { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 16px; }
    .newsletter-form { display: flex; flex-direction: column; gap: 10px; }
    .newsletter-input { font-family: inherit; font-size: 14px; padding: 10px 14px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); outline: none; transition: border-color var(--transition); width: 100%; }
    .newsletter-input::placeholder { color: var(--text-tertiary); }
    .newsletter-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(110,231,183,0.1); }
    .newsletter-btn { font-family: inherit; font-size: 13px; font-weight: 600; padding: 10px 16px; background: var(--accent); color: white; border: none; border-radius: 8px; cursor: pointer; transition: background var(--transition); width: 100%; }
    .newsletter-btn:hover { background: var(--accent-hover); }
    .ticker-wrap { overflow: hidden; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.01); margin-bottom: 40px; }
    .ticker { display: flex; animation: tickerScroll 20s linear infinite; white-space: nowrap; will-change: transform; }
    .ticker-item { display: inline-flex; align-items: center; gap: 6px; padding: 10px 28px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-secondary); flex-shrink: 0; }
    .ticker-dot { width: 6px; height: 6px; border-radius: 50%; }
    .ticker-dot.up { background: #00ffa3; box-shadow: 0 0 6px rgba(16,185,129,0.5); }
    .ticker-dot.down { background: #EF4444; box-shadow: 0 0 6px rgba(239,68,68,0.5); }
    @keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
    .footer { border-top: 1px solid var(--border); padding: 48px 0; position: relative; }
    .footer::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(110,231,183,0.2), transparent); }
    .footer-inner { display: flex; align-items: center; justify-content: space-between; }
    .footer-left { font-size: 13px; color: var(--text-tertiary); }
    .footer-left span { color: var(--text-secondary); font-weight: 500; }
    .footer-links { display: flex; gap: 20px; list-style: none; }
    .footer-links a { font-size: 13px; color: var(--text-tertiary); transition: color var(--transition); }
    .footer-links a:hover { color: var(--text-secondary); }
    .nav-hamburger { display: none; align-items: center; justify-content: center; width: 32px; height: 32px; background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 0; flex-direction: column; gap: 5px; }
    .nav-hamburger span { display: block; width: 18px; height: 1.5px; background: var(--text-secondary); border-radius: 1px; transition: all 0.3s ease; }
    .nav-hamburger.open span:nth-child(1) { transform: rotate(45deg) translate(4.5px, 4.5px); }
    .nav-hamburger.open span:nth-child(2) { opacity: 0; }
    .nav-hamburger.open span:nth-child(3) { transform: rotate(-45deg) translate(4.5px, -4.5px); }
    .nav-mobile-menu { display: none; position: fixed; top: 57px; left: 0; right: 0; background: rgba(10,10,10,0.97); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border-bottom: 1px solid var(--border); flex-direction: column; padding: 8px 24px; z-index: 99; }
    .nav-mobile-menu a { display: block; padding: 14px 0; font-size: 14px; color: var(--text-secondary); border-bottom: 1px solid rgba(255,255,255,0.04); transition: color var(--transition); }
    .nav-mobile-menu a:last-child { border-bottom: none; }
    .nav-mobile-menu a:hover, .nav-mobile-menu a:active { color: var(--text-primary); }
    @media (max-width: 768px) {
      .hero { padding: 56px 0 40px; }
      .hero-title { font-size: 32px; letter-spacing: -1px; }
      .featured-card-inner { padding: 24px; }
      .featured-title { font-size: 22px; }
      .main-layout { grid-template-columns: 1fr; gap: 40px; }
      .news-card-inner { padding-left: 8px; }
      .container { padding-left: 16px; padding-right: 16px; }
      .nav-divider { display: none; }
      .nav-links { display: none; }
      .nav-btn-ghost { display: none; }
      .nav-cta { display: none; }
      .nav-hamburger { display: flex; }
      .nav-mobile-menu.open { display: flex; }
      .logo-text { font-size: 13px; }
      .footer-inner { flex-direction: column; gap: 16px; text-align: center; }
    }
    @keyframes trendGlow { 0% { filter: brightness(1); } 100% { filter: brightness(1.3); } }
    @keyframes fireFlicker { 0% { transform: scale(1) rotate(-3deg); } 100% { transform: scale(1.15) rotate(3deg); } }
    @media (max-width: 480px) {
      .hero-title { font-size: 28px; }
      .featured-card-inner { padding: 20px; }
      .featured-title { font-size: 20px; }
      .news-title { font-size: 16px; }
    }
  </style>
</head>
<body>
  ${websiteJsonLd()}

  ${renderNav('trending')}

  <!-- Hero -->
  <section class="hero">
    <canvas class="hero-mesh" id="heroMesh"></canvas>
    <div class="hero-top-line"></div>
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="hero-title">What's Trending in <span class="accent">AI</span></h1>
      <p class="hero-subtitle">The latest in AI models, tools, and industry moves.</p>
      <div class="hero-stats">
        <span class="hero-stat"><span class="dot"></span> Live</span>
        <span class="hero-stat">${todayDate}</span>
      </div>
    </div>
  </section>

  <!-- Trending Ticker -->
  <div class="ticker-wrap">
    <div class="ticker">
      ${tickerHTML}${tickerHTML}
    </div>
  </div>

  <!-- Featured Story -->
  <section class="container">
    ${featured ? renderFeaturedCard(featured) : ''}
  </section>

  <!-- Main Layout: Feed + Sidebar -->
  <div class="container">
    <div class="main-layout">

      <!-- News Feed -->
      <main>
        <div class="feed-header">Latest Stories</div>
        ${feed.slice(0, 8).map(renderNewsCard).join('')}
        <a href="/news" style="display:block;text-align:center;margin:24px 0;padding:12px 24px;border:1px solid var(--border);border-radius:8px;color:var(--accent);font-size:13px;font-family:'JetBrains Mono',monospace;transition:all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">View all news &rarr;</a>
      </main>

      <!-- Sidebar -->
      <aside>
        <div class="sidebar-section" id="trending">
          <div class="sidebar-title">Trending Topics</div>
          <div class="topics-wrap">
            ${TRENDING_TOPICS.map((t) => `<a href="/topic/${t.slug}" class="topic-pill" style="text-decoration:none;color:inherit;">${t.name}</a>`).join('')}
          </div>
        </div>

        <div class="sidebar-section" id="models">
          <div class="sidebar-title"><a href="/models" style="color:inherit;">Top Models</a></div>
          ${topModels.map(renderModelRow).join('')}
          <a href="/models" style="display:block;margin-top:12px;font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--accent);transition:color 0.2s ease;">View full leaderboard &rarr;</a>
        </div>

        <div class="sidebar-section" id="most-read-section">
          <div class="sidebar-title">Most Read</div>
          <div id="most-read-list" style="font-size:13px;color:var(--text-tertiary);">Loading...</div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-title">Newsletter</div>
          <p class="newsletter-text">Get the top AI stories delivered to your inbox every morning. No spam, unsubscribe anytime.</p>
          <form class="newsletter-form" id="subscribeForm" onsubmit="handleSubscribe(event)">
            <input type="email" class="newsletter-input" id="subscribeEmail" placeholder="you@email.com" aria-label="Email address" required>
            <button type="submit" class="newsletter-btn" id="subscribeBtn">Subscribe</button>
          </form>
          <div id="subscribeMsg" style="display:none;font-size:13px;color:var(--accent);padding:12px 0;"></div>
        </div>
      </aside>

    </div>
  </div>

  <!-- Trending Repos -->
  ${(trendingRepos && trendingRepos.length > 0) ? `
  <div class="container" style="padding: 48px 20px 48px;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg width="20" height="20" viewBox="0 0 98 96" fill="#e6edf3" style="opacity:0.8;"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/></svg>
        <span style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;background:linear-gradient(90deg,#ff6b4a,#ff9a44,#ffcc33);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:trendGlow 2s ease-in-out infinite alternate;">Trending on GitHub</span>
        <span style="font-size:13px;animation:fireFlicker 0.5s ease-in-out infinite alternate;">&#128293;</span>
      </div>
      <a href="/repos" style="font-size:12px;color:var(--accent);text-decoration:none;">View all &rarr;</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px;">
      ${trendingRepos.slice(0, 8).map(r => {
        const langColors = { Python:'#3572A5', TypeScript:'#3178c6', JavaScript:'#f1e05a', Rust:'#dea584', Go:'#00ADD8', Java:'#b07219', 'C++':'#f34b7d', Jupyter:'#DA5B0B', Kotlin:'#A97BFF', Swift:'#F05138', Ruby:'#701516', PHP:'#4F5D95' };
        const lc = langColors[r.language] || '#8b949e';
        const owner = r.name.split('/')[0] || '';
        const repo = r.name.split('/')[1] || r.name;
        const trustColors = {verified:'#4ade80',trusted:'#60a5fa',community:'#a78bfa','new':'#fbbf24',caution:'#f87171'};
        const trustLabels = {verified:'Verified',trusted:'Trusted',community:'Community','new':'New',caution:'Caution'};
        const tc = trustColors[r.trust] || '#8b949e';
        const tl = trustLabels[r.trust] || '';
        return `
        <a href="${r.url}" target="_blank" rel="noopener" style="display:block;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:16px;transition:border-color 0.2s;text-decoration:none;color:inherit;background:rgba(255,255,255,0.02);" onmouseover="this.style.borderColor='rgba(255,255,255,0.25)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.1)'">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="#8b949e"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1h-8a1 1 0 0 0-1 1v6.708A2.486 2.486 0 0 1 4.5 9h8ZM5 12.25a.25.25 0 0 1 .25-.25h3.5a.25.25 0 0 1 .25.25v3.25a.25.25 0 0 1-.4.2l-1.45-1.087a.249.249 0 0 0-.3 0L5.4 15.7a.25.25 0 0 1-.4-.2Z"/></svg>
            <span style="font-size:13px;color:#8b949e;">${owner} /</span>
            <span style="font-size:13px;font-weight:600;color:#58a6ff;">${repo}</span>
            ${tl ? `<span style="font-size:9px;font-family:'JetBrains Mono',monospace;color:${tc};border:1px solid ${tc}33;padding:1px 6px;border-radius:3px;margin-left:auto;">${tl}</span>` : ''}
          </div>
          <div style="font-size:12px;color:#8b949e;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:36px;">${r.description || 'No description'}</div>
          <div style="display:flex;align-items:center;gap:16px;margin-top:12px;font-size:12px;color:#8b949e;">
            <span style="display:flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:50%;background:${lc};display:inline-block;"></span>${r.language || 'Unknown'}</span>
            <span style="display:flex;align-items:center;gap:4px;"><svg width="14" height="14" viewBox="0 0 16 16" fill="#8b949e"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>${r.stars >= 1000 ? (r.stars/1000).toFixed(1)+'k' : r.stars}</span>
          </div>
        </a>`;
      }).join('')}
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-left"><span>whatstrending.ai</span> &copy; ${new Date().getFullYear()}</div>
      <ul class="footer-links">
        <li><a href="/about">About</a></li>
        <li><a href="/about#privacy">Privacy</a></li>
        <li><a href="/about#terms">Terms</a></li>
        <li><a href="https://x.com" target="_blank" rel="noopener">X / Twitter</a></li>
      </ul>
    </div>
  </footer>

<script>
(function(){
  var c=document.getElementById('heroMesh');
  if(!c)return;
  c.width=c.parentElement.offsetWidth;c.height=c.parentElement.offsetHeight;
  var ctx=c.getContext('2d');
  var blobs=[
    {x:c.width*0.2,y:c.height*0.3,r:130,color:[110,231,183],speed:0.7,phase:0},
    {x:c.width*0.7,y:c.height*0.5,r:110,color:[110,231,183],speed:0.5,phase:2},
    {x:c.width*0.5,y:c.height*0.65,r:90,color:[52,211,153],speed:0.6,phase:4},
    {x:c.width*0.85,y:c.height*0.25,r:80,color:[74,222,128],speed:0.4,phase:1},
    {x:c.width*0.1,y:c.height*0.7,r:70,color:[110,231,183],speed:0.8,phase:3}
  ];
  function draw(t){
    ctx.clearRect(0,0,c.width,c.height);
    var ts=t*0.001;
    for(var i=0;i<blobs.length;i++){
      var b=blobs[i];
      var bx=b.x+Math.sin(ts*b.speed+b.phase)*40;
      var by=b.y+Math.cos(ts*b.speed*0.7+b.phase)*25;
      var pulse=0.8+Math.sin(ts*b.speed*1.2+b.phase)*0.3;
      var grad=ctx.createRadialGradient(bx,by,0,bx,by,b.r*pulse);
      grad.addColorStop(0,'rgba('+b.color[0]+','+b.color[1]+','+b.color[2]+',0.06)');
      grad.addColorStop(0.5,'rgba('+b.color[0]+','+b.color[1]+','+b.color[2]+',0.02)');
      grad.addColorStop(1,'rgba('+b.color[0]+','+b.color[1]+','+b.color[2]+',0)');
      ctx.fillStyle=grad;
      ctx.fillRect(0,0,c.width,c.height);
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
// GA event tracking
document.addEventListener('click',function(e){
  var a=e.target.closest('a');
  if(!a||!window.gtag)return;
  var href=a.getAttribute('href')||'';
  if(href.startsWith('/news/'))gtag('event','click_news',{item:href});
  else if(href.startsWith('/repos/'))gtag('event','click_repo',{item:href});
  else if(href.startsWith('/tools/'))gtag('event','click_tool',{item:href});
  else if(href.startsWith('/compare/'))gtag('event','click_compare',{item:href});
  else if(href.startsWith('/topic/'))gtag('event','click_topic',{item:href});
  else if(href.startsWith('/models'))gtag('event','click_models');
});
// Scroll depth tracking
var scrollSent={};
window.addEventListener('scroll',function(){
  var pct=Math.round(100*window.scrollY/(document.body.scrollHeight-window.innerHeight));
  [25,50,75,100].forEach(function(t){if(pct>=t&&!scrollSent[t]){scrollSent[t]=true;if(window.gtag)gtag('event','scroll_depth',{depth:t});}});
});
// Email subscribe
function handleSubscribe(e) {
  e.preventDefault();
  var email = document.getElementById('subscribeEmail').value;
  var btn = document.getElementById('subscribeBtn');
  btn.textContent = 'Subscribing...';
  btn.disabled = true;
  fetch('/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      document.getElementById('subscribeForm').style.display = 'none';
      var msg = document.getElementById('subscribeMsg');
      msg.textContent = data.message || "Thanks! We'll send you the weekly AI digest.";
      msg.style.display = 'block';
    })
    .catch(function() {
      btn.textContent = 'Subscribe';
      btn.disabled = false;
    });
}
// Most read
fetch('/api/most-read').then(function(r){return r.json();}).then(function(res){
  var list = document.getElementById('most-read-list');
  if (!list) return;
  var items = (res.data || []).slice(0, 5);
  if (items.length === 0) { list.textContent = 'No data yet'; return; }
  list.innerHTML = items.map(function(item, i) {
    var title = item.slug.replace(/-/g, ' ').replace(/\b\w/g, function(c){return c.toUpperCase();});
    return '<a href="/news/' + item.slug + '" style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;">' +
      '<span style="font-family:JetBrains Mono,monospace;font-size:12px;color:var(--text-tertiary);width:20px;text-align:center;">' + (i+1) + '</span>' +
      '<span style="font-size:13px;font-weight:500;color:var(--text-primary);flex:1;">' + title.slice(0, 60) + '</span>' +
      '<span style="font-family:JetBrains Mono,monospace;font-size:11px;color:var(--text-tertiary);">' + item.views + '</span>' +
      '</a>';
  }).join('');
}).catch(function(){});
</script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// REPOS PAGE
// ---------------------------------------------------------------------------

function renderReposPage(repos) {
  const repoCards = repos.map(r => {
    let daysLabel = '';
    if (r.created_at) {
      const createdDate = new Date(r.created_at);
      const daysAgo = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!isNaN(daysAgo) && daysAgo >= 0) daysLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`;
    }
    if (r.starsToday) daysLabel = r.starsToday;
    const langColors = {
      Python: '#3572A5', TypeScript: '#3178c6', JavaScript: '#f1e05a',
      Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
      Jupyter: '#DA5B0B', Kotlin: '#A97BFF', Swift: '#F05138',
    };
    const langColor = langColors[r.language] || '#888';
    const starsFormatted = r.stars >= 1000 ? (r.stars / 1000).toFixed(1) + 'k' : r.stars;
    const trustColors = {verified:'#4ade80',trusted:'#60a5fa',community:'#a78bfa','new':'#fbbf24',caution:'#f87171'};
    const trustLabels = {verified:'Verified',trusted:'Trusted',community:'Community','new':'New',caution:'Caution'};
    const tc = trustColors[r.trust] || '';
    const tl = trustLabels[r.trust] || '';

    // Smart tags based on description keywords
    const desc = (r.description || '').toLowerCase();
    const tags = [];
    if (/\bagent\b|agentic/.test(desc)) tags.push('agents');
    if (/\bllm\b|language model|gpt|claude|gemini|llama/.test(desc)) tags.push('llm');
    if (/\brag\b|retrieval|vector|embedding/.test(desc)) tags.push('rag');
    if (/\bcod(?:e|ing)\b|ide|editor|copilot|developer tool/.test(desc)) tags.push('coding');
    if (/\bimage\b|diffusion|stable|midjourney|vision|visual/.test(desc)) tags.push('image');
    if (/\bvideo\b|animation/.test(desc)) tags.push('video');
    if (/\bchat\b|conversation|assistant|chatbot/.test(desc)) tags.push('chat');
    if (/\bframework\b|library|sdk|toolkit/.test(desc)) tags.push('framework');
    if (/\bfine.?tun|train|dataset|benchmark/.test(desc)) tags.push('training');
    if (/\bmcp\b|tool.?use|function.?call|protocol/.test(desc)) tags.push('mcp');
    if (/\bopen.?source\b|self.?host/.test(desc)) tags.push('open-source');
    if (/\bsearch\b|crawl|scrape/.test(desc)) tags.push('search');
    if (/\bauto|workflow|orchestrat|pipeline/.test(desc)) tags.push('automation');
    if (/\bsecurity|hack|pentest|vuln/.test(desc)) tags.push('security');

    return `
    <a href="/repos/${r.name}" class="repo-card" data-lang="${(r.language || 'Unknown').toLowerCase()}" data-trust="${r.trust || ''}" data-tags="${tags.join(',')}" data-name="${(r.name || '').toLowerCase()}" data-desc="${desc.slice(0, 200)}">
      <div class="repo-card-header">
        <span class="repo-name">${r.name}</span>
        <div class="repo-header-right">
          ${tl ? `<span style="font-size:8px;font-family:'JetBrains Mono',monospace;color:${tc};border:1px solid ${tc}33;padding:2px 6px;border-radius:3px;white-space:nowrap;">${tl}</span>` : ''}
          <span class="repo-stars">${starsFormatted} stars</span>
        </div>
      </div>
      <p class="repo-desc">${r.description || 'No description available'}</p>
      <div class="repo-meta">
        <span class="repo-lang"><span class="repo-lang-dot" style="background:${langColor}"></span>${r.language || 'Unknown'}</span>
        ${daysLabel ? `<span class="repo-created">${daysLabel}</span>` : ''}
      </div>
    </a>`;
  }).join('');

  return `${renderPageHead(
    'Trending AI GitHub Repos 2026 - Top AI/ML Repositories | whatstrending.ai',
    'Discover the hottest AI and machine learning GitHub repositories in 2026. Ranked by stars with trust scores. Updated daily.',
    '/repos'
  )}
  <style>
    .repos-grid { display: grid; grid-template-columns: 1fr; gap: 0; padding-bottom: 80px; overflow-x: hidden; }
    .repo-card { display: block; padding: 24px 0; border-bottom: 1px solid var(--border); border-left: 2px solid transparent; transition: all var(--transition); text-decoration: none; color: inherit; overflow: hidden; }
    .repo-card:hover { border-left-color: var(--accent); background: linear-gradient(90deg, rgba(110,231,183,0.03), transparent); }
    .repo-card-header { margin-bottom: 8px; }
    .repo-name { font-size: 14px; font-weight: 600; color: var(--accent); font-family: 'JetBrains Mono', monospace; display: block; margin-bottom: 6px; }
    .repo-header-right { display: flex; align-items: center; gap: 8px; }
    .repo-stars { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #F59E0B; font-weight: 500; white-space: nowrap; }
    .repo-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .repo-meta { display: flex; align-items: center; gap: 16px; font-size: 12px; color: var(--text-tertiary); }
    .repo-lang { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; }
    .repo-lang-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .repo-created { font-family: 'JetBrains Mono', monospace; }
    .empty-state { text-align: center; padding: 80px 24px; color: var(--text-tertiary); }
    .empty-state h3 { font-size: 20px; color: var(--text-secondary); margin-bottom: 8px; }
    .tag-btn { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 500; padding: 5px 12px; border-radius: 6px; background: transparent; border: 1px solid var(--border); color: var(--text-secondary); cursor: pointer; transition: all 0.2s; white-space: nowrap; }
    .tag-btn:hover { border-color: rgba(255,255,255,0.25); color: var(--text-primary); }
    .tag-btn.active { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.3); color: var(--accent); }
    .tag-smart { border-color: rgba(167,139,250,0.15); }
    .tag-smart:hover { border-color: rgba(167,139,250,0.35); }
    .tag-smart.active { background: rgba(167,139,250,0.1); border-color: rgba(167,139,250,0.3); color: #a78bfa; }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"Trending AI Repos","description":"Top trending AI and machine learning GitHub repositories with trust scores","url":"https://whatstrending.ai/repos","publisher":{"@type":"Organization","name":"whatstrending.ai"}})}</script>
</head>
<body>
  ${renderNav('repos')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">Trending AI Repos 2026</h1>
      <p class="page-hero-sub">${repos.length} AI and ML repositories on GitHub, ranked by stars with trust scores</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <!-- Search bar -->
    <div style="margin-bottom:20px;">
      <input type="text" id="repoSearch" placeholder="Search repos by name, description, or tag..." style="width:100%;padding:12px 18px;font-family:'Instrument Sans',sans-serif;font-size:14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;color:var(--text-primary);outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(52,211,153,0.4)'" onblur="this.style.borderColor=''">
    </div>
    <!-- Smart tags -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;" id="tagBar">
      <button class="tag-btn active" onclick="filterTag('all',this)">All</button>
      ${(() => {
        const langCounts = {};
        const tagCounts = {};
        repos.forEach(r => {
          const l = r.language || 'Unknown';
          langCounts[l] = (langCounts[l] || 0) + 1;
        });
        // Count tags from descriptions
        const tagLabels = {agents:'Agents',llm:'LLM',rag:'RAG',coding:'Coding',image:'Image',video:'Video',chat:'Chat',framework:'Framework',training:'Training',mcp:'MCP','open-source':'Open Source',search:'Search',automation:'Automation',security:'Security'};
        const descAll = repos.map(r => (r.description || '').toLowerCase());
        Object.keys(tagLabels).forEach(tag => {
          const patterns = {
            agents: /\bagent\b|agentic/,llm:/\bllm\b|language model|gpt|claude|gemini|llama/,rag:/\brag\b|retrieval|vector|embedding/,coding:/\bcod(?:e|ing)\b|ide|editor|copilot/,image:/\bimage\b|diffusion|stable|vision/,video:/\bvideo\b|animation/,chat:/\bchat\b|conversation|assistant|chatbot/,framework:/\bframework\b|library|sdk|toolkit/,training:/\bfine.?tun|train|dataset|benchmark/,mcp:/\bmcp\b|tool.?use|protocol/,'open-source':/\bopen.?source\b|self.?host/,search:/\bsearch\b|crawl|scrape/,automation:/\bauto|workflow|orchestrat|pipeline/,security:/\bsecurity|hack|pentest|vuln/
          };
          const cnt = descAll.filter(d => patterns[tag]?.test(d)).length;
          if (cnt > 0) tagCounts[tag] = cnt;
        });
        // Top languages
        const topLangs = Object.entries(langCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);
        const langBtns = topLangs.map(([l, c]) => `<button class="tag-btn" onclick="filterLang('${l.toLowerCase()}',this)">${l} <span style="opacity:0.5;font-size:10px;">${c}</span></button>`).join('');
        // Top tags
        const topTags = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);
        const tagBtns = topTags.map(([t, c]) => `<button class="tag-btn tag-smart" onclick="filterSmartTag('${t}',this)">${tagLabels[t]} <span style="opacity:0.5;font-size:10px;">${c}</span></button>`).join('');
        return langBtns + tagBtns;
      })()}
    </div>
    ${repos.length > 0 ? `<div class="repos-grid" id="reposGrid">${repoCards}</div>
    <div id="noResults" style="display:none;text-align:center;padding:60px 24px;color:var(--text-tertiary);">
      <p style="font-size:16px;color:var(--text-secondary);margin-bottom:4px;">No repos found</p>
      <p style="font-size:13px;">Try a different search term or tag</p>
    </div>` : `
    <div class="empty-state">
      <h3>Repos feed initializing</h3>
      <p>Trending repos will appear here after the next fetch. Check back soon.</p>
    </div>`}
  </section>

  ${renderFooter()}
  <script>
  (function(){
    const search = document.getElementById('repoSearch');
    const grid = document.getElementById('reposGrid');
    const noRes = document.getElementById('noResults');
    if (!search || !grid) return;
    const cards = Array.from(grid.querySelectorAll('.repo-card'));
    let activeFilter = 'all';
    let activeType = 'all'; // 'all','lang','tag'

    function applyFilters() {
      const q = search.value.toLowerCase().trim();
      let visible = 0;
      cards.forEach(c => {
        const name = c.dataset.name || '';
        const desc = c.dataset.desc || '';
        const lang = c.dataset.lang || '';
        const tags = c.dataset.tags || '';
        const trust = c.dataset.trust || '';

        let show = true;
        // Text search
        if (q && !name.includes(q) && !desc.includes(q) && !tags.includes(q) && !lang.includes(q)) show = false;
        // Tag/lang filter
        if (activeType === 'lang' && activeFilter !== 'all' && lang !== activeFilter) show = false;
        if (activeType === 'tag' && activeFilter !== 'all' && !tags.split(',').includes(activeFilter)) show = false;

        c.style.display = show ? '' : 'none';
        if (show) visible++;
      });
      if (noRes) noRes.style.display = visible === 0 ? 'block' : 'none';
    }

    search.addEventListener('input', applyFilters);

    window.filterTag = function(tag, btn) {
      activeFilter = 'all'; activeType = 'all';
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    };
    window.filterLang = function(lang, btn) {
      activeFilter = lang; activeType = 'lang';
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    };
    window.filterSmartTag = function(tag, btn) {
      activeFilter = tag; activeType = 'tag';
      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    };
  })();
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function renderOgSvg(title, category, source, date, excerpt) {
  const catColors = {
    Models: '#00ffa3', Tools: '#06B6D4', Research: '#F59E0B',
    Industry: '#EC4899', Startups: '#8B5CF6', Regulation: '#EF4444', 'Open Source': '#34d399',
  };
  const cc = catColors[category] || '#888';
  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Word-wrap title into lines (~32 chars per line at this font size)
  const words = (title || '').split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 34 && cur) { lines.push(cur.trim()); cur = w; }
    else { cur = cur ? cur + ' ' + w : w; }
  }
  if (cur.trim()) lines.push(cur.trim());
  const titleLines = lines.slice(0, 3);
  const titleY = titleLines.length === 1 ? 300 : titleLines.length === 2 ? 270 : 240;

  // Word-wrap excerpt (~70 chars per line)
  const exWords = (excerpt || '').split(' ');
  const exLines = [];
  let exCur = '';
  for (const w of exWords) {
    if ((exCur + ' ' + w).trim().length > 75 && exCur) { exLines.push(exCur.trim()); exCur = w; }
    else { exCur = exCur ? exCur + ' ' + w : w; }
  }
  if (exCur.trim()) exLines.push(exCur.trim());
  const excerptLines = exLines.slice(0, 2);
  const excerptY = titleY + titleLines.length * 56 + 30;

  return `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="topLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="5%" stop-color="transparent"/>
      <stop offset="50%" stop-color="${cc}"/>
      <stop offset="95%" stop-color="transparent"/>
    </linearGradient>
    <linearGradient id="botLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="transparent"/>
      <stop offset="50%" stop-color="#34d39930"/>
      <stop offset="100%" stop-color="transparent"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.1" cy="0.9" r="0.5">
      <stop offset="0%" stop-color="${cc}18"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.9" cy="0.1" r="0.4">
      <stop offset="0%" stop-color="#00c8ff08"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="#0A0A0A"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <!-- Top accent line -->
  <rect x="0" y="0" width="1200" height="3" fill="url(#topLine)" opacity="0.7"/>

  <!-- Bottom accent line -->
  <rect x="0" y="628" width="1200" height="2" fill="url(#botLine)"/>

  <!-- Logo mark -->
  <circle cx="72" cy="44" r="13" fill="none" stroke="#34d399" stroke-width="2" opacity="0.8"/>
  <circle cx="72" cy="44" r="4" fill="#34d399"/>

  <!-- Logo text -->
  <text x="94" y="49" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="600" fill="#cccccc">whatstrending<tspan fill="#555555">.ai</tspan></text>

  <!-- Category pill -->
  <rect x="${1200 - 56 - (category || '').length * 9 - 28}" y="30" width="${(category || '').length * 9 + 28}" height="28" rx="5" fill="${cc}14" stroke="${cc}40" stroke-width="1"/>
  <text x="${1200 - 56 - (category || '').length * 9 / 2}" y="49" font-family="monospace" font-size="11" font-weight="600" fill="${cc}" text-anchor="middle" letter-spacing="1.5">${esc(category || '').toUpperCase()}</text>

  <!-- Headline -->
  ${titleLines.map((line, i) => `<text x="56" y="${titleY + i * 56}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="48" font-weight="700" fill="#ededed" letter-spacing="-1">${esc(line)}</text>`).join('\n  ')}

  <!-- Excerpt -->
  ${excerptLines.map((line, i) => `<text x="56" y="${excerptY + i * 24}" font-family="system-ui, -apple-system, sans-serif" font-size="17" fill="#777777">${esc(line)}</text>`).join('\n  ')}

  <!-- Divider -->
  <line x1="56" y1="558" x2="1144" y2="558" stroke="#ffffff10" stroke-width="1"/>

  <!-- Source -->
  <text x="56" y="590" font-family="monospace" font-size="13" fill="#666666">Source: <tspan fill="#aaaaaa" font-weight="600">${esc(source)}</tspan></text>

  <!-- Date -->
  <text x="1144" y="590" font-family="monospace" font-size="12" fill="#444444" text-anchor="end">${esc(date)}</text>

  <!-- Decorative accent bar -->
  <rect x="0" y="${titleY - 20}" width="4" height="100" rx="2" fill="${cc}" opacity="0.25"/>
</svg>`;
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /api/

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Amazonbot
Allow: /

Sitemap: https://whatstrending.ai/sitemap.xml
Sitemap: https://whatstrending.ai/news-sitemap.xml`;
}

function renderNewsSitemapXml(newsArticles) {
  const recentArticles = newsArticles
    .filter(a => a.date || a.published_at)
    .sort((a, b) => new Date(b.date || b.published_at) - new Date(a.date || a.published_at))
    .slice(0, 1000);

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${recentArticles.map(a => {
  const pubDate = a.date ? new Date(a.date).toISOString() : (a.published_at ? new Date(a.published_at).toISOString() : new Date().toISOString());
  const title = (a.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return `  <url>
    <loc>https://whatstrending.ai/news/${a.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>whatstrending.ai</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${pubDate}</news:publication_date>
      <news:title>${title}</news:title>
    </news:news>
  </url>`;
}).join('\n')}
</urlset>`;
}

async function renderSitemapXml(articles, newsArticles, tools, trendingRepos, env) {
  const today = new Date().toISOString().split('T')[0];

  const storyUrls = articles.map(a => {
    const storyDate = a.date ? new Date(a.date).toISOString().split('T')[0] : (a.published_at ? new Date(a.published_at).toISOString().split('T')[0] : today);
    return `
  <url>
    <loc>https://whatstrending.ai/news/${a.slug}</loc>
    <lastmod>${storyDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
  }).join('');

  const newsUrls = newsArticles.map(a => {
    const articleDate = a.date ? new Date(a.date).toISOString().split('T')[0] : today;
    return `
  <url>
    <loc>https://whatstrending.ai/news/${a.slug}</loc>
    <lastmod>${articleDate}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.6</priority>
  </url>`;
  }).join('');

  const toolUrls = tools.map(t => `
  <url>
    <loc>https://whatstrending.ai/tools/${toolSlug(t.name)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`).join('');

  const compareUrls = COMPARISONS.map(c => `
  <url>
    <loc>https://whatstrending.ai/compare/${c.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${COMPARE_CONTENT[c.slug] ? '0.9' : '0.5'}</priority>
  </url>`).join('');

  const modelDetailUrls = Object.values(MODEL_DETAILS).map(m => `
  <url>
    <loc>https://whatstrending.ai/models/${m.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('');

  const alternativeUrls = AI_TOOLS_SEED.map(t => `
  <url>
    <loc>https://whatstrending.ai/alternatives/${toolSlug(t.name)}-alternatives</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

  const categoryUrls = TOOL_CATEGORIES.map(c => `
  <url>
    <loc>https://whatstrending.ai/category/${c}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://whatstrending.ai/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://whatstrending.ai/models</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://whatstrending.ai/repos</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://whatstrending.ai/news</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://whatstrending.ai/tools</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>${storyUrls}${newsUrls}${toolUrls}${compareUrls}${modelDetailUrls}${alternativeUrls}${categoryUrls}${TRENDING_TOPICS.map(t=>`
  <url>
    <loc>https://whatstrending.ai/topic/${t.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}${['best-ai-coding-tools','best-ai-image-generators','best-ai-chatbots','best-ai-video-tools','best-ai-writing-tools','open-source-llms-guide','best-ai-tools-for-coding','best-ai-tools-for-writing','best-ai-tools-for-image-generation','best-ai-tools-for-video','best-ai-tools-for-research'].map(s=>`
  <url>
    <loc>https://whatstrending.ai/guide/${s}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}
  <url><loc>https://whatstrending.ai/compare</loc><lastmod>2025-01-01</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://whatstrending.ai/alternatives</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://whatstrending.ai/about</loc><lastmod>2025-01-01</lastmod><changefreq>monthly</changefreq><priority>0.4</priority></url>${(trendingRepos||[]).map(r=>`
  <url>
    <loc>https://whatstrending.ai/repos/${r.name}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
  </url>`).join('')}${await (async () => {
    if (!env || !env.DB) return '';
    try {
      const dbRepos = await env.DB.prepare('SELECT full_name FROM repos WHERE full_name NOT IN (' + (trendingRepos||[]).map(() => '?').join(',') + ') LIMIT 2000').bind(...(trendingRepos||[]).map(r => r.name)).all();
      return dbRepos.results.map(r => `
  <url>
    <loc>https://whatstrending.ai/repos/${r.full_name}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.4</priority>
  </url>`).join('');
    } catch { return ''; }
  })()}${SEO_TRENDING_TOPICS.map(t=>`
  <url>
    <loc>https://whatstrending.ai/trending/${t.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}${newsArticles.map(a=>`
  <url>
    <loc>https://whatstrending.ai/verify/${a.slug}</loc>
    <lastmod>${a.date ? new Date(a.date).toISOString().split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>`).join('')}${(() => {
    // Generate digest URLs for the last 90 days
    const digestUrls = [];
    const now = new Date();
    for (let i = 0; i < 90; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      digestUrls.push(`
  <url>
    <loc>https://whatstrending.ai/digest/${ds}</loc>
    <lastmod>${ds}</lastmod>
    <changefreq>${i === 0 ? 'daily' : 'monthly'}</changefreq>
    <priority>${i < 7 ? '0.6' : '0.4'}</priority>
  </url>`);
    }
    return digestUrls.join('');
  })()}${NEWS_TOPIC_HUBS.map(h=>`
  <url>
    <loc>https://whatstrending.ai/news/${h.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
  <url>
    <loc>https://whatstrending.ai/glossary</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>${GLOSSARY_TERMS.map(t=>`
  <url>
    <loc>https://whatstrending.ai/glossary/${t.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}
</urlset>`;
}

// ---------------------------------------------------------------------------
// Comparison Content Fact-Check Pipeline
// ---------------------------------------------------------------------------
// Architecture: Weekly cron (Sunday 3AM UTC) triggers AI-powered fact-checking
// of comparison page content. Results stored in KV (compare_content).
//
// Pipeline steps:
// 1. Load current COMPARE_CONTENT (hardcoded defaults)
// 2. For each comparison with rich content, ask Workers AI to verify/update:
//    - Context window sizes, pricing, benchmark scores, key features
// 3. AI returns updated JSON fields (verdict, pros_a, pros_b, best_a, best_b, details)
// 4. Store merged result in KV key 'compare_content'
// 5. renderComparePage() loads from KV first, falls back to hardcoded
//
// To swap AI provider: replace the env.AI.run() call in updateSingleComparison()
// with any API call that accepts a prompt and returns JSON text.
// ---------------------------------------------------------------------------

async function updateComparisonContent(env) {
  const slugs = Object.keys(COMPARE_CONTENT);
  const results = {};

  for (const slug of slugs) {
    try {
      const updated = await updateSingleComparison(env, slug, COMPARE_CONTENT[slug]);
      if (updated) results[slug] = updated;
    } catch (e) {
      // Keep hardcoded data on failure
      results[slug] = COMPARE_CONTENT[slug];
    }
  }

  // Store in KV with 8-day TTL (refreshed weekly)
  results._lastUpdated = new Date().toISOString();
  await env.NEWS_KV.put('compare_content', JSON.stringify(results), { expirationTtl: 691200 });
}

async function updateSingleComparison(env, slug, current) {
  const comparison = COMPARISONS.find(c => c.slug === slug);
  if (!comparison) return current;

  const prompt = `You are a tech analyst. Fact-check and update this AI tool comparison for ${comparison.a} vs ${comparison.b}.

Current data:
- Verdict: ${current.verdict}
- ${comparison.a} strengths: ${current.pros_a.join(', ')}
- ${comparison.b} strengths: ${current.pros_b.join(', ')}
- ${comparison.a} best for: ${current.best_a}
- ${comparison.b} best for: ${current.best_b}

Update any outdated information (pricing, context windows, benchmark scores, features) with the latest known data as of 2026. Keep the same structure. Be concise and factual.

Return ONLY valid JSON with these exact fields:
{"verdict":"...","pros_a":["...","...","...","..."],"pros_b":["...","...","...","..."],"best_a":"Best for: ...","best_b":"Best for: ..."}`;

  const response = await callLLM(env, [{ role: 'user', content: prompt }], 500);

  if (!response || !response.response) return current;

  try {
    // Extract JSON from response
    const text = response.response;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return current;

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.verdict || !Array.isArray(parsed.pros_a) || !Array.isArray(parsed.pros_b)) {
      return current;
    }

    // Merge: keep existing details (long-form content), update structured fields
    return {
      ...current,
      verdict: parsed.verdict,
      pros_a: parsed.pros_a.slice(0, 4),
      pros_b: parsed.pros_b.slice(0, 4),
      best_a: parsed.best_a || current.best_a,
      best_b: parsed.best_b || current.best_b,
    };
  } catch {
    return current;
  }
}

async function getCompareContent(env) {
  try {
    const cached = await env.NEWS_KV.get('compare_content', 'json');
    if (cached) return { ...COMPARE_CONTENT, ...cached };
  } catch {}
  return COMPARE_CONTENT;
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

async function submitIndexNow(env) {
  try {
    const urls = ['https://whatstrending.ai/', 'https://whatstrending.ai/news', 'https://whatstrending.ai/models', 'https://whatstrending.ai/repos'];
    try {
      const raw = await env.NEWS_KV.get('news_index', 'json');
      if (raw && Array.isArray(raw)) {
        raw.slice(0, 10).forEach(a => urls.push('https://whatstrending.ai/news/' + a.slug));
      }
    } catch {}
    await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'whatstrending.ai',
        key: '490353be25d0cb178076a513a46d91e9',
        keyLocation: 'https://whatstrending.ai/490353be25d0cb178076a513a46d91e9.txt',
        urlList: urls
      })
    });
  } catch {}
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let path = url.pathname;
    const method = request.method;

    // www redirect
    if (url.hostname === 'www.whatstrending.ai') {
      return Response.redirect('https://whatstrending.ai' + path + url.search, 301);
    }

    // Trailing-slash redirect (except root and API routes)
    if (path !== '/' && path.endsWith('/') && !path.startsWith('/api/')) {
      return Response.redirect('https://whatstrending.ai' + path.slice(0, -1) + url.search, 301);
    }

    // Manual news trigger (fetches RSS + AI rewrite via Hermes-MiniMax)
    if (path === '/api/trigger-news' && url.searchParams.get('key') === 'vibeking2026') {
      try {
        // If reset=1, clear all old news first
        if (url.searchParams.get('reset') === '1') {
          await env.NEWS_KV.put('news_index', JSON.stringify([]));
          // Delete individual article keys
          const list = await env.NEWS_KV.list({ prefix: 'news:' });
          for (const key of list.keys) {
            await env.NEWS_KV.delete(key.name);
          }
        }
        await fetchAndProcessFeeds(env);
        return new Response(JSON.stringify({ success: true, message: 'News fetched' }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Manual model rankings trigger
    if (path === '/api/trigger-models' && url.searchParams.get('key') === 'vibeking2026') {
      try {
        await fetchModelRankings(env);
        return new Response(JSON.stringify({ success: true, message: 'Model rankings fetched from LMSYS' }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Manual repos trigger
    if (path === '/api/trigger-repos' && url.searchParams.get('key') === 'vibeking2026') {
      try {
        await fetchTrendingRepos(env);
        return new Response(JSON.stringify({ success: true, message: 'Trending repos fetched from GitHub' }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Manual IndexNow bulk submit
    if (path === '/api/indexnow' && url.searchParams.get('key') === 'vibeking2026') {
      try {
        await submitIndexNow(env);
        return new Response(JSON.stringify({ success: true, message: 'IndexNow submitted' }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Debug: check KV contents
    // Manual comparison fact-check trigger
    if (path === '/api/trigger-compare' && url.searchParams.get('key') === 'vibeking2026') {
      try {
        await updateComparisonContent(env);
        return new Response(JSON.stringify({ success: true, message: 'Comparison content updated via AI' }), { headers: { 'Content-Type': 'application/json' } });
      } catch(e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { headers: { 'Content-Type': 'application/json' } });
      }
    }

    if (path === '/api/debug-kv' && url.searchParams.get('key') === 'vibeking2026') {
      const keys = ['trending_repos', 'model_rankings', 'news_index', 'repos_debug'];
      const result = {};
      for (const k of keys) {
        try {
          const val = await env.NEWS_KV.get(k);
          if (k === 'repos_debug') {
            result[k] = val ? JSON.parse(val) : 'NULL';
          } else {
            result[k] = val ? `${val.length} chars` : 'NULL';
          }
        } catch(e) { result[k] = `ERROR: ${e.message}`; }
      }
      return new Response(JSON.stringify(result, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    // ---- CORS preflight ----
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // ---- Init tools table (lazy, on first request) ----
    await initDB(env);

    // ---- API ROUTES (before HTML routes) ----

    // POST /api/articles — create article
    if (path === '/api/articles' && method === 'POST') {
      return handleApiArticleCreate(request, env);
    }

    // GET /api/articles — list articles
    if (path === '/api/articles' && method === 'GET') {
      return handleApiArticlesList(request, env);
    }

    // Public data feed for the awesome-ai-tools-2026 list generator.
    // The GitHub Action in that repo fetches this weekly to regenerate the
    // README, keeping the list auto-synced with the live catalog.
    if (path === '/api/awesome-data' && method === 'GET') {
      let models = SAMPLE_MODELS;
      try {
        if (env.NEWS_KV) {
          const r = await env.NEWS_KV.get('model_rankings', 'json');
          if (r && r.categories && Array.isArray(r.categories.overall) && r.categories.overall.length) {
            models = r.categories.overall;
          }
        }
      } catch { /* fall back to SAMPLE_MODELS */ }
      return new Response(JSON.stringify({
        generatedAt: new Date().toISOString(),
        site: 'https://whatstrending.ai',
        tools: AI_TOOLS_SEED,
        comparisons: COMPARISONS,
        models: models.slice(0, 20),
      }), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Routes with dynamic segments: /api/articles/:slugOrId
    const articleSlugMatch = path.match(/^\/api\/articles\/([^/]+)$/);
    if (articleSlugMatch) {
      const param = articleSlugMatch[1];

      // DELETE /api/articles/:id
      if (method === 'DELETE') {
        return handleApiArticleDelete(request, env, param);
      }

      // PUT /api/articles/:id
      if (method === 'PUT') {
        return handleApiArticleUpdate(request, env, param);
      }

      // GET /api/articles/:slug
      if (method === 'GET') {
        return handleApiArticleGet(param, env);
      }
    }

    // ---- MODELS API ROUTES ----

    // GET /api/models — list models
    if (path === '/api/models' && method === 'GET') {
      return handleApiModelsList(request, env);
    }

    // POST /api/models — create model
    if (path === '/api/models' && method === 'POST') {
      return handleApiModelCreate(request, env);
    }

    // Routes with dynamic segments: /api/models/:model_id
    const modelIdMatch = path.match(/^\/api\/models\/([^/]+)$/);
    if (modelIdMatch) {
      const modelId = modelIdMatch[1];

      if (method === 'GET') return handleApiModelGet(modelId, env);
      if (method === 'PUT') return handleApiModelUpdate(request, env, modelId);
      if (method === 'DELETE') return handleApiModelDelete(request, env, modelId);
    }

    // ---- HTML ROUTES ----

    // IndexNow verification key
    if (path === '/490353be25d0cb178076a513a46d91e9.txt') {
      return new Response('490353be25d0cb178076a513a46d91e9', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (path === '/favicon.svg' || path === '/favicon.ico') {
      return new Response(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="#00d4aa"/><text x="50" y="68" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="32" fill="#0a0a12">WT</text></svg>`, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=604800' },
      });
    }

    if (path === '/robots.txt') {
      return new Response(renderRobotsTxt(), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Dynamic OG image for news articles
    if (path === '/og') {
      const slug = url.searchParams.get('slug') || '';
      let article = null;
      try {
        if (env.NEWS_KV && slug) {
          article = await env.NEWS_KV.get(`news:${slug}`, 'json');
          if (!article) {
            const idx = await env.NEWS_KV.get('news_index', 'json');
            if (idx && Array.isArray(idx)) article = idx.find(a => a.slug === slug);
          }
        }
      } catch {}
      const title = article?.title || url.searchParams.get('title') || 'whatstrending.ai';
      const category = article?.category || url.searchParams.get('cat') || 'Industry';
      const source = article?.source || url.searchParams.get('source') || 'whatstrending.ai';
      const dateRaw = article?.date || '';
      const date = dateRaw ? new Date(dateRaw).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      const excerpt = article?.summary ? article.summary.split('\n')[0].slice(0, 160) : (url.searchParams.get('excerpt') || '');

      return new Response(renderOgSvg(title, category, source, date, excerpt), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400, s-maxage=604800',
        },
      });
    }

    // RSS Feed
    if (path === '/feed.xml' || path === '/rss' || path === '/rss.xml') {
      let feedArticles = [];
      try {
        const raw = await env.NEWS_KV.get('news_index', 'json');
        if (raw && Array.isArray(raw)) feedArticles = raw.slice(0, 20);
      } catch {}
      const rssItems = feedArticles.map(a => `
    <item>
      <title><![CDATA[${a.title}]]></title>
      <link>https://whatstrending.ai/news/${a.slug}</link>
      <guid>https://whatstrending.ai/news/${a.slug}</guid>
      <pubDate>${a.date ? new Date(a.date).toUTCString() : new Date().toUTCString()}</pubDate>
      <category>${a.category || 'Industry'}</category>
      <description><![CDATA[${(a.summary || '').split('\n')[0].slice(0, 300)}]]></description>
    </item>`).join('');
      const rssFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI News, Model Rankings & Trending AI Tools | whatstrending.ai</title>
    <link>https://whatstrending.ai</link>
    <description>The latest AI news, model rankings, trending repos, and tool discovery.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://whatstrending.ai/feed.xml" rel="self" type="application/rss+xml"/>
    ${rssItems}
  </channel>
</rss>`;
      return new Response(rssFeed, {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
      });
    }

    if (path === '/og-image.png' || path === '/og-preview.jpg') {
      const binaryStr = atob(OG_IMAGE_BASE64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      return new Response(bytes, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    // ---- NEWS ROUTES ----
    if (path === '/news') {
      let newsArticles = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('news_index', 'json');
          if (raw && Array.isArray(raw)) newsArticles = raw;
        }
      } catch { /* empty */ }
      const page = parseInt(url.searchParams.get('page') || '1');
      const perPage = 30;
      const totalPages = Math.ceil(newsArticles.length / perPage);
      const pageArticles = newsArticles.slice((page - 1) * perPage, page * perPage);
      return new Response(renderNewsPage(pageArticles, page, totalPages, newsArticles.length), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    // ---- NEWS TOPIC HUB PAGES ---- /news/[topic]
    const newsHubMatch = NEWS_TOPIC_HUBS.find(h => path === '/news/' + h.slug);
    if (newsHubMatch) {
      let allNews = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('news_index', 'json');
          if (raw && Array.isArray(raw)) allNews = raw;
        }
      } catch {}
      const kws = newsHubMatch.keywords.split(',').map(k => k.trim().toLowerCase());
      const matchKw = (text) => kws.some(k => (text || '').toLowerCase().includes(k));
      const hubArticles = allNews.filter(a => matchKw(a.title) || matchKw(a.summary) || matchKw(a.category)).slice(0, 50);
      return new Response(renderNewsTopicHubPage(newsHubMatch, hubArticles), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    const newsSlugMatch = path.match(/^\/news\/([^/]+)$/);
    if (newsSlugMatch) {
      const slug = newsSlugMatch[1];
      let article = null;
      let newsIndex = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get(`news:${slug}`, 'json');
          if (raw) article = raw;
          const idx = await env.NEWS_KV.get('news_index', 'json');
          if (idx && Array.isArray(idx)) newsIndex = idx;
        }
      } catch { /* */ }
      if (!article && newsIndex.length > 0) {
        article = newsIndex.find(a => a.slug === slug);
      }
      if (!article) {
        try {
          if (env.NEWS_KV) {
            const index = await env.NEWS_KV.get('news_index', 'json');
            if (index) {
              article = index.find(a => a.slug === slug);
              newsIndex = index;
            }
          }
        } catch { /* */ }
      }
      if (article) {
        // Related articles: same category, exclude current
        const related = newsIndex
          .filter(a => a.slug !== slug && a.category === article.category)
          .slice(0, 5);
        return new Response(renderNewsArticlePage(article, related), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      // 404 fallback
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- TOPIC PAGES ----
    if (path.startsWith('/topic/')) {
      const topicSlug = path.replace('/topic/', '');
      const topic = TRENDING_TOPICS.find(t => t.slug === topicSlug);
      if (!topic) return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      const kws = topic.keywords.split(',').map(k => k.trim().toLowerCase());
      let allNews = [], allRepos = [];
      try {
        if (env.NEWS_KV) {
          const nr = await env.NEWS_KV.get('news_index', 'json');
          if (nr && Array.isArray(nr)) allNews = nr;
          const rr = await env.NEWS_KV.get('trending_repos', 'json');
          if (rr && Array.isArray(rr)) allRepos = rr;
        }
      } catch {}
      const matchKw = (text) => kws.some(k => (text || '').toLowerCase().includes(k));
      const topicNews = allNews.filter(a => matchKw(a.title) || matchKw(a.summary) || matchKw(a.category)).slice(0, 20);
      const topicRepos = allRepos.filter(r => matchKw(r.name) || matchKw(r.description)).slice(0, 20);
      const topicTools = AI_TOOLS_SEED.filter(t => matchKw(t.name) || matchKw(t.description) || matchKw(t.category)).slice(0, 10);

      const html = `${renderPageHead(
        topic.name + ' — AI Trends | whatstrending.ai',
        'Latest news, repos, and tools about ' + topic.name + '. Updated every 6 hours.',
        '/topic/' + topic.slug
      )}
      <style>
        .topic-hero{padding:56px 0 40px;border-bottom:1px solid var(--border);margin-bottom:40px;}
        .topic-title{font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;}
        .topic-sub{font-size:14px;color:var(--text-secondary);}
        .topic-section{margin-bottom:48px;}
        .topic-section-title{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:500;letter-spacing:2.5px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:20px;padding-bottom:10px;border-bottom:1px solid var(--border);}
        .topic-item{display:block;padding:16px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:all 0.2s;}
        .topic-item:hover{padding-left:8px;}
        .ti-title{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;}
        .ti-meta{font-size:12px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;}
        .ti-desc{font-size:13px;color:var(--text-secondary);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .topic-empty{color:var(--text-tertiary);font-size:13px;padding:20px 0;}
        .topic-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px;}
        .topic-pills a{font-size:12px;color:var(--text-secondary);border:1px solid var(--border);padding:4px 12px;border-radius:6px;text-decoration:none;transition:border-color 0.2s;}
        .topic-pills a:hover{border-color:var(--accent);color:var(--accent);}
      </style>
      <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":topic.name,"description":"Latest AI trends about "+topic.name,"url":"https://whatstrending.ai/topic/"+topic.slug})}</script>
      </head><body>
      ${breadcrumbJsonLd([
        { name: 'Home', url: 'https://whatstrending.ai/' },
        { name: 'Topics', url: 'https://whatstrending.ai/' },
        { name: topic.name, url: 'https://whatstrending.ai/topic/' + topic.slug }
      ])}
      ${renderNav('trending')}
      <section class="topic-hero"><div class="container" style="position:relative;z-index:1;">
        <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${topic.name}</span></nav>
        <h1 class="topic-title">${topic.name}</h1>
        <p class="topic-sub">News, repos, and tools about ${topic.name}. Auto-updated every 6 hours.</p>
      </div></section>
      <div class="container" style="position:relative;z-index:1;">
        <div class="topic-section">
          <div class="topic-section-title">Latest News</div>
          ${topicNews.length > 0 ? topicNews.map(a => `<a href="/news/${a.slug}" class="topic-item"><div class="ti-title">${a.title}</div><div class="ti-meta">${a.source} · ${formatShortDate(a.date)}</div></a>`).join('') : '<div class="topic-empty">No news found for this topic yet.</div>'}
        </div>
        <div class="topic-section">
          <div class="topic-section-title">Trending Repos</div>
          ${topicRepos.length > 0 ? topicRepos.map(r => `<a href="/repos/${r.name}" class="topic-item"><div class="ti-title">${r.name}</div><div class="ti-desc">${(r.description||'').slice(0,120)}</div><div class="ti-meta">${r.language||''} · ${r.stars>=1000?(r.stars/1000).toFixed(1)+'k':r.stars} stars</div></a>`).join('') : '<div class="topic-empty">No repos found for this topic yet.</div>'}
        </div>
        ${topicTools.length > 0 ? `<div class="topic-section">
          <div class="topic-section-title">Related Tools</div>
          ${topicTools.map(t => `<a href="/tools/${t.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}" class="topic-item"><div class="ti-title">${t.name}</div><div class="ti-desc">${t.description||''}</div></a>`).join('')}
        </div>` : ''}
        <div class="topic-section">
          <div class="topic-section-title">Other Topics</div>
          <div class="topic-pills">${TRENDING_TOPICS.filter(t=>t.slug!==topicSlug).map(t=>`<a href="/topic/${t.slug}">${t.name}</a>`).join('')}</div>
        </div>
      </div>
      ${renderFooter()}
      </body></html>`;
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' } });
    }

    // ---- REPOS ROUTE ----
    if (path === '/repos') {
      let repos = [];
      const kvRepoNames = new Set();
      // Load current trending from KV (has starsToday)
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('trending_repos', 'json');
          if (raw && Array.isArray(raw)) {
            repos = raw;
            raw.forEach(r => kvRepoNames.add(r.name));
          }
        }
      } catch { /* empty */ }
      // Merge ALL non-suspicious archived repos from D1
      if (env.DB) {
        try {
          const dbRepos = await env.DB.prepare(
            "SELECT full_name, description, stars, language, url, trust, peak_stars FROM repos WHERE trust IN ('verified','trusted','community') ORDER BY stars DESC LIMIT 2000"
          ).all();
          if (dbRepos.results) {
            for (const r of dbRepos.results) {
              if (!kvRepoNames.has(r.full_name)) {
                repos.push({
                  name: r.full_name,
                  description: r.description || '',
                  stars: r.stars || 0,
                  language: r.language || 'Unknown',
                  url: r.url || `https://github.com/${r.full_name}`,
                  trust: r.trust || 'community',
                  starsToday: '',
                  source: 'archive',
                });
              }
            }
          }
        } catch { /* empty */ }
      }
      // Sort: trending (with starsToday) first, then by stars
      repos.sort((a, b) => {
        const aHot = a.starsToday ? 1 : 0;
        const bHot = b.starsToday ? 1 : 0;
        if (aHot !== bHot) return bHot - aHot;
        return (b.stars || 0) - (a.stars || 0);
      });
      return new Response(renderReposPage(repos), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    // Individual repo detail page: /repos/owner/name
    if (path.startsWith('/repos/') && path.split('/').length >= 4) {
      const parts = path.replace('/repos/', '').split('/');
      const repoFullName = parts[0] + '/' + parts[1];
      let repos = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('trending_repos', 'json');
          if (raw && Array.isArray(raw)) repos = raw;
        }
      } catch {}
      let repo = repos.find(r => r.name === repoFullName);
      // Fallback to D1 archive if not in current trending
      if (!repo && env.DB) {
        try {
          const dbRepo = await env.DB.prepare('SELECT * FROM repos WHERE full_name = ?').bind(repoFullName).first();
          if (dbRepo) {
            repo = { name: dbRepo.full_name, description: dbRepo.description, stars: dbRepo.stars, language: dbRepo.language, url: dbRepo.url, trust: dbRepo.trust, topics: dbRepo.topics, source: dbRepo.source };
          }
        } catch {}
      }
      if (!repo) {
        return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      }
      const trustColors = {verified:'#4ade80',trusted:'#60a5fa',community:'#a78bfa','new':'#fbbf24',caution:'#f87171'};
      const trustLabels = {verified:'Verified Org',trusted:'Trusted Project',community:'Community Project','new':'New Project',caution:'Use with Caution'};
      const tc = trustColors[repo.trust] || '#8b949e';
      const tl = trustLabels[repo.trust] || '';
      const owner = parts[0];
      const repoName = parts[1];
      const langColors = { Python:'#3572A5', TypeScript:'#3178c6', JavaScript:'#f1e05a', Rust:'#dea584', Go:'#00ADD8', Java:'#b07219' };
      const lc = langColors[repo.language] || '#888';
      const related = repos.filter(r => r.name !== repoFullName && r.language === repo.language).slice(0, 5);

      const html = `${renderPageHead(
        repoFullName + ' — Trending AI Repo | whatstrending.ai',
        (repo.description || repoFullName).slice(0, 160),
        '/repos/' + repoFullName
      )}
      <style>
        .repo-detail{max-width:720px;margin:0 auto;padding:40px 20px 80px;}
        .rd-header{margin-bottom:32px;}
        .rd-owner{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-tertiary);margin-bottom:4px;}
        .rd-name{font-size:28px;font-weight:700;color:var(--text-primary);margin-bottom:12px;}
        .rd-desc{font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:24px;}
        .rd-badges{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;}
        .rd-badge{font-family:'JetBrains Mono',monospace;font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid;}
        .rd-stats{display:flex;gap:20px;margin-bottom:32px;flex-wrap:wrap;}
        .rd-stat{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-tertiary);display:flex;align-items:center;gap:6px;}
        .rd-cta{display:inline-block;padding:12px 24px;background:var(--accent);color:white;font-weight:600;border-radius:8px;text-decoration:none;transition:background 0.2s;}
        .rd-cta:hover{opacity:0.85;}
        .rd-related{margin-top:48px;border-top:1px solid var(--border);padding-top:32px;}
        .rd-related-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;}
        .rd-related-item{display:block;padding:12px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;}
        .rd-related-item:hover .rd-ri-name{color:var(--accent);}
        .rd-ri-name{font-size:14px;font-weight:600;color:var(--text-primary);transition:color 0.2s;}
        .rd-ri-desc{font-size:12px;color:var(--text-tertiary);margin-top:4px;}
        .back-link{display:inline-block;margin-top:24px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);}
      </style>
      <script type="application/ld+json">${JSON.stringify({
        "@context":"https://schema.org",
        "@type":"SoftwareSourceCode",
        "name":repoName,
        "description":repo.description||'',
        "codeRepository":repo.url,
        "programmingLanguage":repo.language||'',
        "author":{"@type":"Organization","name":owner}
      })}</script>
      </head><body>
      ${breadcrumbJsonLd([
        { name: 'Home', url: 'https://whatstrending.ai/' },
        { name: 'Repos', url: 'https://whatstrending.ai/repos' },
        { name: repoFullName, url: 'https://whatstrending.ai/repos/' + repoFullName }
      ])}
      ${renderNav('repos')}
      <section class="repo-detail" style="position:relative;z-index:1;">
        <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:16px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><a href="/repos" style="color:var(--text-tertiary);">Repos</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;">${repoFullName}</span></nav>
        <div class="rd-header">
          <div class="rd-owner">${owner}</div>
          <h1 class="rd-name">${repoName}</h1>
          <p class="rd-desc">${repo.description || 'No description available.'}</p>
          <div class="rd-badges">
            ${tl ? `<span class="rd-badge" style="color:${tc};border-color:${tc}33;">${tl}</span>` : ''}
            ${repo.language ? `<span class="rd-badge" style="color:${lc};border-color:${lc}33;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${lc};margin-right:4px;"></span>${repo.language}</span>` : ''}
          </div>
          <div class="rd-stats">
            <span class="rd-stat"><svg width="14" height="14" viewBox="0 0 16 16" fill="#F59E0B"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>${repo.stars >= 1000 ? (repo.stars/1000).toFixed(1)+'k' : repo.stars} stars</span>
            ${repo.starsToday ? `<span class="rd-stat">${repo.starsToday}</span>` : ''}
            ${repo.source ? `<span class="rd-stat">via ${repo.source}</span>` : ''}
          </div>
          <a href="${repo.url}" target="_blank" rel="noopener" class="rd-cta">View on GitHub</a>
        </div>
        ${related.length > 0 ? `
        <div class="rd-related">
          <div class="rd-related-title">Related ${repo.language || ''} Repos</div>
          ${related.map(rel => `
          <a href="/repos/${rel.name}" class="rd-related-item">
            <div class="rd-ri-name">${rel.name}</div>
            <div class="rd-ri-desc">${(rel.description || '').slice(0, 100)}</div>
          </a>`).join('')}
        </div>` : ''}
        <a href="/repos" class="back-link">&larr; Back to Trending Repos</a>
      </section>
      ${renderFooter()}
      </body></html>`;
      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }
    // Any other /repos/* (e.g. single-segment /repos/foo that isn't owner/name)
    // → real 404 (was soft-404 to homepage). Valid repo URLs are /repos/owner/name.
    if (path.startsWith('/repos/')) {
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- TOOLS ROUTES ----
    if (path === '/tools') {
      const cat = url.searchParams.get('cat') || 'all';
      const tools = await getToolsFromDB(env, cat);
      return new Response(renderToolsPage(tools, cat), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    const toolSlugMatch = path.match(/^\/tools\/([^/]+)$/);
    if (toolSlugMatch) {
      const slug = toolSlugMatch[1];
      // Check if this is a category slug (e.g. /tools/coding → same as /category/coding)
      if (TOOL_CATEGORIES.includes(slug) || slug === 'open-source') {
        if (slug === 'open-source') {
          // Open source filter: tools with GitHub URLs
          const allTools = await getToolsFromDB(env, 'all');
          const osTools = allTools.filter(t => t.url && (t.url.includes('github.com') || (t.description && t.description.toLowerCase().includes('open source')) || (t.description && t.description.toLowerCase().includes('open-source'))));
          return new Response(renderCategoryPage('open-source', osTools), {
            headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
          });
        }
        const tools = await getToolsFromDB(env, slug);
        return new Response(renderCategoryPage(slug, tools), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      const tool = await getToolBySlug(env, slug);
      if (tool) {
        return new Response(renderToolPage(tool), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- CATEGORY ROUTES ----
    const catMatch = path.match(/^\/category\/([^/]+)$/);
    if (catMatch) {
      const category = catMatch[1];
      if (TOOL_CATEGORIES.includes(category)) {
        const tools = await getToolsFromDB(env, category);
        return new Response(renderCategoryPage(category, tools), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- COMPARE ROUTES ----
    if (path === '/compare') {
      return new Response(renderCompareHub(), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    // Redirect duplicate reverse comparisons to canonical direction
    const REVERSE_REDIRECTS = {
      'claude-vs-chatgpt': 'chatgpt-vs-claude',
      'gemini-vs-claude': 'claude-vs-gemini',
      'chatgpt-vs-perplexity': 'perplexity-vs-chatgpt',
      'bolt-vs-v0': 'v0-vs-bolt',
      'codex-vs-claude-code': 'claude-code-vs-codex',
    };

    const compareMatch = path.match(/^\/compare\/([^/]+)$/);
    if (compareMatch) {
      const slug = compareMatch[1];
      if (REVERSE_REDIRECTS[slug]) {
        return Response.redirect('https://whatstrending.ai/compare/' + REVERSE_REDIRECTS[slug], 301);
      }
      const comparison = COMPARISONS.find(c => c.slug === slug);
      if (comparison) {
        const toolA = AI_TOOLS_SEED.find(t => t.name === comparison.a) || null;
        const toolB = AI_TOOLS_SEED.find(t => t.name === comparison.b) || null;
        const compareContent = await getCompareContent(env);
        return new Response(renderComparePage(comparison, toolA, toolB, compareContent), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // Fetch articles and models from KV for all HTML pages
    let kvModels = null;
    if (env.NEWS_KV) {
      try { kvModels = await env.NEWS_KV.get('model_rankings', 'json'); } catch {}
    }
    const sidebarModelsRaw = (kvModels && kvModels.categories && kvModels.categories.overall)
      ? kvModels.categories.overall : SAMPLE_MODELS;

    const [articles, sidebarModels] = await Promise.all([
      getArticlesForDisplay(env),
      Promise.resolve(sidebarModelsRaw),
    ]);

    // ---- GUIDES (evergreen SEO pages) ----
    const GUIDES = {
      'best-ai-coding-tools': { title: 'Best AI Coding Tools in 2026', desc: 'The top AI-powered coding tools and IDE assistants for developers in 2026. Compare Cursor, Claude Code, GitHub Copilot, and more.', tools: ['Cursor','Claude Code','GitHub Copilot','Codex','Windsurf','Bolt','Replit','v0'] },
      'best-ai-image-generators': { title: 'Best AI Image Generators in 2026', desc: 'Compare the top AI image generation tools. Midjourney, DALL-E, Stable Diffusion, Flux, Leonardo and more.', tools: ['Midjourney','DALL-E','Stable Diffusion','Leonardo','Flux','Adobe Firefly','Ideogram'] },
      'best-ai-chatbots': { title: 'Best AI Chatbots in 2026', desc: 'ChatGPT, Claude, Gemini, Grok, Perplexity — which AI chatbot is best? Comprehensive comparison.', tools: ['ChatGPT','Claude','Gemini','Grok','Perplexity','Kagi'] },
      'best-ai-video-tools': { title: 'Best AI Video Generation Tools in 2026', desc: 'Compare Sora, Runway, Kling, Veo 3, Pika and other AI video tools for creators.', tools: ['Sora','Runway','Kling','Veo 3','Pika','HeyGen','Synthesia'] },
      'best-ai-writing-tools': { title: 'Best AI Writing Tools in 2026', desc: 'Top AI writing assistants for content creation, copywriting, and editing.', tools: ['Jasper','Copy.ai','Grammarly','QuillBot','Notion AI','Gamma'] },
      'open-source-llms-guide': { title: 'Open Source LLMs: Complete Guide for 2026', desc: 'Everything you need to know about open source large language models in 2026. Llama, Mistral, DeepSeek, Qwen, and more.', tools: ['Llama 4','Mistral','DeepSeek','Qwen','Gemma'] },
      'best-ai-tools-for-coding': { title: 'Best AI Tools for Coding in 2026', desc: 'Find the best AI coding tools and assistants in 2026. From AI-powered IDEs to terminal agents, these tools will transform your development workflow.', tools: ['Cursor','Claude Code','GitHub Copilot','Windsurf','Aider','Replit','v0','Bolt'], longContent: '<h2>Why Developers Need AI Coding Tools in 2026</h2><p>AI coding tools have fundamentally changed how software is written. In 2026, the best developers are not just writing code — they are reviewing and guiding AI-generated code. Studies show that developers using AI assistants accept suggestions for over 60% of their keystrokes, dramatically accelerating development speed.</p><p>The AI coding tool landscape splits into three categories: IDE-integrated assistants (Cursor, Copilot, Windsurf), terminal-native agents (Claude Code, Aider), and full-stack app builders (Bolt, v0, Replit). Each serves a different workflow, and many developers use tools from multiple categories.</p><h2>IDE-Integrated AI Assistants</h2><p>Cursor leads the IDE category with its AI-native approach built on VS Code. It offers multi-file editing, codebase-wide awareness, and support for multiple AI models including Claude, GPT-5, and Gemini. At $20/month for Pro, it provides deep AI integration that treats code generation as a first-class feature.</p><p>GitHub Copilot remains the most popular option with its native GitHub integration and competitive $10/month pricing. The recent addition of cloud agents that can create PRs automatically has made it more competitive with standalone tools.</p><p>Windsurf by Codeium offers a polished experience with its Cascade feature for multi-step tasks. Its smoother learning curve makes it ideal for developers new to AI-assisted coding.</p><h2>Terminal-Native Coding Agents</h2><p>Claude Code by Anthropic operates in the terminal, reading entire repositories and executing multi-step tasks autonomously. It excels at large codebase refactoring, writing tests, and implementing complex features across multiple files. Claude Code is the tool of choice for senior engineers who want maximum autonomy from their AI assistant.</p><p>Aider is an open-source alternative that integrates deeply with git and supports multiple LLM backends. It is free to use with your own API keys, making it the most cost-effective option for developers who want terminal-native AI assistance.</p><h2>Full-Stack App Builders</h2><p>For rapid prototyping and MVP creation, tools like Bolt, v0, and Replit can generate complete applications from text descriptions. v0 excels at frontend components with polished React and Tailwind output, while Bolt handles full-stack generation including backend logic and databases.</p><h2>How to Choose</h2><p>Choose Cursor if you want the deepest AI integration in a visual IDE. Choose Claude Code if you prefer terminal workflows and need autonomous multi-file capabilities. Choose Copilot if you want solid AI at a lower price with native GitHub integration. Choose Bolt or v0 if you need to go from idea to working prototype in minutes.</p>' },
      'best-ai-tools-for-writing': { title: 'Best AI Tools for Writing in 2026', desc: 'Top AI writing assistants for content creation, copywriting, blogging, and editing in 2026. Compare Jasper, Grammarly, Copy.ai, and more.', tools: ['Jasper','Copy.ai','Grammarly','QuillBot','Writesonic','Rytr','Notion AI','Claude'], longContent: '<h2>The State of AI Writing Tools in 2026</h2><p>AI writing tools have matured from basic text generators into sophisticated content platforms. In 2026, the best AI writing tools understand brand voice, maintain consistency across campaigns, and produce content that requires minimal human editing. Whether you are a marketer, blogger, student, or business professional, there is an AI writing tool designed for your specific needs.</p><h2>Enterprise Marketing Platforms</h2><p>Jasper is the leading enterprise AI content platform, offering brand voice control, campaign-level content planning, and team collaboration features. It is designed for marketing teams that need to produce consistent, on-brand content at scale. With enterprise-grade security and compliance features, Jasper is trusted by major brands worldwide.</p><p>Copy.ai has evolved from a simple copywriting tool into a full go-to-market AI platform. Its workflow automation features go beyond writing, helping sales teams generate outreach sequences, follow-up emails, and personalized messaging at scale.</p><h2>Writing Assistants for Everyone</h2><p>Grammarly remains the most widely used AI writing assistant, offering real-time grammar, tone, and clarity suggestions across browsers, email clients, and desktop applications. Its AI-powered full rewrite feature now generates complete alternative versions of your text while maintaining your intent.</p><p>QuillBot specializes in paraphrasing and rewording, making it invaluable for students, academics, and anyone who needs to rephrase content. Its integrated summarizer and citation generator make it a complete academic writing toolkit.</p><h2>AI-Powered Content Creation</h2><p>Writesonic focuses on SEO-optimized content, generating blog posts that are structured for search engine visibility. Its AI Article Writer can produce long-form content with proper heading hierarchy, keyword integration, and meta descriptions.</p><p>For workspace-integrated AI writing, Notion AI embeds AI assistance directly into your documents, wikis, and databases. It can draft content, summarize meeting notes, generate action items, and answer questions about your workspace content.</p><h2>Using General-Purpose AI for Writing</h2><p>Claude and ChatGPT deserve mention as powerful writing tools despite being general-purpose assistants. Claude excels at nuanced, well-structured writing that follows complex instructions precisely. ChatGPT offers creative brainstorming and versatile content generation. Many professional writers use these alongside dedicated writing tools.</p><h2>Choosing the Right Tool</h2><p>Choose Jasper for enterprise marketing teams needing brand-consistent content at scale. Choose Grammarly for cross-platform writing assistance and grammar checking. Choose Copy.ai for sales and go-to-market workflows. Choose QuillBot for academic writing and paraphrasing. Choose Claude or ChatGPT for general-purpose high-quality writing.</p>' },
      'best-ai-tools-for-image-generation': { title: 'Best AI Tools for Image Generation in 2026', desc: 'Compare the best AI image generators in 2026: Midjourney, DALL-E, Stable Diffusion, Flux, and more. Find the right tool for your creative workflow.', tools: ['Midjourney','DALL-E','Stable Diffusion','Flux','Leonardo','Ideogram','Canva AI'], longContent: '<h2>AI Image Generation in 2026: A Creative Revolution</h2><p>AI image generation has reached a level of quality that makes AI-generated images virtually indistinguishable from professional photography and digital art. In 2026, creators, designers, and businesses use AI image tools for everything from concept art and marketing visuals to product mockups and social media content.</p><h2>Premium Cloud-Based Generators</h2><p>Midjourney remains the gold standard for artistic quality. Its v6+ models produce stunning, aesthetically refined images with a cinematic quality that makes them immediately usable for professional work. The Discord-based workflow has a learning curve, but the community aspect provides endless inspiration and prompt ideas. Plans start at $10/month.</p><p>DALL-E, integrated directly into ChatGPT, offers the most accessible AI image generation experience. Simply describe what you want in conversation. DALL-E 3 excels at text rendering in images — generating signs, logos, and typography accurately — which remains a weakness for most competitors. It also offers inpainting and outpainting for precise image editing.</p><p>Ideogram has carved a niche with exceptional text rendering accuracy, making it the go-to choice for designs that combine imagery with readable text elements.</p><h2>Open Source Options</h2><p>Stable Diffusion remains the most popular open-source image generation model. Running locally on consumer GPUs, it offers unlimited generation with no per-image cost and complete privacy. The massive ecosystem of custom models, LoRAs, ControlNet, and workflow tools (ComfyUI, Automatic1111) makes it the most customizable option available.</p><p>Flux by Black Forest Labs is the newer open-source contender, offering superior image quality and prompt adherence out of the box. It requires fewer generation steps than Stable Diffusion, making it faster on the same hardware. Flux has quickly become the preferred choice for developers building image generation into their applications.</p><h2>Creative Suites and Specialized Tools</h2><p>Leonardo offers a real-time canvas for iterative editing and the ability to fine-tune custom models on your own data, making it popular with game developers and asset creators. Canva AI integrates image generation into its design platform with Magic Studio, making AI imagery accessible to non-designers creating marketing materials and social media content.</p><h2>How to Choose</h2><p>Choose Midjourney for the highest artistic quality and creative community. Choose DALL-E for convenience and text in images. Choose Stable Diffusion for unlimited local generation and maximum customization. Choose Flux for the best open-source quality. Choose Leonardo for game assets and fine-tuned custom models. Choose Canva AI for quick marketing visuals.</p>' },
      'best-ai-tools-for-video': { title: 'Best AI Tools for Video Generation in 2026', desc: 'Top AI video generation tools compared in 2026: Sora, Runway, Kling, Veo 3, Pika, HeyGen, and Synthesia. Find the best AI video tool for your needs.', tools: ['Sora','Runway','Pika','Kling','HeyGen','Synthesia','Descript'], longContent: '<h2>AI Video Generation: The Frontier of Creative AI</h2><p>AI video generation has made remarkable progress in 2026. What started as flickering, incoherent clips has evolved into tools capable of producing cinematic-quality video with consistent characters, realistic physics, and temporal coherence. Professional creators now use AI video tools for pre-visualization, content creation, and even final production shots.</p><h2>Text-to-Video Generators</h2><p>Sora by OpenAI represents the highest-quality text-to-video generation available. It produces realistic scenes with complex motion, accurate physics simulation, and cinematic camera movements. Sora excels at generating longer clips (up to 60 seconds) with consistent characters and environments. Its Storyboard mode enables narrative control across multiple shots.</p><p>Runway Gen-4 Turbo is the industry-standard tool for professional video creators. Beyond generation, Runway offers video editing, inpainting, image-to-video, and video-to-video transformation. Its temporal coherence architecture eliminates the flickering artifacts common in earlier AI video. For production workflows, Runway is the most complete platform.</p><p>Kling by Kuaishou offers strong video generation with generous free credits, making it the most accessible option for creators on a budget. Its motion handling and physics understanding rival more expensive alternatives.</p><p>Pika specializes in quick, fun video creation with a simpler interface than competitors. Its lip-sync features and stylization options make it popular for social media content creators.</p><h2>AI Avatar and Presenter Tools</h2><p>HeyGen creates videos with realistic AI avatars that can speak in 40+ languages with natural lip-sync. It is ideal for marketing teams creating personalized video at scale, multilingual content, and sales outreach.</p><p>Synthesia focuses on enterprise training and L&D, offering professional avatars, SOC 2 compliance, and LMS platform integration. Its team collaboration features make it the choice for corporate video production.</p><h2>AI Video Editing</h2><p>Descript transforms video editing by letting you edit video the same way you edit a text document. Edit the transcript, and the video changes accordingly. Its AI features include filler word removal, voice cloning for corrections, and automatic eye contact adjustment.</p><h2>Google Veo 3</h2><p>Veo 3, available through Google AI Studio, introduces native audio generation synchronized with video — a first in the industry. For Google ecosystem users, Veo 3 integrates seamlessly with other Google AI tools and offers strong physics understanding in generated scenes.</p><h2>How to Choose</h2><p>Choose Sora for the highest visual fidelity and cinematic quality. Choose Runway for a complete professional video production toolkit. Choose Kling for budget-friendly video generation. Choose HeyGen for marketing videos with AI presenters. Choose Synthesia for corporate training content. Choose Descript for AI-powered video editing.</p>' },
      'best-ai-tools-for-research': { title: 'Best AI Tools for Research in 2026', desc: 'The best AI research tools in 2026 for academics, analysts, and professionals. Compare Perplexity, Claude, Elicit, and more for sourced, accurate research.', tools: ['Perplexity','Claude','ChatGPT','Kagi','Phind','You.com'], longContent: '<h2>AI-Powered Research in 2026</h2><p>AI research tools have transformed how professionals, academics, and analysts find, synthesize, and verify information. In 2026, the best AI research tools do not just search — they understand context, cite sources, and synthesize complex information across multiple documents.</p><h2>AI Search and Answer Engines</h2><p>Perplexity leads the AI research tool category with its citation-first approach. Every answer includes numbered references linking to original sources, making it invaluable for academic research, journalism, and any work requiring verifiable facts. Pro Search uses multi-step reasoning to break down complex research questions, and Focus modes let you search specifically within academic papers, YouTube videos, or Reddit discussions.</p><p>Kagi offers an ad-free, privacy-first search experience with AI summarization capabilities. Its Universal Summarizer can condense any URL or document, and customizable result rankings let you boost or block specific websites. For researchers who value clean, unbiased results without advertising influence, Kagi is the premium choice.</p><h2>AI Assistants for Deep Research</h2><p>Claude by Anthropic excels at analyzing long documents with its 1M token context window. Researchers can upload entire papers, reports, or datasets and ask detailed questions. Claude instruction-following precision makes it ideal for structured analysis tasks, literature reviews, and extracting specific data points from large document sets.</p><p>ChatGPT with its Deep Research feature can autonomously conduct multi-step research, browsing the web, synthesizing information from multiple sources, and producing structured reports. Its breadth of capabilities (code execution, data analysis, image understanding) makes it the most versatile research assistant.</p><h2>Developer-Focused Research</h2><p>Phind is optimized for technical research, providing code solutions and technical answers with source citations. For developers researching APIs, debugging issues, or learning new technologies, Phind combines search accuracy with code-aware understanding.</p><p>You.com offers a conversational AI search experience with multimodal understanding. Its ability to process images and documents alongside text queries makes it useful for research that spans multiple media types.</p><h2>How to Choose</h2><p>Choose Perplexity for sourced research with verifiable citations. Choose Claude for analyzing long documents and extracting insights from large texts. Choose ChatGPT for versatile multi-step research with data analysis. Choose Kagi for ad-free, privacy-first search. Choose Phind for developer-focused technical research.</p>' },
    };

    // ---- ALTERNATIVES HUB (real index page, links every alt page) ----
    // Previously /alternatives had no handler and soft-404'd to the homepage,
    // leaving all alt pages orphaned. This hub gives them a crawl path.
    if (path === '/alternatives') {
      const CAT_LABELS = {
        chat: 'AI Chat & Assistants', coding: 'AI Coding Tools', devtools: 'Developer Tools',
        image: 'AI Image Generation', video: 'AI Video Generation', writing: 'AI Writing',
        productivity: 'Productivity', search: 'AI Search & Research',
      };
      const byCat = {};
      AI_TOOLS_SEED.forEach(function(t) { (byCat[t.category] = byCat[t.category] || []).push(t); });
      const catOrder = Object.keys(byCat).sort(function(a, b) { return byCat[b].length - byCat[a].length; });
      const sections = catOrder.map(function(cat) {
        const items = byCat[cat].slice().sort(function(a, b) { return a.name.localeCompare(b.name); });
        const links = items.map(function(t) {
          return '<a href="/alternatives/' + toolSlug(t.name) + '-alternatives" style="display:block;padding:12px 16px;border:1px solid var(--border);border-radius:10px;color:var(--text-primary);font-size:14px;font-weight:500;text-decoration:none;">' +
            'Best ' + t.name + ' Alternatives' +
            '<span style="display:block;font-size:12px;color:var(--text-tertiary);font-weight:400;margin-top:2px;">' + (t.tagline || t.category) + '</span></a>';
        }).join('');
        return '<section style="margin-bottom:40px;">' +
          '<h2 style="font-size:20px;font-weight:600;color:var(--text-primary);margin-bottom:16px;">' + (CAT_LABELS[cat] || cat) + ' <span style="font-size:13px;color:var(--text-tertiary);font-weight:400;">(' + items.length + ')</span></h2>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">' + links + '</div></section>';
      }).join('');

      const hubHtml = renderPageHead(
        'AI Tool Alternatives Directory in 2026 | whatstrending.ai',
        'Find alternatives to every major AI tool. Compare ' + AI_TOOLS_SEED.length + ' AI tools across chat, coding, image, video, writing and more — features, pricing, and side-by-side comparisons.',
        '/alternatives'
      ) + `
      </head><body>
      ${breadcrumbJsonLd([{name:'Home',url:'https://whatstrending.ai/'},{name:'Alternatives',url:'https://whatstrending.ai/alternatives'}])}
      ${renderNav('alternatives')}
      <section class="container" style="max-width:960px;padding-top:40px;padding-bottom:80px;position:relative;z-index:1;">
        <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">Alternatives</span></nav>
        <h1 style="font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;">AI Tool Alternatives Directory</h1>
        <p style="font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:40px;">Looking for an alternative to a specific AI tool? Browse alternatives for ${AI_TOOLS_SEED.length} popular AI tools below. Each page compares similar tools on features, pricing, and use cases.</p>
        ${sections}
      </section>
      ${renderFooter()}
      </body></html>`;
      return new Response(hubHtml, {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    // ---- ALTERNATIVES PAGES (programmatic SEO) ----
    const altMatch = path.match(/^\/alternatives\/([^/]+)-alternatives$/);
    if (altMatch) {
      const toolName = altMatch[1];
      const tool = AI_TOOLS_SEED.find(function(t) { return toolSlug(t.name) === toolName; });
      if (tool) {
        const alternatives = AI_TOOLS_SEED.filter(function(t) { return t.category === tool.category && t.name !== tool.name; });
        const toolComps = COMPARISONS.filter(function(c) { return c.a === tool.name || c.b === tool.name; });
        const altCards = alternatives.map(function(alt) {
          var comp = COMPARISONS.find(function(c) { return (c.a === tool.name && c.b === alt.name) || (c.a === alt.name && c.b === tool.name); });
          return '<div style="padding:20px;border:1px solid var(--border);border-radius:12px;margin-bottom:12px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">' +
            '<div><h3 style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">' + alt.name + '</h3>' +
            '<p style="font-size:13px;color:var(--accent);">' + alt.tagline + '</p></div>' +
            '<span style="padding:4px 12px;border:1px solid var(--border);border-radius:20px;font-size:12px;color:' + (alt.pricing === 'free' ? 'var(--accent)' : alt.pricing === 'freemium' ? '#F59E0B' : '#EC4899') + ';">' + alt.pricing + '</span></div>' +
            '<p style="font-size:14px;color:var(--text-secondary);line-height:1.6;margin-bottom:12px;">' + alt.description + '</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '<a href="/tools/' + toolSlug(alt.name) + '" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;color:var(--text-secondary);">View Details</a>' +
            '<a href="/alternatives/' + toolSlug(alt.name) + '-alternatives" style="font-size:12px;padding:6px 12px;border:1px solid var(--border);border-radius:6px;color:var(--text-secondary);">' + alt.name + ' Alternatives</a>' +
            (comp ? '<a href="/compare/' + comp.slug + '" style="font-size:12px;padding:6px 12px;border:1px solid var(--accent);border-radius:6px;color:var(--accent);">' + tool.name + ' vs ' + alt.name + '</a>' : '') +
            '</div></div>';
        }).join('');

        var altPageHtml = renderPageHead(
          'Best ' + tool.name + ' Alternatives in 2026 | whatstrending.ai',
          'Looking for ' + tool.name + ' alternatives? Compare ' + alternatives.length + '+ similar ' + tool.category + ' tools with features, pricing, and side-by-side comparisons.',
          '/alternatives/' + toolName + '-alternatives'
        ) + `
        <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"ItemList","name":tool.name+" Alternatives","numberOfItems":alternatives.length,"itemListElement":alternatives.slice(0,10).map(function(a,i){return{"@type":"ListItem","position":i+1,"name":a.name,"url":"https://whatstrending.ai/tools/"+toolSlug(a.name)}})})}</script>
        </head><body>
        ${breadcrumbJsonLd([{name:'Home',url:'https://whatstrending.ai/'},{name:'Alternatives',url:'https://whatstrending.ai/alternatives'},{name:tool.name+' Alternatives',url:'https://whatstrending.ai/alternatives/'+toolName+'-alternatives'}])}
        ${renderNav('tools')}
        <section class="container" style="max-width:720px;padding-top:40px;padding-bottom:80px;position:relative;z-index:1;">
          <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);">${tool.name} Alternatives</span></nav>
          <h1 style="font-size:32px;font-weight:700;letter-spacing:-1px;color:var(--text-primary);margin-bottom:8px;">Best ${tool.name} Alternatives in 2026</h1>
          <p style="font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:32px;">Looking for something other than ${tool.name}? Here are ${alternatives.length} ${tool.category} tools that offer similar capabilities. Each alternative is compared on features, pricing, and use cases.</p>
          <div style="padding:16px;border:1px solid var(--border);border-radius:12px;margin-bottom:32px;background:rgba(52,211,153,0.03);">
            <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:4px;">Currently comparing against:</p>
            <p style="font-size:16px;font-weight:600;color:var(--text-primary);">${tool.name} — ${tool.tagline}</p>
            <p style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${tool.pricing} · <a href="/tools/${toolSlug(tool.name)}" style="color:var(--accent);">View full review</a></p>
          </div>
          ${altCards}
          <a href="/tools" style="display:inline-block;margin-top:24px;font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--accent);">&larr; Back to Tools Directory</a>
        </section>
        ${renderFooter()}
        </body></html>`;
        return new Response(altPageHtml, {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      // Unknown tool slug → REAL 404. Previously this fell through to the
      // homepage with HTTP 200 (soft-404), which created hundreds of duplicate
      // pages all canonicalizing to the homepage and tanked indexing of the
      // entire /alternatives/ section.
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    if (path.startsWith('/guide/') && GUIDES[path.replace('/guide/', '')]) {
      const slug = path.replace('/guide/', '');
      const guide = GUIDES[slug];
      const toolCards = guide.tools.map(t => {
        const tool = AI_TOOLS_SEED.find(x => x.name === t);
        return tool ? `<div style="padding:16px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${tool.name}</div><div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${tool.tagline || tool.description}</div><div style="margin-top:8px;font-size:12px;color:var(--accent);">${tool.pricing}</div></div>` : `<div style="padding:16px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:15px;font-weight:600;color:var(--text-primary);">${t}</div></div>`;
      }).join('');

      return new Response(`${renderPageHead(guide.title + ' | whatstrending.ai', guide.desc, '/guide/' + slug)}
      <style>
        .guide{max-width:720px;margin:0 auto;padding:48px 20px 80px;}
        .guide h1{font-size:32px;font-weight:700;letter-spacing:-1px;margin-bottom:12px;}
        .guide .lead{font-size:16px;color:var(--text-secondary);line-height:1.7;margin-bottom:32px;}
        .guide-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;margin-bottom:40px;}
        .guide h2{font-size:20px;font-weight:600;margin:32px 0 16px;}
        .guide p{font-size:15px;color:var(--text-secondary);line-height:1.7;margin-bottom:16px;}
        .guide-cta{display:inline-block;margin-top:16px;padding:10px 20px;background:var(--accent);color:white;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;}
        .guide-related{margin-top:48px;padding-top:32px;border-top:1px solid var(--border);}
        .guide-related-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;}
        .guide-related-links{display:flex;flex-direction:column;gap:8px;}
        .guide-related-links a{font-size:14px;color:var(--accent);text-decoration:none;}
      </style>
      <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"Article","headline":guide.title,"description":guide.desc,"url":"https://whatstrending.ai/guide/"+slug,"publisher":{"@type":"Organization","name":"whatstrending.ai"},"datePublished":"2026-05-06","dateModified":"2026-05-06"})}</script>
      </head><body>
      ${breadcrumbJsonLd([
        { name: 'Home', url: 'https://whatstrending.ai/' },
        { name: 'Guides', url: 'https://whatstrending.ai/' },
        { name: guide.title, url: 'https://whatstrending.ai/guide/' + slug }
      ])}
      ${renderNav('guide')}
      <section class="guide" style="position:relative;z-index:1;">
        <nav style="font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-tertiary);margin-bottom:24px;display:flex;align-items:center;gap:8px;"><a href="/" style="color:var(--text-tertiary);">Home</a><span style="opacity:0.5;">/</span><span style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:300px;">${guide.title}</span></nav>
        <h1>${guide.title}</h1>
        <p class="lead">${guide.desc}</p>
        <div class="guide-grid">${toolCards}</div>
        ${guide.longContent ? `<div style="font-size:15px;color:var(--text-secondary);line-height:1.8;">${guide.longContent}</div>` : `<h2>How we evaluate</h2>
        <p>We look at real-world performance, pricing, ease of use, and community adoption. Our rankings are based on data from multiple sources including model benchmarks, GitHub stars, and user reviews.</p>
        <p>This guide is updated regularly as new tools emerge and existing ones improve.</p>`}
        <a href="/tools" class="guide-cta">Browse all AI tools</a>
        <div class="guide-related">
          <div class="guide-related-title">More Guides</div>
          <div class="guide-related-links">
            ${Object.entries(GUIDES).filter(([s]) => s !== slug).map(([s, g]) => `<a href="/guide/${s}">${g.title}</a>`).join('')}
          </div>
        </div>
      </section>
      ${renderFooter()}
      </body></html>`, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
    }
    // Any /guide/* not in the GUIDES map → real 404 (was soft-404 to homepage).
    if (path.startsWith('/guide/')) {
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- SEARCH ----
    if (path === '/search') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      let allNews = [], allRepos = [];
      try {
        if (env.NEWS_KV) {
          const nr = await env.NEWS_KV.get('news_index', 'json');
          if (nr && Array.isArray(nr)) allNews = nr;
          const rr = await env.NEWS_KV.get('trending_repos', 'json');
          if (rr && Array.isArray(rr)) allRepos = rr;
        }
      } catch {}
      const allTools = await getToolsFromDB(env, 'all');
      const match = (text) => (text || '').toLowerCase().includes(q);
      const newsResults = q ? allNews.filter(a => match(a.title) || match(a.summary)).slice(0, 15) : [];
      const repoResults = q ? allRepos.filter(r => match(r.name) || match(r.description)).slice(0, 15) : [];
      const toolResults = q ? allTools.filter(t => match(t.name) || match(t.description) || match(t.tagline)).slice(0, 10) : [];
      const total = newsResults.length + repoResults.length + toolResults.length;

      return new Response(`${renderPageHead(
        q ? q + ' — Search | whatstrending.ai' : 'Search — whatstrending.ai',
        'Search across AI news, trending repos, and tools on whatstrending.ai.',
        '/search'
      )}
      <style>
        .search-page{max-width:720px;margin:0 auto;padding:40px 20px 80px;}
        .search-bar{display:flex;gap:8px;margin-bottom:32px;}
        .search-input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;color:var(--text-primary);font-size:15px;outline:none;font-family:inherit;}
        .search-input:focus{border-color:var(--accent);}
        .search-btn{background:var(--accent);color:white;border:none;border-radius:10px;padding:14px 20px;font-weight:600;cursor:pointer;font-size:14px;}
        .sr-section{margin-bottom:32px;}
        .sr-title{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border);}
        .sr-item{display:block;padding:14px 0;border-bottom:1px solid var(--border);text-decoration:none;color:inherit;transition:padding-left 0.2s;}
        .sr-item:hover{padding-left:8px;}
        .sr-item-title{font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;}
        .sr-item-meta{font-size:12px;color:var(--text-tertiary);font-family:'JetBrains Mono',monospace;}
        .sr-empty{color:var(--text-tertiary);font-size:14px;padding:40px 0;text-align:center;}
        .sr-count{font-size:13px;color:var(--text-tertiary);margin-bottom:24px;}
      </style>
      </head><body>
      ${renderNav('search')}
      <section class="search-page" style="position:relative;z-index:1;">
        <form action="/search" method="GET" class="search-bar">
          <input class="search-input" name="q" value="${q}" placeholder="Search news, repos, tools..." autofocus/>
          <button type="submit" class="search-btn">Search</button>
        </form>
        ${q ? `<div class="sr-count">${total} results for "${q}"</div>` : ''}
        ${newsResults.length > 0 ? `<div class="sr-section"><div class="sr-title">News (${newsResults.length})</div>${newsResults.map(a => `<a href="/news/${a.slug}" class="sr-item"><div class="sr-item-title">${a.title}</div><div class="sr-item-meta">${a.source} · ${formatShortDate(a.date)}</div></a>`).join('')}</div>` : ''}
        ${repoResults.length > 0 ? `<div class="sr-section"><div class="sr-title">Repos (${repoResults.length})</div>${repoResults.map(r => `<a href="/repos/${r.name}" class="sr-item"><div class="sr-item-title">${r.name}</div><div class="sr-item-meta">${r.language || ''} · ${r.stars >= 1000 ? (r.stars/1000).toFixed(1)+'k' : r.stars} stars</div></a>`).join('')}</div>` : ''}
        ${toolResults.length > 0 ? `<div class="sr-section"><div class="sr-title">Tools (${toolResults.length})</div>${toolResults.map(t => `<a href="/tools/${t.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}" class="sr-item"><div class="sr-item-title">${t.name}</div><div class="sr-item-meta">${t.category} · ${t.pricing}</div></a>`).join('')}</div>` : ''}
        ${q && total === 0 ? '<div class="sr-empty">No results found. Try a different search term.</div>' : ''}
        ${!q ? '<div class="sr-empty">Type something to search across all AI news, repos, and tools.</div>' : ''}
      </section>
      ${renderFooter()}
      </body></html>`, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- ABOUT PAGE ----
    if (path === '/about') {
      return new Response(`${renderPageHead('About — whatstrending.ai','About whatstrending.ai, an AI intelligence dashboard tracking what matters in artificial intelligence.','/about')}
      <style>
        .about{max-width:680px;margin:0 auto;padding:60px 20px 80px;}
        .about h1{font-size:32px;font-weight:700;margin-bottom:24px;letter-spacing:-1px;}
        .about p{font-size:15px;color:var(--text-secondary);line-height:1.8;margin-bottom:20px;}
        .about h2{font-size:18px;font-weight:600;margin:32px 0 12px;color:var(--text-primary);}
        .about a{color:var(--accent);}
        .about ul{margin:0 0 20px 20px;color:var(--text-secondary);line-height:1.8;}
      </style>
      <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"AboutPage","name":"About whatstrending.ai","url":"https://whatstrending.ai/about"})}</script>
      </head><body>
      ${renderNav('about')}
      <section class="about" style="position:relative;z-index:1;">
        <h1>About whatstrending.ai</h1>
        <p>whatstrending.ai is an AI intelligence dashboard that tracks what matters in artificial intelligence. News, model rankings, trending GitHub repos, tools, and comparisons — all auto-updated every 6 hours.</p>
        <h2>What we track</h2>
        <ul>
          <li>AI news from top tech sources, updated every 6 hours</li>
          <li>Real-time model rankings and leaderboards</li>
          <li>100+ trending GitHub repos with trust scores</li>
          <li>50+ AI tools across 8 categories</li>
          <li>49 head-to-head tool comparisons</li>
          <li>10 topic hubs for focused exploration</li>
        </ul>
        <h2>Why we built this</h2>
        <p>The AI space moves too fast. We got tired of checking 15 different sources every morning just to stay current. So we built a dashboard that does it automatically.</p>
        <p>Everything updates every 6 hours. No manual curation, no editorial bias. Just data.</p>
        <h2>Contact</h2>
        <p>Have feedback or suggestions? Reach out on <a href="https://x.com" target="_blank" rel="noopener">X / Twitter</a>.</p>
      </section>
      ${renderFooter()}
      </body></html>`, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- SUBMIT PAGE ----
    if (path === '/submit') {
      return new Response(`${renderPageHead('Submit a Tool or Repo — whatstrending.ai','Submit an AI tool or GitHub repository to be featured on whatstrending.ai.','/submit')}
      <style>
        .submit-page{max-width:580px;margin:0 auto;padding:60px 20px 80px;}
        .submit-page h1{font-size:28px;font-weight:700;margin-bottom:8px;letter-spacing:-1px;}
        .submit-page .sub{font-size:14px;color:var(--text-tertiary);margin-bottom:32px;}
        .sf-group{margin-bottom:20px;}
        .sf-label{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text-tertiary);margin-bottom:6px;display:block;}
        .sf-input{width:100%;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px;color:var(--text-primary);font-family:inherit;font-size:14px;outline:none;transition:border-color 0.2s;}
        .sf-input:focus{border-color:var(--accent);}
        .sf-textarea{min-height:100px;resize:vertical;}
        .sf-btn{width:100%;padding:14px;background:var(--accent);color:white;font-weight:600;border:none;border-radius:8px;cursor:pointer;font-size:15px;transition:opacity 0.2s;margin-top:8px;}
        .sf-btn:hover{opacity:0.85;}
        .sf-note{font-size:12px;color:var(--text-tertiary);margin-top:16px;text-align:center;}
      </style>
      </head><body>
      ${renderNav('submit')}
      <section class="submit-page" style="position:relative;z-index:1;">
        <h1>Submit a Tool or Repo</h1>
        <p class="sub">Know an AI tool or GitHub repo that should be featured? Let us know.</p>
        <form id="submitForm" onsubmit="handleSubmit(event)">
          <div class="sf-group">
            <label class="sf-label">Type</label>
            <select class="sf-input" name="type" required><option value="tool">AI Tool</option><option value="repo">GitHub Repo</option></select>
          </div>
          <div class="sf-group">
            <label class="sf-label">Name</label>
            <input class="sf-input" name="name" placeholder="e.g. Claude Code" required/>
          </div>
          <div class="sf-group">
            <label class="sf-label">URL</label>
            <input class="sf-input" name="url" type="url" placeholder="https://..." required/>
          </div>
          <div class="sf-group">
            <label class="sf-label">Description</label>
            <textarea class="sf-input sf-textarea" name="description" placeholder="What does it do?"></textarea>
          </div>
          <div class="sf-group">
            <label class="sf-label">Your email (optional)</label>
            <input class="sf-input" name="email" type="email" placeholder="you@email.com"/>
          </div>
          <button type="submit" class="sf-btn">Submit</button>
          <p class="sf-note">Submissions are reviewed manually. We add quality tools and repos that provide real value.</p>
        </form>
      </section>
      <script>
        function handleSubmit(e){
          e.preventDefault();
          var f=e.target;
          var data={type:f.type.value,name:f.name.value,url:f.url.value,description:f.description.value,email:f.email.value};
          fetch('/api/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).then(function(){
            f.innerHTML='<div style="text-align:center;padding:40px;color:var(--accent);font-size:16px;">Thanks! Your submission has been received.</div>';
          }).catch(function(){
            f.innerHTML='<div style="text-align:center;padding:40px;color:#f87171;">Something went wrong. Try again later.</div>';
          });
        }
      </script>
      ${renderFooter()}
      </body></html>`, { headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- SUBSCRIBE API ----
    if (path === '/api/subscribe' && method === 'POST') {
      try {
        const data = await request.json();
        const email = (data.email || '').trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return errorResponse('Invalid email address', 400);
        }
        if (env.DB) {
          await env.DB.prepare('INSERT OR IGNORE INTO emails (email) VALUES (?)').bind(email).run();
        }
        return jsonResponse({ success: true, message: "Thanks! We'll send you the weekly AI digest." });
      } catch (e) {
        return errorResponse('Failed to subscribe: ' + e.message, 500);
      }
    }

    // ---- VIEW TRACKING API ----
    if (path === '/api/track-view' && method === 'POST') {
      try {
        const data = await request.json();
        const slug = (data.slug || '').trim();
        if (!slug || slug.length > 200) {
          return jsonResponse({ success: false }, 400);
        }
        if (env.NEWS_KV) {
          const key = `views:${slug}`;
          const current = await env.NEWS_KV.get(key);
          const count = (parseInt(current, 10) || 0) + 1;
          await env.NEWS_KV.put(key, String(count));
          return jsonResponse({ success: true, views: count });
        }
        return jsonResponse({ success: true, views: 0 });
      } catch (e) {
        return jsonResponse({ success: false }, 500);
      }
    }

    // ---- MOST READ API ----
    if (path === '/api/most-read' && method === 'GET') {
      try {
        if (!env.NEWS_KV) return successResponse([]);
        const list = await env.NEWS_KV.list({ prefix: 'views:' });
        const entries = [];
        for (const key of list.keys) {
          const val = await env.NEWS_KV.get(key.name);
          const slug = key.name.replace('views:', '');
          entries.push({ slug, views: parseInt(val, 10) || 0 });
        }
        entries.sort((a, b) => b.views - a.views);
        return successResponse(entries.slice(0, 10));
      } catch (e) {
        return errorResponse('Failed: ' + e.message, 500);
      }
    }

    // ---- SUBMIT API ----
    if (path === '/api/submit' && request.method === 'POST') {
      try {
        const data = await request.json();
        if (env.DB) {
          await env.DB.prepare("CREATE TABLE IF NOT EXISTS submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, name TEXT, url TEXT, description TEXT, email TEXT, created_at TEXT DEFAULT (datetime('now')))").run();
          await env.DB.prepare('INSERT INTO submissions (type, name, url, description, email) VALUES (?, ?, ?, ?, ?)').bind(data.type || '', data.name || '', data.url || '', data.description || '', data.email || '').run();
        }
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
      }
    }

    // ---- SEO: TRENDING TOPIC PAGES ---- /trending/[topic-slug]
    const trendingSlugMatch = path.match(/^\/trending\/([a-z0-9-]+)$/);
    if (trendingSlugMatch) {
      const tSlug = trendingSlugMatch[1];
      const seoTopic = SEO_TRENDING_TOPICS.find(t => t.slug === tSlug);
      if (seoTopic) {
        let allNews = [];
        try {
          if (env.NEWS_KV) {
            const raw = await env.NEWS_KV.get('news_index', 'json');
            if (raw && Array.isArray(raw)) allNews = raw;
          }
        } catch {}
        const kws = seoTopic.keywords.split(',').map(k => k.trim().toLowerCase());
        const matchKw = (text) => kws.some(k => (text || '').toLowerCase().includes(k));
        const topicArticles = allNews.filter(a => matchKw(a.title) || matchKw(a.summary) || matchKw(a.category)).slice(0, 50);
        return new Response(renderSeoTrendingPage(seoTopic, topicArticles), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- SEO: FACT-CHECK VERIFY PAGES ---- /verify/[article-slug]
    const verifySlugMatch = path.match(/^\/verify\/([^/]+)$/);
    if (verifySlugMatch) {
      const vSlug = verifySlugMatch[1];
      let article = null;
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get(`news:${vSlug}`, 'json');
          if (raw) article = raw;
          if (!article) {
            const idx = await env.NEWS_KV.get('news_index', 'json');
            if (idx && Array.isArray(idx)) article = idx.find(a => a.slug === vSlug);
          }
        }
      } catch {}
      if (article) {
        return new Response(renderVerifyPage(article), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- SEO: DAILY DIGEST PAGES ---- /digest/[YYYY-MM-DD]
    const digestMatch = path.match(/^\/digest\/(\d{4}-\d{2}-\d{2})$/);
    if (digestMatch) {
      const digestDate = digestMatch[1];
      // Validate date
      const parsed = new Date(digestDate + 'T00:00:00Z');
      if (isNaN(parsed.getTime())) {
        return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
      }
      let allNews = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('news_index', 'json');
          if (raw && Array.isArray(raw)) allNews = raw;
        }
      } catch {}
      const digestArticles = allNews.filter(function(a) {
        if (!a.date) return false;
        try { return new Date(a.date).toISOString().split('T')[0] === digestDate; } catch { return false; }
      });
      return new Response(renderDigestPage(digestDate, digestArticles), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
      });
    }
    // Any /digest/* that isn't a valid YYYY-MM-DD date → real 404 (was soft-404).
    if (path.startsWith('/digest/')) {
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- GLOSSARY INDEX ---- /glossary
    if (path === '/glossary') {
      return new Response(renderGlossaryIndexPage(), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
      });
    }

    // ---- GLOSSARY TERM PAGES ---- /glossary/[term]
    const glossaryMatch = path.match(/^\/glossary\/([a-z0-9-]+)$/);
    if (glossaryMatch) {
      const gSlug = glossaryMatch[1];
      const glossaryEntry = GLOSSARY_TERMS.find(t => t.slug === gSlug);
      if (glossaryEntry) {
        // Find related articles by matching the term keywords in news
        let relatedArticles = [];
        try {
          if (env.NEWS_KV) {
            const raw = await env.NEWS_KV.get('news_index', 'json');
            if (raw && Array.isArray(raw)) {
              const termLower = glossaryEntry.short.toLowerCase();
              const termWords = termLower.split(/[\s()]+/).filter(w => w.length > 2);
              relatedArticles = raw.filter(a => {
                const text = ((a.title || '') + ' ' + (a.summary || '')).toLowerCase();
                return termWords.some(w => text.includes(w));
              }).slice(0, 5);
            }
          }
        } catch {}
        return new Response(renderGlossaryTermPage(glossaryEntry, relatedArticles), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // ---- NEWS SITEMAP (Google News) ----
    if (path === '/news-sitemap.xml') {
      let newsArticles = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('news_index', 'json');
          if (raw && Array.isArray(raw)) newsArticles = raw;
        }
      } catch { /* */ }
      return new Response(renderNewsSitemapXml(newsArticles), {
        headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=7200' },
      });
    }

    // ---- SITEMAP ----
    if (path === '/sitemap.xml') {
      let newsArticles = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('news_index', 'json');
          if (raw && Array.isArray(raw)) newsArticles = raw;
        }
      } catch { /* */ }
      const allTools = await getToolsFromDB(env, 'all');
      let sitemapRepos = [];
      try { if (env.NEWS_KV) { const rr = await env.NEWS_KV.get('trending_repos', 'json'); if (rr && Array.isArray(rr)) sitemapRepos = rr; } } catch {}
      return new Response(await renderSitemapXml(articles, newsArticles, allTools, sitemapRepos, env), {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    // Story pages
    if (path.startsWith('/story/')) {
      const slug = path.replace('/story/', '');
      const article = articles.find(a => a.slug === slug);
      if (article) {
        return new Response(renderStoryPage(article, articles), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // Individual model detail pages
    const modelSlugMatch = path.match(/^\/models\/([^/]+)$/);
    if (modelSlugMatch) {
      const mSlug = modelSlugMatch[1];
      const modelDetail = MODEL_DETAILS[mSlug];
      if (modelDetail) {
        return new Response(renderModelDetailPage(modelDetail), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
        });
      }
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // Models leaderboard — use LMSYS KV data with fallback
    if (path === '/models') {
      let rankings = null;
      try {
        if (env.NEWS_KV) {
          rankings = await env.NEWS_KV.get('model_rankings', 'json');
        }
      } catch { /* fallback */ }
      return new Response(renderModelsPage(rankings), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=3600' },
      });
    }

    // ROOT CATCH-ALL FIX: the homepage is served ONLY for the exact root path.
    // Previously this block served the homepage with HTTP 200 for ANY unmatched
    // path, creating unlimited soft-404 duplicate pages that poisoned indexing
    // site-wide. Anything that reached here and isn't '/' is a genuine 404.
    if (path !== '/') {
      return new Response(render404Page(), { status: 404, headers: { 'Content-Type': 'text/html;charset=utf-8' } });
    }

    // Serve homepage for GET / — full dashboard with KV + DB data
    let newsLatest = [];
    let modelRankings = null;
    let trendingRepos = [];
    let dashboardTools = [];

    try {
      const [newsRaw, modelsRaw, reposRaw, toolsRaw] = await Promise.all([
        env.NEWS_KV ? env.NEWS_KV.get('news_index', 'json') : null,
        env.NEWS_KV ? env.NEWS_KV.get('model_rankings', 'json') : null,
        env.NEWS_KV ? env.NEWS_KV.get('trending_repos', 'json') : null,
        getToolsFromDB(env, 'all'),
      ]);
      if (newsRaw && Array.isArray(newsRaw)) newsLatest = newsRaw;
      if (modelsRaw) modelRankings = modelsRaw;
      if (reposRaw && Array.isArray(reposRaw)) trendingRepos = reposRaw;
      if (toolsRaw && Array.isArray(toolsRaw)) dashboardTools = toolsRaw;
    } catch { /* graceful fallback */ }

    // Use original layout (news left, models right sidebar)
    const homeArticles = newsLatest || [];
    const homeSidebarModels = (modelRankings && modelRankings.categories && modelRankings.categories.overall)
      ? modelRankings.categories.overall.slice(0, 10)
      : SAMPLE_MODELS;
    const html = renderHTML(homeArticles, homeSidebarModels, trendingRepos);
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
      },
    });
  },

  // ---------------------------------------------------------------------------
  // Scheduled handler
  // - Every 6 hours: fetch RSS feeds, model rankings, trending repos + IndexNow ping
  // - Weekly (Sunday 3AM UTC): fact-check and update comparison content via AI
  // ---------------------------------------------------------------------------
  async scheduled(event, env, ctx) {
    const isWeeklyUpdate = event.cron === '0 3 * * SUN';

    if (isWeeklyUpdate) {
      ctx.waitUntil(updateComparisonContent(env));
    } else {
      ctx.waitUntil(Promise.all([
        fetchAndProcessFeeds(env),
        fetchModelRankings(env),
        fetchTrendingRepos(env),
      ]).then(() => submitIndexNow(env)));
    }
  },
};
