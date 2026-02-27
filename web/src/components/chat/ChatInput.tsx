import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (question: string) => void;
  onStop?: () => void;
  running?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({ onSend, onStop, running = false, disabled = false, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleSend = useCallback(() => {
    if (!input.trim() || running || disabled) return;
    onSend(input.trim());
    setInput("");
  }, [input, running, disabled, onSend]);

  return (
    <div className="p-3 border-t border-[var(--border-color)] flex gap-2">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSend()}
        placeholder={placeholder || "Ask about your sessions..."}
        className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent-blue)]/50 transition-colors"
        disabled={running || disabled}
      />
      {running ? (
        <button
          onClick={onStop}
          className="px-3 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 text-sm font-medium hover:bg-red-500/20 transition-colors"
        >
          <Square size={14} />
        </button>
      ) : (
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="px-3 py-2 rounded-lg bg-[var(--accent-blue)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-colors"
        >
          <Send size={14} />
        </button>
      )}
    </div>
  );
}
