"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { 
  X, Send, Loader2, Plus, Trash2, Pencil, Pin, PinOff,
  History, ChevronLeft, Terminal, MessageSquare,
  Search, MoreVertical, AlertTriangle, Mic
} from "lucide-react";

interface Message  { role: string; text: string; }
interface ChatSession { id: string; title: string; messages: Message[]; isPinned?: boolean; }

const STORAGE_KEY = "cyberguard_history";
const SYNC_EVENT  = "cyberguard_sync"; // custom event untuk same-tab sync

// ── Helper: baca dari localStorage ────────────────────
function readStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

// ── Helper: tulis ke localStorage + broadcast ke semua listener ──
function writeStorage(data: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  // Kirim custom event agar komponen lain di tab YANG SAMA ikut update
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: data }));
}

export default function ChatWidget() {
  const pathname = usePathname();

  const [isOpen,           setIsOpen]           = useState(false);
  const [showHistory,      setShowHistory]       = useState(false);
  const [input,            setInput]             = useState("");
  const [isTyping,         setIsTyping]          = useState(false);
  const [sessions,         setSessions]          = useState<ChatSession[]>([]);
  const [activeId,         setActiveId]          = useState<string>("");
  const [dynamicRecs,      setDynamicRecs]       = useState<string[]>([]);
  const [editingId,        setEditingId]         = useState<string | null>(null);
  const [editTitle,        setEditTitle]         = useState("");
  const [openMenuId,       setOpenMenuId]        = useState<string | null>(null);
  const [deleteConfirmId,  setDeleteConfirmId]   = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);

  const defaultRecs = [
    "Apa itu Phishing?", "Cara mencegah Malware?",
    "Tips WiFi Publik",  "Social Engineering",
  ];

  // ── Muat data dari localStorage ─────────────────────
  const loadData = useCallback(() => {
    const data = readStorage();
    setSessions(data);
    setActiveId(prev => {
      if (prev && data.find(s => s.id === prev)) return prev;
      return data[0]?.id ?? "";
    });

    // Trending topics
    try {
      const raw = localStorage.getItem("cyberguard_topic_stats");
      if (raw) {
        const stats = JSON.parse(raw);
        const sorted = Object.entries(stats)
          .sort(([, a]: any, [, b]: any) => b - a)
          .map(([t]) => t);
        setDynamicRecs(Array.from(new Set([...sorted, ...defaultRecs])).slice(0, 8));
      } else {
        setDynamicRecs(defaultRecs);
      }
    } catch { setDynamicRecs(defaultRecs); }
  }, []);

  // ── Inisialisasi + pasang listener sync ──────────────
  useEffect(() => {
    const data = readStorage();
    if (data.length > 0) {
      setSessions(data);
      setActiveId(data[0].id);
    } else {
      // Buat sesi pertama tanpa perlu state sessions (avoid stale closure)
      const newSession: ChatSession = {
        id: Date.now().toString(),
        title: "Chat Baru",
        messages: [{ role: "bot", text: "Sesi Baru Aktif. Saya CyberGuard AI, ada yang bisa saya bantu?" }],
      };
      writeStorage([newSession]);
      setSessions([newSession]);
      setActiveId(newSession.id);
    }
    loadData();

    // cross-tab sync (storage event HANYA aktif di tab lain)
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadData();
    };

    // same-tab sync (custom event dari halaman chatbot atau widget sendiri)
    const handleSyncEvent = (e: Event) => {
      const detail = (e as CustomEvent<ChatSession[]>).detail;
      if (detail) {
         setTimeout(() => {
        setSessions(detail);
        setActiveId(prev => {
          if (prev && detail.find(s => s.id === prev)) return prev;
          return detail[0]?.id ?? "";
        });
         }, 0);
      }
    };

    window.addEventListener("storage",   handleStorageEvent);
    window.addEventListener(SYNC_EVENT,  handleSyncEvent);
    return () => {
      window.removeEventListener("storage",  handleStorageEvent);
      window.removeEventListener(SYNC_EVENT, handleSyncEvent);
    };
  }, [loadData]);

  // ── Auto scroll ──────────────────────────────────────
  useEffect(() => {
    if (isOpen) setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [sessions, isTyping, isOpen, activeId]);

  // ── Keyboard confirm delete ──────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!deleteConfirmId) return;
      if (e.key === "Enter")  confirmDelete(deleteConfirmId);
      if (e.key === "Escape") setDeleteConfirmId(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [deleteConfirmId, sessions]);

  // ── CRUD helpers ─────────────────────────────────────
  const createNewChat = useCallback(() => {
    const existing = readStorage();
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "Chat Baru",
      messages: [{ role: "bot", text: "Sesi Baru Aktif. Saya CyberGuard AI, ada yang bisa saya bantu?" }],
    };
    const updated = [newSession, ...existing];
    writeStorage(updated);
    setSessions(updated);
    setActiveId(newSession.id);
    setShowHistory(false);
  }, []);

  const togglePin = useCallback((id: string) => {
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, isPinned: !s.isPinned } : s);
      writeStorage(updated);
      return updated;
    });
    setOpenMenuId(null);
  }, []);

  const saveRename = useCallback(() => {
    if (!editingId) return;
    setSessions(prev => {
      const updated = prev.map(s => s.id === editingId ? { ...s, title: editTitle.trim() || s.title } : s);
      writeStorage(updated);
      return updated;
    });
    setEditingId(null);
  }, [editingId, editTitle]);

  const confirmDelete = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      writeStorage(filtered);
      if (filtered.length === 0) {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: "Chat Baru",
          messages: [{ role: "bot", text: "Sesi Baru Aktif. Saya CyberGuard AI, ada yang bisa saya bantu?" }],
        };
        const fresh = [newSession];
        writeStorage(fresh);
        setActiveId(newSession.id);
        setDeleteConfirmId(null);
        return fresh;
      }
      setActiveId(cur => {
        if (cur === id) return filtered[0].id;
        return cur;
      });
      return filtered;
    });
    setDeleteConfirmId(null);
  }, []);

  // ── Kirim pesan ──────────────────────────────────────
  const sendMessage = useCallback(async (msgText: string) => {
    if (!msgText.trim() || !activeId || isTyping) return;
    setIsTyping(true);

    const userMsg: Message = { role: "user", text: msgText };

    // Update stats
    try {
      const raw = localStorage.getItem("cyberguard_topic_stats");
      const stats = raw ? JSON.parse(raw) : {};
      const map: Record<string, string> = {
        "phishing": "Apa itu Phishing?", "malware": "Cara mencegah Malware?",
        "wifi": "Tips WiFi Publik",       "social": "Social Engineering",
      };
      Object.keys(map).forEach(k => {
        if (msgText.toLowerCase().includes(k)) stats[map[k]] = (stats[map[k]] || 0) + 1;
      });
      localStorage.setItem("cyberguard_topic_stats", JSON.stringify(stats));
    } catch {}

    // Tambah pesan user terlebih dahulu
    let latestSessions: ChatSession[] = [];
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeId ? { ...s, messages: [...s.messages, userMsg] } : s
      );
      writeStorage(updated);
      latestSessions = updated;
      return updated;
    });

    try {
  const currentSession = latestSessions.find(s => s.id === activeId);
      const history = (currentSession?.messages ?? []).map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msgText, chat_history: history }),
      });
      const data  = await res.json();
      const reply = data.reply || data.response || "Maaf, tidak ada respons.";

      setSessions(prev => {
        const updated = prev.map(s => {
          if (s.id !== activeId) return s;
          const title = s.title === "Chat Baru"
            ? msgText.split(" ").slice(0, 5).join(" ")
            : s.title;
          return { ...s, title, messages: [...s.messages, { role: "bot", text: reply }] };
        });
        writeStorage(updated);
        return updated;
      });
    } catch {
      setSessions(prev => {
        const updated = prev.map(s =>
          s.id === activeId
            ? { ...s, messages: [...s.messages, { role: "bot", text: "⚠️ Server tidak dapat dijangkau." }] }
            : s
        );
        writeStorage(updated);
        return updated;
      });
    } finally {
      setIsTyping(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [activeId, isTyping]);
  // ── Kirim file suara untuk diperiksa keasliannya ─────
  const sendVoice = useCallback(async (file: File) => {
    if (!activeId || isTyping) return;
    setIsTyping(true);

    // 1. Tampilkan pesan pengguna: "Periksa suara: nama_file"
    const userMsg: Message = { role: "user", text: `🎤 Periksa suara: ${file.name}` };
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeId ? { ...s, messages: [...s.messages, userMsg] } : s
      );
      writeStorage(updated);
      return updated;
    });

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
      reply = "⚠️ Server tidak dapat dijangkau.";
    }

    // 3. Tampilkan balasan bot
    setSessions(prev => {
      const updated = prev.map(s =>
        s.id === activeId
          ? { ...s, messages: [...s.messages, { role: "bot", text: reply }] }
          : s
      );
      writeStorage(updated);
      return updated;
    });
    setIsTyping(false);
  }, [activeId, isTyping]);

  const sortedSessions = [...sessions].sort((a, b) =>
    a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1
  );
  const activeSession = sessions.find(s => s.id === activeId);

  // Jangan tampilkan di halaman login/register dan halaman chatbot itu sendiri
  if (pathname === "/" || pathname === "/chatbot") return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end font-sans">

      {/* ── WIDGET PANEL ── */}
      {isOpen && (
        <div className="mb-6 w-[300px] md:w-[340px] h-[480px] bg-[#030712] rounded-[40px] shadow-[0_0_60px_rgba(0,0,0,0.7)] border border-white/10 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">

          {/* HEADER */}
          <div className="bg-blue-600 p-5 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 p-2 px-3 rounded-2xl transition-all border text-[10px] font-black uppercase tracking-widest ${showHistory ? "bg-white text-blue-600 border-white" : "bg-white/10 text-white border-white/20 hover:bg-white/20"}`}
              >
                {showHistory ? <ChevronLeft size={16} strokeWidth={3} /> : <History size={16} />}
                {showHistory ? "Back" : "Logs"}
              </button>
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain bg-white p-1 rounded-lg shadow-sm" />
              <p className="text-[12px] font-black uppercase tracking-tighter">CyberGuard AI</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition-all">
              <X size={20} strokeWidth={3} />
            </button>
          </div>

          <div className="flex-1 relative overflow-hidden flex flex-col">

            {/* ── PANEL HISTORY ── */}
            {showHistory && (
              <div className="absolute inset-0 bg-[#030712] z-40 flex flex-col animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="p-5 border-b border-white/5">
                  <button
                    onClick={createNewChat}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border border-blue-400/30 shadow-lg"
                  >
                    <Plus size={15} strokeWidth={3} /> Chat Baru
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar" onClick={() => setOpenMenuId(null)}>
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-[4px] px-2 mb-3">
                    {sessions.length} Sesi Tersimpan
                  </p>
                  {sortedSessions.map((s) => (
                    <div key={s.id} className="relative group">
                      <div
                        onClick={() => { setActiveId(s.id); setShowHistory(false); }}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${
                          activeId === s.id
                            ? "bg-blue-600/10 border-blue-500/40 text-blue-400"
                            : "border-white/5 text-gray-500 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate flex-1 min-w-0">
                          {s.isPinned
                            ? <Pin size={13} className="text-blue-400 shrink-0" />
                            : <Terminal size={13} className="shrink-0 opacity-40" />
                          }
                          {editingId === s.id ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={e => setEditTitle(e.target.value)}
                              onBlur={saveRename}
                              onKeyDown={e => e.key === "Enter" && saveRename()}
                              onClick={e => e.stopPropagation()}
                              className="bg-transparent border-b border-blue-500 outline-none w-full text-white text-xs"
                            />
                          ) : (
                            <span className="truncate text-xs font-bold">{s.title}</span>
                          )}
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === s.id ? null : s.id); }}
                          className="p-1.5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1"
                        >
                          <MoreVertical size={13} />
                        </button>
                      </div>

                      {/* Dropdown menu */}
                      {openMenuId === s.id && (
                        <div className="absolute right-2 top-12 w-40 bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl z-[60] p-2 animate-in fade-in zoom-in duration-150">
                          <button
                            onClick={() => togglePin(s.id)}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-gray-300"
                          >
                            {s.isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                            {s.isPinned ? "Lepas Pin" : "Sematkan"}
                          </button>
                          <button
                            onClick={() => { setEditingId(s.id); setEditTitle(s.title); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-gray-300"
                          >
                            <Pencil size={13} /> Rename
                          </button>
                          <div className="h-px bg-white/5 my-1 mx-1" />
                          <button
                            onClick={() => { setDeleteConfirmId(s.id); setOpenMenuId(null); }}
                            className="w-full flex items-center gap-3 p-2.5 hover:bg-red-500/10 rounded-xl text-[10px] font-black uppercase text-red-400"
                          >
                            <Trash2 size={13} /> Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── CHAT AREA ── */}
            <div
              className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar"
              onClick={() => setOpenMenuId(null)}
            >
              {activeSession?.messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}>
<div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm font-medium leading-relaxed whitespace-pre-line ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : "bg-white/[0.06] border border-white/8 text-gray-300 rounded-tl-none"
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-white/[0.06] border border-white/8 px-4 py-3 rounded-2xl rounded-tl-none flex gap-1.5 items-center">
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── INPUT + SUGGESTIONS ── */}
            <div className="p-4 bg-[#020617] border-t border-white/5 shrink-0">
              <div className="flex flex-col gap-3">
                {/* Suggestions */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {dynamicRecs.slice(0, 6).map((text, i) => (
                    <button
                      key={i}
                      onClick={() => !isTyping && sendMessage(text)}
                      disabled={isTyping}
                      className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.04] border border-white/8 rounded-full text-[9px] font-bold text-gray-400 hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-30 whitespace-nowrap"
                    >
                      <Search size={9} className="shrink-0" /> {text}
                    </button>
                  ))}
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
                    placeholder="Tanyakan teknis..."
                    className="w-full bg-white/[0.04] border border-white/10 focus:border-blue-500/50 rounded-2xl py-3.5 pl-4 pr-24 text-xs font-medium text-white placeholder-gray-600 outline-none transition-all focus:bg-white/[0.06]"
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
                    className="absolute right-12 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/5 hover:bg-white/10 text-blue-400 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                  >
                    <Mic size={14} />
                  </button>

                  <button
                    type="submit"
                    disabled={isTyping || !input.trim()}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
                  >
                    {isTyping
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Send size={14} />
                    }
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL HAPUS ── */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#030712] border border-red-500/20 w-full max-w-[300px] rounded-3xl p-8 shadow-2xl text-center animate-in zoom-in duration-200">
            <AlertTriangle size={36} className="text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">Hapus Chat?</h3>
            <p className="text-gray-500 text-xs font-medium mb-6 leading-relaxed">
              Data akan dihapus permanen. Tekan{" "}
              <kbd className="text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd> untuk konfirmasi.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={() => confirmDelete(deleteConfirmId)}
                className="w-full bg-red-600 hover:bg-red-500 text-white py-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
              >
                Hapus Sekarang
              </button>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="w-full bg-white/5 text-gray-500 py-3 rounded-2xl font-black uppercase text-[9px] border border-white/5 hover:bg-white/10 transition-all"
              >
                Batalkan (Esc)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FAB BUTTON ── */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => { setIsOpen(o => !o); setShowHistory(false); }}
          className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all border border-blue-400/30"
        >
         {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
        </button>
        {!isOpen && (
          <span className="text-[9px] font-black text-blue-400 tracking-[4px] bg-[#020617] px-3 py-1.5 rounded-xl border border-blue-500/20">
            TANYA AI
          </span>
        )}
      </div>

      <style jsx global>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
      `}</style>
    </div>
  );
}
