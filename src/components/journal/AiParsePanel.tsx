import type React from 'react';
import { Sparkles, Cpu } from 'lucide-react';

interface AiParsePanelProps {
  aiTextInput: string;
  aiImgData: string | null;
  isAiParsing: boolean;
  onAiTextInputChange: (v: string) => void;
  onAiImgDataChange: (v: string | null) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}

/** AI 智能记账输入面板：一句话描述 + 成交截图，解析后回填父组件表单。 */
export default function AiParsePanel({
  aiTextInput,
  aiImgData,
  isAiParsing,
  onAiTextInputChange,
  onAiImgDataChange,
  onDragOver,
  onDrop,
  onImageSelect,
  onSubmit,
}: AiParsePanelProps) {
  return (
    <div className="mb-6 bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-transparent border border-emerald-500/20 p-5 rounded-2xl space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-500/15 p-1.5 rounded-lg text-emerald-400 border border-emerald-500/20 animate-pulse">
            <Sparkles size={16} />
          </div>
          <div>
            <span className="font-bold text-xs text-white font-sans">AI 智能辅助记账识单</span>
            <p className="text-[10px] text-slate-500 mt-0.5">
              支持输入一句话描述，或拖入/粘贴交易成交单、券商截图，由 AI 自动解析并填充下表。
            </p>
          </div>
        </div>

        {/* Engine feedback indicator */}
        <div className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded bg-black/40 border border-white/5 text-slate-400 flex items-center gap-1.5 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          当前引擎: <span className="text-emerald-400">{
            (localStorage.getItem('ai_default_provider') || 'gemini').toUpperCase()
          }</span>
        </div>
      </div>

      {/* Input panel row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Text input */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold block uppercase">一句话极速描述</label>
          <textarea
            rows={3}
            value={aiTextInput}
            onChange={(e) => onAiTextInputChange(e.target.value)}
            placeholder="例：今天以1.312元买入纳指ETF五千三百份，手续费0.2元，日期是2月19日。"
            className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-sans resize-none leading-relaxed"
          />
        </div>

        {/* Screenshot upload */}
        <div className="space-y-1.5">
          <label className="text-[10px] text-slate-400 font-semibold block uppercase">成交截图识别 (Drag or Paste)</label>
          <div
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => document.getElementById('ai_image_selector')?.click()}
            className={`border border-dashed rounded-xl h-[76px] flex flex-col items-center justify-center cursor-pointer transition-all ${
              aiImgData ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-white/10 hover:border-white/25 bg-black/20'
            }`}
          >
            <input
              id="ai_image_selector"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onImageSelect}
            />
            {aiImgData ? (
              <div className="flex items-center gap-3 px-4 w-full">
                <img src={aiImgData} className="w-10 h-10 object-cover rounded-lg border border-white/10" referrerPolicy="no-referrer" />
                <div className="text-left flex-1 truncate">
                  <span className="text-[10px] text-emerald-400 font-bold block font-sans">已成功载入成交截图</span>
                  <span className="text-[9px] text-slate-500 block truncate">点击或拖拽可重新上传</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAiImgDataChange(null); }}
                  className="text-[10px] font-bold text-slate-500 hover:text-red-400 shrink-0 bg-slate-800/40 px-2 py-1 rounded font-sans"
                >
                  清空图片
                </button>
              </div>
            ) : (
              <div className="text-center">
                <span className="text-[10px] text-slate-400 font-bold block font-sans">拖拽/粘贴或点击上传成交单截图</span>
                <span className="text-[9px] text-slate-600 block mt-0.5">支持主流券商交易完成状态图 (限20MB)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          disabled={isAiParsing || (!aiTextInput && !aiImgData)}
          onClick={onSubmit}
          className={`text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 ${
            (isAiParsing)
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : (!aiTextInput && !aiImgData)
                ? 'bg-white/5 text-slate-600 border border-white/10 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-900 active:scale-95 shadow-emerald-500/10 hover:shadow-emerald-500/20'
          }`}
        >
          {isAiParsing ? (
            <>
              <Cpu size={14} className="animate-spin text-emerald-400" />
              AI 正在提炼账单细节...
            </>
          ) : (
            <>
              <Cpu size={14} />
              AI 智能解析并自动填表
            </>
          )}
        </button>
      </div>
    </div>
  );
}
