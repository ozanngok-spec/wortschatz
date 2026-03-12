import { useState, useEffect } from "react";

async function fetchExampleSentences(word) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: `You are a German language teacher helping a C1 level student. For the German word or expression: "${word}" Return ONLY a JSON object (no markdown, no backticks, no explanation) in this exact format: {"translation":"English translation","type":"Nomen / Verb / Ausdruck / Adjektiv / Adverb / etc","explanation":"Kurze Erklaerung auf Deutsch in 1-2 Saetzen: Was bedeutet dieses Wort und wie wird es verwendet?","sentences":[{"german":"Erster Beispielsatz auf Deutsch","english":"English translation"},{"german":"Zweiter Beispielsatz in einem anderen Kontext","english":"English translation"},{"german":"Dritter Beispielsatz","english":"English translation"}]}`
      }]
    })
  });
  const data = await response.json();
  const text = data.content.map(i => i.text || "").join("");
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

const typeColor = (type) => {
  const t = (type || "").toLowerCase();
  if (t.includes("nomen") || t.includes("noun")) return { bg: "#3d2e1e", text: "#e8c49a" };
  if (t.includes("verb")) return { bg: "#1e2e3d", text: "#9ac4e8" };
  if (t.includes("ausdruck") || t.includes("expression") || t.includes("phrase")) return { bg: "#2e1e3d", text: "#c49ae8" };
  if (t.includes("adj")) return { bg: "#1e3d2e", text: "#9ae8c4" };
  if (t.includes("adverb")) return { bg: "#2e1e1e", text: "#e89a9a" };
  return { bg: "#2e2e1e", text: "#e8e49a" };
};

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

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (words.find(w => w.word.toLowerCase() === trimmed.toLowerCase())) {
      setError("Dieses Wort ist bereits in deiner Liste."); return;
    }
    setLoading(true); setError("");
    try {
      const ai = await fetchExampleSentences(trimmed);
      const newWord = { id: Date.now(), word: trimmed, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences, mastered: false, addedAt: new Date().toISOString() };
      const updated = [newWord, ...words];
      setWords(updated);
      await save(updated);
      setInput(""); setExpandedId(newWord.id);
    } catch(e) { setError("Fehler: " + e.message); }
    setLoading(false);
  };

  const handleRetry = async (w) => {
    setRetryingId(w.id);
    try {
      const ai = await fetchExampleSentences(w.word);
      const updated = words.map(x => x.id === w.id ? { ...x, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences } : x);
      setWords(updated);
      await save(updated);
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

  const filteredWords = words.filter(w =>
    filter === "mastered" ? w.mastered : filter === "learning" ? !w.mastered : true
  );

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
          <div style={{ display:"flex", gap:10 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && !loading && handleAdd()}
              placeholder="Deutsches Wort oder Ausdruck eingeben…"
              style={{ flex:1, background:"#111009", border:"1px solid #252320", borderRadius:6, padding:"11px 15px", fontSize:15, color:"#e8e0d0", outline:"none", fontFamily:"inherit" }} />
            <button onClick={handleAdd} disabled={loading || !input.trim()} style={{ background:loading?"#1a1915":"#c8a96e", color:loading?"#3a3830":"#0a0908", border:"none", borderRadius:6, padding:"11px 22px", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
              {loading ? "Suche…" : "Hinzufügen"}
            </button>
          </div>
          {error && <p style={{ color:"#c87070", fontSize:12, marginTop:8, marginBottom:0 }}>{error}</p>}
        </div>
      </div>

      {/* Stats + Filter */}
      <div style={{ maxWidth:740, margin:"0 auto", padding:"16px 36px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", gap:16, fontSize:11, color:"#3a3830", letterSpacing:"0.06em" }}>
            <span>{words.length} Wörter</span>
            <span style={{ color:"#c8a96e" }}>{words.filter(w => w.mastered).length} gelernt</span>
            <span>{words.filter(w => !w.mastered).length} in Bearbeitung</span>
          </div>
          <div style={{ display:"flex", gap:5 }}>
            {[["all","Alle"],["learning","Lernend"],["mastered","Gelernt"]].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)} style={{ background:filter===f?"#c8a96e":"transparent", color:filter===f?"#0a0908":"#3a3830", border:"1px solid", borderColor:filter===f?"#c8a96e":"#252320", borderRadius:4, padding:"3px 11px", fontSize:10, fontFamily:"inherit", letterSpacing:"0.08em", cursor:"pointer" }}>{label}</button>
            ))}
          </div>
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
              <div onClick={() => setExpandedId(expandedId===w.id ? null : w.id)} style={{ display:"flex", alignItems:"center", padding:"14px 16px", cursor:"pointer", gap:12 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:9, flexWrap:"wrap" }}>
                    <span style={{ fontSize:16, color:w.mastered?"#3a3830":"#e8e0d0", textDecoration:w.mastered?"line-through":"none" }}>{w.word}</span>
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

              {expandedId === w.id && (
                <div style={{ borderTop:"1px solid #161512", padding:"16px 16px 20px" }}>
                  {/* German explanation */}
                  <p style={{ fontSize:13, color:"#a09070", lineHeight:1.7, margin:"0 0 10px", fontStyle:"italic" }}>{w.explanation}</p>

                  {/* Retry button */}
                  <button onClick={() => handleRetry(w)} disabled={isRetrying} style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:4, color:isRetrying?"#3a3830":"#6b6456", fontSize:10, fontFamily:"inherit", letterSpacing:"0.08em", padding:"3px 10px", cursor:isRetrying?"not-allowed":"pointer", marginBottom:18, transition:"all 0.2s" }}>
                    {isRetrying ? "⟳ Aktualisiere…" : "⟳ Erneut generieren"}
                  </button>

                  <div style={{ fontSize:9, color:"#3a3830", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:10 }}>Beispielsätze</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
                    {(w.sentences||[]).map((s,i) => (
                      <div key={i} style={{ borderLeft:"2px solid #252320", paddingLeft:13 }}>
                        <div style={{ fontSize:14, color:"#c8c0b0", lineHeight:1.65, marginBottom:3 }}>
                          {s.german.split(new RegExp(`(${w.word})`,"gi")).map((part,j) =>
                            part.toLowerCase()===w.word.toLowerCase()
                              ? <span key={j} style={{ color:"#c8a96e" }}>{part}</span>
                              : part
                          )}
                        </div>
                        <div style={{ fontSize:12, color:"#4a4438", lineHeight:1.5 }}>{s.english}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:9, color:"#252320", marginTop:14, letterSpacing:"0.06em" }}>
                    Hinzugefügt am {new Date(w.addedAt).toLocaleDateString("de-DE",{day:"numeric",month:"short",year:"numeric"})}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
