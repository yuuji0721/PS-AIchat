"use client";

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// 最後に "default" をつけることが重要です
export default function MapModal({ isOpen, onClose }: MapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold">役所調査マップ</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">閉じる</button>
        </div>
        <div className="flex-1 bg-slate-100 m-4 rounded-lg flex items-center justify-center">
          <p className="text-gray-500">地図エリア</p>
        </div>
      </div>
    </div>
  );
}