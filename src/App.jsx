import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";


const SUPABASE_URL = "https://yhdwabrbsyeexllrbdni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZHdhYnJic3llZXhsbHJiZG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTMyMjAsImV4cCI6MjA4ODg4OTIyMH0.cs0IYZ6am2LTNfSL9-ugdSECQTSmV7rzUwTKRcKOMVc";

const sbFetch = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type":"application/json", "apikey":SUPABASE_ANON_KEY, "Authorization":`Bearer ${SUPABASE_ANON_KEY}`, "Prefer":"return=representation", ...(options.headers||{}) }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin + "wortschatz-salt"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// ── Theme ─────────────────────────────────────────────────────────────────────
const DARK = {
  bg:         "#0a0908",
  bgCard:     "#0e0d0b",
  bgInput:    "#111009",
  bgInset:    "#0a0908",
  border:     "#161512",
  borderMid:  "#252320",
  borderActive:"#2a2820",
  text:       "#e8e0d0",
  textMuted:  "#5a5448",
  textFaint:  "#3a3830",
  textDim:    "#2e2c26",
  textGold:   "#c8a96e",
  textWarm:   "#a09070",
  accent:     "#c8a96e",
  accentBg:   "#0a0908",
  filterBg:   "#111009",
  filterText: "#4a4840",
  pillBg:     "#1a1815",
  red:        "#c87070",
  green:      "#6aaa6a",
};
const LIGHT = {
  bg:         "#f5f0e8",
  bgCard:     "#faf7f2",
  bgInput:    "#ffffff",
  bgInset:    "#f0ebe0",
  border:     "#e0d8cc",
  borderMid:  "#ccc4b4",
  borderActive:"#b8aa96",
  text:       "#2a2418",
  textMuted:  "#7a6e5e",
  textFaint:  "#a09080",
  textDim:    "#c0b8a8",
  textGold:   "#9a7a3e",
  textWarm:   "#7a6040",
  accent:     "#9a7a3e",
  accentBg:   "#f5f0e8",
  filterBg:   "#ffffff",
  filterText: "#6a5e4e",
  pillBg:     "#e8e0d0",
  red:        "#b85050",
  green:      "#4a8a4a",
};

const ThemeCtx = createContext(DARK);
const useTheme = () => useContext(ThemeCtx);

// ── AI ────────────────────────────────────────────────────────────────────────
async function fetchExampleSentences(word) {
  const response = await fetch("/api/claude", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ word }) });
  if (!response.ok) throw new Error(`Proxy error ${response.status}: ${await response.text()}`);
  return await response.json();
}

async function fetchPronunciationFeedback(targetWord, transcript) {
  const response = await fetch("/api/pronounce", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ word:targetWord, transcript }) });
  if (!response.ok) throw new Error(`Proxy error ${response.status}`);
  return await response.json();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { key:"all", label:"Alle" }, { key:"nomen", label:"Nomen" }, { key:"verb", label:"Verb" },
  { key:"ausdruck", label:"Ausdruck" }, { key:"adjektiv", label:"Adjektiv" },
  { key:"adverb", label:"Adverb" }, { key:"mastered", label:"✓ Gelernt" },
];

const matchesTypeFilter = (word, filter) => {
  if (filter === "all") return true;
  if (filter === "mastered") return word.mastered;
  const t = (word.type || "").toLowerCase();
  if (filter === "nomen")    return t.includes("nomen") || t.includes("noun");
  if (filter === "verb")     return t.includes("verb");
  if (filter === "ausdruck") return t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung");
  if (filter === "adjektiv") return t.includes("adj");
  if (filter === "adverb")   return t.includes("adverb");
  return true;
};

const typeColor = (type, th) => {
  const t = (type || "").toLowerCase();
  if (t.includes("nomen") || t.includes("noun")) return { bg:"#3d2e1e", text:"#e8c49a" };
  if (t.includes("verb")) return { bg:"#1e2e3d", text:"#9ac4e8" };
  if (t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung")) return { bg:"#2e1e3d", text:"#c49ae8" };
  if (t.includes("adj")) return { bg:"#1e3d2e", text:"#9ae8c4" };
  if (t.includes("adverb")) return { bg:"#2e1e1e", text:"#e89a9a" };
  return { bg:"#2e2e1e", text:"#e8e49a" };
};

const levelColor = (level) => {
  const l = (level || "").toUpperCase().trim();
  if (l === "A1") return { bg:"#1e3a1e", text:"#7acc7a" };
  if (l === "A2") return { bg:"#1e3020", text:"#6abf6a" };
  if (l === "B1") return { bg:"#1e2e3a", text:"#7ab0e8" };
  if (l === "B2") return { bg:"#1a2a3d", text:"#5a9ad8" };
  if (l === "C1") return { bg:"#3a2a1e", text:"#e8a96e" };
  if (l === "C2") return { bg:"#3d1e2e", text:"#e87ab0" };
  return { bg:"#2a2a2a", text:"#888" };
};

// ── Speak Button ──────────────────────────────────────────────────────────────
function SpeakBtn({ text, size = 13 }) {
  const [speaking, setSpeaking] = useState(false);
  const handleSpeak = (e) => {
    e.stopPropagation(); setSpeaking(true);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE"; u.rate = 0.9;
    u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  return (
    <button onClick={handleSpeak} title="Anhören" style={{ background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px", fontSize:size, opacity:speaking?1:0.5, transition:"opacity 0.2s", lineHeight:1 }}>
      {speaking ? "🔊" : "🔈"}
    </button>
  );
}

// ── Highlighted Word ──────────────────────────────────────────────────────────
function HighlightedWord({ word, highlights }) {
  if (!highlights || highlights.length === 0) return <span style={{ fontSize:22, fontStyle:"italic" }}>{word}</span>;
  const colorMap = { gut:"#6aaa6a", mittel:"#c8a96e", schlecht:"#c87070" };
  return (
    <span style={{ fontSize:22, fontStyle:"italic", letterSpacing:"0.02em" }}>
      {highlights.map((h, i) => (
        <span key={i} style={{ color:colorMap[h.quality]||"inherit", borderBottom:`2px solid ${colorMap[h.quality]||"transparent"}`, paddingBottom:2, transition:"color 0.4s" }}>{h.token}</span>
      ))}
    </span>
  );
}

// ── Pronunciation Practice ────────────────────────────────────────────────────
function PronunciationPractice({ word }) {
  const th = useTheme();
  const [state, setState] = useState("idle");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [volume, setVolume] = useState(0);
  const recognitionRef = useRef(null);
  const audioCtxRef = useRef(null);
  const animFrameRef = useRef(null);
  const streamRef = useRef(null);
  const hasResultRef = useRef(false);

  const stopAudio = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch(e) {} }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setVolume(0);
  };

  const startVolumeMonitor = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext(); audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser(); analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        setVolume(Math.min(100, data.reduce((a,b)=>a+b,0)/data.length*2.5));
        animFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch(e) {}
  };

  const start = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setFeedback("Spracherkennung nicht unterstützt. Bitte Chrome verwenden."); setState("done"); return; }
    hasResultRef.current = false;
    setTranscript(""); setHighlights(null); setScore(null);
    const r = new SR();
    r.lang = "de-DE"; r.interimResults = true; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = async (e) => {
      const heard = Array.from(e.results).map(r=>r[0].transcript).join("");
      if (e.results[e.results.length-1].isFinal) {
        hasResultRef.current = true; setTranscript(heard); stopAudio(); setState("processing");
        try {
          const result = await fetchPronunciationFeedback(word, heard);
          setFeedback(result.feedback); setScore(result.score); setHighlights(result.highlights);
        } catch(e) { setFeedback("Fehler bei der Analyse. Bitte erneut versuchen."); }
        setState("done");
      } else { setTranscript(heard); }
    };
    r.onerror = (e) => {
      stopAudio();
      if (e.error==="no-speech") setFeedback("Kein Ton erkannt. Bitte lauter sprechen.");
      else if (e.error==="not-allowed") setFeedback("Mikrofonzugriff verweigert.");
      else setFeedback("Fehler bei der Aufnahme. Bitte erneut versuchen.");
      setState("done");
    };
    r.onend = () => { stopAudio(); if (!hasResultRef.current) { setFeedback("Kein Ton erkannt. Bitte lauter sprechen."); setState("done"); } };
    r.start(); setState("listening");
    await startVolumeMonitor();
    setTimeout(() => { if (!hasResultRef.current) { try { recognitionRef.current?.stop(); } catch(e) {} } }, 8000);
  };

  const stop = () => { try { recognitionRef.current?.stop(); } catch(e) {} stopAudio(); if (!hasResultRef.current) setState("idle"); };
  const reset = () => { setState("idle"); setFeedback(""); setTranscript(""); setScore(null); setHighlights(null); setVolume(0); };

  const bars = Array.from({ length:8 }, (_,i) => ({ h:6+i*3, active:volume>(i/8)*100 }));
  const scoreColor = score===null?th.textFaint:score>=75?th.green:score>=45?th.accent:th.red;
  const scoreLabel = score===null?"":score>=75?"Sehr gut!":score>=45?"Gut, weiter üben!":"Weiter üben!";

  return (
    <div style={{ marginTop:14, padding:"14px 16px", background:th.bgInset, borderRadius:6, border:`1px solid ${th.border}` }}>
      <div style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:12 }}>Aussprache üben</div>
      <div style={{ marginBottom:14, padding:"10px 14px", background:th.bgCard, borderRadius:6, border:`1px solid ${th.border}`, textAlign:"center" }}>
        <span style={{ color: state==="done" ? th.text : state==="listening" ? th.accent : th.textMuted, transition:"color 0.3s" }}>
          {state==="done" && highlights ? <HighlightedWord word={word} highlights={highlights} /> : <span style={{ fontSize:22, fontStyle:"italic" }}>{word}</span>}
        </span>
        {state==="done" && score!==null && <div style={{ marginTop:6, fontSize:11, color:scoreColor }}>{scoreLabel} ({score}/100)</div>}
        {state==="done" && highlights && (
          <div style={{ marginTop:8, display:"flex", gap:12, justifyContent:"center", fontSize:10 }}>
            <span style={{ color:th.green }}>● gut</span>
            <span style={{ color:th.accent }}>● mittel</span>
            <span style={{ color:th.red }}>● schlecht</span>
          </div>
        )}
      </div>
      {state==="idle" && (
        <button onClick={start} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:11, fontFamily:"inherit", padding:"5px 12px", cursor:"pointer" }}>
          🎤 Jetzt sprechen
        </button>
      )}
      {state==="listening" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
            <div style={{ display:"flex", alignItems:"flex-end", gap:3, height:28 }}>
              {bars.map((b,i) => <div key={i} style={{ width:5, height:b.h, borderRadius:2, background:b.active?(volume>60?th.accent:"#7a9e6e"):th.border, transition:"background 0.08s" }} />)}
            </div>
            <span style={{ fontSize:12, color:th.textMuted }}>Aufnahme läuft…</span>
            <button onClick={stop} style={{ marginLeft:"auto", background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.red, fontSize:10, fontFamily:"inherit", padding:"3px 8px", cursor:"pointer" }}>⏹ Stop</button>
          </div>
          {transcript && <div style={{ fontSize:12, color:th.textMuted, fontStyle:"italic" }}>Gehört: <span style={{ color:th.textWarm }}>{transcript}</span></div>}
          <div style={{ fontSize:10, color:th.textDim, marginTop:4 }}>Sprich laut und deutlich — bis zu 8 Sekunden</div>
        </div>
      )}
      {state==="processing" && <div style={{ color:th.textMuted, fontSize:12 }}>Analysiere Aussprache…</div>}
      {state==="done" && (
        <div>
          {transcript && <div style={{ fontSize:11, color:th.textFaint, marginBottom:8 }}>Gehört: <em style={{ color:th.textMuted }}>„{transcript}"</em></div>}
          <div style={{ fontSize:13, color:th.textWarm, lineHeight:1.7, marginBottom:10 }}>{feedback}</div>
          <button onClick={reset} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:th.textMuted, fontSize:10, fontFamily:"inherit", padding:"3px 10px", cursor:"pointer" }}>⟳ Nochmal versuchen</button>
        </div>
      )}
    </div>
  );
}


// ── PIN Screen ────────────────────────────────────────────────────────────────
function PinScreen({ onEnter, darkMode, toggleDark }) {
  const th = darkMode ? DARK : LIGHT;
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const handle = () => {
    if (pin.trim().length < 4) { setError("Bitte mindestens 4 Zeichen eingeben."); return; }
    onEnter(pin.trim());
  };
  return (
    <div style={{ minHeight:"100vh", background:th.bg, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Palatino Linotype',Palatino,serif", padding:24, transition:"background 0.3s" }}>
      <div style={{ position:"absolute", top:20, right:24 }}>
        <button onClick={toggleDark} style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:20, padding:"4px 12px", fontSize:13, cursor:"pointer", color:th.textMuted, display:"flex", alignItems:"center", gap:6 }}>
          {darkMode ? "☀️" : "🌙"} <span style={{ fontSize:10 }}>{darkMode ? "Hell" : "Dunkel"}</span>
        </button>
      </div>
      <div style={{ textAlign:"center", maxWidth:380 }}>
        <div style={{ width:64, height:64, borderRadius:"50%", border:`1px solid ${th.accent}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 32px", fontSize:26, color:th.accent }}>W</div>
        <h1 style={{ fontSize:34, fontWeight:"normal", color:th.text, margin:"0 0 8px", letterSpacing:"0.06em" }}>Wortschatz</h1>
        <p style={{ color:th.textMuted, fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 40px" }}>Dein persönlicher C1-Wortschatz</p>
        <p style={{ color:th.textWarm, fontSize:14, lineHeight:1.8, marginBottom:32 }}>Gib deinen persönlichen PIN ein, um auf deinen Wortschatz zuzugreifen.<br/>Zum ersten Mal? Wähle einfach einen beliebigen PIN.</p>
        <input value={pin} onChange={e => { setPin(e.target.value); setError(""); }} onKeyDown={e => e.key==="Enter" && handle()} placeholder="Dein PIN oder deine Passphrase…" type="password"
          style={{ width:"100%", boxSizing:"border-box", background:th.bgInput, border:`1px solid ${th.borderMid}`, borderRadius:6, padding:"12px 16px", fontSize:16, color:th.text, outline:"none", fontFamily:"inherit", marginBottom:10, textAlign:"center", letterSpacing:"0.1em" }} />
        {error && <p style={{ color:th.red, fontSize:13, margin:"0 0 10px" }}>{error}</p>}
        <button onClick={handle} style={{ width:"100%", background:th.accent, color:"#0a0908", border:"none", borderRadius:6, padding:"13px", fontSize:13, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
          Meinen Wortschatz öffnen →
        </button>
        <p style={{ color:th.textFaint, fontSize:11, marginTop:16, lineHeight:1.6 }}>Dein PIN wird verschlüsselt gespeichert — niemals im Klartext.</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { return JSON.parse(localStorage.getItem("wortschatz-darkmode") ?? "true"); } catch(e) { return true; }
  });
  const th = darkMode ? DARK : LIGHT;

  const [userId, setUserId] = useState(null);
  const [words, setWords] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [storageLoading, setStorageLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [retryingId, setRetryingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [suggestion, setSuggestion] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("wortschatz-uid");
    if (stored) setUserId(stored);
    setStorageLoading(false);
  }, []);

  const handlePin = async (pin) => {
    const hashed = await hashPin(pin);
    sessionStorage.setItem("wortschatz-uid", hashed);
    setUserId(hashed);
  };
  const handleLogout = () => { sessionStorage.removeItem("wortschatz-uid"); setUserId(null); setWords([]); };

  const loadWords = useCallback(async () => {
    if (!userId) return;
    setDbLoading(true);
    try {
      const data = await sbFetch(`/rest/v1/vocabulary?user_id=eq.${userId}&select=*&order=added_at.desc`);
      setWords((data||[]).map(w => ({ id:w.id, word:w.word, translation:w.translation, type:w.type, level:w.level||'', explanation:w.explanation, sentences:w.sentences, mastered:w.mastered, addedAt:w.added_at })));
    } catch(e) { console.error(e); }
    setDbLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadWords(); }, [userId, loadWords]);

  const save = async (updated) => {}; // unused in deploy, Supabase handles persistence
  const toggleDark = () => {
    const next = !darkMode; setDarkMode(next);
    try { localStorage.setItem("wortschatz-darkmode", JSON.stringify(next)); } catch(e) {}
  };

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Spracherkennung nicht unterstützt. Bitte Chrome verwenden."); return; }
    const r = new SR(); r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false); r.onend = () => setIsListening(false);
    r.start(); setIsListening(true);
  };
  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  const handleAdd = async () => {
    const trimmed = input.trim(); if (!trimmed) return;
    setLoading(true); setError(""); setSuggestion(null);
    try {
      const ai = await fetchExampleSentences(trimmed);
      const finalWord = ai.word || trimmed;
      if (words.find(w => w.word.toLowerCase() === finalWord.toLowerCase())) { setError("Dieses Wort ist bereits in deiner Liste."); setLoading(false); return; }
      if (finalWord.toLowerCase() !== trimmed.toLowerCase()) { setSuggestion({ original:trimmed, corrected:finalWord, ai }); setLoading(false); return; }
      await saveWord(finalWord, ai);
    } catch(e) { setError("Fehler: " + e.message); }
    setLoading(false);
  };

  const saveWord = async (finalWord, ai) => {
    const result = await sbFetch("/rest/v1/vocabulary", { method:"POST", body:JSON.stringify({ user_id:userId, word:finalWord, translation:ai.translation, type:ai.type, level:ai.level||"", explanation:ai.explanation, sentences:ai.sentences, mastered:false }) });
    const inserted = Array.isArray(result) ? result[0] : result;
    setWords(prev => [{ id:inserted.id, word:inserted.word, translation:inserted.translation, type:inserted.type, level:inserted.level||'', explanation:inserted.explanation, sentences:inserted.sentences, mastered:inserted.mastered, addedAt:inserted.added_at }, ...prev]);
    setInput(""); setExpandedId(inserted.id); setSuggestion(null);
  };

  const acceptSuggestion = () => { if (suggestion) saveWord(suggestion.corrected, suggestion.ai); };
  const rejectSuggestion = () => { if (suggestion) saveWord(suggestion.original, suggestion.ai); };

  const handleRetry = async (w) => {
    setRetryingId(w.id);
    try {
      const ai = await fetchExampleSentences(w.word);
      await sbFetch(`/rest/v1/vocabulary?id=eq.${w.id}`, { method:"PATCH", body:JSON.stringify({ translation:ai.translation, type:ai.type, explanation:ai.explanation, sentences:ai.sentences }) });
      setWords(prev => prev.map(x => x.id===w.id ? { ...x, translation:ai.translation, type:ai.type, explanation:ai.explanation, sentences:ai.sentences } : x));
    } catch(e) { console.error(e); }
    setRetryingId(null);
  };

  const handleDelete = async (id) => {
    setDeleteConfirmId(null);
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method:"DELETE" });
    setWords(prev => prev.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggleMastered = async (id, current) => {
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method:"PATCH", body:JSON.stringify({ mastered:!current }) });
    setWords(prev => prev.map(w => w.id===id ? { ...w, mastered:!current } : w));
  };

  const filteredWords = words.filter(w => matchesTypeFilter(w, filter));
  const countFor = (key) => key==="all" ? words.length : words.filter(w => matchesTypeFilter(w, key)).length;

  const popup = { background:th.bgCard, border:`1px solid ${th.borderActive}`, borderRadius:10, padding:"28px 32px", maxWidth:360, width:"90%", textAlign:"center", fontFamily:"'Palatino Linotype',Palatino,serif" };
  const overlay = { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 };

  if (storageLoading) return <div style={{ minHeight:"100vh", background:th.bg, display:"flex", alignItems:"center", justifyContent:"center", color:th.textFaint, fontFamily:"Palatino,serif", fontSize:13 }}>Laden…</div>;
  if (!userId) return <PinScreen onEnter={handlePin} darkMode={darkMode} toggleDark={toggleDark} />;

  return (
    <ThemeCtx.Provider value={th}>
    <div style={{ minHeight:"100vh", background:th.bg, fontFamily:"'Palatino Linotype',Palatino,serif", color:th.text, transition:"background 0.3s, color 0.3s" }}>

      {/* Header */}
      <div style={{ borderBottom:`1px solid ${th.border}`, padding:"20px 36px 16px", background:th.bg, position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <h1 style={{ fontSize:22, fontWeight:"normal", letterSpacing:"0.06em", color:th.text, margin:0 }}>Wortschatz</h1>
              <span style={{ fontSize:10, color:th.textFaint, letterSpacing:"0.14em", textTransform:"uppercase" }}>C1</span>
            </div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <button onClick={handleLogout} style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:4, color:th.textFaint, fontSize:10, fontFamily:"inherit", padding:"4px 12px", cursor:"pointer" }}>Sperren</button>
            {/* Dark/light toggle */}
            <button onClick={toggleDark} title={darkMode ? "Heller Modus" : "Dunkler Modus"}
              style={{ background:"transparent", border:`1px solid ${th.borderMid}`, borderRadius:20, padding:"4px 12px", fontSize:13, cursor:"pointer", color:th.textMuted, display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
              {darkMode ? "☀️" : "🌙"} <span style={{ fontSize:10, letterSpacing:"0.06em" }}>{darkMode ? "Hell" : "Dunkel"}</span>
            </button>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError(""); setSuggestion(null); }}
              onKeyDown={e => e.key==="Enter" && !loading && handleAdd()}
              placeholder="Deutsches Wort oder Ausdruck eingeben…"
              style={{ flex:1, background:th.bgInput, border:`1px solid ${th.borderMid}`, borderRadius:6, padding:"11px 15px", fontSize:15, color:th.text, outline:"none", fontFamily:"inherit" }} />
            <button onClick={isListening ? stopListening : startListening}
              style={{ background:isListening?th.red:th.bgInput, border:`1px solid ${isListening?th.red:th.borderMid}`, borderRadius:6, padding:"11px 14px", fontSize:16, cursor:"pointer", transition:"all 0.2s", lineHeight:1 }}>
              {isListening ? "⏹" : "🎤"}
            </button>
            <button onClick={handleAdd} disabled={loading||!input.trim()}
              style={{ background:loading?th.bgCard:th.accent, color:loading?th.textFaint:"#0a0908", border:"none", borderRadius:6, padding:"11px 22px", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
              {loading ? "Suche…" : "Hinzufügen"}
            </button>
          </div>
          {isListening && <p style={{ color:th.accent, fontSize:12, marginTop:8, marginBottom:0 }}>🎤 Höre zu… jetzt auf Deutsch sprechen</p>}
          {error && <p style={{ color:th.red, fontSize:12, marginTop:8, marginBottom:0 }}>{error}</p>}
        </div>
      </div>

      {/* Stats + Filters */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:"14px 36px 0" }}>
        <div style={{ fontSize:11, color:th.textFaint, letterSpacing:"0.06em", marginBottom:10 }}>
          {words.length} Wörter &nbsp;·&nbsp; <span style={{ color:th.accent }}>{words.filter(w=>w.mastered).length} gelernt</span> &nbsp;·&nbsp; {words.filter(w=>!w.mastered).length} in Bearbeitung
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {TYPE_FILTERS.map(({ key, label }) => {
            const count = countFor(key); const active = filter===key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ display:"flex", alignItems:"center", gap:5, background:active?th.accent:th.filterBg, color:active?"#0a0908":th.filterText, border:`1px solid ${active?th.accent:th.borderMid}`, borderRadius:20, padding:"4px 12px", fontSize:11, fontFamily:"inherit", cursor:"pointer", transition:"all 0.15s" }}>
                {label}
                <span style={{ fontSize:9, opacity:0.7, background:active?"rgba(0,0,0,0.15)":th.pillBg, borderRadius:10, padding:"1px 5px" }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Word List */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:"12px 36px 60px" }}>
        {dbLoading && <div style={{ textAlign:"center", padding:"40px 0", color:th.textFaint, fontSize:13 }}>Lade deinen Wortschatz…</div>}
        {!dbLoading && filteredWords.length===0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:th.textDim }}>
            <div style={{ fontSize:34, marginBottom:10 }}>📖</div>
            <p style={{ fontSize:13 }}>{words.length===0 ? "Füge dein erstes Wort hinzu" : "Keine Wörter in dieser Kategorie"}</p>
          </div>
        )}
        {!dbLoading && filteredWords.map(w => {
          const tc = typeColor(w.type, th); const isRetrying = retryingId===w.id;
          return (
            <div key={w.id} style={{ background:th.bgCard, border:`1px solid ${expandedId===w.id?th.borderActive:th.border}`, borderRadius:7, marginBottom:7, overflow:"hidden", opacity:w.mastered?0.5:1, transition:"all 0.2s" }}>
              <div onClick={() => setExpandedId(expandedId===w.id?null:w.id)} style={{ display:"flex", alignItems:"center", padding:"14px 16px", cursor:"pointer", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                    <span style={{ fontSize:16, color:w.mastered?th.textFaint:th.text, textDecoration:w.mastered?"line-through":"none" }}>{w.word}</span>
                    <SpeakBtn text={w.word} size={13} />
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:tc.bg, color:tc.text, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"sans-serif" }}>{w.type}</span>
                    {w.level && (() => { const lc = levelColor(w.level); return <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, background:lc.bg, color:lc.text, letterSpacing:"0.1em", fontFamily:"sans-serif", fontWeight:"bold" }}>{w.level}</span>; })()}
                  </div>
                  <div style={{ fontSize:12, color:th.textMuted, marginTop:2 }}>{w.translation}</div>
                </div>
                <div style={{ display:"flex", gap:7, alignItems:"center", flexShrink:0 }}>
                  <button onClick={e => { e.stopPropagation(); toggleMastered(w.id, w.mastered); }} style={{ background:"transparent", border:`1px solid ${w.mastered?th.accent:th.borderMid}`, color:w.mastered?th.accent:th.textDim, borderRadius:4, padding:"3px 9px", fontSize:9, fontFamily:"inherit", letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
                    {w.mastered ? "✓ Gelernt" : "Gelernt?"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(w.id); }}
                    onMouseEnter={e=>e.target.style.color=th.red} onMouseLeave={e=>e.target.style.color=th.textDim}
                    style={{ background:"transparent", border:"none", color:th.textDim, fontSize:17, cursor:"pointer", padding:"2px 4px", lineHeight:1, transition:"color 0.15s" }}>×</button>
                  <span style={{ color:th.textDim, fontSize:10, display:"inline-block", transform:expandedId===w.id?"rotate(180deg)":"rotate(0)", transition:"transform 0.2s" }}>▾</span>
                </div>
              </div>
              {expandedId===w.id && (
                <div style={{ borderTop:`1px solid ${th.border}`, padding:"16px 16px 20px" }}>
                  <p style={{ fontSize:13, color:th.textWarm, lineHeight:1.7, margin:"0 0 10px", fontStyle:"italic" }}>{w.explanation}</p>
                  <button onClick={() => handleRetry(w)} disabled={isRetrying} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:4, color:isRetrying?th.textFaint:th.textMuted, fontSize:10, fontFamily:"inherit", padding:"3px 10px", cursor:isRetrying?"not-allowed":"pointer", marginBottom:18 }}>
                    {isRetrying ? "⟳ Aktualisiere…" : "⟳ Erneut generieren"}
                  </button>
                  <div style={{ fontSize:9, color:th.textFaint, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>Beispielsätze</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                    {(w.sentences||[]).map((s,i) => (
                      <div key={i} style={{ borderLeft:`2px solid ${th.borderMid}`, paddingLeft:13 }}>
                        <div style={{ fontSize:14, color:th.text, lineHeight:1.65, marginBottom:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span>
                            {s.german.split(new RegExp(`(${w.word})`,"gi")).map((part,j) =>
                              part.toLowerCase()===w.word.toLowerCase() ? <span key={j} style={{ color:th.accent }}>{part}</span> : part
                            )}
                          </span>
                          <SpeakBtn text={s.german} size={12} />
                        </div>
                        <div style={{ fontSize:12, color:th.textMuted, lineHeight:1.5 }}>{s.english}</div>
                      </div>
                    ))}
                  </div>
                  <PronunciationPractice word={w.word} />
                  <div style={{ fontSize:9, color:th.textDim, marginTop:14 }}>
                    Hinzugefügt am {new Date(w.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Meintest du? */}
      {suggestion && (
        <div style={overlay} onClick={() => setSuggestion(null)}>
          <div onClick={e=>e.stopPropagation()} style={popup}>
            <div style={{ fontSize:22, marginBottom:12 }}>✏️</div>
            <p style={{ color:th.textMuted, fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:16 }}>Meintest du...?</p>
            <p style={{ color:th.text, fontSize:20, fontStyle:"italic", marginBottom:6 }}>{suggestion.corrected}</p>
            <p style={{ color:th.textFaint, fontSize:12, marginBottom:24 }}>statt <span style={{ textDecoration:"line-through", color:th.textDim }}>{suggestion.original}</span></p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={rejectSuggestion} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:6, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"9px 18px", cursor:"pointer" }}>Nein, so behalten</button>
              <button onClick={acceptSuggestion} style={{ background:th.accent, border:"none", borderRadius:6, color:"#0a0908", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"9px 18px", cursor:"pointer" }}>Ja, korrigieren</button>
            </div>
          </div>
        </div>
      )}

      {/* Löschen */}
      {deleteConfirmId && (
        <div style={overlay} onClick={() => setDeleteConfirmId(null)}>
          <div onClick={e=>e.stopPropagation()} style={popup}>
            <div style={{ fontSize:22, marginBottom:12 }}>🗑️</div>
            <p style={{ color:th.text, fontSize:15, marginBottom:6 }}><strong>{words.find(w=>w.id===deleteConfirmId)?.word}</strong></p>
            <p style={{ color:th.textMuted, fontSize:13, lineHeight:1.6, marginBottom:24 }}>Möchtest du dieses Wort wirklich löschen? Das kann nicht rückgängig gemacht werden.</p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background:"transparent", border:`1px solid ${th.borderActive}`, borderRadius:6, color:th.textMuted, fontSize:12, fontFamily:"inherit", padding:"8px 20px", cursor:"pointer" }}>Abbrechen</button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ background:th.red, border:"none", borderRadius:6, color:"#fff", fontSize:12, fontFamily:"inherit", fontWeight:"bold", padding:"8px 20px", cursor:"pointer" }}>Löschen</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </ThemeCtx.Provider>
  );
}
