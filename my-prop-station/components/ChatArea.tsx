"use client";

import { ComputerDesktopIcon } from "@heroicons/react/24/outline";

export type Message = { role: string; content: string; time?: string };

function ChatMessage({ role, content, time }: Message) {
  if (role === "user") {
    return (
      <div className="flex justify-end mb-5">
        <div className="max-w-[78%] md:max-w-[60%] bg-blue-600 text-white px-5 py-3.5 rounded-2xl rounded-br-none shadow-md">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 mb-5">
      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm">
        <ComputerDesktopIcon className="text-white" style={{ width: "16px", height: "16px" }} />
      </div>
      <div className="flex-1 bg-white border border-gray-100 rounded-xl rounded-tl-none px-5 py-4 shadow">
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{content}</p>
        {time && (
          <p className="text-[11px] text-gray-400 mt-3 text-right">{time}</p>
        )}
      </div>
    </div>
  );
}

export default function ChatArea({
  messages,
  isLoading,
}: {
  messages: Message[];
  isLoading: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      {messages.map((m, i) => (
        <ChatMessage key={i} role={m.role} content={m.content} time={m.time} />
      ))}
      {isLoading && (
        <div className="flex gap-3 mb-5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm">
            <ComputerDesktopIcon className="text-white" style={{ width: "16px", height: "16px" }} />
          </div>
          <div className="bg-white border border-gray-100 rounded-xl rounded-tl-none px-5 py-4 shadow flex items-center gap-2.5 text-gray-500 text-sm">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            AIが調査中...
          </div>
        </div>
      )}
    </div>
  );
}
