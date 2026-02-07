"use client";

import { Mic, MessageSquare } from "lucide-react";

interface InputToggleProps {
  mode: 'voice' | 'text';
  onToggle: (mode: 'voice' | 'text') => void;
  disabled?: boolean;
}

export function InputToggle({ mode, onToggle, disabled = false }: InputToggleProps) {
  const handleToggle = () => {
    if (disabled) return;
    onToggle(mode === 'voice' ? 'text' : 'voice');
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:scale-105 active:scale-95 cursor-pointer'
        }
        ${mode === 'voice' 
          ? 'bg-[#c75b3a] text-white border-[#c75b3a] shadow-md' 
          : 'bg-white text-[#4a4a4a] border-[#1a1a1a]/20 shadow-sm'
        }
      `}
    >
      {mode === 'voice' ? (
        <>
          <Mic className="w-4 h-4" />
          <span className="text-sm font-medium">Voice</span>
        </>
      ) : (
        <>
          <MessageSquare className="w-4 h-4" />
          <span className="text-sm font-medium">Text</span>
        </>
      )}
    </button>
  );
}