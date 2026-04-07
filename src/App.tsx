import { useState } from 'react';
import { Bot, CheckCircle, FileText, AlertTriangle, Copy, Loader2, Edit3, Eye } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

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
  const [previewMode, setPreviewMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
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

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
          className="bg-[#007AFF] hover:bg-[#005bb5] disabled:hover:bg-[#007AFF] disabled:opacity-50 active:scale-[0.98] text-white py-3 px-8 rounded-lg font-semibold transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed" 
          onClick={handleAnalyze}
          disabled={appState !== 'idle' || !sourceInput.trim()}
        >
          {appState === 'analyzing' ? (
            <span className="flex items-center gap-2">
              <Loader2 size={18} className="animate-spin" /> Analyzing...
            </span>
          ) : 'Analyze'}
        </button>
      </section>

      {/* VERIFICATION GATE */}
      {(appState === 'verifying' || appState === 'generating' || appState === 'finished') && (
        <section className="fade-in">
          <div className="gate-container">
            <div className="glass gate-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="text-xl font-semibold text-[#ededed] flex items-center gap-2 m-0"><FileText size={20}/> Fact-Sheet Review</h2>
                {appState === 'verifying' && (
                  <button onClick={() => setPreviewMode(!previewMode)} className="bg-[#007AFF] hover:bg-[#005bb5] active:scale-[0.98] text-white py-1.5 px-3 rounded text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer">
                    {previewMode ? <><Edit3 size={14}/> Edit Markdown</> : <><Eye size={14}/> Preview HTML</>}
                  </button>
                )}
              </div>
              
              {previewMode || appState !== 'verifying' ? (
                <div className="md-editor markdown-rendered prose prose-invert max-w-none" style={{ overflowY: 'auto' }}>
                  <ReactMarkdown>
                    {factSheet ? factSheet.replace(/\\n/g, '\n') : "No content generated yet."}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea 
                  className="md-editor"
                  value={factSheet}
                  onChange={(e) => setFactSheet(e.target.value)}
                  placeholder="Review generated facts..."
                />
              )}
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
                className="bg-[#007AFF] hover:bg-[#005bb5] disabled:opacity-50 disabled:hover:bg-[#007AFF] active:scale-[0.98] text-white py-3 px-6 rounded-lg font-semibold transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed" 
                onClick={handleGenerate}
                disabled={appState === 'generating'}
              >
                {appState === 'generating' ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Agent 2 is drafting...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CheckCircle size={18} /> 
                    Confirm & Generate
                  </span>
                )}
              </button>
            </div>
          )}
        </section>
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
                <button className="copy-btn" onClick={() => copyToClipboard(item.content, id)}>
                  {copiedId === id ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                      <CheckCircle size={16} /> Copied!
                    </span>
                  ) : (
                    <Copy size={18} />
                  )}
                </button>
              </div>
              <div className="bento-content markdown-rendered prose prose-invert max-w-none">
                <ReactMarkdown>
                  {item.content ? item.content.replace(/\\n/g, '\n') : ""}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default App;
