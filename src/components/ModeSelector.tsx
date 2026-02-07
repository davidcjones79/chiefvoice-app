"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X, Pencil } from "lucide-react";
import { MODE_CONFIG, type ConversationMode } from "@/lib/modes";

// Re-export for convenience
export type { ConversationMode };

// Storage keys
const CUSTOM_PROMPT_KEY = 'chief-custom-prompt';

interface ModeSelectorProps {
  mode: ConversationMode;
  onChange: (mode: ConversationMode) => void;
  disabled?: boolean;
  customPrompt?: string;
  onCustomPromptChange?: (prompt: string) => void;
}

export function ModeSelector({ 
  mode, 
  onChange, 
  disabled = false,
  customPrompt = '',
  onCustomPromptChange
}: ModeSelectorProps) {
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(customPrompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const currentMode = MODE_CONFIG[mode];

  // Load saved custom prompt on mount
  useEffect(() => {
    const saved = localStorage.getItem(CUSTOM_PROMPT_KEY);
    if (saved && onCustomPromptChange) {
      onCustomPromptChange(saved);
      setEditingPrompt(saved);
    }
  }, [onCustomPromptChange]);

  // Sync editing prompt when customPrompt changes
  useEffect(() => {
    setEditingPrompt(customPrompt);
  }, [customPrompt]);

  // Focus textarea when editor opens
  useEffect(() => {
    if (showCustomEditor && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showCustomEditor]);

  const handleModeChange = (newMode: ConversationMode) => {
    onChange(newMode);
    // Open custom editor when selecting custom mode
    if (newMode === 'custom') {
      setShowCustomEditor(true);
    }
  };

  const handleSaveCustomPrompt = () => {
    localStorage.setItem(CUSTOM_PROMPT_KEY, editingPrompt);
    if (onCustomPromptChange) {
      onCustomPromptChange(editingPrompt);
    }
    setShowCustomEditor(false);
  };

  const handleCancelEdit = () => {
    setEditingPrompt(customPrompt);
    setShowCustomEditor(false);
  };

  return (
    <>
      <div className="relative flex items-center gap-1">
        <select
          value={mode}
          onChange={(e) => handleModeChange(e.target.value as ConversationMode)}
          disabled={disabled}
          className={`
            appearance-none bg-white border border-[#1a1a1a]/20 rounded-full 
            pl-3 pr-8 py-2 text-sm font-medium text-[#4a4a4a]
            transition-all duration-200 cursor-pointer
            ${disabled 
              ? 'opacity-50 cursor-not-allowed' 
              : 'hover:border-[#c75b3a]/30 hover:shadow-md focus:border-[#c75b3a]/30 focus:shadow-md focus:outline-none'
            }
          `}
        >
          {Object.entries(MODE_CONFIG).map(([key, config]) => (
            <option key={key} value={key}>
              {config.emoji} {config.label}
            </option>
          ))}
        </select>
        
        {/* Custom dropdown arrow */}
        <ChevronDown 
          className={`
            absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4a4a4a]/50 pointer-events-none
            ${disabled ? 'opacity-50' : ''}
          `}
        />
        
        {/* Edit custom mode button */}
        {mode === 'custom' && !disabled && (
          <button
            onClick={() => setShowCustomEditor(true)}
            className="p-1.5 rounded-full bg-white border border-[#1a1a1a]/20 text-[#4a4a4a]/70 hover:text-[#c75b3a] hover:border-[#c75b3a]/30 transition-colors"
            title="Edit custom prompt"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        
        {/* Mode description tooltip */}
        {!disabled && (
          <div className="absolute top-full left-0 mt-1 text-xs text-[#1a1a1a]/40 whitespace-nowrap">
            {mode === 'custom' && customPrompt
              ? (customPrompt.length > 40 ? customPrompt.slice(0, 40) + '...' : customPrompt)
              : currentMode.description
            }
          </div>
        )}
      </div>

      {/* Custom prompt editor modal */}
      {showCustomEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-[#faf7f2] rounded-2xl shadow-xl border border-[#1a1a1a]/10 animate-scale-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]/10">
              <h2 className="text-lg font-display text-[#4a4a4a]">
                ✨ Custom Mode
              </h2>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 text-[#4a4a4a]/50 hover:text-[#4a4a4a] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              <label className="block text-sm font-medium text-[#4a4a4a] mb-2">
                Custom System Prompt
              </label>
              <textarea
                ref={textareaRef}
                value={editingPrompt}
                onChange={(e) => setEditingPrompt(e.target.value)}
                placeholder="Describe how you want the assistant to respond. For example: 'Act as a friendly fitness coach. Give motivational advice and practical workout tips.'"
                className="w-full h-40 px-4 py-3 text-sm rounded-xl border border-[#1a1a1a]/20 bg-white
                  placeholder:text-[#4a4a4a]/40 text-[#1a1a1a]
                  focus:outline-none focus:border-[#c75b3a]/50 focus:ring-2 focus:ring-[#c75b3a]/10
                  resize-none transition-all"
              />
              <p className="mt-2 text-xs text-[#4a4a4a]/50">
                This prompt will shape how the assistant responds to you.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-[#1a1a1a]/10">
              <button
                onClick={handleCancelEdit}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-full border border-[#1a1a1a]/20 text-[#4a4a4a] hover:bg-[#1a1a1a]/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCustomPrompt}
                disabled={!editingPrompt.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-full bg-gradient-to-b from-[#c75b3a] to-[#a04828] text-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
