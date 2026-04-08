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
  const [isEditing, setIsEditing] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [ambiguityFlags, setAmbiguityFlags] = useState<string[]>([]);
  const [results, setResults] = useState<GenerationData | null>(null);

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
        body: JSON.stringify({ fact_sheet: factSheet, instructions: systemInstructions })
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
      <section className="flex flex-col md:flex-row gap-4 w-full max-w-4xl mx-auto items-stretch md:items-center fade-in mb-12">
        <input 
          type="text" 
          className="input-field w-full" 
          placeholder="Enter Source URL or Raw Text..." 
          value={sourceInput}
          onChange={(e) => setSourceInput(e.target.value)}
          disabled={appState !== 'idle'}
        />
        <button 
          className={`w-full md:w-auto bg-[#FFDE59] text-black border-[3px] border-black rounded-full py-3 px-8 font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
            appState === 'analyzing' 
              ? 'shadow-none translate-x-[2px] translate-y-[2px]' 
              : 'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]'
          }`}
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

          {/* RESET ACTION */}
          {appState === 'finished' && (
            <div className="action-row" style={{ marginTop: '2.5rem' }}>
              <button 
                className="bg-white text-black border-[3px] border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] rounded-full py-3 px-8 font-bold transition-all flex items-center justify-center cursor-pointer" 
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
