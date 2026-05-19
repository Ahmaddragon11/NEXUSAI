import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ChevronDown, ChevronRight, Copy, Check, Bot, User, Brain, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';
import { CodeBlock } from './CodeBlock';
import { motion, AnimatePresence } from 'motion/react';

export interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  isLast?: boolean;
  onRegenerate?: () => void;
}

export function ChatMessage({ role, content, reasoning, isLast, onRegenerate }: MessageProps) {
  const isUser = role === 'user';
  const [showReasoning, setShowReasoning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex w-full py-6 px-4 md:px-8", isUser ? "" : "")}
    >
      <div className={cn("max-w-4xl mx-auto flex w-full gap-4 md:gap-6", isUser ? "flex-row-reverse" : "flex-row")}>
        <div className="flex-shrink-0 mt-1 relative">
          {isUser ? (
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-lg md:shadow-xl backdrop-blur-none sm:backdrop-blur-sm relative z-10">
              <User size={18} className="w-4 h-4 md:w-[18px] md:h-[18px]" />
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-emerald-500 blur-sm opacity-40 rounded-full"></div>
              <div className="relative w-8 h-8 md:w-10 md:h-10 rounded-full bg-emerald-900 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-md md:shadow-[0_0_15px_rgba(16,185,129,0.3)] z-10">
                <Bot size={18} className="w-4 h-4 md:w-[18px] md:h-[18px]" />
              </div>
            </>
          )}
        </div>
        
        <div className={cn("flex-1 space-y-3 md:space-y-4 min-w-0 max-w-[90%] md:max-w-[85%]", isUser ? "text-right" : "text-left")}>
          <div className={cn("inline-block p-3.5 md:p-5 rounded-2xl md:rounded-[2rem] text-left", isUser ? "bg-white/10 border border-white/20 text-gray-200 rounded-tr-sm" : "glass-bubble rounded-tl-sm w-full")}>
            {!isUser && (
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                <span className="font-bold text-emerald-400 text-sm tracking-widest uppercase font-display">Nexus AI</span>
                <div className="flex items-center gap-2">
                  {isLast && onRegenerate && (
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={onRegenerate}
                      className="text-gray-400 hover:text-emerald-400 bg-black/20 border border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl transition-all p-1.5 shadow-sm flex items-center gap-1.5 px-3"
                      title="Regenerate response"
                    >
                      <RefreshCw size={14} />
                      <span className="text-xs font-medium">Retry</span>
                    </motion.button>
                  )}
                  <motion.button 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="text-gray-400 hover:text-white bg-black/20 border border-white/5 hover:bg-white/10 rounded-xl transition-colors p-2 shadow-sm"
                    title="Copy message"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </motion.button>
                </div>
              </div>
            )}
            
            {reasoning && !isUser && (
              <div className="rounded-2xl border border-white/10 bg-black/40 overflow-hidden shadow-inner mb-4 transition-all hover:border-white/20">
                <button 
                  onClick={() => setShowReasoning(!showReasoning)}
                  className="flex items-center gap-3 w-full px-5 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors text-left font-medium"
                >
                  {showReasoning ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                  <Brain size={18} className="text-emerald-500" />
                  <span className="tracking-wide">Nexus Thought Process</span>
                </button>
                <AnimatePresence>
                  {showReasoning && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5"
                    >
                      <div className="p-5 text-[13px] text-gray-400 font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto bg-black/20 custom-scrollbar">
                        {reasoning}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="prose prose-invert prose-emerald max-w-none break-words leading-relaxed text-gray-200">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 decoration-emerald-500/30 underline-offset-4" />,
                  code({node, inline, className, children, ...props}: any) {
                    const match = /language-(\w+)/.exec(className || '');
                    return !inline && match ? (
                      <div className="my-4 rounded-xl overflow-hidden shadow-2xl border border-white/10">
                        <CodeBlock 
                          language={match[1]} 
                          code={String(children)} 
                          props={props} 
                        />
                      </div>
                    ) : (
                      <code {...props} className={cn("bg-black/30 text-emerald-300 px-1.5 py-0.5 rounded-lg text-[0.85em] font-mono border border-emerald-500/20", className)}>
                        {children}
                      </code>
                    )
                  }
                }}
              >
                {content || (reasoning ? '*Processing request...*' : '')}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
