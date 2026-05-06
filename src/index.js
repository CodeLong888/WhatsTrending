// whatstrending.ai — Cloudflare Worker
// Premium AI news dashboard with D1 database API, AI news aggregation, tool directory
import { OG_IMAGE_BASE64 } from './og-image.js';

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

const AI_TOOLS_SEED = [
  // Coding
  { name: 'Cursor', tagline: 'The AI-first code editor', description: 'AI-powered code editor built on VS Code with deep integration for code generation, editing, and chat.', url: 'https://cursor.com', category: 'coding', pricing: 'freemium' },
  { name: 'GitHub Copilot', tagline: 'Your AI pair programmer', description: 'AI coding assistant that suggests code completions and entire functions in real-time within your editor.', url: 'https://github.com/features/copilot', category: 'coding', pricing: 'paid' },
  { name: 'Windsurf', tagline: 'AI-powered IDE by Codeium', description: 'Full-featured AI IDE with Cascade flow for multi-file editing and intelligent code suggestions.', url: 'https://codeium.com/windsurf', category: 'coding', pricing: 'freemium' },
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
  { name: 'Midjourney', tagline: 'AI image generation via Discord', description: 'Leading AI art generator known for highly aesthetic, photorealistic, and artistic image outputs.', url: 'https://www.midjourney.com', category: 'image', pricing: 'paid' },
  { name: 'DALL-E', tagline: 'AI image generation by OpenAI', description: 'OpenAI image generator integrated into ChatGPT, creating and editing images from natural language prompts.', url: 'https://openai.com/dall-e-3', category: 'image', pricing: 'paid' },
  { name: 'Stable Diffusion', tagline: 'Open source image generation', description: 'Open-source AI image model by Stability AI that can run locally or via API for unrestricted generation.', url: 'https://stability.ai', category: 'image', pricing: 'free' },
  { name: 'Leonardo', tagline: 'AI-powered creative suite', description: 'AI image and video generation platform with fine-tuned models for game assets, design, and art.', url: 'https://leonardo.ai', category: 'image', pricing: 'freemium' },
  { name: 'Ideogram', tagline: 'AI image generation with text rendering', description: 'AI image generator known for exceptional text rendering accuracy within generated images.', url: 'https://ideogram.ai', category: 'image', pricing: 'freemium' },
  { name: 'Flux', tagline: 'Next-gen open image model', description: 'State-of-the-art open-source image generation model by Black Forest Labs with excellent prompt adherence.', url: 'https://blackforestlabs.ai', category: 'image', pricing: 'free' },
  // Video
  { name: 'Runway', tagline: 'AI creative tools for video', description: 'Leading AI video generation platform with Gen-3 Alpha model for creating and editing video from text and images.', url: 'https://runwayml.com', category: 'video', pricing: 'freemium' },
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
  { name: 'Phind', tagline: 'AI search for developers', description: 'AI search engine optimized for developers, providing code solutions and technical answers with sources.', url: 'https://www.phind.com', category: 'search', pricing: 'free' },
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
];

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
  { a: 'ChatGPT', b: 'Perplexity', slug: 'chatgpt-vs-perplexity' },
  { a: 'Lovable', b: 'v0', slug: 'lovable-vs-v0' },
  { a: 'Devin', b: 'Cursor', slug: 'devin-vs-cursor' },
  { a: 'ElevenLabs', b: 'PlayHT', slug: 'elevenlabs-vs-playht' },
  { a: 'Veo 3', b: 'Sora', slug: 'veo-3-vs-sora' },
  { a: 'Claude', b: 'Llama', slug: 'claude-vs-llama' },
  { a: 'Gemini', b: 'Claude', slug: 'gemini-vs-claude' },
  { a: 'Replit', b: 'Cursor', slug: 'replit-vs-cursor' },
  { a: 'Dify', b: 'LangChain', slug: 'dify-vs-langchain' },
  { a: 'n8n', b: 'Zapier', slug: 'n8n-vs-zapier' },
  { a: 'Supabase', b: 'Firebase', slug: 'supabase-vs-firebase' },
  { a: 'Vercel', b: 'Netlify', slug: 'vercel-vs-netlify' },
  { a: 'Flux', b: 'Stable Diffusion', slug: 'flux-vs-stable-diffusion' },
  { a: 'Codex', b: 'Claude Code', slug: 'codex-vs-claude-code' },
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
// D1 data access — fetches articles from DB, falls back to SAMPLE_ARTICLES
// ---------------------------------------------------------------------------

async function getArticlesFromDB(env, { category, limit, offset } = {}) {
  try {
    if (!env.DB) return null;
    let query = 'SELECT * FROM articles';
    const params = [];

    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY published_at DESC';
    if (limit) {
      query += ' LIMIT ?';
      params.push(Number(limit));
    }
    if (offset) {
      query += ' OFFSET ?';
      params.push(Number(offset));
    }

    const result = await env.DB.prepare(query).bind(...params).all();
    return result.results;
  } catch {
    return null;
  }
}

async function getArticleBySlug(env, slug) {
  try {
    if (!env.DB) return null;
    const result = await env.DB.prepare('SELECT * FROM articles WHERE slug = ?').bind(slug).first();
    return result;
  } catch {
    return null;
  }
}

async function getArticleById(env, id) {
  try {
    if (!env.DB) return null;
    const result = await env.DB.prepare('SELECT * FROM articles WHERE id = ?').bind(Number(id)).first();
    return result;
  } catch {
    return null;
  }
}

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

// Get articles for HTML pages — DB first, sample fallback
async function getArticlesForDisplay(env) {
  const dbArticles = await getArticlesFromDB(env);
  if (dbArticles && dbArticles.length > 0) {
    return dbArticles.map(dbRowToArticle);
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
  const limit = url.searchParams.get('limit') || '50';
  const offset = url.searchParams.get('offset') || '0';

  if (!env.DB) {
    // No DB — return sample data filtered
    let articles = SAMPLE_ARTICLES;
    if (category) {
      articles = articles.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    return successResponse(articles.slice(Number(offset), Number(offset) + Number(limit)));
  }

  try {
    const articles = await getArticlesFromDB(env, { category, limit, offset });
    return successResponse(articles || []);
  } catch (err) {
    return errorResponse('Failed to fetch articles: ' + err.message, 500);
  }
}

async function handleApiArticleGet(slug, env) {
  if (!env.DB) {
    const article = SAMPLE_ARTICLES.find(a => a.slug === slug);
    if (article) return successResponse(article);
    return errorResponse('Article not found', 404);
  }

  try {
    const article = await getArticleBySlug(env, slug);
    if (!article) return errorResponse('Article not found', 404);
    return successResponse(article);
  } catch (err) {
    return errorResponse('Failed to fetch article: ' + err.message, 500);
  }
}

async function handleApiArticleCreate(request, env) {
  if (!isAuthorized(request, env)) {
    return errorResponse('Unauthorized', 401);
  }
  if (!env.DB) {
    return errorResponse('Database not configured', 503);
  }

  try {
    const data = await request.json();
    const { slug, title, summary, body, category, source, source_url, image_url, featured } = data;

    if (!slug || !title || !summary || !body) {
      return errorResponse('Missing required fields: slug, title, summary, body');
    }

    const result = await env.DB.prepare(
      `INSERT INTO articles (slug, title, summary, body, category, source, source_url, image_url, featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        slug,
        title,
        summary,
        body,
        category || 'General',
        source || '',
        source_url || '',
        image_url || '',
        featured ? 1 : 0
      )
      .run();

    const created = await env.DB.prepare('SELECT * FROM articles WHERE slug = ?').bind(slug).first();
    return successResponse(created, 201);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return errorResponse('Article with this slug already exists', 409);
    }
    return errorResponse('Failed to create article: ' + err.message, 500);
  }
}

async function handleApiArticleUpdate(request, env, id) {
  if (!isAuthorized(request, env)) {
    return errorResponse('Unauthorized', 401);
  }
  if (!env.DB) {
    return errorResponse('Database not configured', 503);
  }

  try {
    const existing = await getArticleById(env, id);
    if (!existing) return errorResponse('Article not found', 404);

    const data = await request.json();
    const fields = [];
    const values = [];

    for (const key of ['slug', 'title', 'summary', 'body', 'category', 'source', 'source_url', 'image_url']) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (data.featured !== undefined) {
      fields.push('featured = ?');
      values.push(data.featured ? 1 : 0);
    }

    if (fields.length === 0) {
      return errorResponse('No fields to update');
    }

    fields.push("updated_at = datetime('now')");
    values.push(Number(id));

    await env.DB.prepare(`UPDATE articles SET ${fields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    const updated = await getArticleById(env, id);
    return successResponse(updated);
  } catch (err) {
    return errorResponse('Failed to update article: ' + err.message, 500);
  }
}

async function handleApiArticleDelete(request, env, id) {
  if (!isAuthorized(request, env)) {
    return errorResponse('Unauthorized', 401);
  }
  if (!env.DB) {
    return errorResponse('Database not configured', 503);
  }

  try {
    const existing = await getArticleById(env, id);
    if (!existing) return errorResponse('Article not found', 404);

    await env.DB.prepare('DELETE FROM articles WHERE id = ?').bind(Number(id)).run();
    return successResponse({ deleted: true, id: Number(id) });
  } catch (err) {
    return errorResponse('Failed to delete article: ' + err.message, 500);
  }
}

// ---------------------------------------------------------------------------
// Models API
// ---------------------------------------------------------------------------

const NUMERIC_MODEL_FIELDS = ['elo_score', 'elo_rank', 'downloads'];

function validateNumericFields(body) {
  for (const field of NUMERIC_MODEL_FIELDS) {
    if (field in body && body[field] !== null && body[field] !== undefined) {
      const val = Number(body[field]);
      if (isNaN(val)) return `${field} must be a number`;
    }
  }
  return null;
}

function safeParseJSON(text) {
  try {
    return { data: JSON.parse(text), error: null };
  } catch (e) {
    return { data: null, error: 'Invalid JSON: ' + e.message };
  }
}

async function getModelsFromDB(env, { category, limit, offset } = {}) {
  try {
    if (!env.DB) return null;
    let query = 'SELECT * FROM models';
    const params = [];
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    query += ' ORDER BY elo_rank ASC';
    if (limit) { query += ' LIMIT ?'; params.push(Number(limit)); }
    if (offset) { query += ' OFFSET ?'; params.push(Number(offset)); }
    const result = await env.DB.prepare(query).bind(...params).all();
    return result.results;
  } catch {
    return null;
  }
}

async function handleApiModelsList(request, env) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limit = url.searchParams.get('limit') || 50;
    const offset = url.searchParams.get('offset') || 0;

    const dbModels = await getModelsFromDB(env, { category, limit, offset });
    if (dbModels) return successResponse(dbModels);

    // Fallback to sample data
    let models = SAMPLE_MODELS;
    if (category) models = models.filter(m => m.category === category);
    return successResponse(models);
  } catch (err) {
    return errorResponse('Failed to fetch models: ' + err.message, 500);
  }
}

async function handleApiModelGet(modelId, env) {
  try {
    if (!env.DB) {
      const model = SAMPLE_MODELS.find(m => m.name.toLowerCase().replace(/\s+/g, '-') === modelId);
      return model ? successResponse(model) : errorResponse('Model not found', 404);
    }
    const result = await env.DB.prepare('SELECT * FROM models WHERE model_id = ?').bind(modelId).first();
    return result ? successResponse(result) : errorResponse('Model not found', 404);
  } catch (err) {
    return errorResponse('Failed to fetch model: ' + err.message, 500);
  }
}

async function handleApiModelCreate(request, env) {
  if (!isAuthorized(request, env)) return errorResponse('Unauthorized', 401);
  if (!env.DB) return errorResponse('Database not configured', 503);

  try {
    const text = await request.text();
    const { data: body, error: parseErr } = safeParseJSON(text);
    if (parseErr) return errorResponse(parseErr, 400);

    const { model_id, name, provider } = body;
    if (!model_id || !name || !provider) {
      return errorResponse('Missing required fields: model_id, name, provider', 400);
    }

    const numErr = validateNumericFields(body);
    if (numErr) return errorResponse(numErr, 400);

    const existing = await env.DB.prepare('SELECT model_id FROM models WHERE model_id = ?').bind(model_id).first();
    if (existing) return errorResponse('Model with this model_id already exists', 409);

    await env.DB.prepare(`
      INSERT INTO models (model_id, name, provider, category, elo_score, elo_rank, context_window, pricing, downloads, change, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      model_id,
      name,
      provider,
      body.category || 'Proprietary',
      Number(body.elo_score) || 0,
      Number(body.elo_rank) || 0,
      body.context_window || '',
      body.pricing || '',
      Number(body.downloads) || 0,
      body.change || '0',
      body.description || ''
    ).run();

    const created = await env.DB.prepare('SELECT * FROM models WHERE model_id = ?').bind(model_id).first();
    return successResponse(created, 201);
  } catch (err) {
    return errorResponse('Failed to create model: ' + err.message, 500);
  }
}

async function handleApiModelUpdate(request, env, modelId) {
  if (!isAuthorized(request, env)) return errorResponse('Unauthorized', 401);
  if (!env.DB) return errorResponse('Database not configured', 503);

  try {
    const text = await request.text();
    const { data: body, error: parseErr } = safeParseJSON(text);
    if (parseErr) return errorResponse(parseErr, 400);

    // Reject body model_id that mismatches path
    if (body.model_id && body.model_id !== modelId) {
      return errorResponse('model_id in body does not match URL path', 400);
    }

    const existing = await env.DB.prepare('SELECT * FROM models WHERE model_id = ?').bind(modelId).first();
    if (!existing) return errorResponse('Model not found', 404);

    const numErr = validateNumericFields(body);
    if (numErr) return errorResponse(numErr, 400);

    const updatable = ['name', 'provider', 'category', 'elo_score', 'elo_rank', 'context_window', 'pricing', 'downloads', 'change', 'description'];
    const sets = [];
    const vals = [];
    for (const key of updatable) {
      if (key in body) {
        sets.push(`${key} = ?`);
        vals.push(NUMERIC_MODEL_FIELDS.includes(key) ? Number(body[key]) : body[key]);
      }
    }
    if (sets.length === 0) return errorResponse('No fields to update', 400);

    sets.push("updated_at = datetime('now')");
    vals.push(modelId);

    await env.DB.prepare(`UPDATE models SET ${sets.join(', ')} WHERE model_id = ?`).bind(...vals).run();
    const updated = await env.DB.prepare('SELECT * FROM models WHERE model_id = ?').bind(modelId).first();
    return successResponse(updated);
  } catch (err) {
    return errorResponse('Failed to update model: ' + err.message, 500);
  }
}

async function handleApiModelDelete(request, env, modelId) {
  if (!isAuthorized(request, env)) return errorResponse('Unauthorized', 401);
  if (!env.DB) return errorResponse('Database not configured', 503);

  try {
    const existing = await env.DB.prepare('SELECT model_id FROM models WHERE model_id = ?').bind(modelId).first();
    if (!existing) return errorResponse('Model not found', 404);

    await env.DB.prepare('DELETE FROM models WHERE model_id = ?').bind(modelId).run();
    return successResponse({ deleted: true, model_id: modelId });
  } catch (err) {
    return errorResponse('Failed to delete model: ' + err.message, 500);
  }
}

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

  for (const feed of RSS_FEEDS) {
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

        // Generate AI rewrite + category using Llama 8B (paid plan = 15min CPU)
        let aiSummary = item.description.slice(0, 200);
        let aiCategory = '';
        let aiHeadline = '';
        if (env.AI && item.description.length > 100) {
          try {
            // Step 1: Classify category
            const catResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [{
                role: 'user',
                content: `Classify this AI news into exactly ONE category. Reply with just the category name, nothing else.

Categories: Models, Tools, Research, Industry, Startups, Regulation, Open Source

Title: ${item.title}`
              }],
              max_tokens: 10,
            });
            if (catResult && catResult.response) {
              const cat = catResult.response.trim().replace(/[^a-zA-Z ]/g, '');
              if (['Models','Tools','Research','Industry','Startups','Regulation','Open Source'].includes(cat)) {
                aiCategory = cat;
              }
            }

            // Step 2: Rewrite the article
            const rewriteResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                {
                  role: 'system',
                  content: 'You are a tech journalist. Rewrite news articles in your own words. Be specific, include names and numbers. Write 3-4 paragraphs. No preamble — start directly with the news.'
                },
                {
                  role: 'user',
                  content: `Rewrite this article in your own words:\n\n${item.title}\n\n${item.description.slice(0, 1200)}`
                }
              ],
              max_tokens: 768,
            });
            if (rewriteResult && rewriteResult.response) {
              let body = rewriteResult.response.trim();
              // Strip preambles
              body = body.replace(/^(Here is|Here's|Below is|This is|The article|A summary|Sure|Certainly)[^.]*[.:]\s*/i, '');
              body = body.replace(/^(Rewritten|Rewrite|Summary)[.:]\s*/i, '');
              if (body.length > 100) aiSummary = body;
            }

            // Step 3: Generate headline
            const headlineResult = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [{
                role: 'user',
                content: `Write a short, compelling news headline (max 80 characters) for this article. Reply with just the headline, no quotes:\n\n${item.title}\n\n${aiSummary.slice(0, 300)}`
              }],
              max_tokens: 30,
            });
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
        };

        // Quality gate — reject low-quality articles
        const isLongEnough = aiSummary.length > 200;
        const hasMultipleSentences = (aiSummary.match(/\./g) || []).length >= 3;
        const notSpammy = !/(click here|subscribe|sign up|buy now|discount|coupon|% off)/i.test(aiSummary);
        const notMeta = !/(here is|here's|below is|I'll|I will|as an AI)/i.test(aiSummary);
        const hasGoodTitle = (aiHeadline || item.title).length > 15;

        if (isLongEnough && hasMultipleSentences && notSpammy && notMeta && hasGoodTitle) {
          newArticles.push(article);
          existingSlugs.add(slug);
        }
      }
    } catch { /* skip broken feed */ }
  }

  if (newArticles.length > 0) {
    // Filter existing articles too — remove any that slipped through before quality gates
    const cleanExisting = existingIndex.filter(a =>
      a.summary && a.summary.length > 200 && (a.summary.match(/\./g) || []).length >= 3
    );
    // Merge: new articles first, then existing, cap at 500
    const merged = [...newArticles, ...cleanExisting].slice(0, 500);
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
  } catch (e) {
    console.error('fetchTrendingRepos error:', e.message);
    if (env.NEWS_KV) await env.NEWS_KV.put('repos_debug', JSON.stringify({ error: e.message, ts: new Date().toISOString() }));
  }
}

// ---------------------------------------------------------------------------
// HTML rendering helpers
// ---------------------------------------------------------------------------

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
  return `
    <a href="/news/${article.slug}" class="news-card" style="display:block;text-decoration:none;color:inherit;">
      <div class="news-card-inner">
        <div class="news-card-header">
          ${renderCategoryPill(article.category || article.source || '')}
          <span class="meta-time">${formatShortDate(article.time || article.date)}</span>
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

function renderNav(activePage) {
  const pages = [
    { key: 'trending', label: 'Trending', href: '/' },
    { key: 'models', label: 'Models', href: '/models' },
    { key: 'repos', label: 'Repos', href: '/repos' },
    { key: 'news', label: 'News', href: '/news' },
    { key: 'tools', label: 'Tools', href: '/tools' },
    { key: 'compare', label: 'Compare', href: '/compare/chatgpt-vs-claude' },
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
  return `
  <footer class="footer">
    <div class="container footer-inner">
      <div class="footer-left"><span>whatstrending.ai</span> &copy; ${new Date().getFullYear()}</div>
      <ul class="footer-links">
        <li><a href="#about">About</a></li>
        <li><a href="#privacy">Privacy</a></li>
        <li><a href="#terms">Terms</a></li>
        <li><a href="https://x.com" target="_blank" rel="noopener">X / Twitter</a></li>
      </ul>
    </div>
  </footer>`;
}

function renderPageHead(title, description, canonicalPath) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
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
  <meta property="og:url" content="https://whatstrending.ai${canonicalPath}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="https://whatstrending.ai/og-preview.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">

  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><defs><linearGradient id='fg' x1='0' y1='0' x2='1' y2='1'><stop offset='0%25' stop-color='%2300ffa3'/><stop offset='100%25' stop-color='%2300c8ff'/></linearGradient></defs><circle cx='60' cy='60' r='52' stroke='url(%23fg)' stroke-width='2.5' fill='none'/><circle cx='60' cy='60' r='36' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.08'/><circle cx='60' cy='60' r='24' stroke='%2300ffa3' stroke-width='1' fill='none' opacity='0.12'/><path d='M60 24 A36 36 0 0 1 96 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.8'/><path d='M60 36 A24 24 0 0 1 84 60' stroke='%2300ffa3' stroke-width='2.5' stroke-linecap='round' fill='none' opacity='0.5'/><circle cx='60' cy='60' r='5' fill='%2300ffa3'/></svg>">
  <link rel="canonical" href="https://whatstrending.ai${canonicalPath}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="alternate" type="application/rss+xml" title="whatstrending.ai RSS" href="https://whatstrending.ai/feed.xml">`;
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

function renderNewsPage(articles) {
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

  return `${renderPageHead(
    'AI News - AI-Curated Summaries — whatstrending.ai',
    'Latest AI news from top sources with AI-generated summaries. Updated every 6 hours.',
    '/news'
  )}
  <style>
    ${baseCSS()}
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
      <h1 class="page-hero-title">AI News</h1>
      <p class="page-hero-sub">AI-curated summaries from top tech sources. Updated every 6 hours.</p>
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

  ${renderFooter()}
</body>
</html>`;
}

function renderNewsArticlePage(article) {
  const dateStr = article.date ? new Date(article.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '';
  return `${renderPageHead(
    article.title + ' — whatstrending.ai',
    article.summary || article.description || "",
    '/news/' + article.slug
  )}
  <style>
    ${baseCSS()}
    .article-container { max-width: 720px; padding-top: 40px; padding-bottom: 80px; }
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
    @media (max-width: 768px) { .article-title { font-size: 24px; } }
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

  <section class="container article-container" style="position:relative;z-index:1;">
    <div class="article-source">${article.source} · ${article.category || 'Industry'}</div>
    <h1 class="article-title">${article.title}</h1>
    <div class="article-date">${dateStr}</div>
    ${article.originalTitle && article.originalTitle !== article.title ? `<div class="article-original">Originally: ${article.originalTitle}</div>` : ''}
    <div class="article-body">${(article.summary || article.description || "").split('\n').filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join('')}</div>
    <a href="${article.link}" target="_blank" rel="noopener" class="article-cta">Read Original Source</a>
    <br>
    <a href="/news" class="back-link">&larr; Back to AI News</a>
  </section>

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
    'AI Tool Directory — whatstrending.ai',
    'Discover the best AI tools for coding, writing, image generation, video, chat, and productivity.',
    '/tools'
  )}
  <style>
    ${baseCSS()}
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
      <h1 class="page-hero-title">AI Tool Directory</h1>
      <p class="page-hero-sub">Discover the best AI tools across every category</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    <div class="filter-pills">
      ${catTabs}
    </div>
    <div class="tools-grid">
      ${toolCards}
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

  return `${renderPageHead(
    tool.name + ' - AI Tool Review — whatstrending.ai',
    tool.description,
    '/tools/' + slug
  )}
  <style>
    ${baseCSS()}
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
  ${renderNav('tools')}

  <section class="container tool-detail" style="position:relative;z-index:1;">
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
  const catLabel = category === 'devtools' ? 'Dev Tools' : category.charAt(0).toUpperCase() + category.slice(1);
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

  return `${renderPageHead(
    catLabel + ' AI Tools — whatstrending.ai',
    'Best AI tools in the ' + catLabel + ' category. Compare pricing, features, and capabilities.',
    '/category/' + category
  )}
  <style>
    ${baseCSS()}
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

function renderComparePage(comparison, toolA, toolB) {
  const titleText = `${comparison.a} vs ${comparison.b}`;
  const pricingColor = (p) => p === 'free' ? '#00ffa3' : p === 'freemium' ? '#F59E0B' : '#EC4899';

  return `${renderPageHead(
    titleText + ' - AI Tool Comparison — whatstrending.ai',
    `Compare ${comparison.a} and ${comparison.b} side by side. Pricing, features, and category comparison.`,
    '/compare/' + comparison.slug
  )}
  <style>
    ${baseCSS()}
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
    @media (max-width: 768px) { .compare-grid { grid-template-columns: 1fr; } }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"WebPage","name":`${comparison.a} vs ${comparison.b}`,"description":`Compare ${comparison.a} and ${comparison.b} — features, pricing, and which AI tool is better for your needs`,"url":`https://whatstrending.ai/compare/${comparison.slug}`})}</script>
</head>
<body>
  ${renderNav('compare')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">${comparison.a} vs ${comparison.b}</h1>
      <p class="page-hero-sub">Side-by-side comparison of two popular AI tools</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
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

    <div class="other-comparisons">
      <h3>More Comparisons</h3>
      <div class="compare-links">
        ${COMPARISONS.filter(c => c.slug !== comparison.slug).slice(0, 10).map(c =>
          `<a href="/compare/${c.slug}" class="compare-link">${c.a} vs ${c.b}</a>`
        ).join('')}
      </div>
    </div>
  </section>

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
    ${baseCSS()}
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
          return `
        <tr data-category="${m.category === 'Open Source' ? 'opensource' : 'proprietary'}">
          <td class="lb-rank">${m.rank}</td>
          <td class="lb-model">${m.name}</td>
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
    'AI Model Leaderboard - LMSYS Chatbot Arena — whatstrending.ai',
    'Live rankings from LMSYS Chatbot Arena. Compare top AI models by overall, coding, math, and creative writing.',
    '/models'
  )}
  <style>
    ${baseCSS()}
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
</head>
<body>

  ${renderNav('models')}

  <section class="models-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="models-hero-title">AI Model Leaderboard</h1>
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
    ? newsItems.map(a => `
      <a href="/news/${a.slug || ''}" class="dash-news-item">
        <div class="dash-news-top">
          <span class="dash-news-source">${a.source || ''}</span>
          <span class="dash-news-date">${a.published_at ? formatRelativeTime(a.published_at) : (a.time || '')}</span>
        </div>
        <h3 class="dash-news-title">${a.title}</h3>
        <p class="dash-news-summary">${(a.summary || '').slice(0, 120)}${(a.summary || '').length > 120 ? '...' : ''}</p>
      </a>`).join('')
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
  <title>whatstrending.ai — AI Intelligence Dashboard</title>
  <meta name="description" content="The latest AI news, model rankings, trending repos, and tool discovery. Updated daily.">
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
  <meta property="og:description" content="The latest AI news, model rankings, trending repos, and tool discovery. Updated daily.">
  <meta property="og:image" content="https://whatstrending.ai/og-preview.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta name="twitter:description" content="The latest AI news, model rankings, trending repos, and tool discovery.">

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
        <li><a href="#about">About</a></li>
        <li><a href="#privacy">Privacy</a></li>
        <li><a href="#terms">Terms</a></li>
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
  <title>whatstrending.ai — AI Intelligence Dashboard</title>
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
  <meta property="og:description" content="The latest AI news, model rankings, and tool discovery. Updated daily.">
  <meta property="og:image" content="https://whatstrending.ai/og-preview.jpg">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="whatstrending.ai — AI Intelligence Dashboard">
  <meta name="twitter:description" content="The latest AI news, model rankings, and tool discovery. Updated daily.">

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

        <div class="sidebar-section">
          <div class="sidebar-title">Newsletter</div>
          <p class="newsletter-text">Get the top AI stories delivered to your inbox every morning. No spam, unsubscribe anytime.</p>
          <form class="newsletter-form" onsubmit="return false;">
            <input type="email" class="newsletter-input" placeholder="you@email.com" aria-label="Email address" required>
            <button type="submit" class="newsletter-btn">Subscribe</button>
          </form>
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
        <li><a href="#about">About</a></li>
        <li><a href="#privacy">Privacy</a></li>
        <li><a href="#terms">Terms</a></li>
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

    return `
    <a href="/repos/${r.name}" class="repo-card">
      <div class="repo-card-header">
        <span class="repo-name">${r.name}</span>
        <div style="display:flex;align-items:center;gap:8px;">
          ${tl ? `<span style="font-size:9px;font-family:'JetBrains Mono',monospace;color:${tc};border:1px solid ${tc}33;padding:1px 6px;border-radius:3px;">${tl}</span>` : ''}
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
    'Trending AI Repos - GitHub — whatstrending.ai',
    'Discover the hottest new AI and machine learning repositories on GitHub.',
    '/repos'
  )}
  <style>
    ${baseCSS()}
    .repos-grid { display: grid; grid-template-columns: 1fr; gap: 0; padding-bottom: 80px; }
    .repo-card { display: block; padding: 24px 16px; border-bottom: 1px solid var(--border); border-left: 2px solid transparent; transition: all var(--transition); text-decoration: none; color: inherit; }
    .repo-card:hover { border-left-color: var(--accent); background: linear-gradient(90deg, rgba(110,231,183,0.03), transparent); }
    .repo-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .repo-name { font-size: 15px; font-weight: 600; color: var(--accent); font-family: 'JetBrains Mono', monospace; }
    .repo-stars { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #F59E0B; font-weight: 500; }
    .repo-desc { font-size: 14px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .repo-meta { display: flex; align-items: center; gap: 16px; font-size: 12px; color: var(--text-tertiary); }
    .repo-lang { display: flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; }
    .repo-lang-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .repo-created { font-family: 'JetBrains Mono', monospace; }
    .empty-state { text-align: center; padding: 80px 24px; color: var(--text-tertiary); }
    .empty-state h3 { font-size: 20px; color: var(--text-secondary); margin-bottom: 8px; }
  </style>
  <script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"Trending AI Repos","description":"Top trending AI and machine learning GitHub repositories with trust scores","url":"https://whatstrending.ai/repos","publisher":{"@type":"Organization","name":"whatstrending.ai"}})}</script>
</head>
<body>
  ${renderNav('repos')}

  <section class="page-hero">
    <div class="container" style="position:relative;z-index:1;">
      <h1 class="page-hero-title">Trending AI Repos</h1>
      <p class="page-hero-sub">Hottest new AI/ML repositories on GitHub, ranked by stars</p>
    </div>
  </section>

  <section class="container" style="position:relative;z-index:1;">
    ${repos.length > 0 ? `<div class="repos-grid">${repoCards}</div>` : `
    <div class="empty-state">
      <h3>Repos feed initializing</h3>
      <p>Trending repos will appear here after the next fetch. Check back soon.</p>
    </div>`}
  </section>

  ${renderFooter()}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------

function renderRobotsTxt() {
  return `User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://whatstrending.ai/sitemap.xml`;
}

function renderSitemapXml(articles, newsArticles, tools, trendingRepos) {
  const today = new Date().toISOString().split('T')[0];

  const storyUrls = articles.map(a => `
  <url>
    <loc>https://whatstrending.ai/news/${a.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('');

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
    <priority>0.5</priority>
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
  </url>${storyUrls}${newsUrls}${toolUrls}${compareUrls}${categoryUrls}${TRENDING_TOPICS.map(t=>`
  <url>
    <loc>https://whatstrending.ai/topic/${t.slug}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>`).join('')}${['best-ai-coding-tools','best-ai-image-generators','best-ai-chatbots','best-ai-video-tools','best-ai-writing-tools','open-source-llms-guide'].map(s=>`
  <url>
    <loc>https://whatstrending.ai/guide/${s}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('')}${(trendingRepos||[]).map(r=>`
  <url>
    <loc>https://whatstrending.ai/repos/${r.name}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.5</priority>
  </url>`).join('')}
</urlset>`;
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Manual news trigger (skip AI rewriting to stay within fetch time limit)
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

    // Debug: check KV contents
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

    if (path === '/robots.txt') {
      return new Response(renderRobotsTxt(), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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
    <title>whatstrending.ai — AI Intelligence Dashboard</title>
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
      return new Response(renderNewsPage(newsArticles), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const newsSlugMatch = path.match(/^\/news\/([^/]+)$/);
    if (newsSlugMatch) {
      const slug = newsSlugMatch[1];
      let article = null;
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get(`news:${slug}`, 'json');
          if (raw) article = raw;
        }
      } catch { /* */ }
      if (!article) {
        // Try from index
        try {
          if (env.NEWS_KV) {
            const index = await env.NEWS_KV.get('news_index', 'json');
            if (index) article = index.find(a => a.slug === slug);
          }
        } catch { /* */ }
      }
      if (article) {
        return new Response(renderNewsArticlePage(article), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      }
      // 404 fallback
      return new Response('Not found', { status: 404 });
    }

    // ---- TOPIC PAGES ----
    if (path.startsWith('/topic/')) {
      const topicSlug = path.replace('/topic/', '');
      const topic = TRENDING_TOPICS.find(t => t.slug === topicSlug);
      if (!topic) return new Response('Topic not found', { status: 404 });
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
      <style>${baseCSS()}
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
      ${renderNav('trending')}
      <section class="topic-hero"><div class="container" style="position:relative;z-index:1;">
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
      return new Response(html, { headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
    }

    // ---- REPOS ROUTE ----
    if (path === '/repos') {
      let repos = [];
      try {
        if (env.NEWS_KV) {
          const raw = await env.NEWS_KV.get('trending_repos', 'json');
          if (raw && Array.isArray(raw)) repos = raw;
        }
      } catch { /* empty */ }
      return new Response(renderReposPage(repos), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
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
      const repo = repos.find(r => r.name === repoFullName);
      if (!repo) {
        return new Response('Repo not found', { status: 404 });
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
      <style>${baseCSS()}
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
        "author":{"@type":"Organization","name":owner},
        "aggregateRating":{"@type":"AggregateRating","ratingValue":"5","ratingCount":repo.stars||0,"bestRating":"5"}
      })}</script>
      </head><body>
      ${renderNav('repos')}
      <section class="repo-detail" style="position:relative;z-index:1;">
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
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }

    // ---- TOOLS ROUTES ----
    if (path === '/tools') {
      const cat = url.searchParams.get('cat') || 'all';
      const tools = await getToolsFromDB(env, cat);
      return new Response(renderToolsPage(tools, cat), {
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
    }

    const toolSlugMatch = path.match(/^\/tools\/([^/]+)$/);
    if (toolSlugMatch) {
      const slug = toolSlugMatch[1];
      const tool = await getToolBySlug(env, slug);
      if (tool) {
        return new Response(renderToolPage(tool), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      }
      return new Response('Not found', { status: 404 });
    }

    // ---- CATEGORY ROUTES ----
    const catMatch = path.match(/^\/category\/([^/]+)$/);
    if (catMatch) {
      const category = catMatch[1];
      if (TOOL_CATEGORIES.includes(category)) {
        const tools = await getToolsFromDB(env, category);
        return new Response(renderCategoryPage(category, tools), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      }
      return new Response('Not found', { status: 404 });
    }

    // ---- COMPARE ROUTES ----
    const compareMatch = path.match(/^\/compare\/([^/]+)$/);
    if (compareMatch) {
      const slug = compareMatch[1];
      const comparison = COMPARISONS.find(c => c.slug === slug);
      if (comparison) {
        const toolA = AI_TOOLS_SEED.find(t => t.name === comparison.a) || null;
        const toolB = AI_TOOLS_SEED.find(t => t.name === comparison.b) || null;
        return new Response(renderComparePage(comparison, toolA, toolB), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      }
      return new Response('Not found', { status: 404 });
    }

    // Fetch articles from DB (with fallback) for all HTML pages
    const [articles, sidebarModels] = await Promise.all([
      getArticlesForDisplay(env),
      getModelsFromDB(env, {}),
    ]);

    // ---- GUIDES (evergreen SEO pages) ----
    const GUIDES = {
      'best-ai-coding-tools': { title: 'Best AI Coding Tools in 2026', desc: 'The top AI-powered coding tools and IDE assistants for developers in 2026. Compare Cursor, Claude Code, GitHub Copilot, and more.', tools: ['Cursor','Claude Code','GitHub Copilot','Codex','Windsurf','Bolt','Replit','v0'] },
      'best-ai-image-generators': { title: 'Best AI Image Generators in 2026', desc: 'Compare the top AI image generation tools. Midjourney, DALL-E, Stable Diffusion, Flux, Leonardo and more.', tools: ['Midjourney','DALL-E','Stable Diffusion','Leonardo','Flux','Adobe Firefly','Ideogram'] },
      'best-ai-chatbots': { title: 'Best AI Chatbots in 2026', desc: 'ChatGPT, Claude, Gemini, Grok, Perplexity — which AI chatbot is best? Comprehensive comparison.', tools: ['ChatGPT','Claude','Gemini','Grok','Perplexity','Kagi'] },
      'best-ai-video-tools': { title: 'Best AI Video Generation Tools in 2026', desc: 'Compare Sora, Runway, Kling, Veo 3, Pika and other AI video tools for creators.', tools: ['Sora','Runway','Kling','Veo 3','Pika','HeyGen','Synthesia'] },
      'best-ai-writing-tools': { title: 'Best AI Writing Tools in 2026', desc: 'Top AI writing assistants for content creation, copywriting, and editing.', tools: ['Jasper','Copy.ai','Grammarly','QuillBot','Notion AI','Gamma'] },
      'open-source-llms-guide': { title: 'Open Source LLMs: Complete Guide for 2026', desc: 'Everything you need to know about open source large language models in 2026. Llama, Mistral, DeepSeek, Qwen, and more.', tools: ['Llama 4','Mistral','DeepSeek','Qwen','Gemma'] },
    };

    if (path.startsWith('/guide/') && GUIDES[path.replace('/guide/', '')]) {
      const slug = path.replace('/guide/', '');
      const guide = GUIDES[slug];
      const toolCards = guide.tools.map(t => {
        const tool = AI_TOOLS_SEED.find(x => x.name === t);
        return tool ? `<div style="padding:16px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:15px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">${tool.name}</div><div style="font-size:13px;color:var(--text-secondary);line-height:1.5;">${tool.tagline || tool.description}</div><div style="margin-top:8px;font-size:12px;color:var(--accent);">${tool.pricing}</div></div>` : `<div style="padding:16px;border:1px solid var(--border);border-radius:10px;"><div style="font-size:15px;font-weight:600;color:var(--text-primary);">${t}</div></div>`;
      }).join('');

      return new Response(`${renderPageHead(guide.title + ' | whatstrending.ai', guide.desc, '/guide/' + slug)}
      <style>${baseCSS()}
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
      ${renderNav('guide')}
      <section class="guide" style="position:relative;z-index:1;">
        <h1>${guide.title}</h1>
        <p class="lead">${guide.desc}</p>
        <div class="guide-grid">${toolCards}</div>
        <h2>How we evaluate</h2>
        <p>We look at real-world performance, pricing, ease of use, and community adoption. Our rankings are based on data from multiple sources including model benchmarks, GitHub stars, and user reviews.</p>
        <p>This guide is updated regularly as new tools emerge and existing ones improve.</p>
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
      <style>${baseCSS()}
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
      <style>${baseCSS()}
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
      <style>${baseCSS()}
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
      return new Response(renderSitemapXml(articles, newsArticles, allTools, sitemapRepos), {
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      });
    }

    // Story pages
    if (path.startsWith('/story/')) {
      const slug = path.replace('/story/', '');
      const article = articles.find(a => a.slug === slug);
      if (article) {
        return new Response(renderStoryPage(article, articles), {
          headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
        });
      }
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
        headers: { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      });
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
        'Cache-Control': 'public, max-age=300',
      },
    });
  },

  // ---------------------------------------------------------------------------
  // Scheduled handler — runs every 6 hours to fetch RSS and generate AI summaries
  // ---------------------------------------------------------------------------
  async scheduled(event, env, ctx) {
    ctx.waitUntil(Promise.all([
      fetchAndProcessFeeds(env),
      fetchModelRankings(env),
      fetchTrendingRepos(env),
    ]));
  },
};
