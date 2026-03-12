import { useState, useEffect, useCallback } from "react";

const SUPABASE_URL = "https://yhdwabrbsyeexllrbdni.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZHdhYnJic3llZXhsbHJiZG5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzMTMyMjAsImV4cCI6MjA4ODg4OTIyMH0.cs0IYZ6am2LTNfSL9-ugdSECQTSmV7rzUwTKRcKOMVc";

const sbFetch = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Prefer": "return=representation",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
};

async function fetchExampleSentences(word) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word })
  });
  if (!response.ok) throw new Error(`Proxy error ${response.status}: ${await response.text()}`);
  return await response.json();
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

async function hashPin(pin) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin + "wortschatz-salt"));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function PinScreen({ onEnter }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const handle = () => {
    if (pin.trim().length < 4) { setError("Please enter at least 4 characters."); return; }
    onEnter(pin.trim());
  };
  return (
    <div style={{ minHeight:"100vh", background:"#0a0908", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'Palatino Linotype',Palatino,serif", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:380 }}>
        <div style={{ width:64, height:64, borderRadius:"50%", border:"1px solid #c8a96e", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 32px", fontSize:26, color:"#c8a96e" }}>W</div>
        <h1 style={{ fontSize:34, fontWeight:"normal", color:"#e8e0d0", margin:"0 0 8px", letterSpacing:"0.06em" }}>Wortschatz</h1>
        <p style={{ color:"#6b6456", fontSize:13, letterSpacing:"0.1em", textTransform:"uppercase", margin:"0 0 40px" }}>Your Personal C1 Vocabulary</p>
        <p style={{ color:"#7a6e5e", fontSize:14, lineHeight:1.8, marginBottom:32 }}>Enter a personal PIN or passphrase to access your vocabulary.<br/>First time? Just pick any PIN — it creates your personal list.</p>
        <input value={pin} onChange={e => { setPin(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handle()} placeholder="Your PIN or passphrase…" type="password"
          style={{ width:"100%", boxSizing:"border-box", background:"#111009", border:"1px solid #252320", borderRadius:6, padding:"12px 16px", fontSize:16, color:"#e8e0d0", outline:"none", fontFamily:"inherit", marginBottom:10, textAlign:"center", letterSpacing:"0.1em" }} />
        {error && <p style={{ color:"#c87070", fontSize:13, margin:"0 0 10px" }}>{error}</p>}
        <button onClick={handle} style={{ width:"100%", background:"#c8a96e", color:"#0a0908", border:"none", borderRadius:6, padding:"13px", fontSize:13, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer" }}>
          Enter my Vocabulary →
        </button>
        <p style={{ color:"#3a3830", fontSize:11, marginTop:16, lineHeight:1.6 }}>Your PIN is hashed — never stored in plain text. Don't forget it.</p>
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

export default function App() {
  const [userId, setUserId] = useState(null);
  const [words, setWords] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [retryingId, setRetryingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("wortschatz-uid");
    if (stored) setUserId(stored);
  }, []);

  const handlePin = async (pin) => {
    const hashed = await hashPin(pin);
    sessionStorage.setItem("wortschatz-uid", hashed);
    setUserId(hashed);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("wortschatz-uid");
    setUserId(null);
    setWords([]);
  };

  const loadWords = useCallback(async () => {
    if (!userId) return;
    setDbLoading(true);
    try {
      const data = await sbFetch(`/rest/v1/vocabulary?user_id=eq.${userId}&select=*&order=added_at.desc`);
      setWords((data || []).map(w => ({
        id: w.id, word: w.word, translation: w.translation,
        type: w.type, explanation: w.explanation,
        sentences: w.sentences, mastered: w.mastered, addedAt: w.added_at
      })));
    } catch(e) { console.error(e); }
    setDbLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) loadWords(); }, [userId, loadWords]);

  const handleAdd = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    if (words.find(w => w.word.toLowerCase() === trimmed.toLowerCase())) {
      setError("This word is already in your list."); return;
    }
    setLoading(true); setError("");
    try {
      const ai = await fetchExampleSentences(trimmed);
      const result = await sbFetch("/rest/v1/vocabulary", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, word: trimmed, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences, mastered: false })
      });
      const inserted = Array.isArray(result) ? result[0] : result;
      setWords(prev => [{ id: inserted.id, word: inserted.word, translation: inserted.translation, type: inserted.type, explanation: inserted.explanation, sentences: inserted.sentences, mastered: inserted.mastered, addedAt: inserted.added_at }, ...prev]);
      setInput(""); setExpandedId(inserted.id);
    } catch(e) { setError("Something went wrong: " + e.message); }
    setLoading(false);
  };

  // Retry: re-fetch AI content and update the word in DB
  const handleRetry = async (w) => {
    setRetryingId(w.id);
    try {
      const ai = await fetchExampleSentences(w.word);
      await sbFetch(`/rest/v1/vocabulary?id=eq.${w.id}`, {
        method: "PATCH",
        body: JSON.stringify({ translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences })
      });
      setWords(prev => prev.map(x => x.id === w.id ? { ...x, translation: ai.translation, type: ai.type, explanation: ai.explanation, sentences: ai.sentences } : x));
    } catch(e) { console.error(e); }
    setRetryingId(null);
  };

  const handleDelete = async (id) => {
    setDeleteConfirmId(null);
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method: "DELETE" });
    setWords(prev => prev.filter(w => w.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const toggleMastered = async (id, current) => {
    await sbFetch(`/rest/v1/vocabulary?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ mastered: !current }) });
    setWords(prev => prev.map(w => w.id === id ? { ...w, mastered: !current } : w));
  };

  const filteredWords = words.filter(w =>
    filter === "mastered" ? w.mastered : filter === "learning" ? !w.mastered : true
  );

  if (!userId) return <PinScreen onEnter={handlePin} />;

  return (
    <div style={{ minHeight:"100vh", background:"#0a0908", fontFamily:"'Palatino Linotype',Palatino,serif", color:"#e8e0d0" }}>

      {/* Header */}
      <div style={{ borderBottom:"1px solid #1a1815", padding:"20px 36px 16px", background:"#0a0908", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ maxWidth:740, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:10 }}>
              <h1 style={{ fontSize:22, fontWeight:"normal", letterSpacing:"0.06em", color:"#e8e0d0", margin:0 }}>Wortschatz</h1>
              <span style={{ fontSize:10, color:"#3a3830", letterSpacing:"0.14em", textTransform:"uppercase" }}>C1</span>
            </div>
            <button onClick={handleLogout} style={{ background:"transparent", border:"1px solid #252320", borderRadius:4, color:"#3a3830", fontSize:10, fontFamily:"inherit", letterSpacing:"0.08em", padding:"4px 12px", cursor:"pointer" }}>Lock</button>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <input value={input} onChange={e => { setInput(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && !loading && handleAdd()} placeholder="Deutsches Wort oder Ausdruck eingeben…"
              style={{ flex:1, background:"#111009", border:"1px solid #252320", borderRadius:6, padding:"11px 15px", fontSize:15, color:"#e8e0d0", outline:"none", fontFamily:"inherit" }} />
            <button onClick={handleAdd} disabled={loading || !input.trim()} style={{ background:loading?"#1a1915":"#c8a96e", color:loading?"#3a3830":"#0a0908", border:"none", borderRadius:6, padding:"11px 22px", fontSize:12, fontFamily:"inherit", fontWeight:"bold", letterSpacing:"0.08em", textTransform:"uppercase", cursor:loading?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
              {loading ? "Suche…" : "Hinzufügen"}
            </button>
          </div>
          {error && <p style={{ color:"#c87070", fontSize:12, marginTop:8, marginBottom:0, wordBreak:"break-all" }}>{error}</p>}
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
        {dbLoading && <div style={{ textAlign:"center", padding:"40px 0", color:"#3a3830", fontSize:13 }}>Lade deinen Wortschatz…</div>}
        {!dbLoading && filteredWords.length === 0 && (
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
                  <button onClick={e => { e.stopPropagation(); toggleMastered(w.id, w.mastered); }} style={{ background:"transparent", border:"1px solid", borderColor:w.mastered?"#c8a96e":"#252320", color:w.mastered?"#c8a96e":"#2e2c26", borderRadius:4, padding:"3px 9px", fontSize:9, fontFamily:"inherit", letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer" }}>
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
                  <p style={{ fontSize:13, color:"#a09070", lineHeight:1.7, margin:"0 0 4px", fontStyle:"italic" }}>{w.explanation}</p>

                  {/* Try again button */}
                  <button
                    onClick={() => handleRetry(w)}
                    disabled={isRetrying}
                    style={{ background:"transparent", border:"1px solid #2a2820", borderRadius:4, color:isRetrying?"#3a3830":"#6b6456", fontSize:10, fontFamily:"inherit", letterSpacing:"0.08em", padding:"3px 10px", cursor:isRetrying?"not-allowed":"pointer", marginBottom:18, transition:"all 0.2s" }}
                  >
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
