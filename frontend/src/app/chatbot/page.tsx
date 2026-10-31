  "use client";

  import Navbar from "@/components/Navbar";
  import ReactMarkdown from "react-markdown";
  import { useState, useEffect, useRef, useCallback, Suspense } from "react";
  import { useSearchParams, useRouter } from "next/navigation";
  import { 
    Plus, MessageSquare, Send, Bot, Menu, X, 
    User, Loader2, MoreVertical, Trash2, Pencil,
    ShieldCheck, Search, Pin, PinOff, Sparkles,
        AlertTriangle, Zap, Shield, Clock, Mic
  } from "lucide-react";

  interface Message {
    role: string;
    text: string;
    timestamp?: number;
  }

  interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    isPinned?: boolean;
    createdAt?: number;
    updatedAt?: number;
  }

  const STORAGE_KEY = "cyberguard_history";
  const STATS_KEY   = "cyberguard_topic_stats";

export default function ChatbotPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#020617] text-white">Memuat...</div>}>
      <ChatbotContent />
    </Suspense>
  );
}

function ChatbotContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();

    const [sessions,         setSessions]         = useState<ChatSession[]>([]);
    const [activeSessionId,  setActiveSessionId]  = useState<string>("");
    const [input,            setInput]            = useState("");
    const [isSidebarOpen,    setIsSidebarOpen]    = useState(true);
    const [isTyping,         setIsTyping]         = useState(false);
    const [editingId,        setEditingId]        = useState<string | null>(null);
    const [editTitle,        setEditTitle]        = useState("");
    const [openMenuId,       setOpenMenuId]       = useState<string | null>(null);
    const [deleteConfirmId,  setDeleteConfirmId]  = useState<string | null>(null);
    const [dynamicRecs,      setDynamicRecs]      = useState<string[]>([]);
    const [isInitialized,    setIsInitialized]    = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef       = useRef<HTMLInputElement>(null);
        const fileRef        = useRef<HTMLInputElement>(null);

    const defaultRecs = [
      "Apa itu Phishing?",
      "Cara mencegah Malware?",
      "Tips aman WiFi Publik",
      "Apa itu Social Engineering?",
      "Tips password yang kuat",
      "Apa itu Ransomware?",
      "Cara verifikasi link palsu",
      "Apa itu SIM Swap?",
    ];

    // ── Baca sessions dari localStorage ──────────────────
    const readSessions = useCallback((): ChatSession[] => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch { return []; }
    }, []);

    // ── Tulis sessions ke localStorage ───────────────────
 const writeSessions = useCallback(async (data: ChatSession[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("cyberguard_sync", { detail: data }));

  // Sync ke Supabase
  const saved = localStorage.getItem("user");
  if (!saved) return;
  const user = JSON.parse(saved);

  for (const session of data) {
  await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_email: user.email,
        session_id: session.id,
        title     : session.title,
        messages  : session.messages
      })
    });
  }
}, []);

    // ── Buat sesi baru ────────────────────────────────────
    const createNewChat = useCallback((autoActivate = true): ChatSession => {
      const saved = localStorage.getItem("user");
      const userName = saved ? (JSON.parse(saved).full_name || "Pengguna") : "Pengguna";

      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: "Chat Baru",
        isPinned: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [{
          role: "bot",
          text: `Halo ${userName}! Saya CyberGuard AI, asisten keamanan siber Anda. Silakan tanyakan apa saja seputar ancaman digital, phishing, malware, atau keamanan data Anda.`,
          timestamp: Date.now(),
        }],
      };

      setSessions(prev => {
        const updated = [newSession, ...prev];
        writeSessions(updated);
        return updated;
      });

      if (autoActivate) setActiveSessionId(newSession.id);
      return newSession;
    }, [writeSessions]);

    // ── Trending topics ───────────────────────────────────
    const updateTopicFrequency = useCallback((msg: string) => {
      const raw = localStorage.getItem(STATS_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      const map: Record<string, string> = {
        "phishing":  "Apa itu Phishing?",
        "malware":   "Cara mencegah Malware?",
        "wifi":      "Tips aman WiFi Publik",
        "social":    "Apa itu Social Engineering?",
        "password":  "Tips password yang kuat",
        "ransomware":"Apa itu Ransomware?",
        "link":      "Cara verifikasi link palsu",
        "sim":       "Apa itu SIM Swap?",
      };
      Object.keys(map).forEach(k => {
        if (msg.toLowerCase().includes(k)) stats[map[k]] = (stats[map[k]] || 0) + 1;
      });
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));

      const sorted = Object.entries(stats)
        .sort(([, a]: any, [, b]: any) => b - a)
        .map(([t]) => t);
      setDynamicRecs(Array.from(new Set([...sorted, ...defaultRecs])).slice(0, 10));
    }, []);

    const loadTrendingTopics = useCallback(() => {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) { setDynamicRecs(defaultRecs); return; }
      const stats = JSON.parse(raw);
      const sorted = Object.entries(stats)
        .sort(([, a]: any, [, b]: any) => b - a)
        .map(([t]) => t);
      setDynamicRecs(Array.from(new Set([...sorted, ...defaultRecs])).slice(0, 10));
    }, []);

    // ── INISIALISASI — baca localStorage & sync dari widget ──
    useEffect(() => {
      const existing = readSessions();
      const sessionFromWidget = searchParams.get("session");

      if (existing.length > 0) {
        setSessions(existing);
        // Jika widget mengirim session ID tertentu → aktifkan itu
        if (sessionFromWidget && existing.find(s => s.id === sessionFromWidget)) {
          setActiveSessionId(sessionFromWidget);
        } else {
          setActiveSessionId(existing[0].id);
        }
      } else {
        createNewChat(true);
      }

      loadTrendingTopics();
      setIsInitialized(true);

      // Bersihkan URL param setelah dibaca
      if (sessionFromWidget) {
        router.replace("/chatbot", { scroll: false });
      }
    }, []);

    // ── Dengarkan perubahan localStorage dari tab/widget lain ──
    useEffect(() => {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY && e.newValue) {
          try {
            const updated: ChatSession[] = JSON.parse(e.newValue);
            setSessions(updated);
          } catch {}
        }
      };
      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }, []);

    // ── Auto scroll ───────────────────────────────────────
    useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [sessions, isTyping]);

    // ── Simpan ke localStorage setiap kali sessions berubah ──
    useEffect(() => {
      if (isInitialized && sessions.length > 0) {
        writeSessions(sessions);
      }
    }, [sessions, isInitialized, writeSessions]);

    // ── Keyboard shortcut untuk delete confirm ────────────
    useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
        if (!deleteConfirmId) return;
        if (e.key === "Enter")  confirmDelete(deleteConfirmId);
        if (e.key === "Escape") setDeleteConfirmId(null);
      };
      window.addEventListener("keydown", handleKey);
      return () => window.removeEventListener("keydown", handleKey);
    }, [deleteConfirmId]);

    // ── Kirim pesan ───────────────────────────────────────
    const sendMessage = async (messageText: string) => {
      if (!messageText.trim() || !activeSessionId || isTyping) return;

      updateTopicFrequency(messageText);
      setIsTyping(true);

      const userMsg: Message = { role: "user", text: messageText, timestamp: Date.now() };
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() }
          : s
      ));

      try {
   const currentSession = sessions.find(s => s.id === activeSessionId);
      const history = (currentSession?.messages ?? []).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

   const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ message: messageText, chat_history: history }),
      });
    
        const data = await res.json();
        const reply = data.reply || data.response || "Maaf, tidak ada respons.";

        setSessions(prev => prev.map(s => {
          if (s.id !== activeSessionId) return s;
          const title = s.title === "Chat Baru"
            ? messageText.split(" ").slice(0, 5).join(" ")
            : s.title;
          return {
            ...s,
            title,
            updatedAt: Date.now(),
            messages: [...s.messages, { role: "bot", text: reply, timestamp: Date.now() }],
          };
        }));
      } catch {
        setSessions(prev => prev.map(s =>
          s.id === activeSessionId
            ? { ...s, messages: [...s.messages, { role: "bot", text: "⚠️ Tidak dapat terhubung ke server. Pastikan backend aktif.", timestamp: Date.now() }] }
            : s
        ));
      } finally {
        setIsTyping(false);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    };
    // ── Kirim file suara untuk diperiksa keasliannya ──────
    const sendVoice = async (file: File) => {
      if (!activeSessionId || isTyping) return;
      setIsTyping(true);

      // 1. Tampilkan pesan pengguna: "Periksa suara: nama_file"
      const userMsg: Message = { role: "user", text: `🎤 Periksa suara: ${file.name}`, timestamp: Date.now() };
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, messages: [...s.messages, userMsg], updatedAt: Date.now() }
          : s
      ));

      // 2. Kirim file ke backend, lalu susun kalimat balasan
      let reply = "";
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/voice/check`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          reply = `⚠️ ${data.detail || "Gagal memeriksa suara."}`;
        } else {
          const h = data.hasil;
          const kesimpulan = h.label === "asli"
            ? "Suara ini terindikasi ASLI (rekaman suara manusia)."
            : "Suara ini terindikasi SINTETIS (kemungkinan dihasilkan AI).";
          reply =
            `${kesimpulan}\n` +
            `Skor keaslian: ${Math.round(h.skor_asli * 100)}% ` +
            `(batas ${Math.round(h.ambang * 100)}%), dari ${h.jumlah_segmen} potongan suara.\n` +
            `${h.catatan}`;
        }
      } catch {
        reply = "⚠️ Tidak dapat terhubung ke server. Pastikan backend aktif.";
      }

      // 3. Tampilkan balasan bot
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, updatedAt: Date.now(), messages: [...s.messages, { role: "bot", text: reply, timestamp: Date.now() }] }
          : s
      ));
      setIsTyping(false);
    };

    const confirmDelete = (id: string) => {
      const filtered = sessions.filter(s => s.id !== id);
      setSessions(filtered);
      if (filtered.length === 0) {
        createNewChat(true);
      } else if (activeSessionId === id) {
        setActiveSessionId(filtered[0].id);
      }
      setDeleteConfirmId(null);
    };

    const saveRename = () => {
      if (!editingId) return;
      setSessions(prev => prev.map(s =>
        s.id === editingId ? { ...s, title: editTitle.trim() || s.title } : s
      ));
      setEditingId(null);
    };

    const activeSession = sessions.find(s => s.id === activeSessionId);
    const sortedSessions = [...sessions].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });

    const formatTime = (ts?: number) => {
      if (!ts) return "";
      return new Date(ts).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    };

    return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white font-sans overflow-hidden transition-colors duration-500">
        <Navbar />

        <div className="flex flex-1 overflow-hidden relative">

          {/* ── SIDEBAR ── */}
        <aside className={`${isSidebarOpen ? "w-72" : "w-0"} bg-white dark:bg-[#030b1a] border-r border-slate-200 dark:border-white/5 transition-all duration-300 overflow-hidden flex flex-col z-20 shrink-0`}>
            <div className="p-5 flex flex-col h-full">

              {/* New chat button */}
              <button
                onClick={() => createNewChat(true)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 mb-6 active:scale-95 transition-all text-[11px] tracking-widest uppercase shadow-lg shadow-blue-500/20 border border-blue-400/20"
              >
                <Plus size={16} strokeWidth={3} /> Chat Baru
              </button>

              {/* Session count */}
              <div className="flex items-center justify-between mb-3 px-1">
                <p className="text-[10px] font-black text-slate-500 dark:text-slate-600 uppercase tracking-[4px]">Riwayat Chat</p>
                <span className="text-[9px] font-black text-gray-600 bg-white/5 px-2 py-0.5 rounded-full">{sessions.length}</span>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                {sortedSessions.map((s) => (
                  <div key={s.id} className="relative group">
                    <div
                      onClick={() => { setActiveSessionId(s.id); setOpenMenuId(null); }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                        activeSessionId === s.id
    ? "bg-blue-50 dark:bg-blue-600/10 border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-400"
    : "border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.04] text-slate-500 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate flex-1 min-w-0">
                        {s.isPinned
                          ? <Pin size={12} className="text-blue-400 shrink-0" />
                          : <MessageSquare size={13} className="shrink-0 opacity-40" />
                        }
                        {editingId === s.id ? (
                          <input
                            autoFocus
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onBlur={saveRename}
                            onKeyDown={e => e.key === "Enter" && saveRename()}
                            className="bg-transparent border-b border-blue-500 outline-none text-white text-xs w-full"
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <span className="truncate text-xs font-bold">{s.title}</span>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded-lg shrink-0 ml-1 transition-opacity"
                      >
                        <MoreVertical size={13} />
                      </button>
                    </div>

                      {/* Context menu - Support Light Mode */}
  {openMenuId === s.id && (
    <div className="absolute right-2 top-10 w-44 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-[100] p-2 animate-in fade-in zoom-in duration-150">
            
                        <button
                          onClick={() => { setSessions(prev => { const u = prev.map(ses => ses.id === s.id ? { ...ses, isPinned: !ses.isPinned } : ses); writeSessions(u); return u; }); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-xs font-bold text-gray-300"
                        >
                          {s.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                          {s.isPinned ? "Lepas Pin" : "Sematkan"}
                        </button>
                        <button
                          onClick={() => { setEditingId(s.id); setEditTitle(s.title); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-xs font-bold text-gray-300"
                        >
                          <Pencil size={13} /> Ganti Nama
                        </button>
                        <div className="h-px bg-white/5 my-1 mx-1" />
                        <button
                          onClick={() => { setDeleteConfirmId(s.id); setOpenMenuId(null); }}
                          className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-xs font-bold text-red-400"
                        >
                          <Trash2 size={13} /> Hapus Chat
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Sidebar footer */}
            <div className="pt-5 mt-5 border-t border-slate-200 dark:border-white/5">
    <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-600 dark:bg-blue-500/10 border border-blue-400/20 shadow-lg shadow-blue-500/10 transition-all">
      <div className="w-2 h-2 bg-white dark:bg-blue-400 rounded-full animate-pulse shrink-0" />
      <span className="text-[10px] font-black uppercase tracking-[3px] text-white dark:text-blue-300">AI System Active</span>
    </div>
  </div>
            </div>
          </aside>

          {/* ── MAIN CHAT AREA ── */}
          <main className="flex-1 flex flex-col bg-transparent relative min-w-0" onClick={() => setOpenMenuId(null)}>

            {/* Header */}
        <header className="px-8 py-4 border-b border-slate-100 dark:border-white/5 flex items-center gap-4 bg-white/90 dark:bg-[#020617]/80 backdrop-blur-xl shrink-0 transition-all z-10">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-white/5 rounded-xl text-gray-500 transition-colors"
              >
                {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>

              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-blue-500/30">
    <Bot size={15} className="text-white" />
  </div>
  <span className="text-xs font-[1000] text-slate-900 dark:text-white uppercase tracking-[1px] truncate">
                  {activeSession?.title ?? "CyberGuard AI"}
                </span>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 shrink-0">
    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
    <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-[2px]">Online</span>
  </div>
            </header>

            {/* Messages */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-6 pb-6">
              {activeSession?.messages.length === 0 ? (
                /* Empty state */
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-3xl flex items-center justify-center mx-auto mb-5">
                      <Shield size={28} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-[1000] text-slate-900 dark:text-white uppercase tracking-tight mb-2">CyberGuard AI</h3>
  <p className="text-slate-600 dark:text-gray-500 text-sm leading-relaxed font-medium">Tanyakan apa saja seputar keamanan siber — phishing, malware, dan ancaman digital lainnya.</p>
                  </div>
                </div>
              ) : (
             <div className="max-w-3xl mx-auto pt-10 pb-4 space-y-6">
                  {activeSession?.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    >
                    {/* Avatar */}
  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 ${
    msg.role === "user"
      ? "bg-blue-600 shadow-lg shadow-blue-500/20"
      : "bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/20"
  }`}>
  {msg.role === "user" ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
  </div>

  {/* Bubble & Timestamp Container */}
  <div className={`flex flex-col gap-1 max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
    {/* Bubble */}
    <div 
  className={`px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed font-semibold shadow-sm transition-all ${
    msg.role === "user"
      ? "bg-blue-600 text-white rounded-tr-none shadow-blue-500/20"
: "bg-slate-100 dark:bg-[#0f1e35] border border-slate-200 dark:border-blue-500/20 text-slate-900 dark:text-slate-100 rounded-tl-none text-justify"
  }`}
    >
    
  {msg.role === "bot" ? <ReactMarkdown>{msg.text.replace(/\n/g, '\n\n')}</ReactMarkdown> : msg.text}
    </div>

    {/* Timestamp */}
    {msg.timestamp && (
      <span className="text-[10px] text-slate-500 dark:text-gray-600 font-bold flex items-center gap-1 uppercase tracking-tight">
        <Clock size={9} /> {formatTime(msg.timestamp)}
      </span>
    )}
  </div>
  </div>  
  ))} 
                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex gap-3 animate-in fade-in">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-md shadow-blue-500/20 flex items-center justify-center shrink-0">
    <Bot size={14} className="text-white" />
                      </div>
                    <div className="bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/8 px-5 py-4 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                        <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    </div>
                  )}
          <div ref={messagesEndRef} className="h-2" />
                </div>
              )}
            </div>

            {/* Input area */}
          <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-[#020617] shrink-0 transition-colors duration-500">
              <div className="max-w-3xl mx-auto space-y-3">

                {/* Quick suggestions */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2 ml-1">
                    <Sparkles size={10} className="text-blue-400 animate-pulse" />
                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-[3px]">Sering Ditanyakan</span>
                  </div>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {dynamicRecs.map((text, i) => (
                      <button
                        key={i}
                        onClick={() => !isTyping && sendMessage(text)}
                        disabled={isTyping}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/8 rounded-full text-[10px] font-bold text-slate-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500/40 transition-all disabled:opacity-30 whitespace-nowrap"
                      >
                        <Search size={12} className="shrink-0 text-blue-600 dark:text-blue-400" />{text}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <form
                  onSubmit={e => { e.preventDefault(); if (input.trim()) { sendMessage(input); setInput(""); } }}
                  className="relative"
                >
                <input
    ref={inputRef}
    value={input}
    onChange={e => setInput(e.target.value)}
    placeholder="Tanyakan seputar keamanan siber..."
 className="w-full bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 focus:border-blue-500/50 rounded-2xl pl-5 pr-14 py-3 text-[15px] font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-600 outline-none transition-all focus:bg-white dark:focus:bg-white/[0.08] shadow-inner"
  />

                  <input
                    ref={fileRef}
                    type="file"
                    accept=".wav,.mp3,.flac,.m4a,.ogg,.opus,audio/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) sendVoice(f);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isTyping}
                    title="Periksa keaslian suara"
                    className="absolute right-14 top-1/2 -translate-y-1/2 w-11 h-11 bg-slate-200 hover:bg-slate-300 dark:bg-white/5 dark:hover:bg-white/10 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                  >
                    <Mic size={16} />
                  </button>

                  <button
                    type="submit"
                    disabled={isTyping || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 bg-blue-600 hover:bg-blue-700 dark:hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(37,99,235,0.3)] dark:shadow-blue-500/20"
                  >
                    {isTyping ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-500 dark:text-slate-600 font-black uppercase tracking-wider">
    CyberGuard AI • Berbasis RAG • Trusted Intelligence Source
  </p>
              </div>
            </div>
          </main>
        </div>

        {/* ── DELETE CONFIRM MODAL ── */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#030712] border border-slate-200 dark:border-red-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center animate-in zoom-in duration-200">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-5" />
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Hapus Chat?</h3>
              <p className="text-gray-500 text-xs font-medium mb-7 leading-relaxed">
                Tindakan ini permanen dan tidak bisa dibatalkan. Tekan{" "}
                <kbd className="text-slate-700 dark:text-white bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd>{" "}
                untuk konfirmasi atau <kbd className="text-slate-700 dark:text-white bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd>untuk batal.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => confirmDelete(deleteConfirmId)}
                  className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                >
                  Hapus Sekarang
                </button>
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full bg-white/5 text-gray-400 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-white/5 hover:bg-white/10 transition-all"
                >
                  Batalkan
                </button>
              </div>
            </div>
          </div>
        )}

  <style jsx global>{`
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    
    .custom-scrollbar::-webkit-scrollbar { width: 5px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    
    /* Scrollbar dinamis: Abu-abu di mode terang, putih tipis di mode gelap */
    .custom-scrollbar::-webkit-scrollbar-thumb { 
      background: rgba(0,0,0,0.1); 
      border-radius: 20px; 
    }
    .dark .custom-scrollbar::-webkit-scrollbar-thumb { 
      background: rgba(255,255,255,0.05); 
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { 
      background: rgba(37,99,235,0.4); 
    }
.prose p, .prose li {
  margin-top: 0.25rem !important;
  margin-bottom: 0.25rem !important;
  text-align: left !important;
}
  `}</style>
      </div>
    );
  }
