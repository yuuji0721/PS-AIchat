"use client";

import { useState, KeyboardEvent } from "react";
import { PaperClipIcon, ArrowUpIcon } from "@heroicons/react/24/outline";

export default function ChatInput({
  onSend,
  isLoading,
}: {
  onSend: (text: string) => void;
  isLoading: boolean;
}) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim() || isLoading) return;
    onSend(text);
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend = text.trim().length > 0 && !isLoading;

  return (
    <div className="px-4 md:px-8 pb-5 pt-4 bg-white border-t border-gray-100 shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* 入力ボックス */}
        <div className="flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 bg-white shadow-sm focus-within:border-blue-400 focus-within:shadow-md transition-all min-h-[52px]">
          <PaperClipIcon className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLoading
                ? "AIが回答を生成中..."
                : "質問を入力してください（例：〇〇物件の公示地価とハザード情報を調べて）"
            }
            disabled={isLoading}
          />
          {/* 送信ボタン（タッチ領域 44px 確保） */}
          <button
            onClick={handleSubmit}
            disabled={!canSend}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all ${
              canSend
                ? "bg-blue-600 hover:bg-blue-700 shadow-md"
                : "bg-gray-200 cursor-not-allowed"
            }`}
            aria-label="送信"
          >
            <ArrowUpIcon className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* 免責フッター */}
        <p className="text-[11px] text-gray-400 mt-2.5 text-center leading-relaxed">
          ※ 社内セキュリティ制限（ガードレール）適用：顧客への直接公開の禁止、断定的な法的助言の制限、SSO認証対応。
        </p>
      </div>
    </div>
  );
}
