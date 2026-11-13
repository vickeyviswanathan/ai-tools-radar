# DRAFT OUTLINE — not published, not in the sitemap, not linked

**Working title:** Ollama vs LM Studio vs llama.cpp: Choosing a Local-Model Runner
**Pillar:** AI Engineering · **Target week:** 3 (from the SEO growth pack) · **Status:** outline only

> Publishing rule for this piece: **no benchmark numbers, speed claims or "X is faster" statements until the tests below
> have actually been run, logged and the raw results are linked.** Every factual claim about a tool must cite its own
> documentation or repository. Anything we cannot source is cut, not softened.

## Reader and intent
Developers choosing how to run open-weight models locally (laptop/workstation, CPU or consumer GPU) for coding agents,
RAG prototyping or private prompts. Comparison/evaluation intent ("ollama vs lm studio", "llama.cpp vs ollama").

## Proposed structure
1. **The short decision guide** (a table filled in only from sourced facts): interface (CLI / GUI / library), OS support,
   model format handling, API surface (OpenAI-compatible server?), licence, how updates ship, what each is *not* for.
2. **How they relate** — verify from each project's docs whether and how they build on or wrap `llama.cpp` before writing
   any sentence about the relationship.
3. **Setup friction** — time-to-first-token workflow for each, written from a real clean-machine run with screenshots.
4. **Using it with agents and apps** — pointing an OpenAI-compatible client at each local server; config snippets that were
   actually executed.
5. **Privacy and data posture** — what stays on the machine by default; telemetry/network behaviour verified with a
   network capture or official statement (not assumption).
6. **Operational caveats** — model management, disk usage, GPU/CPU offload controls, concurrency limits — each tied to a source or a test.
7. **When to choose which** — decision rules derived from sections 1–6 only.
8. **Related Cipherati pages** — existing tool reviews and any comparison pages for these three tools.

## Test plan (must be completed and documented before any numbers appear)
| Item | How |
|---|---|
| Hardware + OS description | Record exact CPU/GPU/RAM, OS version, driver versions |
| Same model + same quantisation on all three | Pin model file hash and prompt set; note any unavoidable differences |
| Metrics | Time to first token, tokens/second (prompt and generation separately), peak RAM/VRAM; ≥5 runs each, report median and range |
| Method | Scripted harness committed to the repo; raw logs attached; versions of each tool recorded |
| Caveats | State clearly that results are one machine and one model, not general rankings |

## Sources to read before writing (all primary)
- Ollama documentation and repository
- LM Studio documentation (including its server and licence terms)
- llama.cpp repository (README, server docs, licence)

## Open questions
- Which exact versions will be tested at writing time?
- Does the test hardware represent what readers have? (If not, say so prominently.)
- Which claims on the existing Cipherati review pages for these tools need to be re-checked against current docs first?
