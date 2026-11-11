import { useState, useEffect } from "react";

const LEVELS = [
  { label: "Excellent", value: "an excellent" },
  { label: "Strong", value: "a strong" },
  { label: "Good", value: "a good" },
  { label: "Adequate", value: "an adequate" },
  { label: "Some", value: "some" },
  { label: "Limited", value: "limited" },
];

// ── Groq model selection ──────────────────────────────────────────────
// Groq retires models periodically. We start with GROQ_DEFAULT_MODEL; if Groq
// reports it as retired, we fetch the key's model list and pick a replacement.
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";
// Preferred general-purpose writing models, best first (matched by prefix so
// newer versions of the same family still match).
const GROQ_PREFERRED = [
  "llama-3.3-70b", "openai/gpt-oss-120b", "moonshotai/kimi-k2", "meta-llama/llama-4-maverick",
  "meta-llama/llama-4-scout", "qwen/qwen3", "openai/gpt-oss-20b", "llama-3.1-8b",
];
// Speech, safety-filter and tool-only models can't write comments.
const GROQ_NOT_FOR_TEXT = /whisper|guard|tts|playai|orpheus|compound|embed|vision|allam/i;
const isRetiredModel = (msg) => /decommission|deprecat|no longer (supported|available)|does not exist|model_not_found|not found|invalid model/i.test(msg ?? "");
const pickGroqModel = (ids, exclude) => {
  const usable = ids.filter(id => id !== exclude && !GROQ_NOT_FOR_TEXT.test(id));
  for (const pref of GROQ_PREFERRED) {
    const hit = usable.find(id => id === pref || id.startsWith(pref));
    if (hit) return hit;
  }
  // Nothing familiar: take the largest model by its parameter count ("70b", "120b"…).
  const size = id => Number((id.match(/(\d+)b\b/i) || [0, 0])[1]);
  return usable.sort((a, b) => size(b) - size(a))[0] || null;
};
const getGroqModel = () => {
  try { return localStorage.getItem("rc_groq_model") || GROQ_DEFAULT_MODEL; } catch { return GROQ_DEFAULT_MODEL; }
};
const saveGroqModel = (model) => {
  try { localStorage.setItem("rc_groq_model", model); } catch { /* storage unavailable */ }
};

// Strength-focused midterm opening lines from school guidance (names replaced with codes).
const STRENGTH_OPENERS = [
  `[@Name] consistently demonstrates a willingness to learn and a positive approach to classroom activities.`,
  `[@Name] contributes positively to the classroom environment and demonstrates strength in building connections with peers and staff.`,
  `[@Name] approaches new learning with curiosity and is willing to ask questions to deepen [@Possessive] understanding.`,
  `[@Name] demonstrates strong problem-solving skills and is able to apply feedback to improve [@Possessive] work.`,
  `[@Name] arrives prepared for class and demonstrates a willingness to participate and engage in learning.`,
];

const PRONOUN_SETS = [
  { label: "She/Her/Her", p: "she", o: "her", pos: "her", P: "She", O: "Her", Pos: "Her" },
  { label: "He/Him/His", p: "he", o: "him", pos: "his", P: "He", O: "Him", Pos: "His" },
  { label: "They/Them/Their", p: "they", o: "them", pos: "their", P: "They", O: "Them", Pos: "Their" },
];

const SUBJECTS = [
  "English","Mathematics","Science","Biology","Chemistry","Physics",
  "History","Geography","French","Art","Music","Physical Education","Business","Computer Science","Other"
];

const CURRICULUM_TOPICS = {
  Physics: {
    // Standalone subject only at Grades 11–12. Grade 11 University only (SPH3U).
    11: {
      University:  ["kinematics", "forces", "energy and society", "waves and sound", "electricity and magnetism"],
      default:     ["kinematics", "forces", "energy and society", "waves and sound", "electricity and magnetism"],
    },
    12: {
      University:  ["dynamics", "energy and momentum", "gravitational, electric, and magnetic fields", "the wave nature of light", "revolutions in modern physics including quantum mechanics and special relativity"],
      College:     ["motion and its applications", "mechanical systems", "electricity and magnetism", "energy transformations", "hydraulic and pneumatic systems"],
      default:     ["dynamics", "energy and momentum", "gravitational, electric, and magnetic fields", "the wave nature of light", "revolutions in modern physics"],
    },
  },
  Chemistry: {
    // Standalone subject only at Grades 11–12. Grade 11 University only (SCH3U).
    11: {
      University:  ["matter, chemical trends, and chemical bonding", "chemical reactions", "quantities in chemical reactions", "solutions and solubility", "gases and atmospheric chemistry"],
      default:     ["matter, chemical trends, and chemical bonding", "chemical reactions", "quantities in chemical reactions", "solutions and solubility", "gases and atmospheric chemistry"],
    },
    12: {
      University:  ["organic chemistry", "structure and properties of matter", "energy changes and rates of reaction", "chemical systems and equilibrium", "electrochemistry"],
      College:     ["matter and qualitative analysis", "organic chemistry", "electrochemistry", "chemical calculations", "chemistry in the environment"],
      default:     ["organic chemistry", "structure and properties of matter", "energy changes and rates of reaction", "chemical systems and equilibrium", "electrochemistry"],
    },
  },
  Biology: {
    // Standalone subject only at Grades 11–12. Grade 12 University only (SBI4U).
    11: {
      University:  ["diversity of living things", "evolution", "genetic processes", "animals: structure and function", "plants: anatomy, growth, and function"],
      College:     ["cellular biology", "microbiology", "genetics", "anatomy of mammals", "plants in the natural environment"],
      default:     ["diversity of living things", "evolution", "genetic processes", "animals: structure and function", "plants: anatomy, growth, and function"],
    },
    12: {
      University:  ["biochemistry", "metabolic processes", "molecular genetics", "homeostasis", "population dynamics"],
      default:     ["biochemistry", "metabolic processes", "molecular genetics", "homeostasis", "population dynamics"],
    },
  },
  Science: {
    9: {
      // De-streamed as of 2022 (SNC1W) — no Academic/Applied streams
      default:     ["sustainable ecosystems and biodiversity", "atoms, elements, and compounds", "static and current electricity", "the solar system and space exploration"],
    },
    10: {
      Academic:    ["tissues, organs, and systems of living things", "chemical reactions", "climate change", "light and geometric optics"],
      Applied:     ["tissues, organs, and systems", "chemical reactions and their practical application", "earth's dynamic climate", "light and applications of optics"],
      default:     ["tissues, organs, and systems", "chemical reactions", "climate change", "light and geometric optics"],
    },
  },
  Mathematics: {
    9: {
      Academic:    ["number sense and algebra", "linear relations", "analytic geometry", "measurement and geometry"],
      Applied:     ["proportional reasoning", "linear relations in applied contexts", "measurement and practical geometry", "number sense"],
      default:     ["number sense and algebra", "linear relations", "measurement and geometry", "analytic geometry"],
    },
    10: {
      Academic:    ["quadratic relations", "analytic geometry", "trigonometry of right and acute triangles", "linear systems"],
      Applied:     ["measurement and trigonometry in applied contexts", "modelling linear relations", "quadratic relations in applied contexts", "proportional reasoning"],
      default:     ["quadratic relations", "analytic geometry", "trigonometry", "linear systems"],
    },
    11: {
      University:  ["characteristics of functions", "exponential functions", "trigonometric functions", "discrete functions and financial applications"],
      College:     ["quadratic and exponential relationships", "trigonometry for practical applications", "personal finance and budgeting", "statistics and data management"],
      Workplace:   ["financial literacy and earning income", "measurement in the workplace", "geometry and spatial reasoning", "data and probability for decision-making"],
      default:     ["characteristics of functions", "exponential functions", "trigonometric functions", "financial applications"],
    },
    12: {
      University:  ["polynomial and rational functions", "trigonometric functions", "exponential and logarithmic functions", "combining functions and rates of change"],
      College:     ["geometry and trigonometry in applied contexts", "personal finance and mathematical models", "statistics and probability", "functions in everyday contexts"],
      Workplace:   ["financial literacy and budgeting", "measurement and workplace mathematics", "data analysis and probability", "spatial reasoning"],
      default:     ["polynomial and rational functions", "trigonometric functions", "exponential and logarithmic functions", "combining functions"],
    },
  },
  English: {
    9: {
      Academic:    ["literary analysis and response", "essay writing and argumentation", "oral communication and media literacy", "grammar and language conventions"],
      Applied:     ["reading and interpreting texts", "practical writing for everyday purposes", "oral communication and media", "language conventions"],
      default:     ["literary analysis", "essay writing", "oral communication", "media literacy"],
    },
    10: {
      Academic:    ["literary studies and critical response", "expository and argumentative writing", "media and information literacy", "oral communication and presentation"],
      Applied:     ["reading for meaning and purpose", "functional and creative writing", "media literacy", "oral communication"],
      default:     ["literary studies", "essay writing", "media literacy", "oral communication"],
    },
    11: {
      University:  ["literary analysis and critical thinking", "independent research and essay writing", "world literature and diverse perspectives", "media and information literacy"],
      College:     ["expository writing and communication", "media and information literacy", "textual analysis for practical purposes", "oral communication in professional contexts"],
      Workplace:   ["workplace communication and writing", "reading for information and practical purposes", "oral communication in the workplace", "media and digital literacy"],
      default:     ["literary analysis", "essay writing", "media literacy", "oral communication"],
    },
    12: {
      University:  ["world literature and advanced literary analysis", "independent literary research", "advanced essay writing and argumentation", "media studies and critical literacy"],
      College:     ["media and information literacy", "practical writing for college and career", "communication strategies", "textual analysis"],
      Workplace:   ["workplace and community communications", "technical and functional writing", "reading and interpreting workplace documents", "oral communication for employment"],
      default:     ["literary analysis", "writing", "media literacy", "oral communication"],
    },
  },
  History: {
    10: {
      Academic:    ["Canada in the twentieth century", "historical thinking and inquiry", "democratic values and human rights", "identity, citizenship, and heritage"],
      Applied:     ["Canadian history and identity", "social change and diversity", "civic participation and democracy", "conflict and cooperation in Canada"],
      default:     ["Canada in the twentieth century", "conflict and cooperation", "democratic values and human rights", "identity, citizenship, and heritage"],
    },
    11: {
      University:  ["historical inquiry and thinking", "Canada and world affairs", "social and cultural history", "governance and political change"],
      College:     ["Canadian and world history in context", "social history and daily life", "conflict, cooperation, and identity", "governance and citizenship"],
      default:     ["Canada and world affairs", "social history", "governance and citizenship", "conflict and cooperation"],
    },
    12: {
      University:  ["historical inquiry and interpretation", "societies and change across time", "global conflict and international cooperation", "power, governance, and justice"],
      College:     ["world history and global perspectives", "conflict and cooperation", "social and cultural change", "citizenship and governance"],
      default:     ["historical inquiry", "societies and change", "global conflict and cooperation", "power and governance"],
    },
  },
  Geography: {
    9: {
      Academic:    ["physical geography and the environment", "human geography and settlement", "geographic inquiry and mapping", "Canada's natural and human systems"],
      Applied:     ["physical and human geography in local and global contexts", "mapping and geographic skills", "environmental issues and stewardship", "Canada's communities"],
      default:     ["physical geography", "human geography", "geographic inquiry", "Canada's natural and human systems"],
    },
    11: {
      University:  ["geographic inquiry and spatial thinking", "physical geography and environmental systems", "human geography and global issues", "world issues and international development"],
      College:     ["geographic inquiry in applied contexts", "physical and human geography", "environmental management", "global and local community issues"],
      default:     ["geographic inquiry", "physical geography", "human geography", "world issues"],
    },
    12: {
      University:  ["geographic inquiry and spatial analysis", "physical geography and environmental change", "human geography and development", "environmental and resource management"],
      College:     ["geographic inquiry for practical purposes", "natural resource management", "human geography and communities", "environmental stewardship"],
      default:     ["geographic inquiry", "physical geography", "human geography", "environmental and resource management"],
    },
  },
  French: {
    9:  { default: ["oral communication", "reading and comprehension", "writing and language use", "grammar and language conventions"] },
    10: { default: ["oral communication", "reading comprehension", "writing", "language conventions"] },
    11: {
      University:  ["advanced oral communication", "literary reading and analysis", "essay and analytical writing", "grammar and language use"],
      College:     ["oral communication for practical purposes", "reading for information", "functional writing", "language conventions"],
      default:     ["oral communication", "reading", "writing", "language conventions"],
    },
    12: {
      University:  ["advanced oral communication and debate", "literary and informational reading", "analytical and argumentative writing", "advanced grammar"],
      College:     ["oral communication in professional contexts", "reading for information and analysis", "practical and expository writing", "language conventions"],
      default:     ["oral communication", "reading", "writing", "language conventions"],
    },
  },
  Business: {
    9:  { default: ["financial literacy", "entrepreneurship basics", "marketing fundamentals", "business communication"] },
    10: { default: ["financial planning", "marketing", "management and entrepreneurship", "accounting basics"] },
    11: {
      University:  ["financial accounting principles", "marketing strategy", "entrepreneurship and innovation", "international business"],
      College:     ["financial planning and accounting", "marketing and sales", "small business management", "business communications"],
      default:     ["financial accounting", "marketing", "entrepreneurship", "international business"],
    },
    12: {
      University:  ["financial accounting", "marketing management", "organizational behaviour and leadership", "international business"],
      College:     ["accounting and financial management", "marketing and customer relations", "business operations", "human resources"],
      default:     ["financial accounting", "marketing management", "organizational behaviour", "international business"],
    },
  },
  "Computer Science": {
    9:  { default: ["programming fundamentals", "computational thinking", "digital citizenship", "hardware and software"] },
    10: { default: ["programming concepts", "problem-solving and algorithms", "data structures", "software development"] },
    11: {
      University:  ["programming logic and design", "data structures and algorithms", "software design and development", "computer networks and security"],
      College:     ["programming for practical applications", "database design and management", "web development", "computer systems and networks"],
      default:     ["programming logic", "data structures", "software design", "computer networks"],
    },
    12: {
      University:  ["data structures and complexity", "algorithms and computational problem-solving", "software engineering principles", "computer organization and architecture"],
      College:     ["applied programming and software development", "database management systems", "network administration", "cybersecurity fundamentals"],
      default:     ["data structures", "algorithms", "software engineering", "computer organization"],
    },
  },
};

const getTopics = (subject, grade, stream) => {
  const gradeData = CURRICULUM_TOPICS[subject]?.[Number(grade)];
  if (!gradeData) return null;
  if (stream && gradeData[stream]) return gradeData[stream];
  return gradeData.default || null;
};

const STREAMS = [
  { label: "Academic (D)", value: "Academic" },
  { label: "Applied (P)", value: "Applied" },
  { label: "University (U)", value: "University" },
  { label: "College (C)", value: "College" },
  { label: "University/College (M)", value: "University/College" },
  { label: "Workplace (E)", value: "Workplace" },
  { label: "Open (O)", value: "Open" },
];

const emptyForm = {
  name: "", pronounIdx: 0, level: "a strong", subject: "Science", grade: "9", stream: "", highest: "",
  strengths: "", improvements: "", notes: "", failing: false, thriving: false,
  failReasons: "", failSupport: "",
};

export default function App() {
  const [form, setForm] = useState(emptyForm);
  const [generated, setGenerated] = useState("");
  const [edited, setEdited] = useState("");
  const [generatedBy, setGeneratedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [tab, setTab] = useState("generate");
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [groqKey, setGroqKey] = useState("");
  const [useGemini, setUseGemini] = useState(true);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [excelMode, setExcelMode] = useState(true);
  // "midterm" → next steps for the rest of THIS course; "final" → next steps for future courses
  const [term, setTermState] = useState(() => {
    try { return localStorage.getItem("rc_term") === "midterm" ? "midterm" : "final"; } catch { return "final"; }
  });
  const setTerm = (t) => {
    setTermState(t);
    try { localStorage.setItem("rc_term", t); } catch { /* storage unavailable */ }
  };
  const isMidterm = term === "midterm";
  // Midterm comments must open with a strength (school guidance). For the top
  // three levels the opening can still carry [@Level]; for adequate / some /
  // limited, "[@Level] understanding" reads as a deficit, so it is left out.
  const usesLevel = !isMidterm || ["an excellent", "a strong", "a good"].includes(form.level);
  // "Doing well" option: no area for growth, close by encouraging current habits.
  const thriving = !form.failing && !!form.thriving;
  const thrivingImprovements = `Areas to improve: NONE — this student is doing well. Do NOT include any weakness, area for growth, "could benefit from", "is encouraged to work on", or new next step (ignore any such sentence in the example). Instead, the closing sentence encourages the student to CONTINUE specific current habits drawn from the Strengths${isMidterm ? ' for the rest of THIS course' : ', ending with the future course reference'}.`;
  const midtermStructureRules = () => `
MIDTERM STRUCTURE (school requirement) — the comment MUST follow this order:
  (a) AREA OF STRENGTH — the opening sentence is strength-focused, built from the Strengths given.${usesLevel ? ' Pair [@Level] understanding with a specific strength in this sentence.' : ' Do NOT open with the achievement level or with anything that sounds like a deficit.'}
${thriving ? `  (b) ANOTHER STRENGTH — this student is doing well, so instead of an area for growth, give one more specific academic strength or habit. Do NOT include any weakness or "could benefit from" sentence.
  (c) KEEP IT UP — the final sentence encourages the student to CONTINUE specific current habits for the rest of THIS course (e.g. "For the remainder of the course, [@Subject] is encouraged to continue [specific habit]."). Do NOT suggest anything new to work on.` : `  (b) AREA FOR GROWTH — one sentence naming a specific area for growth, phrased subtly and constructively (e.g. "[@Subject2] could benefit from…", "[@Subject2] would benefit from…", "Continuing to work on … would help [@Object]…"). Do NOT announce it with the label "An area for growth is…" — the structure should be felt, not stated.
  (c) NEXT STEPS — the final sentence gives a concrete next step for the rest of THIS course.`}
WRONG opening (not strength-focused): "[@Name] is demonstrating a limited understanding of this course."
Strength-focused opening examples (match the style; base the content on THIS student's strengths):
${STRENGTH_OPENERS.map(s => `  - ${s}`).join('\n')}

WRITING QUALITY — the comment is read by parents, so it must sound natural and plain:
  - One clear idea per sentence. No stacked qualifiers like "particularly evident in", "especially in", "which is reflected in".${thriving ? '' : `
  - Area for growth: phrase it subtly, e.g. "[@Subject2] could benefit from participating more actively in class discussions." Vary the wording ("could benefit from", "would benefit from", "[-ing phrase] would help [@Object]…"). NEVER write the label "An area for growth is…" and NEVER "is for [@Object] to…".`}
  - Completed assessments stay in the present tense by describing what the work SHOWS: "[@Possessive2] work on the Dynamics Unit Test shows that [@Subject] can apply complex principles accurately." NEVER "On the [test], [@Subject] applies…".
  - Never mention the same unit or topic twice. If the Best assessment already names a unit (e.g. "Dynamics Unit Test"), do NOT also add the curriculum topic for that unit.
  - No vague padding: "to deepen collective understanding", "to reach [@Possessive] full potential", "to achieve academic success".${usesLevel ? `
  - Never put "strong", "excellent", "good" or "solid" anywhere near [@Level] — the placeholder already states the level.` : ''}${usesLevel && !thriving ? `
BAD (do not write like this): "[@Name] demonstrates [@Level] understanding of Grade 12 Physics concepts, particularly evident in [@Possessive] strong natural intuition for problem-solving. On the Dynamics Unit Test, [@Subject] applies complex principles effectively, especially in the unit on dynamics. An area for growth is for [@Object] to participate more actively in class discussions. For the remainder of the course, [@Subject] is encouraged to share [@Possessive] insights and questions more frequently to deepen collective understanding."
GOOD (same content): "[@Name] demonstrates [@Level] understanding of the Grade 12 Physics course and approaches problem-solving with natural intuition. [@Possessive2] work on the Dynamics Unit Test shows that [@Subject] can apply complex principles accurately. [@Subject2] could benefit from participating more actively in class discussions. For the remainder of the course, [@Subject] is encouraged to share [@Possessive] questions and ideas during class discussions."` : ''}
`;
  const reportName = isMidterm ? "midterm progress report" : "final report card";
  const systemPrompt = `You are an experienced Ontario high school teacher. You write professional, grammatically correct, specific, and natural-sounding ${reportName} comments. You follow formatting instructions precisely and output only what is asked — no commentary, no preamble.`;

  useEffect(() => {
    const storedKey = localStorage.getItem("rc_gemini_key");
    if (storedKey) setApiKey(storedKey.trim());
    const storedGroqKey = localStorage.getItem("rc_groq_key");
    if (storedGroqKey) setGroqKey(storedGroqKey.trim());

    const storedComments = localStorage.getItem("rc_comments");
    if (storedComments) {
      try { setSaved(JSON.parse(storedComments)); } catch {}
    }
    setStorageLoaded(true);
  }, []);

  const persist = (data) => {
    try { localStorage.setItem("rc_comments", JSON.stringify(data)); } catch {}
  };

  // Keys pasted from a web page often carry a trailing space or newline,
  // which the APIs reject as "invalid key" - strip all whitespace.
  const cleanKey = (key) => key.replace(/\s+/g, "");
  const saveApiKey = (key) => {
    const k = cleanKey(key);
    setApiKey(k);
    localStorage.setItem("rc_gemini_key", k);
  };
  const saveGroqKey = (key) => {
    const k = cleanKey(key);
    setGroqKey(k);
    localStorage.setItem("rc_groq_key", k);
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNA = v => v?.trim().toUpperCase() === "N/A";
  const pronouns = PRONOUN_SETS[form.pronounIdx];

  const formulaToText = (formula) => {
    const name = form.name?.trim() || "the student";
    return formula
      .replace(/^=/, '')
      .replace(/\[@Name\]/g, name)
      .replace(/\[@Level\]/g, form.level)
      .replace(/\[@Subject2\]/g, pronouns.P)
      .replace(/\[@Subject\]/g, pronouns.p)
      .replace(/\[@Object2\]/g, pronouns.O)
      .replace(/\[@Object\]/g, pronouns.o)
      .replace(/\[@Possessive2\]/g, pronouns.Pos)
      .replace(/\[@Possessive\]/g, pronouns.pos)
      .replace(/&/g, '')
      .replace(/"/g, '')
      .trim();
  };

  const TONE_GUIDE = {
    "an excellent": 'enthusiastic and highly positive throughout; celebrate strong achievements',
    "a strong": 'confident and positive; highlight clear strengths with encouragement',
    "a good": 'generally positive; acknowledge solid effort with room to grow',
    "an adequate": 'neutral and matter-of-fact; acknowledge foundational competency while clearly identifying specific areas requiring further development',
    "some": 'balanced and encouraging; recognize effort while clearly noting areas needing development',
    "limited": 'supportive but honest; focus on foundational development and areas for growth; avoid words like "impressive", "excelled", "outstanding", or any language implying high achievement',
  };

  const buildPassPrompt = () => {
    const topics = form.subject && form.grade ? getTopics(form.subject, form.grade, form.stream) : null;
    const example = !isMidterm
      ? `=[@Name]&" demonstrated "&[@Level]&" understanding of the Grade 11 Biology course. "&[@Subject2]&" supported "&[@Possessive]&" conclusions with strong evidence, particularly in the unit on genetics. The culminating lab report reflected careful attention to experimental design. "&[@Subject2]&" is encouraged to develop these skills in future science courses."`
      : usesLevel
        ? `=[@Name]&" demonstrates "&[@Level]&" understanding of the Grade 11 Biology course and consistently applies feedback to improve "&[@Possessive]&" work. "&[@Subject2]&" supports "&[@Possessive]&" conclusions with clear evidence, particularly in the unit on genetics. Explaining each step of "&[@Possessive]&" reasoning in written responses would further strengthen "&[@Possessive]&" work. For the remainder of the course, "&[@Subject]&" is encouraged to review feedback on each assessment before the final evaluation."`
        : `=[@Name]&" approaches new learning with curiosity and is willing to ask questions to deepen "&[@Possessive]&" understanding. "&[@Subject2]&" is developing "&[@Possessive]&" ability to apply concepts from the unit on genetics. Completing and submitting assignments more consistently would help "&[@Object]&" build on this progress. For the remainder of the course, "&[@Subject]&" is encouraged to attend extra help sessions and check in regularly about outstanding work."`;
    const tenseRule = isMidterm
      ? `4. This is a MIDTERM comment and MUST be written in the PRESENT TENSE throughout (e.g. "demonstrates", "is developing", "applies", "is encouraged to"). NEVER use past tense ("demonstrated", "showed") or "has demonstrated"/"has shown".`
      : `4. Past tense throughout; only the final sentence looks forward to future courses`;
    const closingRule = thriving
      ? (isMidterm
        ? `7. The final sentence MUST encourage the student to CONTINUE specific current habits for the REMAINDER OF THIS COURSE (e.g. "For the remainder of the course, [@Subject] is encouraged to continue [specific habit]."), followed by a period. Do NOT suggest anything new to work on. NEVER mention future courses.`
        : `7. The final sentence MUST encourage the student to CONTINUE specific current habits and end with a future course reference (e.g. "[@Subject2] is encouraged to continue [specific habit] in future Physics courses."), followed by a period. Do NOT suggest anything new to work on.`)
      : isMidterm
      ? `7. The final sentence MUST give a specific next step for the REMAINDER OF THIS COURSE (e.g. "for the remainder of the course", "in the upcoming units", "before the final evaluation"), followed by a period. NEVER mention future courses, next year, or subsequent courses — the student is still in this course. Keep it concise — no filler like "to achieve academic success".`
      : `7. The final sentence MUST end with a specific future course reference (e.g. "in future Physics courses", "in future science courses", "in subsequent courses") followed by a period. Never stop before naming the future courses. Keep it concise — do not pad it with filler phrases like "to achieve academic success" or "in upcoming studies".`;
    const levelCode = usesLevel
      ? `[@Level] — achievement level — REQUIRED, use exactly once, only before: understanding / grasp / knowledge / comprehension`
      : `[@Level] — DO NOT USE in this comment (see rule 1)`;
    const levelRule = usesLevel
      ? `1. [@Level] MUST appear — never write the achievement level as plain text. Write ONLY "&[@Level]&" with no extra words before or after it (e.g. WRONG: "a good "&[@Level]&"" — CORRECT: "&[@Level]&"")`
      : `1. Do NOT use [@Level] anywhere and never state the achievement level in words — this midterm comment must open with a strength, not the level`;
    const fillerRule = isMidterm
      ? `5. No filler phrases: "worked hard", "showed dedication", "punctual", "attendance", "pleasant to work with", "to further consolidate learning". (Learning-skills strengths such as "a willingness to learn", "a positive approach to classroom activities", "arrives prepared for class" or "contributes positively to the classroom environment" ARE allowed in the opening strength when they match the Strengths given.)`
      : `5. No filler phrases: "worked hard", "positive attitude", "showed dedication", "on time for class", "punctual", "attendance", "contributing to a focused learning environment", "pleasant to work with", "willingness to engage", "to further consolidate learning"`;
    const levelWordsRule = usesLevel
      ? `5b. Do NOT use achievement-level adjectives anywhere in the comment body — words like "excellent", "exceptional", "outstanding", "strong", "good", "solid", "impressive" echo the [@Level] placeholder and sound redundant. Describe what the student did specifically instead.`
      : `5b. Keep praise honest for the achievement level — describe specific strengths rather than using words like "excellent", "exceptional", "outstanding" or "impressive".`;
    return `Write a Grade ${form.grade || 'high school'} ${form.subject || 'course'} Ontario ${reportName} comment as an Excel formula.

CODES (copy exactly, do not alter):
=[@Name] — student name, once at the very start
${levelCode}
[@Subject2] / [@Subject] — She/He/They (sentence start) / she/he/they (mid-sentence) — before verbs only
[@Possessive2] / [@Possessive] — Her/His/Their (sentence start) / her/his/their (mid-sentence) — before nouns only
[@Object] — her/him/them — after prepositions or as verb object

Formula format: =[@Name]&" text "&[@Subject2]&" more "&[@Possessive]&" noun."

EXAMPLE:
${example}

CRITICAL RULES:
${levelRule}
2. 3–4 complete sentences, each ending in a period — no comma splices
3. Not every sentence starts with the pronoun — vary openers (e.g. "The [assessment]...", "Complex problems were...")
${tenseRule}
${fillerRule}
${levelWordsRule}${isMidterm ? midtermStructureRules() : ''}
6. No word or phrase from the end of one sentence should reappear at the start of the next — avoid all back-to-back repetition between sentences
${closingRule}
8. Never make absolute predictions ("will excel", "will succeed", "will thrive") — use "is encouraged to continue" or "is well-prepared to"
9. Only use "continue" in the final sentence when the closing advice relates to a STRENGTH. If it relates to an area for improvement, write "is encouraged to [do X]" without "continue" — "continue" implies the student was already doing it

Achievement: ${form.level} — ${TONE_GUIDE[form.level] || ''}
${form.stream ? `Course stream: ${form.stream} — use this ONLY to calibrate the depth and focus of curriculum references. NEVER write the stream name in the comment. Write "Grade ${form.grade} ${form.subject || 'course'}" NOT "Grade ${form.grade} ${form.stream} ${form.subject || 'course'}".` : ''}
${topics ? `Curriculum topic — choose ONE from this list and mention it ONCE, briefly. Topics: ${topics.join(' / ')}

RULES for using the curriculum topic:
- NEVER in sentence 1 (${isMidterm ? 'the opening strength' : 'which must describe overall course performance'})
- The topic must appear in a POSITIVE context only — it should describe something the student understood, applied, or demonstrated skill with. NEVER attach the topic to a challenge or area for improvement.
- The topic clause must follow a statement about demonstrated CONTENT KNOWLEDGE or SKILL — e.g. "demonstrated understanding of quadratic relations" or "applied concepts from analytic geometry accurately". NEVER attach it to a behavioural or motivational observation like engagement, attitude, participation, willingness, or effort. WRONG: "approached concepts with enthusiasm, particularly in the unit on X" — RIGHT: "applied problem-solving strategies to quadratic relations".
- Do NOT use "which supported" or "which helped" to link a behaviour to a curriculum topic. The topic must stand on its own as an academic observation.` : ''}
Strengths: ${isNA(form.strengths) ? 'omit' : form.strengths}
${thriving ? thrivingImprovements : `Areas to improve (frame as a forward-looking recommendation — something the student SHOULD do more of, not something they already do): ${isNA(form.improvements) ? 'omit' : form.improvements}`}
${!isNA(form.highest) && form.highest ? `Best assessment: ${form.highest}` : 'Do not mention any specific assessment.'}
${form.notes && !isNA(form.notes) ? `Context (tone only, do not state directly): ${form.notes}` : ''}

Output only the Excel formula, nothing else.`;
  };

  // Failing comments differ most between terms: a final comment closes the
  // door (no encouragement), a midterm comment says what must happen to still earn the credit.
  const failExample = () => isMidterm
    ? `=[@Name]&" contributes positively to the classroom environment and demonstrates strength in building connections with peers and staff. "&[@Subject2]&" would benefit from completing key assignments and evaluations, as "&[@Possessive]&" current work does not yet provide sufficient evidence of learning to earn a credit in Grade 9 Science. To earn the credit by the end of the course, "&[@Subject]&" is encouraged to submit all outstanding assignments and attend extra help sessions before the final evaluation."`
    : `=[@Name]&" did not meet the required expectations to pass Grade 9 Science. "&[@Possessive2]&" performance on assessments did not demonstrate sufficient understanding of the course expectations, as several key assignments and evaluations were not completed to a passing standard. Despite support being made available, "&[@Subject]&" was unable to provide the evidence of learning required to earn a credit."`;
  const failStructure = () => isMidterm
    ? `(1) AREA OF STRENGTH — a strength-focused opening built from the Strengths below (never open with failing or a deficit), (2) AREA FOR GROWTH — what is currently lacking using the reasons below, making clear the student is not yet meeting the expectations needed to earn the credit, (3) NEXT STEPS — a specific next step for the REMAINDER OF THIS COURSE to earn the credit`
    : `(1) state they did not pass, (2) explain what specifically was lacking using the reasons provided, (3) reference support or a concluding factual statement`;
  const failToneRule = () => isMidterm
    ? `- MIDTERM: write in the PRESENT TENSE throughout (e.g. "demonstrates", "does not yet provide", "is encouraged to") — never past tense or "has demonstrated". Sentence 3 must be a concrete next step for the rest of THIS course — NEVER mention future courses or next year
- Strength-focused opening examples (match the style; base the content on THIS student's strengths):
${STRENGTH_OPENERS.map(s => `    ${s}`).join('\n')}
- Write plainly for parents: one idea per sentence; phrase the area for growth subtly, e.g. "[@Subject2] would benefit from [-ing phrase]" (NEVER the label "An area for growth is…", NEVER "is for [@Object] to"); no padding like "to reach [@Possessive] full potential"`
    : `- All past tense, no forward-looking language or encouragement`;

  const buildFailPrompt = () => `Write a Grade ${form.grade || 'high school'} ${form.subject || 'course'} Ontario ${reportName} comment for a ${isMidterm ? 'student who is currently FAILING' : 'FAILING student'} as an Excel formula.

CODES (copy exactly):
=[@Name] — student name, once at start
[@Subject2] / [@Subject] — She/He/They (sentence start) / she/he/they (mid-sentence) — before verbs only
[@Possessive2] / [@Possessive] — Her/His/Their (sentence start) / her/his/their (mid-sentence) — before nouns only
[@Object] — her/him/them — after prepositions or as verb object

EXAMPLE:
${failExample()}

RULES:
- 3 complete sentences — do not repeat the same idea across all three. Each sentence should add new information: ${failStructure()}
- Vary sentence openers — not every sentence starts with the pronoun
- Use the reasons for failing to write sentence 2 specifically — do not be generic
- If reasons involve absences/missing work, do NOT mention attendance — write "did not provide sufficient evidence of learning" instead
- Responsibility on student's actions: use "did not provide sufficient evidence", "was unable to demonstrate" — NEVER "had insufficient opportunity" or "was not given the chance"
${failToneRule()}

${isMidterm ? `Strengths (use for the opening sentence): ${form.strengths}\n` : ''}Reasons for failing: ${form.failReasons || 'not specified'}
Support available: ${isNA(form.failSupport) || !form.failSupport ? 'not specified' : form.failSupport}
${form.notes && !isNA(form.notes) ? `Context (tone only): ${form.notes}` : ''}

Output only the Excel formula, nothing else.`;

  const buildGroqPassPrompt = () => {
    const topics = form.subject && form.grade ? getTopics(form.subject, form.grade, form.stream) : null;
    const pronouns = PRONOUN_SETS[form.pronounIdx];
    const toneExamples = {
      "an excellent": "enthusiastic and highly positive. Use words like: excelled, exceptional, outstanding, sophisticated, impressive.",
      "a strong": "confident and positive. Highlight clear strengths with encouragement.",
      "a good": "generally positive. Acknowledge solid effort with room to grow.",
      "an adequate": "neutral and matter-of-fact. Acknowledge basic competency while noting areas needing development.",
      "some": "balanced and honest. Recognize effort but clearly note significant areas needing development. Do NOT use words like well-reasoned, exceptional, careful, outstanding, impressive, or any language implying strong achievement.",
      "limited": "supportive but honest. Focus on foundational development. NEVER use impressive, excelled, outstanding, well-reasoned, or any praise language.",
    };
    const example = !isMidterm
      ? `=[@Name]&" demonstrated "&[@Level]&" understanding of the Grade 11 Biology course. "&[@Subject2]&" showed developing skill in the unit on genetics, though "&[@Subject]&" sometimes struggled to apply concepts independently. The culminating lab reflected foundational knowledge of experimental design. "&[@Subject2]&" is encouraged to seek clarification when needed in future science courses."`
      : usesLevel
        ? `=[@Name]&" demonstrates "&[@Level]&" understanding of the Grade 11 Biology course and applies feedback to improve "&[@Possessive]&" work. "&[@Subject2]&" could benefit from explaining each step of "&[@Possessive]&" reasoning in written responses on genetics. For the remainder of the course, "&[@Subject]&" is encouraged to review feedback on each assessment before the final evaluation."`
        : `=[@Name]&" approaches new learning with curiosity and is willing to ask questions to deepen "&[@Possessive]&" understanding. "&[@Subject2]&" would benefit from completing and submitting assignments more consistently. For the remainder of the course, "&[@Subject]&" is encouraged to attend extra help sessions and check in regularly about outstanding work."`;
    const closing = thriving
      ? (isMidterm
        ? `ONE sentence encouraging the student to CONTINUE specific current habits for the REMAINDER OF THIS COURSE (nothing new to work on)`
        : `ONE sentence encouraging the student to CONTINUE specific current habits in future courses (nothing new to work on)`)
      : isMidterm
      ? `ONE next-step sentence for the REMAINDER OF THIS COURSE (e.g. "for the remainder of the course", "in the upcoming units", "before the final evaluation")`
      : `ONE forward-looking closing sentence referencing future courses`;
    const finalRule = isMidterm
      ? `8. This is a MIDTERM comment and MUST be written in the PRESENT TENSE throughout ("demonstrates", "is developing", "is encouraged to") — never past tense or "has demonstrated". The final sentence must be a next step for the rest of THIS course — NEVER mention future courses, next year, or subsequent courses. End with a period
${midtermStructureRules()}`
      : `8. Final sentence must reference future ${form.subject || 'courses'} (not "classes") and end with a period`;
    const levelCodeLine = usesLevel
      ? `[@Level] — achievement level placeholder — YOU MUST USE THIS, never write "${form.level}" as plain text`
      : `[@Level] — DO NOT USE in this comment, and never state the achievement level in words`;
    const levelRule = usesLevel
      ? `2. [@Level] MUST appear exactly once before a noun like "understanding" or "grasp". The verb immediately before it must be simple: "demonstrated", "showed", "developed", or "displayed"${isMidterm ? ' (midterm: "demonstrates" / "shows")' : ''}. NEVER write compound phrases like "excelled in demonstrating" or "showed exceptional" before [@Level] — [@Level] already contains the achievement level, so adding praise words before it is redundant.`
      : `2. Do NOT use [@Level]. Open with a strength instead (see MIDTERM STRUCTURE).`;
    const sentence1Rule = isMidterm
      ? `3. SENTENCE 1 is the AREA OF STRENGTH${usesLevel ? ' and contains [@Level]' : ''} — NEVER name a specific unit or topic in sentence 1.`
      : `3. SENTENCE 1 must describe the student's OVERALL performance in the course — NEVER name a specific unit or topic in sentence 1. WRONG: "demonstrated [@Level] understanding of quadratic relations". RIGHT: "demonstrated [@Level] understanding of the Grade 10 Mathematics course."`;
    const sentencesRule = isMidterm
      ? `4. Write EXACTLY 3 sentences total. Sentence 1: area of strength. Sentence 2: ${thriving ? 'another specific strength (no area for growth)' : 'area for growth'}. Sentence 3: ${closing}. STOP after sentence 3.`
      : `4. Write EXACTLY 3 sentences total — no more, no less. Sentence 1: overall course performance with [@Level]. Sentence 2: a specific academic observation. Sentence 3: ${closing}. STOP after sentence 3. Do NOT write a 4th sentence.`;
    const bannedRule = isMidterm
      ? `6. BANNED words and phrases in the comment body: "arrived on time", "worked hard", "well-reasoned", "strong ability", "exceptional", "outstanding", "impressive" (unless level is an excellent or a strong), "classes" (use "courses" instead). Learning-skills strengths like "a willingness to learn" or "arrives prepared for class" ARE allowed in the opening when they match the Strengths given.`
      : `6. BANNED words and phrases in the comment body: "arrived on time", "on time for class", "respect for the learning environment", "positive attitude", "willingness to engage", "worked hard", "well-reasoned", "strong ability", "exceptional", "outstanding", "impressive" (unless level is an excellent or a strong), "classes" (use "courses" instead)`;
    return `You are an Ontario high school teacher writing a ${reportName} comment. Output ONLY an Excel formula — no plain text, no preamble.

ACHIEVEMENT LEVEL: ${form.level}
TONE REQUIRED: ${toneExamples[form.level] || TONE_GUIDE[form.level] || ''}
The tone must match the achievement level throughout the entire comment. Do not use praise language for low achievement levels.

EXCEL FORMULA FORMAT — follow exactly:
=[@Name]&" text "&[@Subject2]&" more text "&[@Possessive]&" noun."

CODES:
[@Name] — student name (once, at the very start, no quotes around it in the formula)
${levelCodeLine}
[@Subject2] / [@Subject] — ${pronouns.P} / ${pronouns.p} — before verbs only (${pronouns.P} at sentence start, ${pronouns.p} mid-sentence)
[@Possessive2] / [@Possessive] — ${pronouns.Pos} / ${pronouns.pos} — before nouns only (${pronouns.Pos} at sentence start, ${pronouns.pos} mid-sentence)
[@Object] — ${pronouns.O} — after prepositions or as verb object only

CORRECT EXAMPLE:
${example}

RULES:
1. OUTPUT MUST START WITH = AND USE THE CODES ABOVE — never output plain text
${levelRule}
${sentence1Rule}
${sentencesRule}
4b. Any sentence referencing assessments, tests, or culminating activities must describe what the student academically demonstrated or produced (skills, concepts, problem-solving). NEVER use an assessment sentence to describe behaviour, attitude, or support-seeking.
5. BANNED sentence opener: "Complex problems were approached" — never use this
${bannedRule}
7. Curriculum topic: ${topics ? `choose ONE from: ${topics.join(' / ')}. Mention it ONCE in sentences 2 or 3 only, in a sentence about academic content. NEVER in sentence 1.` : 'omit curriculum topic references.'}
${finalRule}
${form.stream ? `9. Stream: ${form.stream} — do NOT write this word in the comment` : ''}

Strengths: ${isNA(form.strengths) ? 'omit' : form.strengths}
${thriving ? thrivingImprovements : `Areas to improve (frame as encouragement): ${isNA(form.improvements) ? 'omit' : form.improvements}`}
${!isNA(form.highest) && form.highest ? `Best assessment: ${form.highest}` : ''}
${form.notes && !isNA(form.notes) ? `Context (tone only, do not state): ${form.notes}` : ''}

OUTPUT THE EXCEL FORMULA NOW:`;
  };

  const buildGroqFailPrompt = () => `Write a Grade ${form.grade || 'high school'} ${form.subject || 'course'} Ontario ${reportName} comment for a ${isMidterm ? 'student who is currently FAILING' : 'FAILING student'} as an Excel formula.

CODES (copy exactly):
=[@Name] — student name, once at start
[@Subject2] / [@Subject] — ${PRONOUN_SETS[form.pronounIdx].P} / ${PRONOUN_SETS[form.pronounIdx].p} — subject pronoun, before verbs only
[@Possessive2] / [@Possessive] — ${PRONOUN_SETS[form.pronounIdx].Pos} / ${PRONOUN_SETS[form.pronounIdx].pos} — possessive, before nouns only
[@Object] — ${PRONOUN_SETS[form.pronounIdx].O} — after prepositions or as verb object

EXAMPLE:
${failExample()}

RULES:
- 3 complete sentences. Each adds new information: ${failStructure()}
- Vary sentence openers — not every sentence starts with the pronoun
- If reasons involve absences/missing work: do NOT say "attendance" — say "did not provide sufficient evidence of learning"
- NEVER use "had insufficient opportunity" or "was not given the chance" — use "was unable to demonstrate" or "did not provide sufficient evidence"
${failToneRule()}

${isMidterm ? `Strengths (use for the opening sentence): ${form.strengths}\n` : ''}Reasons for failing: ${form.failReasons || 'not specified'}
Support available: ${isNA(form.failSupport) || !form.failSupport ? 'not specified' : form.failSupport}
${form.notes && !isNA(form.notes) ? `Context (tone only): ${form.notes}` : ''}

Output only the Excel formula, nothing else.`;

  const convertToFormula = (raw) => {
    let text = raw.trim()
      .replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '')
      .replace(/\{name\}/gi, '{NAME}')
      .replace(/\{they\}/gi, '{THEY}')
      .replace(/\{them\}/gi, '{THEM}')
      .replace(/\{their\}/gi, '{THEIR}')
      .replace(/\{level\}/gi, '{LEVEL}');

    const TOKEN_RE = /(\{NAME\}|\{THEY\}|\{THEM\}|\{THEIR\}|\{LEVEL\})/g;
    const parts = text.split(TOKEN_RE);

    let formula = '=';
    let atSentenceStart = true;
    let textBuffer = '';

    const flushBuffer = () => {
      if (!textBuffer) return;
      formula += `"${textBuffer}"&`;
      atSentenceStart = /[.!?]\s*$/.test(textBuffer.trimEnd());
      textBuffer = '';
    };

    for (const part of parts) {
      if (!part) continue;
      if (/^\{(NAME|THEY|THEM|THEIR|LEVEL)\}$/.test(part)) {
        flushBuffer();
        let code;
        if (part === '{NAME}')  code = '[@Name]';
        else if (part === '{LEVEL}') code = '[@Level]';
        else if (part === '{THEY}')  code = atSentenceStart ? '[@Subject2]' : '[@Subject]';
        else if (part === '{THEM}')  code = atSentenceStart ? '[@Object2]' : '[@Object]';
        else if (part === '{THEIR}') code = atSentenceStart ? '[@Possessive2]' : '[@Possessive]';
        formula += `${code}&`;
        atSentenceStart = false;
      } else {
        textBuffer += part;
      }
    }

    if (textBuffer) {
      formula += `"${textBuffer.trimEnd()}"`;
    } else {
      formula = formula.replace(/&$/, '');
    }

    return formula.replace(/""/g, '"').replace(/&&+/g, '&');
  };

  const cleanFormula = (raw) => {
    let text = raw.trim();

    const starts = [];
    const startRe = /=(?:&?\[@|")/g;
    let match;
    while ((match = startRe.exec(text)) !== null) starts.push(match.index);
    if (starts.length > 0) {
      text = text.slice(starts[starts.length - 1]).trim();
    }

    text = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').trim();

    if (text.startsWith('=') && !text.startsWith('=[@')) {
      const firstBracket = text.indexOf('[@');
      if (firstBracket !== -1) text = '=' + text.slice(firstBracket);
    }

    text = text.replace(/\[@\s+((?!Level)[^\]]+)\]/g, '[@$1]');

    // Normalize bare [@Code] tokens — add "&...&" wrapping if missing
    // Add "& before any [@Code] not already preceded by & or =
    text = text.replace(/(?<![&=])(\[@(?:Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\])/g, '"&$1');
    // Add &" after any [@Code] not already followed by &
    text = text.replace(/(\[@(?:Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\])(?!&)/g, '$1&"');
    // Clean up any doubled quotes introduced above
    text = text.replace(/""/g, '"');

    // Replace hardcoded level text with placeholder if model forgot to use it
    if (!text.includes('[@Level]')) {
      text = text.replace(
        /(demonstrated|showed|developed|displayed) (an excellent|a strong|a good|an adequate|some|limited) (understanding|grasp|knowledge|comprehension|command)/g,
        `$1 "&[@Level]&" $3`
      );
    }

    text = text.replace(/([^"=&])(&\[@)/g, '$1"$2');
    text = text.replace(/(\]&)([^"&@[])/g, '$1"$2');
    text = text.replace(/""/g, '"');

    const segments = text.split(/&(?="|\[)/);
    const noNA = segments.filter(seg => !/\bN\/?A\b/i.test(seg));
    text = noNA.join('&');
    text = text.replace(/&&+/g, '&').replace(/^=&"/, '="').replace(/^=&\[/, '=[');

    const subjectTriggers = ['that "&', 'if "&', 'when "&', 'as "&', 'because "&', 'as a result, "&', 'As a result, "&', 'therefore, "&', 'Therefore, "&'];
    subjectTriggers.forEach(trigger => {
      text = text.split(trigger + '[@Object]&"').join(trigger + '[@Subject]&"');
      text = text.split(trigger + '[@Object2]&"').join(trigger + '[@Subject2]&"');
      // Possessive before a verb after a subordinator should be Subject
      text = text.split(trigger + '[@Possessive]&"').join(trigger + '[@Subject]&"');
      text = text.split(trigger + '[@Possessive2]&"').join(trigger + '[@Subject2]&"');
    });

    const objectTriggers = ['by "&', 'for "&', 'with "&', 'about "&', 'from "&', 'of "&', 'to "&'];
    objectTriggers.forEach(trigger => {
      text = text.split(trigger + '[@Subject]&"').join(trigger + '[@Object]&"');
      text = text.split(trigger + '[@Subject2]&"').join(trigger + '[@Object2]&"');
    });

    const nameToken = '[@Name]&';
    const firstNameIdx = text.indexOf(nameToken);
    if (firstNameIdx !== -1) {
      let secondIdx = text.indexOf(nameToken, firstNameIdx + nameToken.length);
      while (secondIdx !== -1) {
        const beforeToken = text.slice(0, secondIdx);
        const afterToken = text.slice(secondIdx + nameToken.length);
        const startsNewSentence = /[.!?]\s*"$/.test(beforeToken) || beforeToken === '=';
        const replacement = startsNewSentence ? '[@Subject2]&' : '[@Subject]&';
        text = beforeToken + replacement + afterToken;
        secondIdx = text.indexOf(nameToken, secondIdx + replacement.length);
      }
    }

    const nounList = ['submission', 'performance', 'engagement', 'level', 'participation',
      'understanding', 'work', 'effort', 'achievement', 'behavior', 'behaviour', 'attitude',
      'attendance', 'completion', 'output', 'results', 'approach', 'ability', 'grasp',
      'knowledge', 'focus', 'dedication', 'commitment', 'progress', 'growth'];
    nounList.forEach(noun => {
      text = text.split(`[@Subject2]&" ${noun}`).join(`[@Possessive2]&" ${noun}`);
      text = text.split(`[@Subject]&" ${noun}`).join(`[@Possessive]&" ${noun}`);
    });

    text = text.replace(/(&"\s*)?was\s+"?&?\[@Level\]&?"?\s*(a\s+|an\s+)?(student|learner|worker|individual|one)?/gi,
      'demonstrated "&[@Level]&" understanding of the course material');
    text = text.replace(/a "&\[@Level\]&" level of/g, '"&[@Level]&"');
    // Remove stray level text before [@Level] — the level value already includes the full phrase
    text = text.replace(/ (an excellent|a strong|a good|an adequate|some|limited|a|an) "&\[@Level\]&"/g, ' "&[@Level]&"');

    const lvlToken = '[@Level]';
    let firstPos = text.indexOf(lvlToken);
    if (firstPos !== -1) {
      let secondPos;
      while ((secondPos = text.indexOf(lvlToken, firstPos + lvlToken.length)) !== -1) {
        let start = secondPos;
        if (text[start - 1] === '&') start--;
        if (text[start - 1] === '"') start--;
        let end = secondPos + lvlToken.length;
        if (text[end] === '&') end++;
        if (text[end] === '"') end++;
        text = text.slice(0, start) + text.slice(end);
        text = text.replace(/""/g, '"').replace(/ {2,}/g, ' ');
      }
    }

    [
      ['had insufficient opportunity to demonstrate', 'did not provide sufficient evidence of'],
      ['Had insufficient opportunity to demonstrate', 'Did not provide sufficient evidence of'],
      ['had limited opportunity to demonstrate', 'did not provide sufficient evidence of'],
      ['Had limited opportunity to demonstrate', 'Did not provide sufficient evidence of'],
      ['had limited opportunities to demonstrate', 'did not provide sufficient evidence of'],
      ['Had limited opportunities to demonstrate', 'Did not provide sufficient evidence of'],
      ['had insufficient opportunities to demonstrate', 'did not provide sufficient evidence of'],
      ['Had insufficient opportunities to demonstrate', 'Did not provide sufficient evidence of'],
      ['limited opportunities to demonstrate', 'limited evidence of'],
      ['Limited opportunities to demonstrate', 'Limited evidence of'],
      ['insufficient opportunity to demonstrate', 'insufficient evidence of'],
      ['Insufficient opportunity to demonstrate', 'Insufficient evidence of'],
      ['limited opportunity to demonstrate', 'limited evidence of'],
      ['Limited opportunity to demonstrate', 'Limited evidence of'],
      ['not given the chance to demonstrate', 'unable to provide evidence of'],
      ['did not have the opportunity to demonstrate', 'was unable to provide evidence of'],
      ['did not have sufficient opportunity', 'did not provide sufficient evidence'],
      ['lacked the opportunity to demonstrate', 'did not provide evidence of'],
      ['Lacked the opportunity to demonstrate', 'Did not provide evidence of'],
    ].forEach(([bad, good]) => { text = text.split(bad).join(good); });

    const capMap = { 'Subject2': 'Subject', 'Object2': 'Object', 'Possessive2': 'Possessive' };
    const lowMap = { 'Subject': 'Subject2', 'Object': 'Object2', 'Possessive': 'Possessive2' };
    text = text.replace(/"([^"]*)"&\[@(Subject2|Object2|Possessive2|Subject|Object|Possessive)\]&/g, (_m, pre, code) => {
      const trimmed = pre.trimEnd();
      const startsSentence = trimmed === '' || /[.!?]$/.test(trimmed);
      let newCode = code;
      if (startsSentence && lowMap[code]) newCode = lowMap[code];
      if (!startsSentence && capMap[code]) newCode = capMap[code];
      return `"${pre}"&[@${newCode}]&`;
    });
    text = text.replace(/^=\[@(Subject|Object|Possessive)\]&/, (_m, code) => `=[@${lowMap[code]}]&`);

    const correctNames = ['Name', 'Subject2', 'Subject', 'Object2', 'Object', 'Possessive2', 'Possessive', 'Level'];
    correctNames.forEach(correct => {
      const re = new RegExp(`\\[@\\s*${correct.trim()}\\s*\\]`, 'gi');
      text = text.replace(re, `[@${correct}]`);
    });

    [
      ['it is encouraged that "&[@Subject]&"', '"&[@Subject]&" is encouraged to'],
      ['It is encouraged that "&[@Subject]&"', '"&[@Subject2]&" is encouraged to'],
      ['it is recommended that "&[@Subject]&"', '"&[@Subject]&" is encouraged to'],
      ['It is recommended that "&[@Subject]&"', '"&[@Subject2]&" is encouraged to'],
      ['it is suggested that "&[@Subject]&"', '"&[@Subject]&" is encouraged to'],
      ['It is suggested that "&[@Subject]&"', '"&[@Subject2]&" is encouraged to'],
    ].forEach(([bad, good]) => { text = text.split(bad).join(good); });

    // Fix malformed placeholders: "@Code]" (missing [) or "@Code" (missing both brackets)
    text = text.replace(/"@(Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\]?"/g, '"&[@$1]&"');
    // Fix & inside brackets: [&@Code] → [@Code]
    text = text.replace(/\[&@(Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\]/g, '[@$1]');
    // Fix missing & between closing quote and opening bracket: "[@Code] → "&[@Code]
    text = text.replace(/"(\[@(?:Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\])/g, '"&$1');
    // Remove stream names that appear between grade number and subject (e.g. "Grade 10 Academic Mathematics" → "Grade 10 Mathematics")
    text = text.replace(/\bGrade (\d+) (Academic|Applied|University|College|University\/College|Workplace|Open) /g, 'Grade $1 ');

    // Fix wrong subject in "future X courses" closing sentence
    if (form.subject) {
      const wrongSubjects = ["science", "math", "mathematics", "physics", "chemistry", "biology",
        "english", "history", "geography", "french", "art", "music", "business", "computer science"];
      wrongSubjects.forEach(wrong => {
        if (wrong.toLowerCase() !== form.subject.toLowerCase()) {
          const re = new RegExp(`future ${wrong} courses`, 'gi');
          text = text.replace(re, `future ${form.subject.toLowerCase()} courses`);
        }
      });
    }

    // Remove stray spaces inside placeholder tokens (e.g. [@Object] & → [@Object]&)
    text = text.replace(/\[@(Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\]\s+&/g, '[@$1]&');
    // Fix placeholder immediately before punctuation with no closing &"  (e.g. [@Object]. → [@Object]&".")
    text = text.replace(/(\[@(?:Name|Subject2|Subject|Object2|Object|Possessive2|Possessive|Level)\])([.!?,])/g, '$1&"$2"');
    text = text.replace(/""/g, '"').replace(/&&+/g, '&');

    // Remove trailing incomplete fragment (dangling "& or & at end of formula)
    text = text.replace(/[&"]+$/, '');
    // Ensure formula ends with a closing quote after the last period
    if (!text.endsWith('"')) text += '"';

    return text;
  };

  const generate = async () => {
    const geminiOn = useGemini && !!apiKey;
    if (!geminiOn && !groqKey) {
      setError(useGemini
        ? "Please enter your Gemini API key first (or a Groq key)."
        : "Gemini is turned off — please enter a Groq API key.");
      setShowKeyInput(true);
      return;
    }
    if (form.failing) {
      if (!form.failReasons) { setError("Please provide reasons for failing."); return; }
    } else {
      if (thriving) {
        if (!form.strengths) { setError("Please fill in strengths — they shape the habits the comment encourages."); return; }
      } else if (!form.strengths || !form.improvements) { setError("Please fill in strengths and areas for improvement."); return; }
    }
    // School guidance: every midterm comment opens with an area of strength.
    if (isMidterm && (!form.strengths?.trim() || isNA(form.strengths))) {
      setError("Midterm comments must open with a strength — please describe at least one strength.");
      return;
    }
    setError("");
    setLoading(true);
    setGenerated("");
    setEdited("");

    const MODELS = geminiOn ? ["gemini-3.5-flash", "gemini-2.5-flash", "gemini-2.5-flash-lite"] : [];
    // Errors where a different model might still work (busy, or this model
    // isn't available to this key) -> move on to the next model.
    const isRetryable = (msg) => /high demand|overloaded|503|capacity|rate limit|quota|exhausted|not found|not supported|404/i.test(msg ?? '');
    const isKeyProblem = (msg) => /api key|api_key|permission|unauthori[sz]ed|invalid.*key|401|403/i.test(msg ?? '');
    const isNetworkProblem = (msg) => /failed to fetch|networkerror|load failed|network request failed/i.test(msg ?? '');
    const explain = (service, msg) => {
      if (isKeyProblem(msg)) return `${service} rejected your API key — check it was copied in full (${msg})`;
      if (isNetworkProblem(msg)) return `Couldn't reach ${service}. Your network (e.g. a school network) may be blocking it — try another connection.`;
      return `${service}: ${msg}`;
    };
    const finish = (raw, by) => {
      const hasTokens = /\{(NAME|THEY|THEM|THEIR|LEVEL)\}/i.test(raw);
      const text = hasTokens ? convertToFormula(raw) : cleanFormula(raw);
      setGenerated(text);
      setEdited(text);
      setGeneratedBy(by);
      setError("");
      setLoading(false);
    };
    const body = JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: form.failing ? buildFailPrompt() : buildPassPrompt() }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.5 },
    });

    let geminiError = "";
    geminiLoop:
    for (let m = 0; m < MODELS.length; m++) {
      const model = MODELS[m];
      if (m > 0) {
        setError(`Trying ${model}…`);
        await new Promise(r => setTimeout(r, 1500));
      }
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey }, body }
        );
        const data = await res.json().catch(() => ({}));
        if (data.error || !res.ok) {
          geminiError = data.error?.message || `HTTP ${res.status}`;
          if (isRetryable(geminiError)) continue;  // try the next model
          break geminiLoop;                         // bad key etc. - other models won't help
        }
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === 'MAX_TOKENS') { geminiError = "Output cut off"; continue; }
        const raw = candidate?.content?.parts?.[0]?.text ?? '';
        if (!raw) { geminiError = `No text returned (${candidate?.finishReason || "empty response"})`; continue; }
        finish(raw, model);
        return;
      } catch (e) {
        geminiError = e.message;
        break geminiLoop; // network failure - every Gemini model would fail the same way
      }
    }
    // Fallback (or primary, when Gemini is off / has no key): Groq
    let groqError = "";
    if (groqKey) {
      if (geminiOn) setError("Gemini unavailable — trying Groq…");
      const groqHeaders = { "Content-Type": "application/json", "Authorization": `Bearer ${groqKey}` };
      const callGroq = async (model) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: groqHeaders,
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            temperature: 0.4,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: form.failing ? buildGroqFailPrompt() : buildGroqPassPrompt() },
            ],
          }),
        });
        const data = await res.json().catch(() => ({}));
        // Some newer models put their reasoning in <think> tags - never let it into a comment.
        const raw = (data.choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        if (res.ok && !data.error && raw) return { raw };
        return { error: data.error?.message || `HTTP ${res.status}` };
      };
      try {
        let model = getGroqModel();
        let result = await callGroq(model);
        // Groq retires models from time to time. When it says the model is gone,
        // ask Groq which models this key can use, pick the best one, and remember it.
        if (result.error && isRetiredModel(result.error)) {
          setError("Groq retired its old model — finding a current one…");
          const res = await fetch("https://api.groq.com/openai/v1/models", { headers: groqHeaders });
          const list = await res.json().catch(() => ({}));
          const replacement = pickGroqModel((list.data || []).filter(m => m.active !== false).map(m => m.id), model);
          if (replacement) {
            model = replacement;
            result = await callGroq(model);
            if (result.raw) saveGroqModel(model);
          } else {
            result = { error: `${result.error} (and no replacement model was found)` };
          }
        }
        if (result.raw) {
          finish(result.raw, `${model} (Groq)`);
          return;
        }
        groqError = result.error;
      } catch (e) {
        groqError = e.message;
      }
    }
    const parts = [];
    if (geminiError) parts.push(explain("Gemini", geminiError));
    if (groqError) parts.push(explain("Groq", groqError));
    setError(parts.length ? parts.join("  •  ") : "All models unavailable. Try again shortly.");
    setLoading(false);
  };

  const saveComment = () => {
    if (!edited) return;
    const entry = {
      id: Date.now(),
      name: form.name || "Student",
      subject: form.subject,
      grade: form.grade,
      failing: form.failing,
      term,
      comment: edited,
      date: new Date().toLocaleDateString("en-CA"),
    };
    const updated = [entry, ...saved];
    setSaved(updated);
    persist(updated);
    setCopiedId('saved');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const deleteComment = (id) => {
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated);
    persist(updated);
  };

  const inp = { display: "block", width: "100%", border: "1px solid #d0d0d0", borderRadius: 8, padding: "8px 10px", fontSize: 13, color: "#333", background: "#fff", boxSizing: "border-box", fontFamily: "inherit" };
  const lbl = { display: "block", fontSize: 11, fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em", color: "#555" };

  return (
    <div style={{ fontFamily: "Inter, sans-serif", background: "#f0f4f8", minHeight: "100vh", padding: "24px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #1e3a5f, #2d6a9f)", borderRadius: 16, padding: "20px 24px", marginBottom: 20, color: "white" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>📋 Report Card Comment Generator</div>
              <div style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>Ontario High School · Excel-ready placeholders</div>
            </div>
            <button onClick={() => setShowKeyInput(v => !v)} style={{
              background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
              borderRadius: 8, color: "white", fontSize: 12, fontWeight: 600, padding: "6px 12px", cursor: "pointer"
            }}>
              {apiKey ? "🔑 Key set" : "🔑 Set API key"}
            </button>
          </div>
          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
            💡 <strong>Tip:</strong> Type <code style={{ background: "rgba(255,255,255,0.2)", borderRadius: 4, padding: "1px 5px" }}>N/A</code> in any field to omit that information from the comment.
          </div>
        </div>

        {/* API Key input */}
        {showKeyInput && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: "1px solid #e0e0e0" }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Gemini API Key
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                placeholder="AIza..."
                value={apiKey}
                onChange={e => saveApiKey(e.target.value)}
                style={{ flex: 1, border: "1px solid #d0d0d0", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "monospace" }}
              />
              <button onClick={() => setShowKeyInput(false)} style={{
                padding: "8px 14px", borderRadius: 8, border: "none", background: "#2d6a9f", color: "white", fontWeight: 600, fontSize: 13, cursor: "pointer"
              }}>Save</button>
            </div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Free at aistudio.google.com — stored in localStorage only.</div>
            <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <div onClick={() => setUseGemini(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, background: useGemini ? "#2d6a9f" : "#ccc", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <div style={{ position: "absolute", top: 3, left: useGemini ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
              <span style={{ fontSize: 12, color: "#555" }}>Use Gemini {!useGemini && <span style={{ color: "#c0392b", fontWeight: 600 }}>(disabled — Groq only)</span>}</span>
            </div>
            <div style={{ marginTop: 14, borderTop: "1px solid #eee", paddingTop: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#555", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Groq API Key <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional — last resort fallback)</span>
              </label>
              <input
                type="password"
                placeholder="gsk_..."
                value={groqKey}
                onChange={e => saveGroqKey(e.target.value)}
                style={{ width: "100%", border: "1px solid #d0d0d0", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontFamily: "monospace", boxSizing: "border-box" }}
              />
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>Free at console.groq.com — only used if all Gemini models are unavailable.</div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {["generate", "saved"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13,
              background: tab === t ? "#2d6a9f" : "#fff", color: tab === t ? "#fff" : "#555",
              boxShadow: tab === t ? "0 2px 8px rgba(45,106,159,0.3)" : "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              {t === "generate" ? "✏️ Generate" : `💾 Saved (${saved.length})`}
            </button>
          ))}
        </div>

        {tab === "generate" && (
          <div style={{ background: "#fff", borderRadius: 16, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>

            {/* Midterm / Final toggle */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Comment Type</label>
              <div role="radiogroup" aria-label="Comment type" style={{ display: "inline-flex", background: "#eef2f6", borderRadius: 10, padding: 3, gap: 3 }}>
                {[
                  { value: "midterm", label: "📝 Midterm" },
                  { value: "final", label: "🎓 Final" },
                ].map(o => {
                  const on = term === o.value;
                  return (
                    <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => setTerm(o.value)} style={{
                      padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.15s",
                      background: on ? "#2d6a9f" : "transparent", color: on ? "#fff" : "#555",
                      boxShadow: on ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                    }}>{o.label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                {isMidterm ? "Next steps for the rest of this course." : "Next steps for future courses."}
              </div>
            </div>

            {/* Dropdowns — row 1: course info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Subject</label>
                <select style={inp} value={form.subject} onChange={e => set("subject", e.target.value)}>
                  <option value="">Select…</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Grade</label>
                <select style={inp} value={form.grade} onChange={e => set("grade", e.target.value)}>
                  <option value="">Select…</option>
                  {["9","10","11","12"].map(g => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Stream <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
                <select style={inp} value={form.stream} onChange={e => set("stream", e.target.value)}>
                  <option value="">Select…</option>
                  {STREAMS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Dropdowns — row 2: student info */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Pronouns</label>
                <select style={inp} value={form.pronounIdx} onChange={e => set("pronounIdx", Number(e.target.value))}>
                  {PRONOUN_SETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Achievement Level</label>
                <select style={{ ...inp, opacity: form.failing ? 0.4 : 1 }} value={form.level} onChange={e => set("level", e.target.value)} disabled={form.failing}>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label} — "{l.value}"</option>)}
                </select>
              </div>
            </div>

            {/* Failing toggle */}
            <div style={{ marginBottom: 20, padding: "10px 14px", borderRadius: 10, border: `2px solid ${form.failing ? "#c0392b" : "#e0e0e0"}`, background: form.failing ? "#fff5f5" : "#fafafa", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => set("failing", !form.failing)}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${form.failing ? "#c0392b" : "#aaa"}`, background: form.failing ? "#c0392b" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {form.failing && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ fontWeight: 600, fontSize: 13, color: form.failing ? "#c0392b" : "#555" }}>Student is failing this course</div>
            </div>

            {/* Doing-well toggle (passing students only) */}
            {!form.failing && (
              <div role="checkbox" aria-checked={!!form.thriving} tabIndex={0}
                onClick={() => set("thriving", !form.thriving)}
                onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); set("thriving", !form.thriving); } }}
                style={{ marginTop: -8, marginBottom: 20, padding: "10px 14px", borderRadius: 10, border: `2px solid ${form.thriving ? "#1e8449" : "#e0e0e0"}`, background: form.thriving ? "#f1faf4" : "#fafafa", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${form.thriving ? "#1e8449" : "#aaa"}`, background: form.thriving ? "#1e8449" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {form.thriving && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: form.thriving ? "#1e8449" : "#555" }}>Student is doing well — no next steps needed</div>
                  <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Skips the area for growth; encourages them to continue their current habits.</div>
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: "1px solid #eee", marginBottom: 20 }} />

            {/* Text fields — passing */}
            {!form.failing && (<>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Student Name <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
                <input style={inp} placeholder="For your reference only" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Strengths</label>
                <textarea style={{ ...inp, resize: "vertical" }} rows={3} placeholder="e.g. strong analytical thinking, active participation…" value={form.strengths} onChange={e => set("strengths", e.target.value)} />
              </div>
              {!form.thriving && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Areas for Improvement</label>
                  <textarea style={{ ...inp, resize: "vertical" }} rows={3} placeholder="e.g. submitting work on time, showing steps in problem solving…" value={form.improvements} onChange={e => set("improvements", e.target.value)} />
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Highest Graded Assessment <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
                <input style={inp} placeholder="e.g. Chemistry Culminating, Unit 3 Test…" value={form.highest} onChange={e => set("highest", e.target.value)} />
              </div>
            </>)}

            {/* Text fields — failing */}
            {form.failing && (<>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Student Name <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
                <input style={inp} placeholder="For your reference only" value={form.name} onChange={e => set("name", e.target.value)} />
              </div>
              {isMidterm && (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Strengths <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(midterm comments open with a strength)</span></label>
                  <textarea style={{ ...inp, resize: "vertical" }} rows={2} placeholder="e.g. builds connections with peers, asks questions, arrives prepared…" value={form.strengths} onChange={e => set("strengths", e.target.value)} />
                </div>
              )}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Reasons for Failing</label>
                <textarea style={{ ...inp, resize: "vertical" }} rows={3} placeholder="e.g. chronic absenteeism, incomplete assignments, did not meet learning expectations…" value={form.failReasons} onChange={e => set("failReasons", e.target.value)} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Support Attempted <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
                <textarea style={{ ...inp, resize: "vertical" }} rows={2} placeholder="e.g. extra help sessions offered, parent contact made, modified expectations…" value={form.failSupport} onChange={e => set("failSupport", e.target.value)} />
              </div>
            </>)}

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Additional Notes <span style={{ fontWeight: 400, textTransform: "none", color: "#999" }}>(optional)</span></label>
              <textarea style={{ ...inp, resize: "vertical" }} rows={2} placeholder="e.g. student has an IEP, English language learner, behaviour concerns…" value={form.notes} onChange={e => set("notes", e.target.value)} />
            </div>

            {error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}

            <button onClick={generate} disabled={loading} style={{
              width: "100%", padding: "12px", borderRadius: 10, border: "none", cursor: loading ? "not-allowed" : "pointer",
              background: loading ? "#aaa" : form.failing ? "linear-gradient(135deg, #922b21, #c0392b)" : "linear-gradient(135deg, #1e3a5f, #2d6a9f)",
              color: "white", fontWeight: 700, fontSize: 15
            }}>
              {loading ? "✨ Generating…" : `${form.failing ? "⚠️" : "✨"} Generate ${isMidterm ? "Midterm" : "Final"} ${form.failing ? "Failing " : ""}Comment`}
            </button>

            {/* Output */}
            {generated && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: form.failing ? "#c0392b" : "#2d6a9f", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {form.failing ? "⚠️ Failing Comment — Edit below" : "Generated Comment — Edit below"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ color: !excelMode ? "#2d6a9f" : "#aaa", fontWeight: !excelMode ? 600 : 400 }}>Plain text</span>
                    <div onClick={() => setExcelMode(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, background: excelMode ? "#2d6a9f" : "#ccc", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <div style={{ position: "absolute", top: 3, left: excelMode ? 21 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ color: excelMode ? "#2d6a9f" : "#aaa", fontWeight: excelMode ? 600 : 400 }}>Excel</span>
                  </div>
                </div>
                <textarea value={excelMode ? edited : formulaToText(edited)} onChange={e => excelMode && setEdited(e.target.value)} rows={5}
                  style={{ width: "100%", border: `2px solid ${form.failing ? "#c0392b" : "#2d6a9f"}`, borderRadius: 10, padding: "12px", fontSize: 13, lineHeight: 1.6, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", background: excelMode ? "#fff" : "#f8f9fa" }} />
                {!excelMode && <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Plain text preview — switch to Excel mode to edit</div>}
                {generatedBy && <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>Generated by {generatedBy}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={() => copyToClipboard(excelMode ? edited : formulaToText(edited), 'generated')} style={{
                    flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s",
                    background: copiedId === 'generated' ? "#1e3a5f" : "#fff",
                    color: copiedId === 'generated' ? "#fff" : form.failing ? "#c0392b" : "#2d6a9f",
                    border: `1.5px solid ${copiedId === 'generated' ? "#1e3a5f" : form.failing ? "#c0392b" : "#2d6a9f"}`,
                  }}>{copiedId === 'generated' ? "✅ Copied!" : "📋 Copy"}</button>
                  <button onClick={saveComment} style={{
                    flex: 1, padding: "9px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all 0.2s",
                    background: copiedId === 'saved' ? "#1a7a45" : "#27ae60", color: "#fff",
                  }}>{copiedId === 'saved' ? "✅ Saved!" : "💾 Save Comment"}</button>
                </div>

                {/* Placeholder reference — Excel mode only */}
                {excelMode && !form.failing && (
                  <div style={{ marginTop: 16, background: "#f8f9fa", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#666", marginBottom: 8, textTransform: "uppercase" }}>Excel Placeholder Preview</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: "#444" }}>
                      {[
                        ["&[@Subject]&", pronouns.p], ["&[@Subject2]&", pronouns.P],
                        ["&[@Object]&", pronouns.o], ["&[@Object2]&", pronouns.O],
                        ["&[@Possessive]&", pronouns.pos], ["&[@Possessive2]&", pronouns.Pos],
                        ["&[@Level]&", form.level],
                      ].map(([code, val]) => (
                        <div key={code} style={{ background: "#fff", borderRadius: 6, padding: "4px 8px", border: "1px solid #e0e0e0" }}>
                          <span style={{ fontFamily: "monospace", color: "#c0392b" }}>{code}</span>
                          <span style={{ color: "#888" }}> → </span>
                          <span style={{ fontWeight: 600 }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "saved" && (
          <div>
            {!storageLoaded && <div style={{ textAlign: "center", color: "#888", padding: 40 }}>Loading saved comments…</div>}
            {storageLoaded && saved.length === 0 && (
              <div style={{ background: "#fff", borderRadius: 16, padding: 40, textAlign: "center", color: "#aaa", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
                No saved comments yet. Generate and save one!
              </div>
            )}
            {saved.map(s => (
              <div key={s.id} style={{ background: "#fff", borderRadius: 14, padding: 20, marginBottom: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderLeft: `4px solid ${s.failing ? "#c0392b" : "#2d6a9f"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "#1e3a5f" }}>
                      {s.name || "Student"}{" "}
                      {s.term && <span style={{ fontSize: 11, background: s.term === "midterm" ? "#fff4e0" : "#e8f0f8", color: s.term === "midterm" ? "#b9770e" : "#2d6a9f", borderRadius: 4, padding: "2px 6px", fontWeight: 600, marginRight: 4 }}>{s.term === "midterm" ? "MIDTERM" : "FINAL"}</span>}
                      {s.failing && <span style={{ fontSize: 11, background: "#fdecea", color: "#c0392b", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>FAILING</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{s.subject}{s.grade ? ` · Grade ${s.grade}` : ""} · {s.date}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => copyToClipboard(s.comment, s.id)} style={{
                      padding: "5px 12px", borderRadius: 7, cursor: "pointer", fontWeight: 600, fontSize: 12, transition: "all 0.2s",
                      background: copiedId === s.id ? "#1e3a5f" : "#fff",
                      color: copiedId === s.id ? "#fff" : "#2d6a9f",
                      border: `1.5px solid ${copiedId === s.id ? "#1e3a5f" : "#2d6a9f"}`,
                    }}>{copiedId === s.id ? "✅ Copied!" : "📋 Copy"}</button>
                    <button onClick={() => deleteComment(s.id)} style={{
                      padding: "5px 12px", borderRadius: 7, border: "1.5px solid #e74c3c", background: "#fff",
                      color: "#e74c3c", fontSize: 12, fontWeight: 600, cursor: "pointer"
                    }}>🗑 Delete</button>
                  </div>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: "#333", background: "#f8f9fa", borderRadius: 8, padding: 12 }}>
                  {s.comment}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
