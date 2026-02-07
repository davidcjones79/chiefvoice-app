"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Camera } from "lucide-react";
import { isNative, isIOS } from "@/lib/native";

export interface AttachedFile {
  file: File;
  preview: string; // base64 data URL for preview
  type: "image" | "document";
}

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachment?: AttachedFile) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function TextInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type your message..."
}: TextInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [attachment, setAttachment] = useState<AttachedFile | null>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((value.trim() || attachment) && !disabled) {
        handleSend();
      }
    }
  };

  const handleSend = () => {
    if ((value.trim() || attachment) && !disabled) {
      onSend(attachment || undefined);
      setAttachment(null); // Clear attachment after sending
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    const isImage = file.type.startsWith("image/");
    if (!isImage) {
      alert("Please select an image file (JPG, PNG, GIF, WebP)");
      return;
    }

    // Check file size (max 20MB for OpenAI)
    if (file.size > 20 * 1024 * 1024) {
      alert("File size must be less than 20MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const preview = event.target?.result as string;
      setAttachment({
        file,
        preview,
        type: "image",
      });
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleAttachClick = async () => {
    // On iOS native, we could use Capacitor Camera plugin
    // For now, use standard file input which works on both web and iOS WebView
    fileInputRef.current?.click();
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const canSend = (value.trim() || attachment) && !disabled;

  return (
    <div className="flex flex-col gap-3 px-5 pb-4 pb-safe-plus">
      {/* Attachment preview */}
      {attachment && (
        <div className="relative inline-flex items-start gap-2 p-2 bg-[var(--cream)] rounded-xl border border-[var(--border-color)]">
          <div className="relative">
            <img
              src={attachment.preview}
              alt="Attachment preview"
              className="w-20 h-20 object-cover rounded-lg"
            />
            <button
              onClick={removeAttachment}
              className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--foreground)] text-[var(--background)] rounded-full flex items-center justify-center shadow-md hover:bg-[var(--accent)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-xs text-[var(--foreground)]/60 truncate max-w-[150px]">
              {attachment.file.name}
            </span>
            <span className="text-xs text-[var(--foreground)]/40">
              {(attachment.file.size / 1024).toFixed(0)} KB
            </span>
          </div>
        </div>
      )}

      <div
        className={`
          relative flex items-end gap-2 p-3 rounded-2xl border bg-[var(--card-bg)] transition-all duration-200
          ${isFocused
            ? 'border-[var(--accent)]/30 shadow-md'
            : 'border-[var(--border-color)] shadow-sm'
          }
          ${disabled ? 'opacity-50' : ''}
        `}
      >
        {/* Attachment button */}
        <button
          onClick={handleAttachClick}
          disabled={disabled}
          className={`
            shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
            ${disabled
              ? 'text-[var(--foreground)]/20 cursor-not-allowed'
              : 'text-[var(--foreground)]/50 hover:text-[var(--accent)] hover:bg-[var(--accent)]/10 active:scale-95'
            }
          `}
          title="Attach image"
        >
          <Paperclip className="w-5 h-5" />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder={attachment ? "Add a message about this image..." : placeholder}
          rows={1}
          className="
            flex-1 resize-none border-none outline-none bg-transparent
            text-[var(--foreground)] placeholder-[var(--foreground)]/40
            min-h-[20px] max-h-[100px] leading-5
          "
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        />

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`
            shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
            ${canSend
              ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] hover:scale-105 active:scale-95 shadow-md cursor-pointer'
              : 'bg-[var(--foreground)]/10 text-[var(--foreground)]/30 cursor-not-allowed'
            }
          `}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {/* Hint text */}
      <p className="text-xs text-[var(--foreground)]/40 text-center">
        {attachment ? "Press Enter to send with image" : "Press Enter to send, Shift+Enter for new line"}
      </p>
    </div>
  );
}
