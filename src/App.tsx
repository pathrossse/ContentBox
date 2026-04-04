import { useState } from 'react';
import { Bot, CheckCircle, FileText, AlertTriangle, Copy, Loader2 } from 'lucide-react';

type GUIState = 'idle' | 'analyzing' | 'verifying' | 'generating' | 'finished';

interface GenerationData {
  blog_post: string;
  social_thread: string;
  email_teaser: string;
}

function App() {
  const [appState, setAppState] = useState<GUIState>('idle');
  const [sourceInput, setSourceInput] = useState('');
  const [threadId, setThreadId] = useState('');
  const [factSheet, setFactSheet] = useState('');
  const [ambiguityFlags, setAmbiguityFlags] = useState<string[]>([]);
  const [results, setResults] = useState<GenerationData | null>(null);

  const handleAnalyze = async () => {
    if (!sourceInput.trim()) return;
    setAppState('analyzing');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Analysis failed');
      
      setThreadId(data.thread_id);
      setFactSheet(data.fact_sheet);
      setAmbiguityFlags(data.ambiguity_flags || []);
      setAppState('verifying');
    } catch (err: any) {
      alert(err.message);
      setAppState('idle');
    }
  };

  const handleGenerate = async () => {
    setAppState('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thread_id: threadId, fact_sheet: factSheet })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');
      
      setResults(data);
      setAppState('finished');
    } catch (err: any) {
      alert(err.message);
      setAppState('verifying');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="container">
      {/* HEADER */}
      <header className="header">
        <div className="logo"><Bot size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}/> ContentBox</div>
        <div className="status-badge">
          <div className="status-dot"></div>
          System Status: Online
        </div>
      </header>

      {/* INPUT SECTION */}
      <section className="input-section fade-in">
        <input 
          type="text" 
          className="input-field" 
          placeholder="Enter Source URL or Raw Text..." 
          value={sourceInput}
          onChange={(e) => setSourceInput(e.target.value)}
          disabled={appState !== 'idle'}
        />
        <button 
          className="btn" 
          onClick={handleAnalyze}
          disabled={appState !== 'idle' || !sourceInput.trim()}
        >
          {appState === 'analyzing' ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Loader2 size={18} className="spin" /> Analyzing...
            </span>
          ) : 'Analyze'}
        </button>
      </section>

      {/* VERIFICATION GATE */}
      {(appState === 'verifying' || appState === 'generating' || appState === 'finished') && (
        <section className="fade-in">
          <div className="gate-container">
            <div className="glass gate-panel">
              <h2 className="gate-title"><FileText size={20}/> Fact-Sheet Review</h2>
              <textarea 
                className="md-editor"
                value={factSheet}
                onChange={(e) => setFactSheet(e.target.value)}
                disabled={appState !== 'verifying'}
              />
            </div>
            
            <div className="glass gate-panel warnings">
              <h2 className="gate-title" style={{ color: 'var(--warning-color)' }}><AlertTriangle size={20}/> Ambiguity Flags</h2>
              <ul className="warnings-list">
                {ambiguityFlags.length === 0 ? (
                  <li style={{ color: 'var(--text-secondary)' }}>No ambiguities detected.</li>
                ) : (
                  ambiguityFlags.map((flag, idx) => (
                    <li key={idx} className="warning-item">{flag}</li>
                  ))
                )}
              </ul>
            </div>
          </div>
          
          {(appState === 'verifying' || appState === 'generating') && (
            <div className="action-row">
              <button 
                className="btn" 
                onClick={handleGenerate}
                disabled={appState === 'generating'}
              >
                {appState === 'generating' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <Loader2 size={18} className="spin" /> Agent 2 is drafting...
                  </span>
                ) : (
                  <>
                    <CheckCircle size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }}/> 
                    Confirm & Generate
                  </>
                )}
              </button>
            </div>
          )}
      )}

      {/* OUTPUT GALLERY */}
      {appState === 'finished' && results && (
        <section className="gallery-grid fade-in">
          {[
            { title: 'Blog Post', content: results.blog_post },
            { title: 'Social Media Thread', content: results.social_thread },
            { title: 'Email Teaser', content: results.email_teaser }
          ].map((item, id) => (
            <div className="bento-card glass" key={id}>
              <div className="bento-header">
                <span className="bento-title">{item.title}</span>
                <button className="copy-btn" onClick={() => copyToClipboard(item.content)}>
                  <Copy size={18} />
                </button>
              </div>
              <div className="bento-content">
                {item.content}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;
