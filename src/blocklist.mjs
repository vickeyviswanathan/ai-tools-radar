// Editorial blocklist: projects that are popular but are not AI tools, or are gimmicks / legally
// questionable. Matching is on the normalized name (lowercase, letters and digits only).
// Remove a line to let a project back in.
const BLOCKED = [
  // Not AI tools
  "ui", "librepods", "sharex", "gdevelop", "youtubedownloader", "concat",
  "x64dbg", "cleanyourtv", "pngquant",
  // Voice-cloning toys, prompt-pack "skills" and slide/diagram generators
  "mockingbird", "uiuxproma skill", "uiuxpromaxskill", "tasteskill", "frontendslides", "archify", "lemoopuscar",
  // Copies of other companies' leaked material or unofficial access to someone else's service
  "systempromptsandmodelsofaitools", "systempromptsleaks", "cl4r1t4s", "edgegpt",
  // Gimmick prompt packs and "free API" relays
  "ponytail", "caveman", "gptapifree", "dshourfreemodel", "moneyprinterturbo",
  "stablediffusionwebuicolab", "faststablediffusion", "removeaiwatermarks",
  // Spam redirects, checkpoints, and transient demos
  "aiwebsiteclonertemplate", "qwenimageedit2511lorasfast", "qwen3ttsdemo", "easydataset",
  "wan2214bpreview",
  // Non-AI software, hardware firmware, generic libraries, blogs, books, lists & tip-jars
  "medusa", "reactiveresume", "pypdf", "firmware", "reticulum",
  "claudecodebestpractice", "claudeskills", "aiagentbook", "publicapis",
  "academicresearchskills", "llmaction", "kimik3inc", "humanizer",
];

const normalize = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const SET = new Set(BLOCKED.map(normalize));

export const isEditoriallyBlocked = (name) => SET.has(normalize(name));
