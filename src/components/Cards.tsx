"use client";

import type { Card, CalendarCard, TasksCard, WeatherCard, EmailCard, TimerCard, InfoCard, ActionItemsCard, CodeCard, LearningCard } from "@/lib/cards/types";
import { cn } from "@/lib/utils";

interface CardContainerProps {
  children: React.ReactNode;
  className?: string;
}

function CardContainer({ children, className }: CardContainerProps) {
  return (
    <div className={cn(
      "rounded-xl border border-[#1a1a1a]/10 bg-[#f5f0e8] overflow-hidden",
      "animate-fade-in-up shadow-sm",
      className
    )}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-[#1a1a1a]/5 bg-[#1a1a1a]/[0.02]">
      <span className="text-base">{icon}</span>
      <span className="text-xs font-medium uppercase tracking-wider text-[#1a1a1a]/50">
        {title}
      </span>
    </div>
  );
}

// Calendar Card
function CalendarCardView({ card }: { card: CalendarCard }) {
  return (
    <CardContainer>
      <CardHeader icon="📅" title="Calendar" />
      <div className="divide-y divide-[#1a1a1a]/5">
        {card.events.map((event, i) => (
          <div key={i} className="px-4 py-3 flex items-start gap-3">
            <div className="shrink-0 w-14 text-center">
              <div className="text-sm font-semibold text-[#c75b3a]">{event.time}</div>
              {event.duration && (
                <div className="text-[10px] text-[#1a1a1a]/40">{event.duration}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-[#1a1a1a] truncate">{event.title}</div>
              {event.location && (
                <div className="text-xs text-[#1a1a1a]/50 flex items-center gap-1 mt-0.5">
                  <span>📍</span> {event.location}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}

// Tasks Card
function TasksCardView({ card }: { card: TasksCard }) {
  return (
    <CardContainer>
      <CardHeader icon="✅" title={card.title || "Tasks"} />
      <div className="px-4 py-2 space-y-2">
        {card.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn(
              "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] shrink-0",
              item.done
                ? "bg-green-500 border-green-500 text-white"
                : item.priority === "high"
                ? "border-[#c75b3a]"
                : "border-[#1a1a1a]/20"
            )}>
              {item.done && "✓"}
            </span>
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm",
                item.done && "line-through text-[#1a1a1a]/40"
              )}>
                {item.text}
              </span>
              {item.due && (
                <span className="ml-2 text-xs text-[#d97706]">{item.due}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}

// Weather Card
function WeatherCardView({ card }: { card: WeatherCard }) {
  const weatherIcons: Record<string, string> = {
    sunny: "☀️", clear: "☀️", cloudy: "☁️", "partly cloudy": "⛅",
    rain: "🌧️", rainy: "🌧️", storm: "⛈️", snow: "❄️", fog: "🌫️",
  };
  
  const getIcon = (condition: string) => {
    const key = condition.toLowerCase();
    return weatherIcons[key] || "🌤️";
  };

  return (
    <CardContainer>
      <CardHeader icon="🌤️" title={card.location} />
      <div className="px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{getIcon(card.current.condition)}</span>
          <div>
            <div className="text-2xl font-bold text-[#1a1a1a]">{card.current.temp}°</div>
            <div className="text-sm text-[#1a1a1a]/60 capitalize">{card.current.condition}</div>
          </div>
        </div>
        {card.forecast && card.forecast.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#1a1a1a]/5 flex gap-4">
            {card.forecast.slice(0, 4).map((day, i) => (
              <div key={i} className="text-center flex-1">
                <div className="text-xs text-[#1a1a1a]/50">{day.day}</div>
                <div className="text-lg my-1">{getIcon(day.condition)}</div>
                <div className="text-xs">
                  <span className="font-medium">{day.high}°</span>
                  <span className="text-[#1a1a1a]/40 ml-1">{day.low}°</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </CardContainer>
  );
}

// Email Card
function EmailCardView({ card }: { card: EmailCard }) {
  return (
    <CardContainer>
      <CardHeader icon="📧" title={`${card.emails.length} Email${card.emails.length !== 1 ? 's' : ''}`} />
      <div className="divide-y divide-[#1a1a1a]/5">
        {card.emails.map((email, i) => (
          <div key={i} className={cn(
            "px-4 py-3",
            email.unread && "bg-[#c75b3a]/5"
          )}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium text-sm text-[#1a1a1a] truncate">
                {email.unread && <span className="inline-block w-2 h-2 rounded-full bg-[#c75b3a] mr-2" />}
                {email.from}
              </div>
              {email.time && (
                <div className="text-xs text-[#1a1a1a]/40 shrink-0">{email.time}</div>
              )}
            </div>
            <div className="text-sm text-[#1a1a1a]/70 truncate mt-0.5">{email.subject}</div>
            {email.preview && (
              <div className="text-xs text-[#1a1a1a]/40 truncate mt-1">{email.preview}</div>
            )}
          </div>
        ))}
      </div>
    </CardContainer>
  );
}

// Timer Card
function TimerCardView({ card }: { card: TimerCard }) {
  const actionIcons = { set: "⏱️", cancelled: "❌", fired: "🔔" };
  const actionColors = { 
    set: "text-[#d97706]", 
    cancelled: "text-[#1a1a1a]/40", 
    fired: "text-[#c75b3a]" 
  };

  return (
    <CardContainer className="max-w-xs">
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">{actionIcons[card.action || "set"]}</span>
        <div>
          <div className={cn("font-medium text-sm", actionColors[card.action || "set"])}>
            {card.action === "cancelled" ? "Timer Cancelled" : 
             card.action === "fired" ? "Timer Complete!" : "Timer Set"}
          </div>
          <div className="text-sm text-[#1a1a1a]">{card.label}</div>
          {card.targetTime && (
            <div className="text-xs text-[#1a1a1a]/50">
              {new Date(card.targetTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
}

// Info Card
function InfoCardView({ card }: { card: InfoCard }) {
  return (
    <CardContainer>
      {card.title && <CardHeader icon={card.icon || "💡"} title={card.title} />}
      <div className="px-4 py-3 text-sm text-[#1a1a1a]/80">
        {card.content}
      </div>
    </CardContainer>
  );
}

// Action Items Card (Meeting Mode)
function ActionItemsCardView({ card }: { card: ActionItemsCard }) {
  return (
    <CardContainer>
      <CardHeader icon="📋" title={card.title || "Action Items"} />
      <div className="px-4 py-2 space-y-2">
        {card.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className={cn(
              "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center text-[10px] shrink-0",
              item.done
                ? "bg-green-500 border-green-500 text-white"
                : item.priority === "high"
                ? "border-[#c75b3a] bg-[#c75b3a]/10"
                : "border-[#d97706]"
            )}>
              {item.done && "✓"}
            </span>
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm",
                item.done && "line-through text-[#1a1a1a]/40"
              )}>
                {item.text}
              </span>
              <div className="flex gap-2 mt-0.5 flex-wrap">
                {item.assignee && (
                  <span className="text-xs text-[#1a1a1a]/50 flex items-center gap-1">
                    <span>👤</span> {item.assignee}
                  </span>
                )}
                {item.due && (
                  <span className="text-xs text-[#d97706] flex items-center gap-1">
                    <span>📅</span> {item.due}
                  </span>
                )}
                {item.priority === "high" && (
                  <span className="text-xs text-[#c75b3a] font-medium">High Priority</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </CardContainer>
  );
}

// Code Card (Coding Mode)
function CodeCardView({ card }: { card: CodeCard }) {
  // Simple keyword highlighting for common languages
  const highlightCode = (code: string, lang?: string) => {
    if (!lang) return code;
    
    // Keywords for different languages
    const keywords: Record<string, string[]> = {
      javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined'],
      typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined', 'interface', 'type', 'enum', 'implements', 'extends'],
      python: ['def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'raise', 'with', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue'],
      sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT'],
    };
    
    const langKeywords = keywords[lang.toLowerCase()] || [];
    if (langKeywords.length === 0) return code;
    
    // This is a simplified approach - just return the code for now
    // Real syntax highlighting would need a proper parser
    return code;
  };

  return (
    <CardContainer>
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a]/5 bg-[#1a1a1a]/[0.04]">
        <div className="flex items-center gap-2">
          <span className="text-base">💻</span>
          <span className="text-xs font-medium uppercase tracking-wider text-[#1a1a1a]/50">
            {card.title || "Code"}
          </span>
        </div>
        {card.language && (
          <span className="text-xs font-mono px-2 py-0.5 bg-[#1a1a1a]/10 rounded text-[#1a1a1a]/60">
            {card.language}
          </span>
        )}
      </div>
      {card.filename && (
        <div className="px-4 py-1.5 bg-[#1a1a1a]/[0.02] border-b border-[#1a1a1a]/5">
          <span className="text-xs text-[#1a1a1a]/50 font-mono">📄 {card.filename}</span>
        </div>
      )}
      <div className="overflow-x-auto">
        <pre className="px-4 py-3 text-xs font-mono text-[#1a1a1a]/90 whitespace-pre-wrap break-all">
          <code>{highlightCode(card.code, card.language)}</code>
        </pre>
      </div>
    </CardContainer>
  );
}

// Learning Card (Learning Mode)
function LearningCardView({ card }: { card: LearningCard }) {
  return (
    <CardContainer>
      <CardHeader icon="📚" title={card.concept || "Key Concepts"} />
      <div className="px-4 py-3 space-y-3">
        {/* Summary */}
        {card.summary && (
          <p className="text-sm text-[#1a1a1a]/80">{card.summary}</p>
        )}
        
        {/* Key Points */}
        {card.keyPoints && card.keyPoints.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-[#1a1a1a]/40 mb-2">
              Key Points
            </div>
            <div className="space-y-1.5">
              {card.keyPoints.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[#d97706] mt-0.5">•</span>
                  <span className="text-sm text-[#1a1a1a]/80">{point}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Follow-up Questions */}
        {card.followUp && card.followUp.length > 0 && (
          <div className="pt-2 border-t border-[#1a1a1a]/5">
            <div className="text-xs font-medium uppercase tracking-wider text-[#1a1a1a]/40 mb-2">
              💡 Explore Further
            </div>
            <div className="flex flex-wrap gap-2">
              {card.followUp.map((question, i) => (
                <span
                  key={i}
                  className="text-xs px-3 py-1.5 bg-[#c75b3a]/10 text-[#c75b3a] rounded-full cursor-pointer hover:bg-[#c75b3a]/20 transition-colors"
                >
                  {question}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </CardContainer>
  );
}

// Main Card renderer
export function CardView({ card }: { card: Card }) {
  switch (card.type) {
    case "calendar":
      return <CalendarCardView card={card} />;
    case "tasks":
      return <TasksCardView card={card} />;
    case "weather":
      return <WeatherCardView card={card} />;
    case "email":
      return <EmailCardView card={card} />;
    case "timer":
      return <TimerCardView card={card} />;
    case "info":
      return <InfoCardView card={card} />;
    case "actionitems":
      return <ActionItemsCardView card={card} />;
    case "code":
      return <CodeCardView card={card} />;
    case "learning":
      return <LearningCardView card={card} />;
    default:
      return null;
  }
}

// Render multiple cards
export function CardsView({ cards }: { cards: Card[] }) {
  if (cards.length === 0) return null;
  
  return (
    <div className="space-y-3 mt-3">
      {cards.map((card, i) => (
        <CardView key={card.id || i} card={card} />
      ))}
    </div>
  );
}
