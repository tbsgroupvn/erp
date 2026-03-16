'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Bot, User, Copy, Check, ChevronDown, ChevronRight, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export interface ToolUseBlock {
  toolName: string;
  status: 'running' | 'done' | 'error';
  resultCount?: number;
  errorMessage?: string;
}

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
  toolUseBlocks?: ToolUseBlock[];
  timestamp?: string;
}

/**
 * Parse simple markdown to React elements:
 * - **bold** → <strong>
 * - *italic* → <em>
 * - `code` → <code>
 * - ```...``` → <pre><code>
 * - # Heading → <h3>
 * - - list item → <li> in <ul>
 * - \n\n → paragraph break
 */
function parseMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  // Split by code blocks first
  const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const segments: Array<{ type: 'text' | 'code'; content: string }> = [];

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  segments.forEach((seg, segIdx) => {
    if (seg.type === 'code') {
      nodes.push(<CodeBlock key={`code-block-${segIdx}`} code={seg.content} />);
      return;
    }

    // Process inline text
    const paragraphs = seg.content.split(/\n\n+/);
    paragraphs.forEach((para, pIdx) => {
      if (!para.trim()) return;

      // Check if it's a list block
      const lines = para.split('\n');
      const isListBlock = lines.every((l) => /^[-*]\s/.test(l.trim()) || l.trim() === '');

      if (isListBlock && lines.some((l) => /^[-*]\s/.test(l.trim()))) {
        const items = lines
          .filter((l) => /^[-*]\s/.test(l.trim()))
          .map((l, liIdx) => (
            <li key={liIdx}>{parseInline(l.replace(/^[-*]\s/, ''))}</li>
          ));
        nodes.push(
          <ul key={`ul-${segIdx}-${pIdx}`} className="my-1 list-disc pl-5 space-y-0.5">
            {items}
          </ul>,
        );
        return;
      }

      // Check heading
      const headingMatch = para.match(/^#{1,3}\s+(.+)/);
      if (headingMatch) {
        nodes.push(
          <h3 key={`h-${segIdx}-${pIdx}`} className="my-1 font-semibold text-sm">
            {parseInline(headingMatch[1])}
          </h3>,
        );
        return;
      }

      // Regular paragraph — handle line breaks
      const lineElements: React.ReactNode[] = [];
      lines.forEach((line, lineIdx) => {
        if (lineIdx > 0) lineElements.push(<br key={`br-${lineIdx}`} />);
        lineElements.push(...parseInline(line));
      });
      nodes.push(
        <p key={`p-${segIdx}-${pIdx}`} className="my-1 leading-relaxed">
          {lineElements}
        </p>,
      );
    });
  });

  return nodes;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Đã sao chép code');
    });
  }, [code]);

  return (
    <div className="my-2 rounded-md overflow-hidden border border-zinc-700">
      <div className="flex items-center justify-between bg-zinc-800 px-3 py-1.5">
        <span className="text-xs text-zinc-400 font-mono">code</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Đã sao chép' : 'Sao chép'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-zinc-900 p-3 text-sm text-green-300">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ToolUseBlockView({ block }: { block: ToolUseBlock }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-xs">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors rounded-md"
      >
        {expanded ? (
          <ChevronDown size={12} className="text-zinc-400 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-zinc-400 shrink-0" />
        )}
        <Database size={12} className="text-violet-500 shrink-0" />
        {block.status === 'running' ? (
          <>
            <Loader2 size={11} className="animate-spin text-violet-400 shrink-0" />
            <span className="text-violet-600 dark:text-violet-400">Đang truy vấn dữ liệu...</span>
          </>
        ) : block.status === 'error' ? (
          <span className="text-red-500">Lỗi: {block.toolName}</span>
        ) : (
          <>
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{block.toolName}</span>
            {block.resultCount != null && (
              <span className="ml-auto text-zinc-400">{block.resultCount} kết quả</span>
            )}
          </>
        )}
      </button>
      {expanded && block.errorMessage && (
        <div className="border-t border-zinc-200 dark:border-zinc-700 px-3 py-2 text-red-500 font-mono">
          {block.errorMessage}
        </div>
      )}
    </div>
  );
}

function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2] !== undefined) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      parts.push(
        <code
          key={key++}
          className="rounded bg-zinc-200 px-1 py-0.5 text-xs font-mono text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200"
        >
          {match[4]}
        </code>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

export function MessageBubble({ role, content, streaming = false, toolUseBlocks, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  const rendered = useMemo(() => {
    if (isUser) return content;
    return parseMarkdown(content);
  }, [content, isUser]);

  return (
    <div className={cn('flex gap-3 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-white',
          isUser ? 'bg-blue-600' : 'bg-violet-600',
        )}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble + metadata */}
      <div className={cn('flex max-w-[80%] flex-col gap-1', isUser && 'items-end')}>
        {/* Tool use blocks (above the bubble for assistant) */}
        {!isUser && toolUseBlocks && toolUseBlocks.length > 0 && (
          <div className="w-full">
            {toolUseBlocks.map((block, i) => (
              <ToolUseBlockView key={i} block={block} />
            ))}
          </div>
        )}

        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm border border-zinc-100 dark:border-zinc-700 rounded-tl-sm',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">{rendered}</div>
          )}

          {/* Streaming cursor */}
          {streaming && !isUser && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-400" />
          )}
        </div>

        {/* Timestamp */}
        {timestamp && (
          <span className="text-[10px] text-zinc-400 px-1">
            {new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  );
}
