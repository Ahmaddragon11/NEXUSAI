/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Settings, Trash2, Paperclip, Brain, X, Menu, Square, Plus, PanelLeftClose, PanelLeft, MessageSquare, ChevronDown } from 'lucide-react';
import { ChatMessage, MessageProps } from './components/ChatMessage';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ChatSession {
  id: string;
  title: string;
  messages: MessageProps[];
  updatedAt: number;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingEnabled, setThinkingEnabled] = useState(true);
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('deepseek-ai/deepseek-v4-flash');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load preferences from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('deepseek-chats');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) setCurrentSessionId(parsed[0].id);
      } catch (e) { console.error("Failed to parse chats", e); }
    }
    
    const savedKey = localStorage.getItem('deepseek-api-key') || '';
    const savedModel = localStorage.getItem('deepseek-model') || 'deepseek-ai/deepseek-r1';
    const savedDarkMode = localStorage.getItem('deepseek-dark-mode') === 'true';
    
    setApiKey(savedKey);
    setSelectedModel(savedModel);
    setIsDarkMode(savedDarkMode);
    
    if (savedDarkMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = (enabled: boolean) => {
    setIsDarkMode(enabled);
    localStorage.setItem('deepseek-dark-mode', String(enabled));
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const fetchModels = async () => {
    if (!apiKey) return;
    setModelsLoading(true);
    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });
      if (res.ok) {
        const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            setAvailableModels(data.data);
          }
      }
    } catch(e) {
      console.error("Failed to load models");
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (isSettingsOpen) fetchModels();
  }, [isSettingsOpen]);

  // Save to localStorage when sessions change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('deepseek-chats', JSON.stringify(sessions));
    } else {
      localStorage.removeItem('deepseek-chats');
    }
  }, [sessions]);

  const activeSession = sessions.find(s => s.id === currentSessionId);
  const messages = activeSession?.messages || [];

  const updateActiveSession = (newMessages: MessageProps[]) => {
    // Generate title from first user message if it's the first message
    let title = activeSession?.title || "New Chat";
    if (!activeSession?.title && newMessages.length > 0) {
      const firstUserMsg = newMessages.find(m => m.role === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.content.split('\n')[0].substring(0, 30) + "...";
      }
    }

    setSessions(prev => {
      if (prev.length === 0 || !currentSessionId) {
        const newId = Date.now().toString();
        setCurrentSessionId(newId);
        return [{ id: newId, title, messages: newMessages, updatedAt: Date.now() }];
      }
      return prev.map(s => s.id === currentSessionId ? { ...s, messages: newMessages, title, updatedAt: Date.now() } : s).sort((a, b) => b.updatedAt - a.updatedAt);
    });
  };

  const createNewChat = () => {
    if (isLoading) return;
    const newId = Date.now().toString();
    setSessions(prev => [{ id: newId, title: "New Chat", messages: [], updatedAt: Date.now() }, ...prev]);
    setCurrentSessionId(newId);
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (currentSessionId === id) {
        setCurrentSessionId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        setAttachedFiles(prev => [...prev, { name: file.name, content: text }]);
      } catch (err) {
        console.error("Failed to read file", err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    textareaRef.current?.focus();
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const triggerChat = async (contextMessages: MessageProps[]) => {
    setIsLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: contextMessages, 
          thinkingEnabled,
          apiKey,
          model: selectedModel
        }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let botMessage: MessageProps = { role: 'assistant', content: '', reasoning: '' };
      
      // Add empty bot message first
      updateActiveSession([...contextMessages, botMessage]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            botMessage = { 
              ...botMessage,
              reasoning: (botMessage.reasoning || '') + (data.reasoning || ''),
              content: (botMessage.content || '') + (data.content || '')
            };
            updateActiveSession([...contextMessages, botMessage]);
          } catch (e) {
            // ignore JSON parse errors for chunks that are split
          }
        }
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        console.log('Aborted generation');
      } else {
        console.error("Streaming error:", e);
        updateActiveSession([...contextMessages, { role: 'assistant', content: `**Error**: ${e.message || 'Could not connect'}` }]);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || isLoading) return;
    
    let finalInput = input.trim();
    if (attachedFiles.length > 0) {
      const filesContext = attachedFiles.map(f => `--- File: ${f.name} ---\n${f.content}\n--- End File ---`).join('\n\n');
      finalInput += `\n\n${filesContext}`;
    }

    const newMessages: MessageProps[] = [...messages, { role: 'user', content: finalInput }];
    updateActiveSession(newMessages);
    
    // Auto-generate title on first user message
    if (newMessages.length === 1) {
      fetch('/api/generate-title', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalInput, apiKey, model: selectedModel })
      }).then(r => r.json()).then(data => {
        if (data.title) {
          setSessions(prev => prev.map(s => s.id === currentSessionId ? {...s, title: data.title} : s));
        }
      }).catch(console.error);
    }
    
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setAttachedFiles([]);
    
    await triggerChat(newMessages);
  };

  const regenerateLast = () => {
    if (isLoading || messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant') {
      const previousMessages = messages.slice(0, -1);
      updateActiveSession(previousMessages);
      triggerChat(previousMessages);
    }
  };


  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear this chat?')) {
      if (currentSessionId) {
        setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [], title: 'New Chat' } : s));
      }
    }
  };

  return (
    <div className="flex h-screen bg-[#030712] overflow-hidden font-sans text-gray-200 relative selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Ambient Radial Blobs */}
      <div className="absolute top-0 left-0 w-[50vw] h-[50vw] bg-emerald-600/20 ambient-blob -translate-x-1/2 -translate-y-1/2 hidden md:block" />
      <div className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/20 ambient-blob translate-x-1/3 translate-y-1/3 hidden md:block" />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-20 md:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || (typeof window !== 'undefined' && window.innerWidth >= 768)) && (
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className={cn(
              "fixed md:static inset-y-0 left-0 z-30 w-72 glass-panel flex flex-col transition-transform transform border-r border-white/5",
              !sidebarOpen && "md:translate-x-0 -translate-x-full"
            )}
          >
            <div className="p-5">
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={createNewChat}
                className="flex items-center justify-center gap-2 w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 p-3.5 rounded-2xl transition-all font-medium border border-emerald-500/20 neon-glow"
              >
                <Plus size={18} />
                New Chat
              </motion.button>
            </div>
            
            <div className="flex-1 overflow-y-auto mt-2 px-3 pb-4 space-y-1.5 custom-scrollbar">
              {sessions.map(s => (
                <div 
                  key={s.id} 
                  onClick={() => { setCurrentSessionId(s.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                  className={cn(
                    "flex items-center group cursor-pointer gap-3 p-3.5 rounded-2xl transition-all relative overflow-hidden",
                    currentSessionId === s.id ? "bg-white/10 text-white font-medium" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  )}
                >
                  {currentSessionId === s.id && (
                    <motion.div layoutId="sidebar-active-indicator" className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-400 rounded-r-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  )}
                  <MessageSquare size={16} className={cn("shrink-0", currentSessionId === s.id ? "text-emerald-400" : "text-gray-500")} />
                  <div className="flex-1 truncate text-sm">{s.title}</div>
                  <button 
                    onClick={(e) => deleteSession(s.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-white/5">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-3 w-full p-3.5 rounded-2xl hover:bg-white/5 active:bg-white/10 transition-colors text-sm font-medium text-gray-300 hover:text-white"
              >
                <Settings size={18} />
                Settings
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-transparent relative min-w-0 z-10">
        
        {/* Header */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 liquid-glass border-b border-white/5 sticky top-0 z-10 transition-colors backdrop-blur-3xl">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
            >
              <Menu size={22} />
            </button>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden md:block p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
              {sidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeft size={22} />}
            </button>
            
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500 blur-md opacity-30 rounded-xl"></div>
                <div className="bg-emerald-500/10 p-2 rounded-xl hidden sm:block border border-emerald-500/20 relative z-10">
                  <Brain size={20} className="text-emerald-400" />
                </div>
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold font-display text-white tracking-wide">NEXUS<span className="text-emerald-400">AI</span></h1>
                <p className="text-[10px] text-emerald-400/80 font-mono uppercase tracking-widest hidden sm:block">Powered by NVIDIA NIM</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 md:gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs md:text-sm font-medium text-gray-300 hover:text-white transition-colors glass-panel px-3 py-1.5 md:px-4 md:py-2.5 rounded-xl hover:border-white/20 select-none">
              <div className={cn(
                "relative inline-flex h-4 w-7 md:h-5 md:w-9 items-center rounded-full transition-colors", 
                thinkingEnabled ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-white/10"
              )}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={thinkingEnabled}
                  onChange={(e) => setThinkingEnabled(e.target.checked)}
                />
                <span className={cn(
                  "inline-block h-3 w-3 md:h-3.5 md:w-3.5 transform rounded-full bg-white transition-transform duration-300",
                  thinkingEnabled ? "translate-x-3.5 md:translate-x-4" : "translate-x-0.5 md:translate-x-1"
                )} />
              </div>
              <span className="hidden sm:inline tracking-wide">Thinking Engine</span>
            </label>
            
            <button 
              onClick={clearChat}
              disabled={messages.length === 0}
              className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-xl border border-transparent hover:border-red-500/20 disabled:opacity-30 disabled:hover:bg-transparent"
              title="Clear Chat Messages"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar pt-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 md:p-8 space-y-6 md:space-y-8">
              <motion.div 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
                className="relative group mt-[-2rem] md:mt-0"
              >
                <div className="absolute inset-0 bg-emerald-500 rounded-[2rem] md:rounded-[2.5rem] blur-lg md:blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>
                <div className="p-6 md:p-8 liquid-glass rounded-[2rem] md:rounded-[2.5rem] relative flex items-center justify-center border-t-white/10 border-l-white/10 z-10">
                  <Brain size={48} className="md:w-16 md:h-16 text-emerald-400 max-w-full drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]" strokeWidth={1} />
                </div>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="max-w-xl space-y-3 md:space-y-4 px-2"
              >
                <h2 className="text-[1.75rem] leading-tight md:text-5xl font-bold font-display text-white tracking-tight">
                  Awaken the <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Nexus</span>
                </h2>
                <p className="text-[13px] md:text-lg text-gray-400 max-w-md mx-auto">
                  Harness the power of NVIDIA NIM AI models with advanced reasoning and context awareness.
                </p>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-w-2xl w-full mt-6 md:mt-8 px-2"
              >
                {['Write a python script to scrape a website', 'Explain quantum computing simply', 'Help me debug this react component', 'Plan a 3-day trip to Tokyo'].map((s, i) => (
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    key={i} 
                    onClick={() => setInput(s)} 
                    className="p-4 text-sm text-left glass-panel rounded-2xl text-gray-300 hover:text-white hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all shadow-lg group relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/0 via-emerald-500/5 to-emerald-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                    {s}
                  </motion.button>
                ))}
              </motion.div>
            </div>
          ) : (
            <div className="pb-8">
              {messages.map((m, i) => (
                <ChatMessage 
                  key={i} 
                  role={m.role} 
                  content={m.content} 
                  reasoning={m.reasoning} 
                  isLast={i === messages.length - 1}
                  onRegenerate={regenerateLast}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'user' && ( 
                <div className="flex w-full py-8 px-4 md:px-8">
                  <div className="max-w-4xl mx-auto flex w-full gap-4 md:gap-6">
                    <div className="flex-shrink-0 mt-1 relative">
                      <div className="absolute inset-0 bg-emerald-500 blur-sm opacity-50 rounded-full animate-pulse"></div>
                      <div className="relative w-10 h-10 rounded-full bg-emerald-900/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                        <Brain size={20} className="animate-pulse" />
                      </div>
                    </div>
                    <div className="flex-1 pt-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce shadow-[0_0_5px_rgba(16,185,129,0.6)]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce shadow-[0_0_5px_rgba(16,185,129,0.6)]" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce shadow-[0_0_5px_rgba(16,185,129,0.6)]" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        <div className="bg-transparent pt-3 pb-6 px-4 md:px-8 z-10">
          <div className="max-w-4xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                <AnimatePresence>
                  {attachedFiles.map((f, i) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: 10 }}
                      key={i} 
                      className="flex items-center gap-2 bg-emerald-900/30 text-emerald-200 text-xs font-medium px-3 py-1.5 rounded-xl border border-emerald-500/20 backdrop-blur-md"
                    >
                      <Paperclip size={14} className="text-emerald-400" />
                      <span className="max-w-[150px] truncate">{f.name}</span>
                      <button 
                        onClick={() => removeFile(i)}
                        className="hover:bg-emerald-800/50 p-1 rounded-full transition-colors ml-1"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            
            <div className="relative flex items-end gap-1 md:gap-2 liquid-glass rounded-[1.5rem] md:rounded-3xl p-1.5 md:p-3 focus-within:ring-2 focus-within:ring-emerald-500/30 focus-within:border-emerald-500/50 transition-all">
              <input 
                type="file" 
                multiple 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 md:p-3 text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl transition-colors flex-shrink-0"
                title="Attach Document"
              >
                <Paperclip size={20} className="md:w-[22px] md:h-[22px]" strokeWidth={2} />
              </motion.button>
              
              <textarea
                ref={textareaRef}
                className="flex-1 max-h-48 min-h-[48px] md:min-h-[56px] bg-transparent outline-none resize-none pt-3 pb-2.5 md:pt-4 md:pb-3 px-1 md:px-2 text-white placeholder:text-gray-500 text-sm md:text-base leading-relaxed"
                placeholder="Ask Nexus anything..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                rows={1}
              />
              
              {isLoading ? (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopGeneration} 
                  className="p-2.5 md:p-3 bg-red-500/20 text-red-400 rounded-xl md:rounded-2xl hover:bg-red-500/30 border border-red-500/20 transition-all flex-shrink-0 shadow-sm md:shadow-[0_0_15px_rgba(239,68,68,0.2)] mb-0.5 md:mb-1 mr-0.5 md:mr-1 flex items-center justify-center group"
                  title="Stop generating"
                >
                  <Square size={18} fill="currentColor" className="md:w-5 md:h-5 group-hover:scale-90 transition-transform" />
                </motion.button>
              ) : (
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={sendMessage} 
                  disabled={!input.trim() && attachedFiles.length === 0}
                  className="p-2.5 md:p-3 bg-emerald-500 text-gray-900 rounded-xl md:rounded-2xl hover:bg-emerald-400 transition-all flex-shrink-0 disabled:opacity-30 disabled:bg-white/10 disabled:text-gray-500 shadow-md md:shadow-[0_0_20px_rgba(16,185,129,0.4)] mb-0.5 md:mb-1 mr-0.5 md:mr-1 flex items-center justify-center group"
                >
                  <Send size={18} strokeWidth={2.5} className="md:w-5 md:h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </motion.button>
              )}
            </div>
            <div className="text-center mt-3 text-[11px] text-gray-500 tracking-wide">
              Nexus AI can make mistakes. Verify important information.
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
          >
              <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="liquid-glass w-full max-w-md shadow-2xl overflow-hidden rounded-[2rem] border-white/10"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h3 className="text-xl font-bold font-display text-white tracking-wide">Settings</h3>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-7 space-y-7">
                {/* Theme Toggle Omitted: We are enforcing dark liquid glass theme */}
                
                {/* API Key */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-200 block uppercase tracking-wider">NVIDIA API Key</label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      localStorage.setItem('deepseek-api-key', e.target.value);
                    }}
                    placeholder="Enter your API Key"
                    className="w-full px-5 py-3.5 glass-panel rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all text-white placeholder-gray-500"
                  />
                  <p className="text-xs text-gray-400">
                    Stored locally in browser. Leave blank for server default.
                  </p>
                </div>

                {/* Model Selection */}
                <div className="space-y-3">
                  <label className="text-sm font-semibold text-gray-200 block flex items-center justify-between uppercase tracking-wider">
                    AI Model
                    {modelsLoading && <span className="text-xs text-emerald-400 font-normal animate-pulse">Fetching...</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={selectedModel}
                      onChange={(e) => {
                        setSelectedModel(e.target.value);
                        localStorage.setItem('deepseek-model', e.target.value);
                      }}
                      className="appearance-none w-full px-5 py-3.5 glass-panel rounded-2xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-white [&>option]:bg-gray-900 transition-all font-mono"
                    >
                    {availableModels.length > 0 ? (
                      availableModels.map((m, index) => (
                        <option key={`${m.id}-${index}`} value={m.id}>{m.id}</option>
                      ))
                    ) : (
                      <>
                        <option value="deepseek-ai/deepseek-v4-flash">deepseek-ai/deepseek-v4-flash</option>
                        <option value="deepseek-ai/deepseek-r1">deepseek-ai/deepseek-r1</option>
                      </>
                    )}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-400">
                      <ChevronDown size={16} />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

