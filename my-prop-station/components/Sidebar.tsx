"use client";

import {
  PlusCircleIcon,
  DocumentTextIcon,
  BookOpenIcon,
  BoltIcon,
  ClockIcon,
  Cog6ToothIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";

const USED_TOKENS  = 4820;
const TOTAL_TOKENS = 5000;

function NavItem({
  icon: Icon,
  label,
  badge,
  hasChevron,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  hasChevron?: boolean;
}) {
  return (
    <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition text-left">
      <Icon className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="flex-1">{label}</span>
      {badge && <span className="text-[10px] text-gray-400 font-medium">{badge}</span>}
      {hasChevron && <ChevronRightIcon className="w-3.5 h-3.5 text-gray-300" />}
    </button>
  );
}

export default function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const usedPct = Math.round((USED_TOKENS / TOTAL_TOKENS) * 100);

  return (
    <aside
      style={{ width: "280px" }}
      className={`
        fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        md:relative md:translate-x-0 md:shrink-0
      `}
    >
      {/* ロゴ */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <ComputerDesktopIcon className="w-4.5 h-4.5 text-white" style={{ width: "18px", height: "18px" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-blue-900 leading-tight">Prop-Station</p>
            <p className="text-[10px] text-blue-500 font-medium">社内専用営業支援</p>
          </div>
        </div>
        <button className="md:hidden text-gray-400 hover:text-gray-600" onClick={onClose} aria-label="閉じる">
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* 新規作成ボタン */}
      <div className="px-3 mb-3">
        <button className="w-full flex items-center justify-center gap-2 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 text-sm font-semibold px-4 py-2 rounded-lg transition">
          <PlusCircleIcon className="w-4 h-4" />
          チャットの新規作成
        </button>
      </div>

      {/* 検索バー */}
      <div className="px-3 mb-3">
        <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-gray-50">
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 shrink-0" />
          <input
            className="flex-1 bg-transparent text-sm text-gray-600 placeholder-gray-400 outline-none"
            placeholder="チャットを検索..."
          />
        </div>
      </div>

      {/* ナビゲーション */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        <NavItem icon={DocumentTextIcon} label="物件資料の作成" />
        <NavItem icon={BookOpenIcon}     label="ライブラリ" badge="Ver 1.2" />
        <NavItem icon={BoltIcon}         label="クイックコマンド" hasChevron />
        <NavItem icon={ClockIcon}        label="過去のチャット履歴" hasChevron />
        <NavItem icon={Cog6ToothIcon}    label="設定" />

        {/* デモモードセレクト */}
        <div className="px-3 py-2">
          <select className="w-full border border-gray-200 rounded-lg text-sm text-gray-600 px-3 py-2 bg-white outline-none cursor-pointer">
            <option>デモモード</option>
            <option>通常モード</option>
          </select>
        </div>
      </nav>

      {/* フッター：トークン＋ユーザー */}
      <div className="px-4 pb-5 pt-3 border-t border-gray-100 space-y-3">
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1.5">本日の残りトークン数</p>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${usedPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{USED_TOKENS.toLocaleString()} / {TOTAL_TOKENS.toLocaleString()}</span>
            <span>{usedPct}%</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
            鈴
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">鈴木一郎</p>
            <p className="text-xs text-gray-400 truncate">営業第一部</p>
            <p className="text-xs text-gray-400 truncate">株式会社プロップ住宅</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
