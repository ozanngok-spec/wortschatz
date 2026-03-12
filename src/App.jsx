import { useState, useEffect, useRef } from "react";

// ── AI: fetch word data ───────────────────────────────────────────────────────
async function fetchExampleSentences(word) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a German language teacher helping a C1 level student. The user typed: "${word}". First, correct any spelling mistakes and return the properly formatted German word or expression. Return ONLY a JSON object (no markdown, no backticks, no explanation): {"word":"corrected German word","translation":"English translation","type":"Nomen / Verb / Ausdruck / Adjektiv / Adverb / etc","explanation":"Kurze Erklaerung auf Deutsch in 1-2 Saetzen","sentences":[{"german":"Beispielsatz 1","english":"Translation"},{"german":"Beispielsatz 2","english":"Translation"},{"german":"Beispielsatz 3","english":"Translation"}]}`
      }]
    })
  });
  const data = await response.json();
  const text = data.content.map(i => i.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ── AI: pronunciation feedback ────────────────────────────────────────────────
async function fetchPronunciationFeedback(word, transcript) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `A German C1 student tried to pronounce the word "${word}". The speech recognition heard: "${transcript}". Give short, encouraging pronunciation feedback in English. If it's close enough, say so positively. If not, give 1-2 specific tips on how to pronounce "${word}" correctly. Keep it under 3 sentences. Be encouraging and specific.`
      }]
    })
  });
  const data = await response.json();
  return data.content.map(i => i.text || "").join("").trim();
}

// ── Text-to-speech ─────────────────────────────────────────────────────────────
function speak(text, lang = "de-DE") {
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_FILTERS = [
  { key: "all", label: "Alle" },
  { key: "nomen", label: "Nomen" },
  { key: "verb", label: "Verb" },
  { key: "ausdruck", label: "Ausdruck" },
  { key: "adjektiv", label: "Adjektiv" },
  { key: "adverb", label: "Adverb" },
  { key: "mastered", label: "✓ Gelernt" },
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

const typeColor = (type) => {
  const t = (type || "").toLowerCase();
  if (t.includes("nomen") || t.includes("noun")) return { bg: "#3d2e1e", text: "#e8c49a" };
  if (t.includes("verb")) return { bg: "#1e2e3d", text: "#9ac4e8" };
  if (t.includes("ausdruck") || t.includes("expression") || t.includes("phrase") || t.includes("redewendung")) return { bg: "#2e1e3d", text: "#c49ae8" };
  if (t.includes("adj")) return { bg: "#1e3d2e", text: "#9ae8c4" };
  if (t.includes("adverb")) return { bg: "#2e1e1e", text: "#e89a9a" };
  return { bg: "#2e2e1e", text: "#e8e49a" };
};

// ── Speak Button ──────────────────────────────────────────────────────────────
function SpeakBtn({ text, size = 13 }) {
  const [speaking, setSpeaking] = useState(false);
  const handleSpeak = (e) => {
    e.stopPropagation();
    setSpeaking(true);
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "de-DE"; u.rate = 0.9;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  return (
    <button onClick={handleSpeak} title="Anhören" style={{ background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px", fontSize:size, opacity: speaking ? 1 : 0.5, transition:"opacity 0.2s", lineHeight:1 }}>
      {speaking ? "🔊" : "🔈"}
    </button>
  );
}

// ── Pronunciation Practice ────────────────────────────────────────────────────
function PronunciationPractice({ word }) {
  const [state, setState] = useState("idle"); // idle | listening | processing | done
  const [feedback, setFeedback] = useState("");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  const start = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setFeedback("Speech recognition is not supported in this browser. Try Chrome."); setState("done"); return; }
    const r = new SR();
    r.lang = "de-DE";
    r.interimResults = false;
    r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = async (e) => {
      const heard = e.results[0][0].transcript;
      setTranscript(heard);
      setState("processing");
      const fb = await fetchPronunciationFeedback(word, heard);
      setFeedback(fb);
      setState("done");
    };
    r.onerror = () => { setFeedback("Couldn't hear anything. Please try again."); setState("done"); };
    r.onend = () => { if (state === "listening") setState("idle"); };
    r.start();
    setState("listening");
  };

  const reset = () => { setState("idle"); setFeedback(""); setTranscript(""); };

  return (
    <div style={{ marginTop:14, padding:"12px 14px", background:"#0a0908", borderRadius:6, border:"1px solid #1e1c18" }}>
      <div style={{ fontSize:9, color:"#3a3830", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>Aussprache üben</div>
      {state === "idle" && (
        <button onClick={start} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid #2a2820", borderRadius:4, color:"#8a7e6e", fontSize:11, fontFamily:"inherit", padding:"5px 12px", cursor:"pointer", letterSpacing:"0.06em" }}>
          🎤 Jetzt sprechen
        </button>
      )}
      {state === "listening" && (
        <div style={{ display:"flex", alignItems:"center", gap:8, color:"#c8a96e", fontSize:12 }}>
          <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#c87070", animation:"pulse 1s infinite" }}></span>
          Spreche jetzt: <em>{word}</em>
        </div>
      )}
      {state === "processing" && (
        <div style={{ color:"#5a5448", fontSize:12 }}>Analysiere Aussprache…</div>
      )}
      {state === "done" && (
        <div>
          {transcript && <div style={{ fontSize:11, color:"#4a4840", marginBottom:6 }}>Gehört: <em style={{ color:"#6b6456" }}>"{transcript}"</em></div>}
          <div style={{ fontSize:13, color:"#a09070", lineHeight:1.7, marginBottom:10 }}>{feedback}</div>
          <button onClick={reset} style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:4, color:"#5a5448", fontSize:10, fontFamily:"inherit", padding:"3px 10px", cursor:"pointer", letterSpacing:"0.06em" }}>
            ⟳ Nochmal versuchen
          </button>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [words, setWords] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
    (async () => {
      try {
        const result = await window.storage.get("wortschatz-words-v2");
        if (result && result.value) setWords(JSON.parse(result.value));
      } catch(e) {}
      setStorageLoading(false);
    })();
  }, []);

  const save = async (updated) => {
    try { await window.storage.set("wortschatz-words-v2", JSON.stringify(updated)); } catch(e) {}
  };

  // ── Voice input ──────────────────────────────────────────────────────────────
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Speech recognition not supported. Try Chrome."); return; }
    const r = new SR();
    r.lang = "de-DE"; r.interimResults = false; r.maxAlternatives = 1;
    recognitionRef.current = r;
    r.onresult = (e) => { setInput(e.results[0][0].transcript); setIsListening(false); };
    r.onerror = () => setIsListening(false);
    r.onend = () => setIsListening(false);
    r.start();
    setIsListening(true);
  };

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false); };

  // ── Add word ─────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true); setError(""); setSuggestion(null);
    try {
      const ai = await fetchExampleSentences(trimmed);
      const finalWord = ai.word || trimmed;
      if (words.find(w => w.word.toLowerCase() === finalWord.toLowerCase())) {
        setError("Dieses Wort ist bereits in deiner Liste."); setLoading(false); return;
      }
      if (finalWord.toLowerCase() !== trimmed.toLowerCase()) {
        setSuggestion({ original: trimmed, corrected: finalWord, ai });
        setLoading(false); return;
      }
      await saveWord(finalWord, ai);
    } catch(e) { setError("Fehler: " + e.message); }
    setLoading(false);
  };

  const saveWord = async (finalWord, ai) => {
    const newWord = { id: Date.now(), word: finalWord, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences, mastered: false, addedAt: new Date().toISOString() };
    const updated = [newWord, ...words];
    setWords(updated); await save(updated);
    setInput(""); setExpandedId(newWord.id); setSuggestion(null);
  };

  const acceptSuggestion = () => { if (suggestion) saveWord(suggestion.corrected, suggestion.ai); };
  const rejectSuggestion = () => { if (suggestion) saveWord(suggestion.original, suggestion.ai); };

  const handleRetry = async (w) => {
    setRetryingId(w.id);
    try {
      const ai = await fetchExampleSentences(w.word);
      const updated = words.map(x => x.id === w.id ? { ...x, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences } : x);
      setWords(updated); await save(updated);
    } catch(e) { console.error(e); }
    setRetryingId(null);
  };

  const handleDelete = async (id) => {
    setDeleteConfirmId(null);
    const updated = words.filter(w => w.id !== id);
    setWords(updated); await save(updated);
    if (expandedId === id) setExpandedId(null);
  };

  const toggleMastered = async (id) => {
    const updated = words.map(w => w.id === id ? { ...w, mastered: !w.mastered } : w);
    setWords(updated); await save(updated);
  };

  const filteredWords = words.filter(w => matchesTypeFilter(w, filter));
  const countFor = (key) => key === "all" ? words.length : words.filter(w => matchesTypeFilter(w, key)).length;

  if (storageLoading) return (
    <div style={{ minHeight:"100vh", background:"#0a0908", display:"flex", alignItems:"center", justifyContent:"center", color:"#3a3830", fontFamily:"Palatino,serif", fontSize:13 }}>Laden…</div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0a0908", fontFamily:"'Palatino Linotype',Palatino,serif", color:"#e8e0d0" }}>

      {/* Header */}
      <div style={{ borderBottom:"1px solid #1a1815", padding:"20px 36px 16px", background:"#0a0908", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:10, marginBottom:14 }}>
            <h1 style={{ fontSize:22, fontWeight:"normal", letterSpacing:"0.06em", color:"#e8e0d0", margin:0 }}>Wortschatz</h1>
            <span style={{ fontSize:10, color:"#3a3830", letterSpacing:"0.14em", textTransform:"uppercase" }}>C1</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError(""); setSuggestion(null); }}
              onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
              placeholder="Deutsches Wort oder Ausdruck eingeben…"
              style={{ flex:1, background:"#111009", border:"1px solid #252320", borderRadius:6, padding:"11px 15px", fontSize:15, color:"#e8e0d0", outline:"none", fontFamily:"inherit" }} />

            {/* Mic button */}
            <button onClick={isListening ? stopListening : startListening} title="Spracheingabe"
              style={{ background: isListening ? "#c87070" : "#111009", border:"1px solid", borderColor: isListening ? "#c87070" : "#252320", borderRadius:6, padding:"11px 14px", fontSize:16, cursor:"pointer", transition:"all 0.2s", lineHeight:1 }}>
              {isListening ? "⏹" : "🎤"}
            </button>

            <button onClick={handleAdd} disabled={loading || !input.trim()} style={{ background:loading?"#1a1915":"#c8a96e", color:loading?"#3a3830":"#0a0908", border:"none", borderRadius:6, padding:"11px 22px", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
              {loading ? "Suche…" : "Hinzufügen"}
            </button>
          </div>
          {isListening && <p style={{ color:"#c8a96e", fontSize:12, marginTop:8, marginBottom:0 }}>🎤 Höre zu… sprich jetzt auf Deutsch</p>}
          {error && <p style={{ color:"#c87070", fontSize:12, marginTop:8, marginBottom:0 }}>{error}</p>}
        </div>
      </div>

      {/* Stats + Type filters */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:"14px 36px 0" }}>
        <div style={{ fontSize:11, color:"#3a3830", letterSpacing:"0.06em", marginBottom:10 }}>
          {words.length} Wörter &nbsp;·&nbsp;
          <span style={{ color:"#c8a96e" }}>{words.filter(w => w.mastered).length} gelernt</span> &nbsp;·&nbsp;
          {words.filter(w => !w.mastered).length} in Bearbeitung
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {TYPE_FILTERS.map(({ key, label }) => {
            const count = countFor(key);
            const active = filter === key;
            return (
              <button key={key} onClick={() => setFilter(key)} style={{ display:"flex", alignItems:"center", gap:5, background:active?"#c8a96e":"#111009", color:active?"#0a0908":"#4a4840", border:"1px solid", borderColor:active?"#c8a96e":"#252320", borderRadius:20, padding:"4px 12px", fontSize:11, fontFamily:"inherit", letterSpacing:"0.06em", cursor:"pointer", transition:"all 0.15s" }}>
                {label}
                <span style={{ fontSize:9, opacity:0.7, background:active?"rgba(0,0,0,0.15)":"#1a1815", borderRadius:10, padding:"1px 5px" }}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Word List */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:"12px 36px 60px" }}>
        {filteredWords.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#252320" }}>
            <div style={{ fontSize:34, marginBottom:10 }}>📖</div>
            <p style={{ fontSize:13, letterSpacing:"0.06em" }}>{words.length===0 ? "Füge dein erstes Wort hinzu" : "Keine Wörter in dieser Kategorie"}</p>
          </div>
        )}

        {filteredWords.map(w => {
          const tc = typeColor(w.type);
          const isRetrying = retryingId === w.id;
          return (
            <div key={w.id} style={{ background:"#0e0d0b", border:"1px solid", borderColor:expandedId===w.id?"#2a2820":"#161512", borderRadius:7, marginBottom:7, overflow:"hidden", opacity:w.mastered?0.5:1, transition:"all 0.2s" }}>

              {/* Row */}
              <div onClick={() => setExpandedId(expandedId===w.id ? null : w.id)} style={{ display:"flex", alignItems:"center", padding:"14px 16px", cursor:"pointer", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                    <span style={{ fontSize:16, color:w.mastered?"#3a3830":"#e8e0d0", textDecoration:w.mastered?"line-through":"none" }}>{w.word}</span>
                    {/* Speak the word */}
                    <SpeakBtn text={w.word} size={13} />
                    <span style={{ fontSize:9, padding:"2px 6px", borderRadius:3, background:tc.bg, color:tc.text, letterSpacing:"0.08em", textTransform:"uppercase", fontFamily:"sans-serif" }}>{w.type}</span>
                  </div>
                  <div style={{ fontSize:12, color:"#5a5448", marginTop:2 }}>{w.translation}</div>
                </div>
                <div style={{ display:"flex", gap:7, alignItems:"center", flexShrink:0 }}>
                  <button onClick={e => { e.stopPropagation(); toggleMastered(w.id); }} style={{ background:"transparent", border:"1px solid", borderColor:w.mastered?"#c8a96e":"#252320", color:w.mastered?"#c8a96e":"#2e2c26", borderRadius:4, padding:"3px 9px", fontSize:9, fontFamily:"inherit", letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
                    {w.mastered ? "✓ Gelernt" : "Gelernt?"}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(w.id); }} onMouseEnter={e=>e.target.style.color="#c87070"} onMouseLeave={e=>e.target.style.color="#252320"}
                    style={{ background:"transparent", border:"none", color:"#252320", fontSize:17, cursor:"pointer", padding:"2px 4px", lineHeight:1, transition:"color 0.15s" }}>×</button>
                  <span style={{ color:"#2e2c26", fontSize:10, display:"inline-block", transform:expandedId===w.id?"rotate(180deg)":"rotate(0)", transition:"transform 0.2s" }}>▾</span>
                </div>
              </div>

              {/* Expanded */}
              {expandedId === w.id && (
                <div style={{ borderTop:"1px solid #161512", padding:"16px 16px 20px" }}>
                  <p style={{ fontSize:13, color:"#a09070", lineHeight:1.7, margin:"0 0 10px", fontStyle:"italic" }}>{w.explanation}</p>

                  <button onClick={() => handleRetry(w)} disabled={isRetrying} style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:4, color:isRetrying?"#3a3830":"#6b6456", fontSize:10, fontFamily:"inherit", letterSpacing:"0.08em", padding:"3px 10px", cursor:isRetrying?"not-allowed":"pointer", marginBottom:18 }}>
                    {isRetrying ? "⟳ Aktualisiere…" : "⟳ Erneut generieren"}
                  </button>

                  {/* Example sentences with speak buttons */}
                  <div style={{ fontSize:9, color:"#3a3830", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>Beispielsätze</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                    {(w.sentences||[]).map((s,i) => (
                      <div key={i} style={{ borderLeft:"2px solid #252320", paddingLeft:13 }}>
                        <div style={{ fontSize:14, color:"#c8c0b0", lineHeight:1.65, marginBottom:3, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                          <span>
                            {s.german.split(new RegExp(`(${w.word})`,"gi")).map((part,j) =>
                              part.toLowerCase()===w.word.toLowerCase()
                                ? <span key={j} style={{ color:"#c8a96e" }}>{part}</span>
                                : part
                            )}
                          </span>
                          <SpeakBtn text={s.german} size={12} />
                        </div>
                        <div style={{ fontSize:12, color:"#4a4438", lineHeight:1.5 }}>{s.english}</div>
                      </div>
                    ))}
                  </div>

                  {/* Pronunciation practice */}
                  <PronunciationPractice word={w.word} />

                  <div style={{ fontSize:9, color:"#252320", marginTop:14, letterSpacing:"0.06em" }}>
                    Hinzugefügt am {new Date(w.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Did you mean? Popup */}
      {suggestion && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
          onClick={() => setSuggestion(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#141210", border:"1px solid #2a2820", borderRadius:10, padding:"28px 32px", maxWidth:360, width:"90%", textAlign:"center", fontFamily:"'Palatino Linotype',Palatino,serif" }}>
            <div style={{ fontSize:22, marginBottom:12 }}>✏️</div>
            <p style={{ color:"#8a7e6e", fontSize:13, letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:16 }}>Meintest du...?</p>
            <p style={{ color:"#e8e0d0", fontSize:20, fontStyle:"italic", marginBottom:6 }}>{suggestion.corrected}</p>
            <p style={{ color:"#4a4840", fontSize:12, marginBottom:24 }}>statt <span style={{ textDecoration:"line-through", color:"#3a3830" }}>{suggestion.original}</span></p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={rejectSuggestion} style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:6, color:"#6b6456", fontSize:12, fontFamily:"inherit", letterSpacing:"0.06em", padding:"9px 18px", cursor:"pointer" }}>
                Nein, so behalten
              </button>
              <button onClick={acceptSuggestion} style={{ background:"#c8a96e", border:"none", borderRadius:6, color:"#0a0908", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.06em", padding:"9px 18px", cursor:"pointer" }}>
                Ja, korrigieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Popup */}
      {deleteConfirmId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}
          onClick={() => setDeleteConfirmId(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#141210", border:"1px solid #2a2820", borderRadius:10, padding:"28px 32px", maxWidth:340, width:"90%", textAlign:"center", fontFamily:"'Palatino Linotype',Palatino,serif" }}>
            <div style={{ fontSize:22, marginBottom:12 }}>🗑️</div>
            <p style={{ color:"#e8e0d0", fontSize:15, marginBottom:6 }}>
              <strong>{words.find(w => w.id === deleteConfirmId)?.word}</strong>
            </p>
            <p style={{ color:"#6b6456", fontSize:13, lineHeight:1.6, marginBottom:24 }}>
              Möchtest du dieses Wort wirklich löschen? Das kann nicht rückgängig gemacht werden.
            </p>
            <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
              <button onClick={() => setDeleteConfirmId(null)} style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:6, color:"#6b6456", fontSize:12, fontFamily:"inherit", letterSpacing:"0.08em", padding:"8px 20px", cursor:"pointer" }}>
                Abbrechen
              </button>
              <button onClick={() => handleDelete(deleteConfirmId)} style={{ background:"#c87070", border:"none", borderRadius:6, color:"#0a0908", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.08em", padding:"8px 20px", cursor:"pointer" }}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
