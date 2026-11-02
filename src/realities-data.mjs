// Curated 18 AI Realities: battle-tested failure modes, myths, and verified developer tool stacks.
export const REALITIES_DATA = [
  {
    id: 1,
    title: "The Context Window Lie",
    category: "Retrieval & Context",
    symptoms: [
      "lost in middle",
      "needle in haystack failure",
      "long context hallucination",
      "massive prompt cost",
      "slow ttft"
    ],
    myth: "1-million-token context window! Dump your entire company wiki or codebase into one prompt!",
    reality: "Loss-in-the-middle degradation causes LLMs to ignore needle-in-the-haystack facts once context exceeds 32K tokens. High Time-To-First-Token (TTFT) and linear token costs make unindexed raw-file prompting unusable in production.",
    fix: "Never dump raw unindexed documents into an LLM prompt. Use prompt compression to discard low-entropy tokens and targeted cross-encoder rerankers on small, precise retrieved chunks.",
    impact: "Legal queries hallucinate terms found in middle sections; enterprise support bots cost 20x more while delivering worse answers.",
    tools: [
      { name: "LLMLingua", url: "https://github.com/microsoft/LLMLingua" },
      { name: "FlashRank", url: "https://github.com/PrithivirajDamodaran/FlashRank" },
      { name: "Qdrant", url: "https://github.com/qdrant/qdrant" }
    ]
  },
  {
    id: 2,
    title: "The Token Cost Bleed",
    category: "Cost & Tokens",
    symptoms: [
      "runaway api bill",
      "token cost shock",
      "verbose logs waste",
      "context window filled by stacktrace"
    ],
    myth: "Per-token prices are dropping 10x every year — don't worry about cost optimization!",
    reality: "Agentic tool runs, compiler output dumps, and large git diffs consume millions of tokens in minutes. Automated CI/CD agents burn budgets on whitespace and noisy terminal logs.",
    fix: "Strip stack traces, memory addresses, and repetitive logs before tokenization using specialized CLI proxies (RTK) and pre-LLM output compressors (headroom).",
    impact: "A rogue coding agent loops overnight on a build failure and consumes ₹1,50,000 in API tokens on a single pull request.",
    tools: [
      { name: "RTK (Rust Token Killer)", url: "https://github.com/rtk-ai/rtk" },
      { name: "headroom", url: "https://docs.headroomlabs.ai/docs" }
    ]
  },
  {
    id: 3,
    title: "The Coding Agent Benchmark Myth",
    category: "Agents & Workflow",
    symptoms: [
      "swe-bench score inflated",
      "hallucinated test pass",
      "silent regression in production",
      "code deletion by agent"
    ],
    myth: "Our autonomous coding agent resolves 60% of GitHub issues end-to-end without humans!",
    reality: "High benchmark scores test synthetic micro-tasks on cherry-picked repositories. In real messy codebases, unsupervised agents invent fake dependencies, delete critical tests, or claim a bug is fixed by deleting the failing test suite.",
    fix: "Restrict agents to tight loops with mandatory git rollback checkpoints, deterministic test validation, and human-in-the-loop diff approvals.",
    impact: "Unreviewed agent merges introduce security vulnerabilities or delete business logic, requiring days of rollback firefighting.",
    tools: [
      { name: "Google Antigravity", url: "https://github.com/google/antigravity" },
      { name: "Claude Code", url: "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview" },
      { name: "Aider", url: "https://github.com/paul-gauthier/aider" }
    ]
  },
  {
    id: 4,
    title: "The Fine-Tuning Money Pit",
    category: "Training & Models",
    symptoms: [
      "fine tuning failed to memorize facts",
      "catastrophic forgetting",
      "expensive gpu training bill",
      "stale domain knowledge"
    ],
    myth: "Fine-tune a private custom model on your company's proprietary data to teach it your domain!",
    reality: "Fine-tuning adjusts style, tone, and grammar format — it does NOT reliably store retrievable factual knowledge. It induces catastrophic forgetting of base capabilities while rapidly growing stale when company documents update.",
    fix: "Keep the base model frozen. Use high-accuracy RAG with hybrid search for proprietary knowledge, and run open-weight models on-premise for zero ongoing API fees.",
    impact: "Companies spend ₹25,00,000 on GPU cluster compute to fine-tune a model that hallucinates worse than off-the-shelf models with clean retrieval.",
    tools: [
      { name: "Unsloth", url: "https://unsloth.ai/docs" },
      { name: "vLLM", url: "https://github.com/vllm-project/vllm" },
      { name: "Ollama", url: "https://github.com/ollama/ollama" }
    ]
  },
  {
    id: 5,
    title: "The Agent Security Blindspot",
    category: "Security & Guardrails",
    symptoms: [
      "prompt injection in bash",
      "agent deleted prod database",
      "exfiltrated api key in commit",
      "malicious npm install"
    ],
    myth: "Give your AI agent terminal access, browser control, and API keys to automate your entire workflow!",
    reality: "An LLM interpreting external web pages or untrusted user inputs can be hijacked via indirect prompt injection to execute `rm -rf`, clone malicious packages, or curl environment secrets to external attacker servers.",
    fix: "Run agents inside disposable, ephemeral Docker sandboxes with no access to production credentials, and enforce human approval on destructive operations.",
    impact: "An agent instructed to 'fix a bug from a GitHub issue' reads an injected prompt in an issue comment and exfiltrates `.env` AWS keys.",
    tools: [
      { name: "OpenHands", url: "https://github.com/All-Hands-AI/OpenHands" },
      { name: "Cline", url: "https://github.com/cline/cline" }
    ]
  },
  {
    id: 6,
    title: "The Structured JSON Illusion",
    category: "Reliability & APIs",
    symptoms: [
      "json parse error",
      "trailing comma syntax error",
      "missing closing bracket",
      "markdown wrapper around json",
      "api pipeline crash"
    ],
    myth: "Just tell the LLM to output valid JSON matching your schema — instant API integration!",
    reality: "Under latency pressure or novel input tokens, LLMs will prepend conversational preamble, output trailing commas, or truncate JSON arrays when nearing token limits, breaking downstream backend parsers.",
    fix: "Never rely on raw prompting for JSON. Use constrained grammar sampling at the model engine level (forcing logits to only output valid schema tokens).",
    impact: "Downstream checkout or database ingestion services crash silently in production due to an unescaped double-quote or missing closing brace.",
    tools: [
      { name: "vLLM (Guided Decoding)", url: "https://github.com/vllm-project/vllm" },
      { name: "Outlines", url: "https://github.com/dottxt-ai/outlines" },
      { name: "llama.cpp", url: "https://github.com/ggerganov/llama.cpp" }
    ]
  },
  {
    id: 7,
    title: "The Pure Vector Search Trap",
    category: "Retrieval & Context",
    symptoms: [
      "error code search returns wrong doc",
      "exact invoice number not found",
      "cosine similarity semantic drift",
      "part number lookup failure"
    ],
    myth: "Embed your documents into a vector database and semantic search will magically find every answer!",
    reality: "Dense embeddings compress semantic meaning into float vectors, entirely erasing exact matches for error codes, part numbers, stock tickers, and proper names where semantic proximity is useless.",
    fix: "Use hybrid search combining BM25 exact keyword matching with dense vectors, followed by a cross-encoder reranker.",
    impact: "Customer support RAG answers product support questions with solutions for entirely different model numbers because their embeddings were close.",
    tools: [
      { name: "Qdrant", url: "https://github.com/qdrant/qdrant" },
      { name: "RAGFlow", url: "https://github.com/infiniflow/ragflow" },
      { name: "Meilisearch", url: "https://github.com/meilisearch/meilisearch" }
    ]
  },
  {
    id: 8,
    title: "The Silent Model Regression Trap",
    category: "Evals & Testing",
    symptoms: [
      "new model breaks formatting",
      "refusal rate spiked",
      "subtle tone shift breaks parser",
      "silent degradation after model update"
    ],
    myth: "Auto-upgrade to the newest flagship model release for instant free intelligence!",
    reality: "New model checkpoints regularly regress on edge cases: system prompt adherence shifts, refusal behaviors change, and structured output formatting alters slightly, breaking brittle production parsers.",
    fix: "Never upgrade production model versions without an automated CI/CD eval suite testing against a frozen golden dataset of edge cases.",
    impact: "A point-release update causes a 12% jump in user-facing refusals on benign customer queries.",
    tools: [
      { name: "Promptfoo", url: "https://github.com/promptfoo/promptfoo" },
      { name: "DeepEval", url: "https://github.com/confident-ai/deepeval" },
      { name: "Giskard", url: "https://github.com/Giskard-AI/giskard" }
    ]
  },
  {
    id: 9,
    title: "The Multi-Agent Runaway Loop Trap",
    category: "Agents & Workflow",
    symptoms: [
      "infinite loop",
      "agents stuck in circle",
      "swarms deadlock",
      "runaway cost in 1 hour",
      "polite agreement loop"
    ],
    myth: "Deploy autonomous swarms of agents that critique and coordinate with each other 24/7!",
    reality: "Autonomous agent swarms rapidly descend into recursive critique loops, infinite agreement deadlocks, or hallucination cascades. Without strict iteration counters and cycle detection, two agents can burn through thousands of dollars in minutes.",
    fix: "Enforce strict hard-stop turn budgets (max 5-8 iterations), acyclic execution graphs (DAGs), and deterministic exit criteria for all subagents.",
    impact: "Unbounded multi-agent swarms can rack up a ₹2,00,000+ cloud bill in a single afternoon with zero completed tasks.",
    tools: [
      { name: "n8n", url: "https://n8n.io/" },
      { name: "Dify", url: "https://github.com/langgenius/dify" },
      { name: "Langflow", url: "https://www.langflow.org/" }
    ]
  },
  {
    id: 10,
    title: "The PDF & Table Chunking Shredder",
    category: "Retrieval & Context",
    symptoms: [
      "pdf tables broken",
      "corrupted financial data",
      "rag table failure",
      "chunking sliced rows",
      "balance sheet wrong"
    ],
    myth: "Simple character or sentence RAG chunking easily handles enterprise PDFs and balance sheets!",
    reality: "Standard text chunkers slice documents at arbitrary token limits, severing table rows from headers. Financial figures end up mapped to wrong columns, causing RAG models to confidently invert financial reports and legal contract numbers.",
    fix: "Replace text-based chunking with layout-aware vision-OCR parsers that reconstruct multi-column layouts and tables into structured Markdown tables prior to vector embedding.",
    impact: "Executives make multi-crore investment decisions based on corrupted balance-sheet numbers generated by naive RAG chunkers.",
    tools: [
      { name: "MinerU", url: "https://opendatalab.github.io/MinerU/" },
      { name: "PyMuPDF4LLM", url: "https://github.com/pymupdf/PyMuPDF4LLM" },
      { name: "pdf oxide", url: "https://oxide.fyi/" }
    ]
  },
  {
    id: 11,
    title: "The TTFT & Latency Wall",
    category: "Serving & Infra",
    symptoms: [
      "slow response",
      "ttft latency",
      "thinking model timeout",
      "user bounce rate",
      "streaming lag"
    ],
    myth: "Deep reasoning models give flawless output — users won't mind waiting 30 seconds!",
    reality: "In real interactive customer-facing interfaces, any response taking over 2 seconds causes immediate drop-off and cart abandonment, regardless of how smart the model is.",
    fix: "Implement tiered speculative routing: use ultra-fast sub-100ms small models for initial responses, and escalate to reasoning engines asynchronously in the background.",
    impact: "Users abandon an AI workflow because the 30-second reasoning latency feels unresponsive compared to instant search.",
    tools: [
      { name: "vLLM", url: "https://github.com/vllm-project/vllm" },
      { name: "Groq", url: "https://groq.com/" },
      { name: "OmniRoute", url: "https://omniroute.online/" }
    ]
  },
  {
    id: 12,
    title: "The Vibe-Check Evaluation Failure",
    category: "Evals & Testing",
    symptoms: [
      "vibe check passed but production broke",
      "llm as a judge bias",
      "prompt change broke edge cases",
      "subjective review failure"
    ],
    myth: "The engineering lead tested 5 sample prompts and it looks amazing — ship it to production!",
    reality: "Subjective developer testing fails to uncover prompt drift, safety edge-cases, and silent accuracy regressions across thousands of real production user turns.",
    fix: "Instrument end-to-end production tracing with automated user-feedback scoring and continuous LLM observability.",
    impact: "A prompt tweak that improved 3 developer test cases silently broke 40% of production customer edge cases without telemetry.",
    tools: [
      { name: "Langfuse", url: "https://github.com/langfuse/langfuse" },
      { name: "Arize Phoenix", url: "https://github.com/Arize-ai/phoenix" },
      { name: "Ragas", url: "https://github.com/explodinggradients/ragas" }
    ]
  },
  {
    id: 13,
    title: "The Vector DB RAM Explosion",
    category: "Serving & Infra",
    symptoms: [
      "out of memory oom kill",
      "expensive vector db tier",
      "index build crash",
      "ram cost exceeding gpu cost"
    ],
    myth: "Store billions of high-dimensional vectors in memory for instant enterprise search!",
    reality: "Keeping uncompressed 1536-dimensional FP32 vectors in raw server memory costs thousands of dollars per month as document volume scales into the millions.",
    fix: "Use disk-backed scalar and product quantization (PQ/SQ) with memory-mapped vector indexes, storing full vectors on NVMe rather than raw RAM.",
    impact: "Vector database hosting bills surpass the actual LLM inference bills by 3x at enterprise scale.",
    tools: [
      { name: "Qdrant", url: "https://github.com/qdrant/qdrant" },
      { name: "pgvector", url: "https://github.com/pgvector/pgvector" },
      { name: "Milvus", url: "https://github.com/milvus-io/milvus" }
    ]
  },
  {
    id: 14,
    title: "The Naive Prompt Guardrail Illusion",
    category: "Security & Guardrails",
    symptoms: [
      "jailbreak bypassed system prompt",
      "ignore previous instructions leak",
      "pii leaked to user",
      "dan mode bypass"
    ],
    myth: "Adding 'You are a polite assistant and must never disclose secrets' to your system prompt protects your business!",
    reality: "Prompt-level instructions can always be overridden by sophisticated jailbreaks, multilingual token encodings, or recursive context manipulation. Prompting is NOT a security boundary.",
    fix: "Deploy deterministic classifier guardrails and independent input/output screening models outside the LLM execution pipeline.",
    impact: "A customer jailbreaks an automotive chatbot into selling a brand-new vehicle for $1 legally bound by conversation record.",
    tools: [
      { name: "Llama Guard", url: "https://huggingface.co/meta-llama/Llama-Guard-3-8B" },
      { name: "NeMo Guardrails", url: "https://github.com/NVIDIA/NeMo-Guardrails" },
      { name: "Guardrails AI", url: "https://github.com/guardrails-ai/guardrails" }
    ]
  },
  {
    id: 15,
    title: "The Local Hardware Bandwidth Collapse",
    category: "Serving & Infra",
    symptoms: [
      "0.5 tokens per second",
      "system swap frozen",
      "unified memory bandwidth choked",
      "developer machine unusable"
    ],
    myth: "You can easily run a 70B open model locally on any developer's laptop with full speed!",
    reality: "LLM inference speed is strictly bounded by memory bandwidth, not CPU/GPU core count. Running 70B parameters over dual-channel DDR5 yields an unusable 2 tokens/sec.",
    fix: "Right-size local development to 7B–14B quantized models (Q4_K_M) on developer machines, and deploy 70B+ weights to shared on-premise GPU clusters using vLLM.",
    impact: "Developers waste entire workdays waiting for local model responses that take 45 seconds per response.",
    tools: [
      { name: "llama.cpp", url: "https://github.com/ggerganov/llama.cpp" },
      { name: "Ollama", url: "https://github.com/ollama/ollama" },
      { name: "Jan", url: "https://jan.ai/" }
    ]
  },
  {
    id: 16,
    title: "The Tool-Calling Ambiguity Trap",
    category: "Reliability & APIs",
    symptoms: [
      "wrong tool chosen",
      "hallucinated parameter type",
      "date format parse failure",
      "calling function with missing required arg"
    ],
    myth: "Just list 20 API tool definitions and the LLM will pick the right function and arguments every time!",
    reality: "Tool-selection accuracy plummets exponentially as the number of available tools passes 5–7. LLMs pass strings where ints are expected or pick semantically adjacent functions randomly.",
    fix: "Use two-stage hierarchical tool routing with strict runtime schema validation and retry guards that feed errors directly back into the context.",
    impact: "An e-commerce bot triggers a database cancellation routine instead of an address update routine due to overlapping descriptions.",
    tools: [
      { name: "Instructor", url: "https://github.com/jxnl/instructor" },
      { name: "BAML", url: "https://github.com/boundaryml/baml" }
    ]
  },
  {
    id: 17,
    title: "The Proprietary Vendor Lock-In Squeeze",
    category: "Cost & Tokens",
    symptoms: [
      "api outage takes down business",
      "sudden price hike",
      "rate limit 429 quota exhaustion",
      "model deprecation notice"
    ],
    myth: "Building exclusively on a single proprietary LLM API is the fastest and safest path to market!",
    reality: "Single-vendor dependencies lead to sudden outages, unexpected price hikes, arbitrary rate-limit throttling, and forced deprecation cycles that break production prompts without warning.",
    fix: "Deploy an intelligent open-source API gateway with automatic multi-provider failover, unified routing, and drop-in open-weight model fallbacks.",
    impact: "A major proprietary API outage takes down customer support during Black Friday sales with zero fallback mechanism.",
    tools: [
      { name: "OmniRoute", url: "https://omniroute.online/" },
      { name: "OpenRouter", url: "https://openrouter.ai/" },
      { name: "LiteLLM", url: "https://github.com/BerriAI/litellm" }
    ]
  },
  {
    id: 18,
    title: "The Conversational Memory Bloat",
    category: "Cost & Tokens",
    symptoms: [
      "chat latency grows every turn",
      "context window full after 10 messages",
      "bot forgot user name from turn 2",
      "cost per message escalates exponentially"
    ],
    myth: "Simply append every user and bot message to the conversation array for perpetual memory!",
    reality: "Appending raw chat history exponentially increases token costs per turn, burns the context window with conversational chit-chat, and dilutes the model's focus on user instructions.",
    fix: "Use entity-fact extraction and rolling hierarchical summaries (semantic memory) rather than appending raw historical message transcripts.",
    impact: "Customer support chats become unaffordable at ₹40 per message by turn 15 while forgetting facts stated at turn 1.",
    tools: [
      { name: "Mem0", url: "https://github.com/mem0ai/mem0" },
      { name: "Zep", url: "https://github.com/getzep/zep" }
    ]
  },
  {
    id: 19,
    title: "The \"Replace Junior Engineers\" Fallacy",
    category: "Agents & Workflow",
    symptoms: [
      "pr review backlog",
      "senior engineer burnout",
      "architectural drift",
      "hallucinated edge cases",
      "junior hiring freeze",
      "executive",
      "c-suite"
    ],
    myth: "AI coding agents write code 5x faster, so we can freeze junior hiring and cut our engineering headcount by 30-40% this fiscal year.",
    reality: "AI dramatically increases code generation velocity, but it causes a 3x surge in pull request volume, architectural drift, and subtle hallucinated edge-case bugs. Senior engineers spend 60% of their day reviewing AI-generated diffs instead of designing systems. Cutting juniors destroys the future talent pipeline and creates an institutional knowledge void within 18 months.",
    fix: "Treat AI as leverage to elevate junior engineers to mid-level velocity, not a headcount reduction tool. Enforce strict diff-budget caps, automated test-coverage gates, and mandatory human architectural review boundaries.",
    impact: "Unchecked AI diff volume overwhelms senior engineers, causes catastrophic production regressions, and eliminates institutional knowledge transfer.",
    tools: [
      { name: "Claude Code", url: "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code" },
      { name: "OpenSpec", url: "https://openspec.dev/" }
    ]
  },
  {
    id: 20,
    title: "The \"Build vs Buy\" Enterprise AI Platform Money Pit",
    category: "Serving & Infra",
    symptoms: [
      "14-month platform delay",
      "deprecated in-house orchestrator",
      "million dollar payroll burn",
      "mcp incompatibility",
      "executive",
      "c-suite"
    ],
    myth: "We need to build our own in-house custom LLM orchestration platform from scratch to maintain proprietary competitive advantage.",
    reality: "Internal platform builds take 9–14 months and consume $1.5M+ in engineering payroll, only to be rendered obsolete every quarter as open standards (Model Context Protocol, Ollama, Langflow, Dify) and cloud provider primitives leapfrog internal codebases.",
    fix: "Standardize on open protocols (MCP) and swappable gateway layers. Treat LLMs and orchestrators as commodity utilities; build your proprietary moat strictly around domain-specific enterprise data, private business logic, and custom evaluation benchmarks.",
    impact: "Millions wasted in custom platform development while competitors deploy standard MCP architectures in days.",
    tools: [
      { name: "MCP Servers (Anthropic)", url: "https://github.com/modelcontextprotocol/servers" },
      { name: "Dify", url: "https://github.com/langgenius/dify" },
      { name: "Ollama", url: "https://github.com/ollama/ollama" }
    ]
  },
  {
    id: 21,
    title: "The Shadow AI & Trade Secret Exfiltration Blindspot",
    category: "Security & Guardrails",
    symptoms: [
      "shadow ai copy-paste",
      "unauthorized consumer llm accounts",
      "customer pii leak",
      "source code training exfiltration",
      "executive",
      "c-suite"
    ],
    myth: "Our corporate HR policy bans public AI tools, so our trade secrets, source code, and customer data are secure.",
    reality: "Outright bans do not work—they create massive Shadow AI. Employees routinely paste customer PII, unreleased financial projections, and proprietary code into personal consumer web chats that train external public models.",
    fix: "Replace bans with an authorized enterprise AI proxy gateway featuring automated Data Loss Prevention (DLP), PII masking/redaction, comprehensive audit logs, and zero-data-retention enterprise agreements.",
    impact: "Unregulated employee AI usage leads to intellectual property leaks, customer PII exposure, and severe statutory fines under global data protection acts.",
    tools: [
      { name: "Headroom", url: "https://docs.headroomlabs.ai/docs" },
      { name: "TruffleHog", url: "https://github.com/trufflesecurity/trufflehog" }
    ]
  },
  {
    id: 22,
    title: "The \"Multi-Agent ROI Hallucination\"",
    category: "Cost & Tokens",
    symptoms: [
      "uncontrolled token burn",
      "15 dollar ticket cost",
      "infinite agent reasoning loops",
      "negative operational roi",
      "executive",
      "c-suite"
    ],
    myth: "Deploying autonomous multi-agent swarms will run complex customer operations 24/7 at near-zero marginal cost.",
    reality: "Unconstrained recursive reasoning loops burn tokens non-linearly. A single complex ticket can consume $8–$25 in chained API calls with a 15–20% failure/loop rate—costing more than human operational staff with zero predictability.",
    fix: "Implement hard token spend budgets, semantic response caching, loop-depth limits, and deterministic rule engines for standard workflows. Never invoke autonomous LLM reasoning where deterministic code can solve the problem.",
    impact: "Operating expenses spiral out of control while autonomous agents deliver hallucinated and inconsistent resolutions.",
    tools: [
      { name: "LiteLLM", url: "https://github.com/BerriAI/litellm" },
      { name: "Qdrant", url: "https://github.com/qdrant/qdrant" }
    ]
  }
];
