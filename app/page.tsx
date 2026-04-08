"use client";

import { useState } from 'react';
import { Bot, CheckCircle, FileText, AlertTriangle, Copy, Loader2, Edit3, Eye, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type GUIState = 'idle' | 'analyzing' | 'verifying' | 'generating' | 'finished';

interface GenerationData {
  blog_post: string;
  social_thread: string | string[];
  email_teaser: string;
}

export default function Home() {
  const [appState, setAppState] = useState<GUIState>('idle');
  const [sourceInput, setSourceInput] = useState('');
  const [factSheet, setFactSheet] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [ambiguityFlags, setAmbiguityFlags] = useState<string[]>([]);
  const [results, setResults] = useState<GenerationData | null>(null);

  const formatContent = (content: any) => {
    if (Array.isArray(content)) return content.join('\n\n');
    if (typeof content === 'string') return content.replace(/\\n/g, '\n');
    return '';
  };

  // STEP 1: Analyze & Extract Insights
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
      
      setFactSheet(data.fact_sheet);
      setAmbiguityFlags(data.ambiguity_flags || []);
      setAppState('verifying');
    } catch (err: any) {
      alert(err.message);
      setAppState('idle');
    }
  };

  // STEP 2: Confirm & Generate Final Content
  const handleGenerate = async () => {
    setAppState('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fact_sheet: factSheet })
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

  const copyToClipboard = (text: any, id: number) => {
    navigator.clipboard.writeText(formatContent(text));
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
          ) : 'Analyze & Extract'}
        </button>
      </section>

      {/* VERIFICATION GATE */}
      {(appState === 'verifying' || appState === 'generating' || appState === 'finished') && (
        <section className="fade-in">
          <div className="gate-container">
            <div className={`glass gate-panel ${appState === 'finished' ? 'opacity-70 grayscale-[0.3]' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="text-xl font-semibold text-[#ededed] flex items-center gap-2 m-0"><FileText size={20}/> Fact-Sheet Review</h2>
                <button onClick={() => setPreviewMode(!previewMode)} className="bg-[#5856D6] hover:bg-[#4644b1] active:scale-[0.98] text-white py-1.5 px-3 rounded text-sm font-medium transition-all flex items-center gap-1.5 cursor-pointer">
                  {previewMode ? <><Edit3 size={14}/> Edit Markdown</> : <><Eye size={14}/> Preview HTML</>}
                </button>
              </div>
              
              {previewMode ? (
                <div className="md-editor markdown-rendered prose prose-invert max-w-none" style={{ overflowY: 'auto' }}>
                  <ReactMarkdown>
                    {formatContent(factSheet) || "No content generated yet."}
                  </ReactMarkdown>
                </div>
              ) : (
                <textarea 
                  className="md-editor"
                  value={factSheet}
                  onChange={(e) => setFactSheet(e.target.value)}
                  placeholder="Review and edit generated facts..."
                  disabled={appState === 'generating' || appState === 'finished'}
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

              {appState === 'verifying' && (
                <button 
                  className="mt-6 w-full bg-[#34c759] hover:bg-[#2eaa4d] active:scale-[0.98] text-white py-4 px-6 rounded-lg font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-green-900/20" 
                  onClick={handleGenerate}
                >
                  <Zap size={20}/> Confirm & Generate High-Quality Content
                </button>
              )}

              {appState === 'generating' && (
                <div className="mt-6 w-full bg-[#34c759]/30 text-[#34c759] py-4 px-6 rounded-lg font-bold flex items-center justify-center gap-2 border border-[#34c759]/50 animate-pulse">
                  <Loader2 size={20} className="animate-spin" /> Finalizing Assets...
                </div>
              )}
            </div>
          </div>

          {/* OUTPUT GALLERY */}
          {appState === 'finished' && results && (
            <section className="gallery-grid fade-in" style={{ marginTop: '2rem' }}>
              {[
                { title: 'Blog Post', content: results.blog_post },
                { title: 'Social Media Thread', content: results.social_thread },
                { title: 'Email Teaser', content: results.email_teaser }
              ].map((item, id) => (
                <div className="bento-card glass" key={id}>
                  <div className="bento-header">
                    <span className="bento-title">{item.title}</span>
                    <button className="copy-btn transition-all duration-200" onClick={() => copyToClipboard(item.content, id)}>
                      {copiedId === id ? (
                        <span className="flex items-center gap-1 text-green-500 text-sm font-medium animate-in fade-in zoom-in duration-300">
                          <CheckCircle size={16} /> Copied!
                        </span>
                      ) : (
                        <Copy size={18} className="transition-all hover:scale-110" />
                      )}
                    </button>
                  </div>
                  <div className="bento-content markdown-rendered prose prose-invert max-w-none">
                    <ReactMarkdown>
                      {formatContent(item.content)}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
            </section>
          )}

          {appState === 'finished' && (
            <div className="action-row" style={{ marginTop: '2.5rem' }}>
              <button 
                className="bg-transparent hover:bg-white/5 border border-white/20 text-white py-3 px-8 rounded-lg font-semibold transition-all flex items-center justify-center cursor-pointer" 
                onClick={() => { setAppState('idle'); setSourceInput(''); setFactSheet(''); setResults(null); }}
              >
                Start New Project
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
