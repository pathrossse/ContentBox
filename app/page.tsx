"use client";

import { useState, useEffect, useRef } from 'react';
import { Bot, CheckCircle, FileText, AlertTriangle, Copy, Loader2, Edit3, Eye, Zap, History, X, Trash2, Download, Clock, ExternalLink, ChevronRight, ShieldCheck, HelpCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

type GUIState = 'idle' | 'analyzing' | 'verifying' | 'generating' | 'finished';

interface GenerationData {
  blog_post: string;
  social_thread: string | string[];
  email_teaser: string;
  qc_verified?: boolean;
  qc_feedback?: string;
}

interface Session {
  id: string;
  url: string;
  timestamp: string;
  title: string;
  factSheet: string;
  results: GenerationData | null;
  ambiguityFlags: string[];
  qc_verified?: boolean;
}

export default function Home() {
  const [appState, setAppState] = useState<GUIState>('idle');
  const [sourceInput, setSourceInput] = useState('');
  const [factSheet, setFactSheet] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [ambiguityFlags, setAmbiguityFlags] = useState<string[]>([]);
  const [results, setResults] = useState<GenerationData | null>(null);

  // HYDRATION: Load History & Active Session
  useEffect(() => {
    const storedHistory = localStorage.getItem('contentbox_history');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        setHistory(parsedHistory);

        // Check for active session restore (if < 24h)
        const activeSession = parsedHistory[0];
        if (activeSession) {
          const sessionDate = new Date(activeSession.timestamp).getTime();
          const now = new Date().getTime();
          if (now - sessionDate < 24 * 60 * 60 * 1000) {
            setFactSheet(activeSession.factSheet);
            setResults(activeSession.results);
            setAmbiguityFlags(activeSession.ambiguityFlags);
            setSourceInput(activeSession.url);
            setAppState(activeSession.results ? 'finished' : 'verifying');
          }
        }
      } catch (err) {
        console.error("Failed to hydrate session:", err);
      }
    }
  }, []);

  // PERSISTENCE: Auto-save on Complete
  const saveToHistory = (data: Partial<Session>) => {
    const newSession: Session = {
      id: Math.random().toString(36).substr(2, 9),
      url: sourceInput,
      timestamp: new Date().toISOString(),
      title: factSheet.split('\n')[0].replace(/#/g, '').trim().substring(0, 40) || 'Untitled Analysis',
      factSheet: factSheet,
      results: results,
      ambiguityFlags: ambiguityFlags,
      ...data
    };

    const updatedHistory = [newSession, ...history.filter(s => s.url !== sourceInput)].slice(0, 50);
    
    // Size check (4MB)
    const historyString = JSON.stringify(updatedHistory);
    if (historyString.length > 4 * 1024 * 1024) {
      alert("Storage limit reached! Please delete some old sessions to save new ones.");
      return;
    }

    setHistory(updatedHistory);
    localStorage.setItem('contentbox_history', historyString);
  };

  const systemInstructions = `You are an Expert Content Marketer. Use the provided high-density insights to generate authoritative content.
  STRICT RULE: Strictly follow the user-edited facts provided below. Ignore the initial scraped data if it contradicts this updated sheet. The provided insights are your SOLE source of truth.
  
  Output strict JSON:
  - blog_post: A deep, long-form SEO blog post in Markdown format. IMPORTANT: Use ONLY Markdown (##, ###, etc.) and NO HTML tags.
  - social_thread: An array of 5-10 virality-focused tweets. Angle 1: Hook/Problem. Middle: Deep Value. End: Result/Call-to-Action.
  - email_teaser: A CTR-focused teaser (50-150 words). Format: 1 sentence hook, followed by 3 bullet points of value, then a CTA. Include a "subject" field inside this object or as part of the text.
  - status: "complete"`;

  const formatContent = (content: any): string => {
    if (!content) return '';
    
    // Handle Arrays
    if (Array.isArray(content)) {
      return content.map(item => formatContent(item)).join('\n\n');
    }

    // Handle Objects
    if (typeof content === 'object' && content !== null) {
      // Concatenate all string values found in the object
      return Object.entries(content)
        .map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `**${label}**: ${formatContent(value)}`;
        })
        .join('\n\n');
    }

    // Handle Strings & Others
    if (typeof content === 'string') return content.replace(/\\n/g, '\n');
    return String(content);
  };

  function isValidUrl(input: string): boolean {
    const clean = input.replace(/^https?:\/\//, '').trim();
    return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}(\/.*)?$/.test(clean);
  }

  // STEP 1: Analyze & Extract Insights
  const handleAnalyze = async () => {
    if (!sourceInput.trim()) return;
    
    if (!isValidUrl(sourceInput)) {
      alert("Invalid input! Please enter a valid URL (e.g., google.com or https://apple.com)");
      return;
    }

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
        body: JSON.stringify({ fact_sheet: factSheet, instructions: systemInstructions })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Generation failed');
      
      setResults(data);
      setAppState('finished');
      saveToHistory({ results: data, timestamp: new Date().toISOString() });
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

  const handleStartNew = () => {
    setAppState('idle');
    setSourceInput('');
    setFactSheet('');
    setResults(null);
    setAmbiguityFlags([]);
    setIsHistoryOpen(false);
  };

  const loadSession = (session: Session) => {
    setSourceInput(session.url);
    setFactSheet(session.factSheet);
    setResults(session.results);
    setAmbiguityFlags(session.ambiguityFlags);
    setAppState(session.results ? 'finished' : 'verifying');
    setIsHistoryOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this session forever?")) {
      const updated = history.filter(s => s.id !== id);
      setHistory(updated);
      localStorage.setItem('contentbox_history', JSON.stringify(updated));
    }
  };

  const exportSession = (session: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contentbox-${session.id}.json`;
    a.click();
  };

  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] relative overflow-hidden flex flex-col items-center justify-start transition-all duration-700">
      {/* BACKGROUND DECORATIONS */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FFDE59]/10 rounded-full blur-[120px] animate-pulse pointer-events-none opacity-40" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#5856D6]/10 rounded-full blur-[150px] animate-pulse pointer-events-none opacity-30" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      {/* HEADER */}
      <header className="w-full flex justify-between items-center px-8 py-6 z-10">
        <div className="logo flex items-center gap-2 text-2xl font-black tracking-tighter">
          <div className="bg-[#FFDE59] p-1.5 rounded-lg shadow-[0_0_15px_rgba(255,222,89,0.3)]">
            <Bot size={28} className="text-black" />
          </div>
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">ContentBox</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-semibold text-white/50 transition-all"
          >
            <History size={14} /> History
          </button>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-white/50 tracking-widest uppercase">
            <div className="status-dot w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            System Status: Online
          </div>
        </div>
      </header>

      <main className={`relative z-10 w-full flex flex-col items-center flex-1 ${appState === 'idle' ? 'justify-center pb-32' : 'pt-12'}`}>
        
        {/* HERO SECTION - Only visible in IDLE */}
        {appState === 'idle' && (
          <div className="text-center mb-12 fade-in">
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight leading-[1.1] max-w-4xl mx-auto bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              Transform Content into <span className="text-[#FFDE59]">Engaging Posts</span>
            </h1>
            <p className="text-lg md:text-xl text-white/40 max-w-2xl mx-auto font-medium">
              Extract insights, automate creative generation, and scale your content factory in seconds.
            </p>
          </div>
        )}

        {/* INPUT SECTION */}
        <section className={`flex flex-col md:flex-row gap-4 w-full max-w-4xl mx-auto items-stretch md:items-center fade-in px-6 ${appState === 'idle' ? '' : 'mb-12'}`}>
          <div className="relative flex-1 group">
            <input 
              type="text" 
              className="input-field w-full rounded-2xl bg-white/5 border-white/10 focus:border-[#FFDE59] focus:ring-4 focus:ring-[#FFDE59]/10 transition-all py-4 px-6 text-lg outline-none" 
              placeholder="Paste a URL or raw text here..." 
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              disabled={appState !== 'idle'}
            />
          </div>
          <button 
            className={`w-full md:w-auto bg-gradient-to-br from-[#FFDE59] to-[#FFBD59] text-black border-none rounded-2xl py-4 px-10 font-bold text-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_10px_30px_rgba(255,222,89,0.2)] hover:shadow-[0_15px_40px_rgba(255,222,89,0.3)] hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed ${
              appState === 'analyzing' ? 'opacity-80 scale-95' : ''
            }`}
            onClick={handleAnalyze}
            disabled={appState !== 'idle' || !sourceInput.trim()}
          >
            {appState === 'analyzing' ? (
              <span className="flex items-center gap-2">
                <Loader2 size={24} className="animate-spin" /> Analyzing...
              </span>
            ) : (
              <>
                <Zap size={20} fill="currentColor" /> Analyze & Extract
              </>
            )}
          </button>
        </section>

      {/* VERIFICATION GATE - Phase 1 */}
      {(appState === 'verifying' || appState === 'generating' || appState === 'finished') && (
        <section className="fade-in">
          <div className="gate-container fade-in">
            <div className="gate-panel glass">
              <div className="bento-header">
                <h3 className="gate-title"><FileText size={18} /> Fact-Sheet Review</h3>
                <button 
                  className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Save & Preview' : 'Edit Facts'}
                </button>
              </div>
              
              {isEditing ? (
                <textarea 
                  className="md-editor w-full h-[400px] mt-4"
                  value={factSheet}
                  onChange={(e) => setFactSheet(e.target.value)}
                  placeholder="Review and refine the extracted facts here..."
                />
              ) : (
                <div className="md-editor mt-4 markdown-rendered overflow-y-auto h-[400px]">
                  <ReactMarkdown>{factSheet}</ReactMarkdown>
                </div>
              )}
            </div>
            
            {/* Ambiguity Flags */}
            <div className={`glass gate-panel warnings ${appState === 'finished' ? 'opacity-70 grayscale-[0.3]' : ''}`}>
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

          {/* ACTION ROW - This is the "Confirmation" step between review and final output */}
          {appState === 'verifying' && (
            <div className="action-row" style={{ marginTop: '2rem' }}>
              <button 
                className="bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] rounded-full py-4 px-12 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer" 
                onClick={handleGenerate}
              >
                <Zap size={20}/> Confirm & Generate
              </button>
            </div>
          )}

          {appState === 'generating' && (
            <div className="action-row" style={{ marginTop: '2rem' }}>
              <div className="bg-white text-black border-[3px] border-black translate-x-[2px] translate-y-[2px] rounded-full py-4 px-12 font-bold flex items-center justify-center gap-2 opacity-80 cursor-wait">
                <Loader2 size={20} className="animate-spin" /> Finalizing Assets...
              </div>
            </div>
          )}

          {/* OUTPUT GALLERY - Phase 2 */}
          {appState === 'finished' && results && (
            <section className="gallery-grid fade-in" style={{ marginTop: '2.5rem' }}>
              {[
                { title: 'Blog Post', content: results.blog_post },
                { title: 'Social Media Thread', content: results.social_thread },
                { title: 'Email Teaser', content: results.email_teaser }
              ].map((item, id) => (
                <div className="bento-card glass" key={id}>
                  <div className="bento-header">
                    <div className="flex items-center gap-2">
                      <span className="bento-title">{item.title}</span>
                      {results.qc_verified ? (
                        <div className="group relative">
                          <ShieldCheck size={18} className="text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)] cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-[#1a1a1a] border border-green-500/30 rounded text-[10px] text-green-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            Editor-in-Chief: Verified Accurate
                          </div>
                        </div>
                      ) : (
                        <div className="group relative">
                          <AlertTriangle size={18} className="text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)] cursor-help" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-[#1a1a1a] border border-amber-500/30 rounded text-[10px] text-amber-500 w-48 leading-tight opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                            <p className="font-bold mb-1">QC Warning:</p>
                            {results.qc_feedback || "Potential discrepancy detected. Manual check advised."}
                          </div>
                        </div>
                      )}
                    </div>
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

          {/* RESET ACTION */}
          {appState === 'finished' && (
            <div className="action-row" style={{ marginTop: '2.5rem' }}>
              <button 
                className="bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] rounded-full py-3 px-8 font-bold transition-all flex items-center justify-center cursor-pointer" 
                onClick={handleStartNew}
              >
                Start New Project
              </button>
            </div>
          )}
        </section>
      )}
      </main>

      {/* HISTORY SIDEBAR */}
      <aside 
        className={`fixed top-0 right-0 h-full w-[320px] bg-[#121212] border-l border-white/10 z-[100] transition-transform duration-300 ease-in-out shadow-[-10px_0_30px_rgba(0,0,0,0.5)] ${
          isHistoryOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-6 border-bottom border-white/10">
          <h2 className="text-lg font-bold flex items-center gap-2"><Clock size={20} className="text-[#FFDE59]" /> Recent Sessions</h2>
          <button onClick={() => setIsHistoryOpen(false)} className="text-white/40 hover:text-white transition-all"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto h-[calc(100%-80px)] p-4 space-y-4 custom-scrollbar">
          {history.length === 0 ? (
            <div className="text-center py-20 opacity-30 italic text-sm">No recent activity</div>
          ) : (
            history.map((session) => (
              <div 
                key={session.id} 
                className="group relative bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-4 transition-all cursor-pointer hover:border-[#FFDE59]/30"
                onClick={() => loadSession(session)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-[#FFDE59] uppercase tracking-widest">{getRelativeTime(session.timestamp)}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => exportSession(session, e)} title="Export JSON" className="text-white/40 hover:text-white"><Download size={14}/></button>
                    <button onClick={(e) => deleteSession(session.id, e)} title="Delete" className="text-white/40 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-white/90 line-clamp-1 mb-1">{session.title}</h4>
                <div className="flex items-center gap-1.5 text-[10px] text-white/30 truncate">
                  <ExternalLink size={10} /> {session.url}
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <ChevronRight size={14} className="text-white/20 group-hover:text-[#FFDE59] transition-all" />
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* OVERLAY */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] fade-in" 
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
    </div>
  );
}
