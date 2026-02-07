"use client";

import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface RichTextProps {
  text: string;
}

// Language display names and colors
const LANGUAGE_CONFIG: Record<string, { name: string; color: string }> = {
  javascript: { name: "JavaScript", color: "#f7df1e" },
  js: { name: "JavaScript", color: "#f7df1e" },
  typescript: { name: "TypeScript", color: "#3178c6" },
  ts: { name: "TypeScript", color: "#3178c6" },
  python: { name: "Python", color: "#3776ab" },
  py: { name: "Python", color: "#3776ab" },
  bash: { name: "Bash", color: "#4eaa25" },
  sh: { name: "Shell", color: "#4eaa25" },
  shell: { name: "Shell", color: "#4eaa25" },
  sql: { name: "SQL", color: "#e38c00" },
  json: { name: "JSON", color: "#292929" },
  html: { name: "HTML", color: "#e34c26" },
  css: { name: "CSS", color: "#264de4" },
  rust: { name: "Rust", color: "#dea584" },
  go: { name: "Go", color: "#00add8" },
  java: { name: "Java", color: "#b07219" },
  cpp: { name: "C++", color: "#f34b7d" },
  c: { name: "C", color: "#555555" },
};

// Token types for syntax highlighting
type TokenType = 'keyword' | 'string' | 'number' | 'comment' | 'function' | 'operator' | 'variable' | 'plain';

interface Token {
  type: TokenType;
  content: string;
}

// Common keywords across languages
const KEYWORDS = new Set([
  // JavaScript/TypeScript
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
  'switch', 'case', 'break', 'continue', 'new', 'this', 'class', 'extends', 'import',
  'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw',
  'typeof', 'instanceof', 'in', 'of', 'true', 'false', 'null', 'undefined', 'void',
  // Python
  'def', 'class', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while',
  'return', 'yield', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass',
  'True', 'False', 'None', 'and', 'or', 'not', 'is', 'in', 'global', 'nonlocal',
  // SQL
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT', 'INTO', 'VALUES', 'UPDATE',
  'SET', 'DELETE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'GROUP', 'BY',
  'ORDER', 'ASC', 'DESC', 'LIMIT', 'OFFSET', 'CREATE', 'TABLE', 'ALTER', 'DROP',
  // Bash
  'if', 'then', 'else', 'elif', 'fi', 'for', 'do', 'done', 'while', 'until',
  'case', 'esac', 'function', 'return', 'exit', 'echo', 'cd', 'export', 'source',
]);

// Tokenize code for syntax highlighting
function tokenize(code: string, language?: string): Token[] {
  const tokens: Token[] = [];
  let remaining = code;
  
  while (remaining.length > 0) {
    // Single-line comment (// or #)
    const commentMatch = remaining.match(/^(\/\/.*|#.*)$/m);
    if (commentMatch && remaining.startsWith(commentMatch[1])) {
      tokens.push({ type: 'comment', content: commentMatch[1] });
      remaining = remaining.slice(commentMatch[1].length);
      continue;
    }
    
    // Multi-line comment /* */
    const multiCommentMatch = remaining.match(/^\/\*[\s\S]*?\*\//);
    if (multiCommentMatch) {
      tokens.push({ type: 'comment', content: multiCommentMatch[0] });
      remaining = remaining.slice(multiCommentMatch[0].length);
      continue;
    }
    
    // String (double or single quotes, backticks)
    const stringMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/);
    if (stringMatch) {
      tokens.push({ type: 'string', content: stringMatch[1] });
      remaining = remaining.slice(stringMatch[1].length);
      continue;
    }
    
    // Number
    const numberMatch = remaining.match(/^\b(\d+\.?\d*|0x[a-fA-F0-9]+)\b/);
    if (numberMatch) {
      tokens.push({ type: 'number', content: numberMatch[1] });
      remaining = remaining.slice(numberMatch[1].length);
      continue;
    }
    
    // Function call (word followed by parenthesis)
    const funcMatch = remaining.match(/^([a-zA-Z_]\w*)(\s*\()/);
    if (funcMatch && !KEYWORDS.has(funcMatch[1])) {
      tokens.push({ type: 'function', content: funcMatch[1] });
      tokens.push({ type: 'plain', content: funcMatch[2] });
      remaining = remaining.slice(funcMatch[0].length);
      continue;
    }
    
    // Keyword or identifier
    const wordMatch = remaining.match(/^[a-zA-Z_]\w*/);
    if (wordMatch) {
      const word = wordMatch[0];
      const type = KEYWORDS.has(word) ? 'keyword' : 'plain';
      tokens.push({ type, content: word });
      remaining = remaining.slice(word.length);
      continue;
    }
    
    // Operators
    const opMatch = remaining.match(/^(===|!==|==|!=|<=|>=|=>|&&|\|\||[+\-*/%=<>!&|^~?:])/);
    if (opMatch) {
      tokens.push({ type: 'operator', content: opMatch[1] });
      remaining = remaining.slice(opMatch[1].length);
      continue;
    }
    
    // Anything else (whitespace, punctuation, etc.)
    tokens.push({ type: 'plain', content: remaining[0] });
    remaining = remaining.slice(1);
  }
  
  return tokens;
}

// Render highlighted code
function HighlightedCode({ code, language }: { code: string; language?: string }) {
  const tokens = tokenize(code, language);

  return (
    <>
      {tokens.map((token, i) => {
        const colorClass = {
          keyword: 'text-[var(--accent)]', // rust/coral
          string: 'text-[#059669]',  // green
          number: 'text-[#d97706]',  // amber
          comment: 'text-[var(--foreground)]/40 italic',
          function: 'text-[#7c3aed]', // purple
          operator: 'text-[var(--foreground)]/60',
          variable: 'text-[var(--foreground)]/80',
          plain: 'text-[var(--foreground)]/80',
        }[token.type];

        return (
          <span key={i} className={colorClass}>
            {token.content}
          </span>
        );
      })}
    </>
  );
}

// Code block component with syntax highlighting and copy button
function CodeBlock({ code, language }: { code: string; language?: string }) {
  const langConfig = language ? LANGUAGE_CONFIG[language.toLowerCase()] : null;
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  return (
    <div className="group my-3 rounded-xl border border-[var(--border-color)] bg-[var(--foreground)]/[0.03] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border-color-light)] bg-[var(--foreground)]/[0.02]">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--foreground)]/40">
          {langConfig?.name || language || 'code'}
        </span>
        <div className="flex items-center gap-2">
          {langConfig && (
            <span
              className="w-2 h-2 rounded-full opacity-60"
              style={{ backgroundColor: langConfig.color }}
            />
          )}
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-[var(--hover-bg)] text-[var(--foreground)]/40 hover:text-[var(--foreground)]/70"
            title="Copy code"
          >
            {copied ? (
              <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <pre className="px-3 py-2.5 overflow-x-auto">
        <code className="text-xs font-mono whitespace-pre-wrap break-words">
          <HighlightedCode code={code} language={language} />
        </code>
      </pre>
    </div>
  );
}

/**
 * Auto-detect and convert common patterns to rich format markers
 */
function autoFormatPatterns(text: string): string {
  let result = text;
  
  // Convert numbered lists to bullet points: "1. item" or "1) item"
  result = result.replace(/^(\d+)[.)]\s+/gm, '- ');
  
  // Convert "urgent:", "warning:", "important:", "alert:" to alert banner
  result = result.replace(/^(urgent|warning|important|alert):\s*/gim, '⚠️ ');
  
  // Convert "done:", "completed:", "success:" to success banner
  result = result.replace(/^(done|completed|success|confirmed):\s*/gim, '✅ ');
  
  // Convert "note:" or "info:" to a subtle format
  result = result.replace(/^(note|info|fyi):\s*/gim, '💡 ');
  
  // Convert "task:" or "todo:" to checkbox
  result = result.replace(/^(task|todo|action item):\s*/gim, '[ ] ');
  
  // Convert calendar-like patterns: "Meeting at 3pm" or "Call at 10:30 AM"
  result = result.replace(/^(meeting|call|appointment|event|scheduled)([^:\n]*(?:at|@)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?[^:\n]*)/gim, '📅 $1$2');
  
  // Convert email mentions: "Email from John" or "Message from Sarah"
  result = result.replace(/^(email|message|mail)\s+(from|to)\s+/gim, '📧 $1 $2 ');
  
  // Convert "overdue:" to alert
  result = result.replace(/^overdue:\s*/gim, '⚠️ Overdue: ');
  
  // Convert triple dash or asterisk to section break
  result = result.replace(/^(---|\*\*\*)\s*$/gm, '');
  
  return result;
}

// Parse and render rich text with formatting
export function RichText({ text }: RichTextProps) {
  // First apply auto-formatting
  const formattedText = autoFormatPatterns(text);
  const elements: ReactNode[] = [];
  let key = 0;

  // First, extract code blocks (fenced with ```)
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const segments: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  let lastIndex = 0;
  let match;
  
  while ((match = codeBlockRegex.exec(formattedText)) !== null) {
    // Add text before this code block
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: formattedText.slice(lastIndex, match.index) });
    }
    // Add the code block
    segments.push({ type: 'code', content: match[2].trim(), language: match[1] || undefined });
    lastIndex = match.index + match[0].length;
  }
  // Add remaining text
  if (lastIndex < formattedText.length) {
    segments.push({ type: 'text', content: formattedText.slice(lastIndex) });
  }

  // If no code blocks found, process as single text segment
  if (segments.length === 0) {
    segments.push({ type: 'text', content: formattedText });
  }

  // Process each segment
  for (const segment of segments) {
    if (segment.type === 'code') {
      elements.push(
        <CodeBlock key={key++} code={segment.content} language={segment.language} />
      );
      continue;
    }
    
    // Process text segment line by line
    const lines = segment.content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Alert banner: [!] or ⚠️ at start
    if (line.startsWith('[!]') || line.startsWith('⚠️')) {
      elements.push(
        <div key={key++} className="my-2 px-3 py-2 bg-[var(--accent)]/10 border-l-4 border-[var(--accent)] rounded-r-lg text-[var(--accent)] text-sm">
          {parseInlineFormatting(line.replace(/^\[!\]\s*|^⚠️\s*/, ''))}
        </div>
      );
      continue;
    }

    // Success banner: [✓] or ✅ at start
    if (line.startsWith('[✓]') || line.startsWith('✅')) {
      elements.push(
        <div key={key++} className="my-2 px-3 py-2 bg-green-500/10 border-l-4 border-green-500 rounded-r-lg text-green-700 text-sm">
          {parseInlineFormatting(line.replace(/^\[✓\]\s*|^✅\s*/, ''))}
        </div>
      );
      continue;
    }

    // Quote: > at start
    if (line.startsWith('>')) {
      elements.push(
        <div key={key++} className="my-2 pl-3 border-l-2 border-[var(--secondary-text)]/40 text-[var(--secondary-text)]/70 italic text-sm">
          {parseInlineFormatting(line.substring(1).trim())}
        </div>
      );
      continue;
    }

    // Bullet point: - or • at start
    if (line.match(/^[-•]\s/)) {
      elements.push(
        <div key={key++} className="flex gap-2 my-1">
          <span className="text-[var(--accent)]">•</span>
          <span>{parseInlineFormatting(line.replace(/^[-•]\s*/, ''))}</span>
        </div>
      );
      continue;
    }

    // Checkbox task: [ ] or [x] at start
    if (line.match(/^\[[ x]\]/i)) {
      const isChecked = line.match(/^\[x\]/i);
      elements.push(
        <div key={key++} className="flex gap-2 my-1 items-start">
          <span className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center text-xs ${
            isChecked
              ? 'bg-green-500 border-green-500 text-white'
              : 'border-[var(--secondary-text)]/40'
          }`}>
            {isChecked && '✓'}
          </span>
          <span className={isChecked ? 'line-through text-[var(--secondary-text)]/50' : ''}>
            {parseInlineFormatting(line.replace(/^\[[ x]\]\s*/i, ''))}
          </span>
        </div>
      );
      continue;
    }

    // Calendar event: 📅 at start
    if (line.startsWith('📅')) {
      elements.push(
        <div key={key++} className="my-2 px-3 py-2 bg-[var(--cream)] border border-[var(--border-color)] rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📅</span>
            <span className="font-medium">{parseInlineFormatting(line.replace(/^📅\s*/, ''))}</span>
          </div>
        </div>
      );
      continue;
    }

    // Email preview: 📧 at start
    if (line.startsWith('📧')) {
      elements.push(
        <div key={key++} className="my-2 px-3 py-2 bg-[var(--cream)] border border-[var(--border-color)] rounded-xl text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📧</span>
            <span>{parseInlineFormatting(line.replace(/^📧\s*/, ''))}</span>
          </div>
        </div>
      );
      continue;
    }

    // Regular line with inline formatting
    if (line.trim()) {
      elements.push(
        <p key={key++} className="my-1 whitespace-pre-wrap">
          {parseInlineFormatting(line)}
        </p>
      );
    } else if (i > 0 && i < lines.length - 1) {
      // Empty line = paragraph break
      elements.push(<div key={key++} className="h-2" />);
    }
  }
  } // End of segment loop

  return <>{elements}</>;
}

// Parse inline formatting: **bold**, `code`, *italic*, $numbers
function parseInlineFormatting(text: string): ReactNode[] {
  const elements: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold: **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      elements.push(<strong key={key++} className="font-semibold">{boldMatch[1]}</strong>);
      remaining = remaining.substring(boldMatch[0].length);
      continue;
    }

    // Code: `text`
    const codeMatch = remaining.match(/^`(.+?)`/);
    if (codeMatch) {
      elements.push(
        <code key={key++} className="px-1.5 py-0.5 bg-[var(--foreground)]/10 rounded text-[var(--accent)] font-mono text-xs">
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.substring(codeMatch[0].length);
      continue;
    }

    // Currency: $1,234.56
    const currencyMatch = remaining.match(/^\$[\d,]+\.?\d*/);
    if (currencyMatch) {
      elements.push(
        <span key={key++} className="font-semibold text-[var(--accent)]">{currencyMatch[0]}</span>
      );
      remaining = remaining.substring(currencyMatch[0].length);
      continue;
    }

    // Time: 10:30 AM, 2pm, etc.
    const timeMatch = remaining.match(/^\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?|\d{1,2}\s*(?:AM|PM|am|pm)/);
    if (timeMatch) {
      elements.push(
        <span key={key++} className="font-medium text-[#d97706]">{timeMatch[0]}</span>
      );
      remaining = remaining.substring(timeMatch[0].length);
      continue;
    }

    // URL
    const urlMatch = remaining.match(/^https?:\/\/[^\s]+/);
    if (urlMatch) {
      elements.push(
        <a
          key={key++}
          href={urlMatch[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] hover:text-[var(--accent-dark)] underline underline-offset-2 break-all"
        >
          {urlMatch[0]}
        </a>
      );
      remaining = remaining.substring(urlMatch[0].length);
      continue;
    }

    // Plain text (one character at a time to catch next pattern)
    elements.push(remaining[0]);
    remaining = remaining.substring(1);
  }

  // Combine adjacent strings
  const combined: ReactNode[] = [];
  let currentString = '';
  
  for (const el of elements) {
    if (typeof el === 'string') {
      currentString += el;
    } else {
      if (currentString) {
        combined.push(currentString);
        currentString = '';
      }
      combined.push(el);
    }
  }
  if (currentString) {
    combined.push(currentString);
  }

  return combined;
}
