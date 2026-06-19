"use client";
import React, { useState, useEffect } from "react";

// メッセージ1件ずつの型
interface Message {
  role: "user" | "ai";
  content: string;
  time: string;
  sheetData?: any;
}

// チャット部屋（セッション）ごとの型
interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  tag?: string;
}

export default function Page() {
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [isQuickCommandOpen, setIsQuickCommandOpen] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(true);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalTag, setModalTag] = useState("");
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [activeSheetData, setActiveSheetData] = useState<any>(null);


  // =========================================
  // プロフィール用のState（★ 修正：tempUserImageを正しく追加しました）
  // =========================================
  const [userName, setUserName] = useState("鈴木 一郎");
  const [companyName, setCompanyName] = useState("株式会社プロップ住宅");
  const [departmentName, setDepartmentName] = useState("営業第一部");
  const [userImage, setUserImage] = useState("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80");
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);
  const [tempCompanyName, setTempCompanyName] = useState(companyName);
  const [tempDepartmentName, setTempDepartmentName] = useState(departmentName);
  const [tempUserImage, setTempUserImage] = useState(userImage); // ← ★ここを定義しました！
  
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "default-session",
      title: "新規チャット",
      messages: [
        { role: "ai", content: "新規チャットセッションを開始しました。営業用の調べ物（物件検索、重要事項説明の法令確認、地価・都市計画照会など）を入力してください。💻📁", time: "12:01" }
      ],
      tag: ""
    }
  ]);

  const [currentSessionId, setCurrentSessionId] = useState<string>("default-session");

  const currentSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = currentSession.messages;

  const [typedGreeting, setTypedGreeting] = useState("");
  const [greetingDone, setGreetingDone] = useState(false);
  const isNewChatState = messages.filter(m => m.role === "user").length === 0 && !isLoading;
  const fullGreeting = `こんにちは、${userName}さん`;

  useEffect(() => {
    if (!isNewChatState) { setTypedGreeting(""); setGreetingDone(false); return; }
    setTypedGreeting("");
    setGreetingDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTypedGreeting(fullGreeting.slice(0, i));
      if (i >= fullGreeting.length) { clearInterval(timer); setGreetingDone(true); }
    }, 80);
    return () => clearInterval(timer);
  }, [isNewChatState, fullGreeting]);

  const handleNewChat = (
    customTitle = "新規チャット", 
    customMessage = "新規チャットセッションを開始しました。営業用の調べ物（物件検索、重要事項説明の法令確認、地価・都市計画照会など）を入力してください。💻📁",
    customTag = ""
  ) => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: customTitle,
      messages: [{ role: "ai", content: customMessage, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }],
      tag: customTag
    };
    
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newId);
    
    if (!isHistoryOpen) setIsHistoryOpen(true);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const openEditModal = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setModalTitle(session.title);
    setModalTag(session.tag || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingSessionId) return;
    setSessions(prev => prev.map(s => s.id === editingSessionId ? { ...s, title: modalTitle.trim() || "無題のチャット", tag: modalTag.trim() } : s));
    setIsEditModalOpen(false);
    setEditingSessionId(null);
  };

  // プロフィールを保存する関数（★ 修正：画像も連動して保存）
  const handleSaveProfile = () => {
    setUserName(tempUserName);
    setCompanyName(tempCompanyName);
    setDepartmentName(tempDepartmentName);
    setUserImage(tempUserImage); // ← ★反映されるようにしました
    setIsProfileModalOpen(false);
  };

  // プロフィールモーダルを開く関数（★ 修正：現在の画像データをセット）
  const openProfileModal = () => {
    setTempUserName(userName);
    setTempCompanyName(companyName);
    setTempDepartmentName(departmentName);
    setTempUserImage(userImage); // ← ★セットされるようにしました
    setIsProfileModalOpen(true);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input;
    setInput("");
    setIsLoading(true);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const updatedMessages: Message[] = [...messages, { role: "user", content: userText, time: timeString }];
    const isFirstUserMessage = messages.filter(m => m.role === "user").length === 0;
    const newTitle = isFirstUserMessage ? (userText.length > 12 ? userText.slice(0, 12) + "..." : userText) : currentSession.title;

    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, title: newTitle, messages: updatedMessages } : s));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userText, history: updatedMessages }),
      });

      const data = await response.json();
      const aiReply = data.reply || "エラーが発生しました。";

      // ★ 変更：AIからのテキスト（reply）と、裏側の構造化データ（sheetData）を一緒にメッセージへ保存
      const finalMessages: any[] = [
        ...updatedMessages,
        { 
          role: "ai", 
          content: aiReply, 
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          sheetData: data.sheetData // ← ここで国交省やGISの解析データを記憶します
        }
      ];
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: finalMessages } : s));
    } catch (error) {
      setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: [...updatedMessages, { role: "ai", content: "通信に失敗しました。もう一度お試しください。", time: "" }] } : s));
    } finally {
      setIsLoading(false);
    }
  };
 

  const filteredSessions = sessions.filter(session => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    const matchTitle = session.title.toLowerCase().includes(query);
    const matchTag = session.tag ? session.tag.toLowerCase().includes(query) : false;
    return matchTitle || matchTag;
  });

  return (
    <div className="flex h-screen w-full bg-[#f4f7f9] text-gray-800 font-sans overflow-hidden">
      
      {/* =========================================
          サイドバー
      ========================================= */}
      <aside className={`
        fixed md:relative z-50 inset-y-0 left-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-300 ease-in-out overflow-hidden shrink-0
        ${isSidebarOpen ? "translate-x-0 w-[310px] shadow-2xl md:shadow-none" : "-translate-x-full w-0 md:translate-x-0 md:w-[72px] md:shadow-none"}
      `}>
        
        {isSidebarOpen ? (
          <>
        
        {/* ロゴエリア（左側にロゴ＆タイトル、右側に閉じるボタンを配置） */}
        <div className="h-[76px] pl-6 pr-3 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white">
          
          {/* 左側のかたまり：ロゴとテキスト */}
          <div className="flex items-center gap-3.5">
            <img src="/logo-only.webp" alt="Prop-Station" className="w-8 h-8 object-contain" />
            <div className="flex flex-col">
              <h1 className="font-bold text-[21px] tracking-tight leading-none">
                <span className="text-blue-600">Prop</span><span className="text-[#1a365d]">-Station</span>
              </h1>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100/50 px-2 py-0.5 rounded-md w-max mt-1 text-center">
                不動産専用AIchat
              </span>
            </div>
          </div>

          {/* 右側：閉じるボタン */}
          <button
            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
            title="サイドバーを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/><line x1="4" y1="4" x2="4" y2="20" strokeLinecap="round"/></svg>
          </button>
          
        </div>

            {/* メニューエリア */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col min-w-[310px] space-y-3.5 bg-white">
              <button
                onClick={() => handleNewChat()}
                className="w-full flex items-center gap-3 px-4 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm transition-all hover:bg-blue-100 shadow-sm shrink-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                </div>
                新規チャット
              </button>
              
              <div className="relative shrink-0">
                <span className="absolute left-4 top-3 text-gray-400 text-sm">🔍</span>
                <input 
                  type="text" 
                  placeholder="チャットを検索..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-blue-300 focus:bg-white transition-all placeholder-gray-400 text-gray-700" 
                />
              </div>

              <div className="flex flex-col">
                <div
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  className="border-b border-gray-100 pb-2 pt-1 flex items-center justify-between text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 cursor-pointer px-1 transition-colors group"
                >
                  <div className="flex items-center gap-2.5"><span>🛠️</span> ツール <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md ml-1">Recommend</span></div>
                  <span className={`text-[10px] text-gray-400/70 font-normal transition-transform duration-300 ${isToolsOpen ? "rotate-90" : ""}`}>＞</span>
                </div>
                <div className={`transition-all duration-300 overflow-hidden flex flex-col gap-1 ${isToolsOpen ? "max-h-[300px] mt-2 opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="group">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/50 border border-transparent text-gray-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60 text-left">
                      <span className="text-sm">📄</span> 物件資料の作成 <span className="text-[10px] font-normal text-gray-400/60">(Ver 1.2)</span>
                    </button>
                    <div className="max-h-0 overflow-hidden group-hover:max-h-10 transition-all duration-200 px-3">
                      <p className="text-[10px] text-amber-600 font-semibold py-1">Ver 1.2で実装予定です</p>
                    </div>
                  </div>
                  <div className="group">
                    <button className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/50 border border-transparent text-gray-400 rounded-xl font-bold text-xs cursor-not-allowed opacity-60 text-left">
                      <span className="text-sm">📖</span> ライブラリ <span className="text-[10px] font-normal text-gray-400/60">(Ver 1.2)</span>
                    </button>
                    <div className="max-h-0 overflow-hidden group-hover:max-h-10 transition-all duration-200 px-3">
                      <p className="text-[10px] text-amber-600 font-semibold py-1">Ver 1.2で実装予定です</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <div 
                  onClick={() => setIsQuickCommandOpen(!isQuickCommandOpen)}
                  className="border-b border-gray-100 pb-2 pt-1 flex items-center justify-between text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 cursor-pointer px-1 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <span>⚡</span> クイックコマンド
                  </div>
                  <span className={`text-[10px] text-gray-400/70 font-normal transition-transform duration-300 ${isQuickCommandOpen ? "rotate-90" : ""}`}>＞</span>
                </div>
                <div className={`transition-all duration-300 overflow-hidden flex flex-col gap-1 ${isQuickCommandOpen ? "max-h-[200px] mt-2 opacity-100" : "max-h-0 opacity-0"}`}>
                  <button onClick={() => handleNewChat("役所調査", "役所調査のサポートモードを起動しました。調査したい市区町村や、確認したい項目を教えてください。🏢", "役所調査")} className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/50 hover:bg-blue-50 border border-transparent hover:border-blue-100 text-gray-600 hover:text-blue-700 rounded-xl font-bold text-xs transition-all cursor-pointer text-left">
                    <span className="text-sm">🏢</span> 役所調査サポート
                  </button>
                  <button onClick={() => handleNewChat("地価検索", "地価検索モードを起動しました。調べたい土地の住所を入力してください。💴", "地価検索")} className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-gray-50/50 hover:bg-blue-50 border border-transparent hover:border-blue-100 text-gray-600 hover:text-blue-700 rounded-xl font-bold text-xs transition-all cursor-pointer text-left">
                    <span className="text-sm">💴</span> 周辺地価検索
                  </button>
                </div>
              </div>

              <div className="flex flex-col flex-1">
                <div onClick={() => setIsHistoryOpen(!isHistoryOpen)} className="border-b border-gray-100 pb-2 flex items-center justify-between text-xs sm:text-sm font-bold text-gray-400 hover:text-gray-600 cursor-pointer px-1 mb-2 transition-colors group">
                  <div className="flex items-center gap-2.5"><span>💬</span> チャット</div>
                  <span className={`text-[10px] text-gray-400/70 font-normal transition-transform duration-300 ${isHistoryOpen ? "rotate-90" : ""}`}>＞</span>
                </div>
                <div className={`transition-all duration-300 overflow-hidden flex-1 flex flex-col ${isHistoryOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="flex-1 overflow-y-auto space-y-1 max-h-[180px] md:max-h-none pr-1">
                    {filteredSessions.map((session) => (
                      <div key={session.id} onClick={() => { setCurrentSessionId(session.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm text-left font-medium transition-all group cursor-pointer ${session.id === currentSessionId ? "bg-gray-50 text-blue-700 font-semibold border border-gray-100" : "text-gray-600 hover:bg-gray-50/60"}`}>
                        <div className="flex items-center truncate flex-1 mr-2">
                          <div className="truncate flex-1 flex flex-col">
                            <span className="truncate">{session.title}</span>
                            {session.tag && <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100/50 px-1.5 py-0.2 rounded-md w-max mt-0.5 font-semibold">#{session.tag}</span>}
                          </div>
                        </div>
                        <button onClick={(e) => openEditModal(e, session)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0 shadow-xs border border-transparent hover:border-gray-100 cursor-pointer" title="タイトルとタグを編集">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </div>
                    ))}
                    {filteredSessions.length === 0 && <p className="text-[11px] text-gray-400 text-center py-4">該当チャットなし</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* トークン数 */}
            <div className="p-5 border-t border-gray-100 bg-white shrink-0">
              <div className="mb-2.5 flex items-center gap-2 text-xs font-bold text-gray-700">
                <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z"/></svg>
                本日の残りトークン数
              </div>
              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mb-1.5">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: "96.4%" }}></div>
              </div>
              <div className="flex justify-between text-[11px] text-gray-500 font-bold tracking-tight">
                <span>4,820 / 5,000</span>
                <span>96.4%</span>
              </div>
            </div>

            {/* ユーザー情報 */}
            <div className="p-5 border-t border-gray-100 bg-white shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded-full bg-blue-100 shrink-0 shadow-xs overflow-hidden border border-gray-100">
                    <img src={userImage} alt={userName} className="w-full h-full object-cover" />
                  </div>
                  <div className="overflow-hidden leading-tight flex flex-col">
                    <p className="text-sm font-extrabold text-gray-800 truncate">{userName}</p>
                    <p className="text-[10px] text-gray-400 font-bold mt-0.5 truncate">{departmentName}</p>
                    <p className="text-[10px] text-gray-400 font-bold truncate">{companyName}</p>
                  </div>
                </div>
                <button 
                  onClick={openProfileModal}
                  className="p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-lg transition-colors shrink-0 cursor-pointer"
                  title="アカウント設定"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* サイドバーが閉じている時（Gemini風アイコンバー） */
          <div className="flex flex-col h-full w-[72px] bg-white border-r border-gray-100 items-center py-4 justify-between">
            <div className="flex flex-col items-center gap-6 w-full">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                title="サイドバーを開く"
              >
                <img src="/logo-only.webp" alt="Prop-Station" className="w-7 h-7 object-contain" />
              </button>

              <div className="w-6 h-[1px] bg-gray-100"></div>

              <button 
                onClick={() => handleNewChat()}
                className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-all shadow-sm cursor-pointer"
                title="新規チャット"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"/></svg>
              </button>

              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-xl transition-all cursor-pointer"
                title="検索"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 w-full">
              <button 
                onClick={openProfileModal}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-blue-600 rounded-xl transition-all cursor-pointer"
                title="アカウント設定"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-10 h-10 rounded-full bg-blue-100 shadow-xs overflow-hidden border-2 border-transparent hover:border-blue-400 transition-all cursor-pointer"
                title="プロフィール"
              >
                <img src={userImage} alt={userName} className="w-full h-full object-cover" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* =========================================
          メインチャットエリア
      ========================================= */}
      {(() => {
        const isNewChat = messages.filter(m => m.role === "user").length === 0 && !isLoading;
        const greetingText = `こんにちは、${userName}さん`;
        return (
          <main className="flex-1 flex flex-col h-full relative min-w-0">

            {/* ヘッダー（新規チャット時は非表示） */}
            {!isNewChat && (
              <header className="h-[72px] bg-[#f4f7f9] border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-3">
                  {!isSidebarOpen && (
                    <button className="p-2 -ml-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors flex items-center justify-center cursor-pointer md:hidden" onClick={() => setIsSidebarOpen(true)}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
                    </button>
                  )}
                  <h2 className="font-bold text-gray-800 text-sm sm:text-base truncate">{currentSession.title}</h2>
                </div>
              </header>
            )}

            {isNewChat ? (
              /* ========== 新規チャット: 中央寄せUI ========== */
              <div className="flex-1 flex flex-col items-center justify-center px-4">
                <div className="flex flex-col items-center mb-10 space-y-4">
                  <img src="/logo.webp" alt="Prop-Station" className="w-20 h-20 object-contain" />
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800 tracking-tight">
                    {typedGreeting}<span className={`inline-block w-0.5 h-7 bg-blue-600 ml-1 align-middle ${greetingDone ? "hidden" : "animate-pulse"}`}></span>
                  </h2>
                  <p className={`text-sm text-gray-500 font-medium transition-opacity duration-500 ${greetingDone ? "opacity-100" : "opacity-0"}`}>営業に必要な調べ物、お手伝い致します！</p>
                </div>

                <div className={`w-full max-w-2xl space-y-3 transition-opacity duration-500 delay-300 ${greetingDone ? "opacity-100" : "opacity-0"}`}>
                  <div className="relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-lg p-2 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="お手伝いできることはありますか？（Enterキーで送信）"
                      className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-gray-800 placeholder-gray-400 text-sm md:text-base font-['Zen_Maru_Gothic',_'Hiragino_Maru_Gothic_ProN',_sans-serif]"
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all mr-1 shadow-sm ${!input.trim() ? "bg-[#1e3a8a] opacity-50 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800"}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                    </button>
                  </div>
                  <div className="w-full">
                    <p className="text-[11px] text-gray-400 font-semibold mb-2">⚡ クイックコマンド</p>
                    <div className="flex gap-2">
                      <button onClick={() => handleNewChat("役所調査", "役所調査のサポートモードを起動しました。調査したい市区町村や、確認したい項目を教えてください。🏢", "役所調査")} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer shadow-sm">🏢 役所調査サポート</button>
                      <button onClick={() => handleNewChat("地価検索", "地価検索モードを起動しました。調べたい土地の住所を入力してください。💴", "地価検索")} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all cursor-pointer shadow-sm">💴 周辺地価検索</button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ========== 継続チャット: 従来UI ========== */
              <>
                <div className="flex-1 overflow-y-auto px-4 py-8">
                  <div className="max-w-4xl mx-auto space-y-6">
                    {messages.map((msg, index) => (
                      <div key={index} className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1 overflow-hidden ${msg.role === "user" ? "bg-blue-100 border border-gray-200" : "bg-white border border-gray-200 text-blue-600"}`}>
                          {msg.role === "user" ? <img src={userImage} className="w-full h-full object-cover" /> : <img src="/logo.webp" className="w-5 h-5 object-contain" />}
                        </div>
                        <div className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"} max-w-[80%]`}>
                          <div className={`p-4 md:p-5 rounded-3xl shadow-sm text-sm md:text-base leading-relaxed whitespace-pre-wrap font-['Zen_Maru_Gothic',_sans-serif] ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none border border-blue-700" : "bg-white text-gray-800 rounded-tl-none border border-gray-100"}`}>
                            {msg.role === "ai"
                              ? msg.content.replace(/\*\*/g, "").replace(/^\s*[\*\-]\s+/gm, "・ ").replace(/#/g, "")
                              : msg.content}
                          </div>
                          {msg.role === "ai" && msg.sheetData && (
                            <button onClick={() => { setActiveSheetData(msg.sheetData); setIsSheetModalOpen(true); }} className="mt-2 flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-100 transition-all cursor-pointer">
                              📋 役所調査シートを見る
                            </button>
                          )}
                          <span className="text-xs text-gray-400 mt-2 mx-1">{msg.time}</span>
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="flex gap-4">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-1 bg-white border border-gray-200">
                          <img src="/logo.webp" className="w-5 h-5 object-contain" />
                        </div>
                        <div className="flex flex-col items-start max-w-[80%]">
                          <div className="p-3 md:p-4 rounded-3xl bg-white border border-gray-100 shadow-sm rounded-tl-none flex items-center gap-3">
                            <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span className="text-sm font-bold text-gray-500 animate-pulse font-['Zen_Maru_Gothic',_'Hiragino_Maru_Gothic_ProN',_sans-serif]">AI思考中...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 md:p-6 w-full">
                  <div className="max-w-4xl mx-auto">
                    <div className={`relative flex items-center bg-white rounded-2xl border border-gray-200 shadow-sm p-2 transition-all ${isLoading ? "opacity-50" : "focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"}`}>
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault();
                            handleSend();
                          }
                        }}
                        placeholder={isLoading ? "AIが考え中..." : "お手伝いできることはありますか？（Enterキーで送信）"}
                        disabled={isLoading}
                        className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-gray-800 placeholder-gray-400 text-sm md:text-base disabled:bg-transparent font-['Zen_Maru_Gothic',_'Hiragino_Maru_Gothic_ProN',_sans-serif]"
                      />
                      <button onClick={handleSend} disabled={isLoading || !input.trim()} className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-all mr-1 shadow-sm ${!input.trim() || isLoading ? "bg-[#1e3a8a] opacity-50 cursor-not-allowed" : "bg-blue-700 hover:bg-blue-800"}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        );
      })()}

      {/* =========================================
          プロフィール編集ポップアップ（Googleアカウント風：バグ修正済）
      ========================================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] w-full max-w-[420px] overflow-hidden shadow-2xl transform transition-all border border-gray-100">
            <div className="bg-gray-100/80 h-32 w-full relative flex items-start justify-end p-4">
               <button onClick={() => setIsProfileModalOpen(false)} className="bg-white/50 hover:bg-white p-2 rounded-full transition-colors backdrop-blur-sm cursor-pointer">
                 <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>

            <div className="px-8 pb-8 relative pt-24 flex flex-col items-center text-center">
              <div className="absolute -top-16 left-1/2 -translate-x-1/2 flex flex-col items-center">
                {/* ★ ここで呼び出している tempUserImage が正常に動作するようになりました */}
                <div className="w-[110px] h-[110px] rounded-full border-4 border-white overflow-hidden shadow-md relative group cursor-pointer bg-white">
                  <img src={tempUserImage} alt="Profile" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white transition-all">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  </div>
                </div>
                <div className="bg-black text-white text-[10px] tracking-wider font-bold px-3.5 py-1.5 rounded-full mt-2 shadow-lg border border-gray-800">
                  PRO プラン
                </div>
              </div>

              <h2 className="text-xl font-extrabold text-gray-900 mt-2">アカウント設定</h2>
              <p className="text-xs text-gray-500 mt-1 mb-6">随時、表示情報を更新します</p>

              <div className="w-full space-y-4 text-left">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">お名前</label>
                  <input type="text" value={tempUserName} onChange={(e) => setTempUserName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800" />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">会社名</label>
                  <input type="text" value={tempCompanyName} onChange={(e) => setTempCompanyName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">部署名</label>
                  <input type="text" value={tempDepartmentName} onChange={(e) => setTempDepartmentName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm font-semibold focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800" />
                </div>
              </div>

              <div className="flex gap-3 w-full mt-8">
                <button onClick={() => setIsProfileModalOpen(false)} className="flex-1 py-3.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-2xl transition-colors cursor-pointer">
                  キャンセル
                </button>
                <button onClick={handleSaveProfile} className="flex-1 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg shadow-blue-200 transition-all cursor-pointer">
                  保存して更新
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* チャット設定編集ポップアップ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-gray-100 transform transition-all">
            <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">✏️ チャット設定の編集</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">タイトル</label>
                <input type="text" value={modalTitle} onChange={(e) => setModalTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800" placeholder="タイトルを入力してください"/>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">タグ（検索用キーワード）</label>
                <input type="text" value={modalTag} onChange={(e) => setModalTag(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-gray-800" placeholder="例: 重要, 物件A, 住宅ローン"/>
                <p className="text-[10px] text-gray-400 mt-1">※設定した言葉を検索窓に入れるとヒットするようになります</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer">キャンセル</button>
              <button onClick={handleSaveEdit} className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-100 transition-all cursor-pointer">保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          ★ 修正版：役所調査シート ポップアップ（A4ゴシック・見切れ完全対策版）
      ========================================= */}
      {isSheetModalOpen && activeSheetData && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-0 md:p-6 backdrop-blur-xs print:absolute print:inset-0 print:bg-white print:p-0">
          
          {/* 💻 ブラウザの印刷エンジンに「ゴシック体」「A4縦」「上下余白」を強制する魔法のスタイル */}
          <style dangerouslySetInnerHTML={{__html: `
            @media print {
              html, body { background: #fff !important; color: #000 !important; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans JP", sans-serif !important; }
              @page { size: A4 portrait; margin: 15mm 12mm 15mm 12mm; }
              .print-no-break { page-break-inside: avoid; break-inside: avoid; }
            }
          `}} />

          <div className="bg-white rounded-none md:rounded-[24px] w-full h-full md:max-w-4xl md:h-[90vh] flex flex-col shadow-2xl overflow-hidden print:overflow-visible print:shadow-none print:rounded-none print:h-auto print:max-w-none print:absolute print:top-0 print:left-0">
            
            {/* ポップアップのヘッダー（印刷時は自動非表示） */}
            <div className="h-[72px] px-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <span className="text-xl">📋</span>
                <h3 className="font-extrabold text-gray-800 text-sm md:text-base">役所調査シート（調査・入力用テンプレート）</h3>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-100 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  🖨️ PDF出力 / 印刷
                </button>
                <button 
                  onClick={() => setIsSheetModalOpen(false)}
                  className="p-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>
            

            {/* 書類の中身（A4印刷に100%最適化したデザイン） */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-gray-900 bg-white print:overflow-visible print:p-0 font-serif selection:bg-transparent">
              
              {/* 書類タイトル */}
              <div className="text-center space-y-1 border-b-2 border-gray-800 pb-3">
                <h2 className="text-xl md:text-2xl font-black tracking-wider">役所調査シート（調査・入力用テンプレート）</h2>
                <div className="flex justify-between text-xs font-bold text-gray-500 pt-1">
                  <span>Prop-Station より出力</span>
                  <span>出力: Prop-Station - 株式会社TreyLink</span>
                </div>
              </div>

              {/* 1. 物件基本情報 */}
              <div className="space-y-2">
                <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">1. 物件基本情報</h4>
                <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                  <tbody>
                    <tr>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 w-1/6 font-bold">物件名</th>
                      <td className="border border-gray-400 p-2.5 w-2/6 font-semibold">{activeSheetData.objectInfo?.name || "ー"}</td>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 w-1/6 font-bold">調査日</th>
                      <td className="border border-gray-400 p-2.5 w-2/6 font-semibold">{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">担当者</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{userName}</td>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">住居表示</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.address || "ー"}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">地番</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.chiban || "ー"}</td>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">敷地面積</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.plotArea || "ーー"} ㎡</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">延床面積</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.floorArea || "ーー"} ㎡</td>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">建築年月</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.buildDate || "ー"}</td>
                    </tr>
                    <tr>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">階数</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">地上 {activeSheetData.objectInfo?.floors || "ー"} 階建</td>
                      <th className="border border-gray-400 bg-gray-50 p-2.5 font-bold">総戸数</th>
                      <td className="border border-gray-400 p-2.5 font-semibold">{activeSheetData.objectInfo?.totalUnits || "ーー"} 戸</td>
                    </tr>
                  </tbody>
                </table>
              </div>


              {/* 2. 都市計画・地域地区制限 */}
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">2. 都市計画・地域地区制限</h4>
                <div className="border border-gray-400 p-3 rounded-none text-xs space-y-3">
                  {/* 区域区分 */}
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="font-bold">［区域区分］：</span>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.areaClassification?.includes("市街化区域")} readOnly /> 市街化区域</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.areaClassification?.includes("市街化調整区域")} readOnly /> 市街化調整区域</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.areaClassification?.includes("非線引き")} readOnly /> 非線引き区域</label>
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span className="font-bold">［都市計画施設］：</span>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={!activeSheetData.urbanPlanning?.facilities || activeSheetData.urbanPlanning?.facilities?.includes("無")} readOnly /> 無</label>
                    <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.facilities && !activeSheetData.urbanPlanning?.facilities?.includes("無")} readOnly /> 有（状況：未完了 ・ 完了）</label>
                  </div>

                  {/* 都市計画道路 */}
                  <div className="bg-gray-50 p-2 border border-gray-200 space-y-1.5">
                    <div className="flex flex-wrap gap-x-4">
                      <span className="font-bold">［都市計画道路（1本目）］：</span>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.road?.includes("無") || !activeSheetData.urbanPlanning?.road} readOnly /> 無</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={activeSheetData.urbanPlanning?.road && !activeSheetData.urbanPlanning?.road?.includes("無")} readOnly /> 有 ➔ 位置：（敷地内・隣接・近隣）</label>
                    </div>
                    <div className="text-gray-600 pl-2">
                      名称・番号：<span className="underline font-bold px-1 text-gray-900">{activeSheetData.urbanPlanning?.road || "ーーー"}</span>
                    </div>
                  </div>

                  {/* 用途地域等の一覧テーブル */}
                  <table className="w-full border-collapse border border-gray-400 text-left mt-2">
                    <thead>
                      <tr className="bg-gray-50 text-center font-bold">
                        <th className="border border-gray-400 p-2 w-1/4">規制項目</th>
                        <th className="border border-gray-400 p-2 w-2/4">該当・詳細選択欄</th>
                        <th className="border border-gray-400 p-2 w-1/4">案内資料</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-400 p-2 font-bold bg-gray-50/30">用途地域</td>
                        <td className="border border-gray-400 p-2 font-extrabold text-blue-700">{activeSheetData.urbanPlanning?.useDistrict || "指定なし"}</td>
                        <td className="border border-gray-400 p-2 text-center text-gray-400">ー</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 p-2 font-bold bg-gray-50/30">防火規制</td>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.urbanPlanning?.fireProtection || "指定なし"}</td>
                        <td className="border border-gray-400 p-2 text-center text-gray-400">ー</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 p-2 font-bold bg-gray-50/30">高度地区</td>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.urbanPlanning?.heightDistrict || "無"}</td>
                        <td className="border border-gray-400 p-2 text-xs text-gray-500">［ ］取得 ［ ］無</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-400 p-2 font-bold bg-gray-50/30">地区計画</td>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.urbanPlanning?.districtPlan || "無"}</td>
                        <td className="border border-gray-400 p-2 text-xs text-gray-500">［ ］取得 ［ ］無</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. 建築基準法制限 */}
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">3. 建築基準法制限</h4>
                <div className="border border-gray-400 p-3 text-xs space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div><span className="font-bold">指定建ぺい率：</span> <span className="underline font-black text-sm px-2 text-blue-700">{activeSheetData.buildingRestrictions?.bcRatio || "ーー"}</span></div>
                    <div><span className="font-bold">指定容積率：</span> <span className="underline font-black text-sm px-2 text-blue-700">{activeSheetData.buildingRestrictions?.farRatio || "ーー"}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-100">
                    <div><span className="font-bold">絶対高さ制限：</span> <span className="font-semibold">{activeSheetData.buildingRestrictions?.heightLimit || "無"}</span></div>
                    <div><span className="font-bold">斜線制限：</span> <span className="font-semibold">{activeSheetData.buildingRestrictions?.slantLine || "通常制限"}</span></div>
                  </div>
                  <div className="pt-1 border-t border-gray-100">
                    <span className="font-bold">日影規制・外壁後退等：</span> <span className="font-semibold">{activeSheetData.buildingRestrictions?.shadow || "対象外または通常規制"}</span>
                  </div>
                  <div className="pt-2 bg-gray-50 p-2 text-gray-500 text-[11px] leading-tight">
                    ※角地緩和（+10%）および防火・耐火建築物による各種緩和措置、容積率不算入部分（地階・共用廊下等）については物件ごとの設計計画図書に基づき別途算定してください。
                  </div>
                </div>
              </div>

              {/* 4. 道路状況 ＆ 5. ハザード情報 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 print:grid-cols-2">
                {/* 道路状況 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">4. 道路状況（1本目）</h4>
                  <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                    <tbody>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold w-1/3">接面方位</th>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.roadInfo?.direction || "ーー"}</td>
                      </tr>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold">建基法種別</th>
                        <td className="border border-gray-400 p-2 font-semibold text-blue-700">{activeSheetData.roadInfo?.type || "調査要確認"}</td>
                      </tr>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold">幅員</th>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.roadInfo?.width || "ーー"} m</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* ハザード情報 */}
                <div className="space-y-2">
                  <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">5. 環境・ハザード情報</h4>
                  <table className="w-full border-collapse border border-gray-400 text-xs text-left">
                    <tbody>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold w-1/3">洪水ハザード</th>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.hazardInfo?.flood || "未確認"}</td>
                      </tr>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold">内水ハザード</th>
                        <td className="border border-gray-400 p-2 font-semibold">{activeSheetData.hazardInfo?.inlandFlood || "未確認"}</td>
                      </tr>
                      <tr>
                        <th className="border border-gray-400 bg-gray-50 p-2 font-bold">文化財・汚染</th>
                        <td className="border border-gray-400 p-2 text-[11px] font-semibold">
                          文化財：{activeSheetData.hazardInfo?.cultureProperty || "無"} / 汚染：{activeSheetData.hazardInfo?.pollution || "無"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 6. インフラ状況 */}
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-black border-l-4 border-gray-800 pl-2">6. インフラ状況（上下水道・飲用水）</h4>
                <div className="border border-gray-400 p-3 text-xs grid grid-cols-2 gap-4">
                  <div><span className="font-bold">［飲用水 区分］：</span> <span className="font-semibold text-blue-700">{activeSheetData.infrastructure?.water || "公営水道（想定）"}</span></div>
                  <div><span className="font-bold">［汚水・雑排水］：</span> <span className="font-semibold text-blue-700">{activeSheetData.infrastructure?.sewer || "公共下水（想定）"}</span></div>
                </div>
              </div>

              {/* 署名欄 */}
              <div className="pt-12 flex justify-end text-xs font-bold gap-8 print:pt-20">
                <div className="border-b border-gray-800 w-32 pb-1 text-center">調査員： {userName} 印</div>
                <div className="border-b border-gray-800 w-32 pb-1 text-center">確認印： ＿＿＿＿＿ 印</div>
              </div>

            </div>
          </div>
        </div>
      )}
      
    </div>
    
  );
}
