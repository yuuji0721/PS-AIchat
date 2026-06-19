"use client";

export default function Header({ onOpenMap }: { onOpenMap: () => void }) {
  return (
    <header className="h-16 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-white">
      <h2 className="font-semibold text-sm md:text-base">Prop-Station 営業支援AI</h2>
      <button
        onClick={onOpenMap}
        className="border rounded-md px-3 py-1 text-xs md:text-sm hover:bg-gray-100 transition"
      >
        地図を開く
      </button>
    </header>
  );
}
