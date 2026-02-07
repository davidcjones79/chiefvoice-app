"use client";

import { type ResponseFormat } from "@/lib/modes";

interface ResponseFormatToggleProps {
  format: ResponseFormat;
  onChange: (format: ResponseFormat) => void;
  disabled?: boolean;
}

const FORMAT_CONFIG: Record<ResponseFormat, { label: string; emoji: string; title: string }> = {
  default: { label: '', emoji: '—', title: 'Default length' },
  concise: { label: '', emoji: '⚡', title: 'Concise: brief responses' },
  detailed: { label: '', emoji: '📖', title: 'Detailed: thorough explanations' },
};

export function ResponseFormatToggle({ format, onChange, disabled = false }: ResponseFormatToggleProps) {
  // Cycle through formats: default -> concise -> detailed -> default
  const cycleFormat = () => {
    const formats: ResponseFormat[] = ['default', 'concise', 'detailed'];
    const currentIndex = formats.indexOf(format);
    const nextIndex = (currentIndex + 1) % formats.length;
    onChange(formats[nextIndex]);
  };

  const config = FORMAT_CONFIG[format];

  return (
    <button
      onClick={cycleFormat}
      disabled={disabled}
      title={config.title}
      className={`
        flex items-center justify-center
        w-9 h-9 rounded-full
        bg-white border border-[#1a1a1a]/20
        text-sm transition-all duration-200
        ${disabled 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:border-[#c75b3a]/30 hover:shadow-md cursor-pointer'
        }
        ${format !== 'default' ? 'ring-2 ring-[#c75b3a]/20' : ''}
      `}
    >
      <span className="text-base">{config.emoji}</span>
    </button>
  );
}
