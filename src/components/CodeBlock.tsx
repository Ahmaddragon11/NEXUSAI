import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, Download, Play, Code, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';

interface CodeBlockProps {
  language: string;
  code: string;
  props?: any;
}

// Simple heuristic to guess filename extension based on language
const getExtension = (lang: string) => {
  const map: Record<string, string> = {
    python: 'py',
    javascript: 'js',
    typescript: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    html: 'html',
    css: 'css',
    json: 'json',
    bash: 'sh',
    shell: 'sh',
    markdown: 'md'
  };
  return map[lang.toLowerCase()] || 'txt';
};

export function CodeBlock({ language, code, props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'code' | 'preview'>('code');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lineCount = code.split('\n').length;
  const [isCollapsed, setIsCollapsed] = useState(lineCount > 15);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileName = () => {
    // Attempt to extract filename from code comment on first line
    const firstLine = code.split('\n')[0].trim();
    let name = `code-snippet.${getExtension(language)}`;
    if (firstLine.startsWith('//') || firstLine.startsWith('#') || firstLine.startsWith('<!--')) {
      const match = firstLine.match(/([a-zA-Z0-9_\-\.]+\.[a-zA-Z0-9]+)/);
      if (match) name = match[1];
    }
    return name;
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getFileName();
    a.click();
    URL.revokeObjectURL(url);
  };

  const isHtml = language?.toLowerCase() === 'html' || language?.toLowerCase() === 'xml';

  return (
    <div className={cn("rounded-2xl overflow-hidden my-5 border bg-black/40 backdrop-blur-md border-white/10 shadow-2xl transition-all", isFullscreen && "fixed inset-2 md:inset-8 z-[100] m-0 flex flex-col shadow-2xl liquid-glass")}>
      <div className="flex items-center justify-between px-5 py-3 bg-white/5 border-b border-white/10 text-gray-300 text-xs font-mono shrink-0 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-30"></div>
        <div className="flex items-center gap-4 relative z-10">
          <span className="font-semibold text-emerald-400 tracking-wider uppercase">{language}</span>
          {isHtml && (
            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/10">
              <button
                onClick={() => setView('code')}
                className={cn("px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors", view === 'code' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400')}
              >
                <Code size={12} /> Code
              </button>
              <button
                onClick={() => setView('preview')}
                className={cn("px-2.5 py-1 rounded-md flex items-center gap-1.5 transition-colors", view === 'preview' ? 'bg-white/20 text-white' : 'hover:bg-white/10 text-gray-400')}
              >
                <Play size={12} /> Preview
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 relative z-10">
          {lineCount > 15 && (
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors p-1.5 text-gray-400 hover:bg-white/10 rounded-lg"
              title={isCollapsed ? "Expand" : "Collapse"}
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          )}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors p-1.5 text-gray-400 hover:bg-white/10 rounded-lg"
            title={isFullscreen ? "Minimize" : "Maximize"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <div className="w-px h-4 bg-white/10 mx-1"></div>
          <button 
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors p-1.5 text-gray-400 hover:bg-white/10 rounded-lg"
            title="Copy code"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
          </button>
          <button 
            onClick={handleDownload}
            className="flex items-center gap-1.5 hover:text-emerald-400 transition-colors p-1.5 text-gray-400 hover:bg-white/10 rounded-lg"
            title="Download code"
          >
            <Download size={14} />
          </button>
        </div>
      </div>
      
      {view === 'code' ? (
        <div className={cn("overflow-auto transition-all duration-300", isCollapsed ? "max-h-[300px]" : "", isFullscreen ? "flex-1" : "")}>
          <SyntaxHighlighter
            {...props}
            style={vscDarkPlus as any}
            language={language}
            PreTag="div"
            customStyle={{ 
              margin: 0, 
              borderRadius: 0, 
              fontSize: '0.85rem', 
              background: 'transparent',
              padding: '1.5rem'
            }}
          >
            {String(code).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <div className={cn("bg-white overflow-hidden", isFullscreen ? "flex-1 flex" : "p-4 min-h-[300px]")}>
          <iframe 
            srcDoc={code} 
            className="w-full h-full border-0 rounded-b-lg" 
            title="HTML Preview"
            sandbox="allow-scripts allow-modals allow-forms allow-popups"
            style={isFullscreen ? {} : { minHeight: "350px" }}
          />
        </div>
      )}
    </div>
  );
}
