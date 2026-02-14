/**
 * Markdown renderer for chat messages
 * Supports: **bold**, *italic*, __underline__, ~~strikethrough~~,
 *           ##headers, `code`, ```code blocks``` (with syntax highlighting),
 *           [links](url), | tables |
 */
import { useEffect, useRef } from 'react';
import hljs from 'highlight.js/lib/core';

// Register only common languages to keep bundle small
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import bash from 'highlight.js/lib/languages/bash';
import lua from 'highlight.js/lib/languages/lua';
import plaintext from 'highlight.js/lib/languages/plaintext';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('js', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('ts', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('py', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('sh', bash);
hljs.registerLanguage('lua', lua);
hljs.registerLanguage('plaintext', plaintext);
hljs.registerLanguage('text', plaintext);

// Import a dark theme that works well with our dark UI
import 'highlight.js/styles/atom-one-dark.css';

export interface MarkdownNode {
  type: 'text' | 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'code-block' | 'header' | 'link' | 'table';
  content: string;
  level?: number; // For headers
  href?: string; // For links
  language?: string; // For code blocks
  tableData?: string[][]; // For tables (rows × cols)
  tableHeader?: string[]; // For table header row
}

/**
 * Parse markdown text into renderable nodes
 */
export function parseMarkdown(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block detection
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        nodes.push({
          type: 'code-block',
          content: codeBlockContent,
          language: codeBlockLang,
        });
        codeBlockContent = '';
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        // Start code block — capture language tag
        codeBlockLang = line.trim().slice(3).trim().toLowerCase();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent += (codeBlockContent ? '\n' : '') + line;
      continue;
    }

    // Empty line = paragraph break
    if (line.trim() === '') {
      nodes.push({ type: 'text', content: '\n\n' });
      continue;
    }

    // Header detection
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch) {
      nodes.push({
        type: 'header',
        content: headerMatch[2],
        level: headerMatch[1].length,
      });
      continue;
    }

    // Table detection: line starts with | and has at least 2 |
    if (line.trim().startsWith('|') && (line.match(/\|/g) || []).length >= 2) {
      // Collect all contiguous table lines
      const tableLines: string[] = [line];
      while (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        if (nextLine.trim().startsWith('|') && (nextLine.match(/\|/g) || []).length >= 2) {
          tableLines.push(nextLine);
          i++;
        } else {
          break;
        }
      }
      const tableNode = parseTable(tableLines);
      if (tableNode) {
        nodes.push(tableNode);
        continue;
      }
      // Fall through to inline parsing if table parse failed
    }

    // Parse inline markdown
    const inlineNodes = parseInlineMarkdown(line);
    nodes.push(...inlineNodes);

    // Add newline between lines (except last)
    if (i < lines.length - 1) {
      nodes.push({ type: 'text', content: '\n' });
    }
  }

  return nodes;
}

/**
 * Parse a markdown table from lines
 */
function parseTable(lines: string[]): MarkdownNode | null {
  if (lines.length < 2) return null; // Need at least header + separator

  const parseRow = (line: string): string[] =>
    line.split('|').map(cell => cell.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length);

  const header = parseRow(lines[0]);
  if (header.length === 0) return null;

  // Check if second line is a separator (---|----|---)
  const separatorLine = lines[1];
  const isSeparator = /^[\s|:-]+$/.test(separatorLine) && separatorLine.includes('-');

  const dataStartIndex = isSeparator ? 2 : 1;
  const tableData = lines.slice(dataStartIndex).map(parseRow);

  return {
    type: 'table',
    content: '',
    tableHeader: isSeparator ? header : undefined,
    tableData: isSeparator ? tableData : [header, ...tableData],
  };
}

/**
 * Parse inline markdown (bold, italic, underline, strikethrough, code, links)
 */
function parseInlineMarkdown(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Code (backticks) — check first to avoid conflicts
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push({ type: 'code', content: codeMatch[1] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Strikethrough (~~text~~)
    const strikeMatch = remaining.match(/^~~(.+?)~~/);
    if (strikeMatch) {
      nodes.push({ type: 'strikethrough', content: strikeMatch[1] });
      remaining = remaining.slice(strikeMatch[0].length);
      continue;
    }

    // Bold (**text**)
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) {
      nodes.push({ type: 'bold', content: boldMatch[1] });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Underline (__text__)
    const underlineMatch = remaining.match(/^__(.+?)__/);
    if (underlineMatch) {
      nodes.push({ type: 'underline', content: underlineMatch[1] });
      remaining = remaining.slice(underlineMatch[0].length);
      continue;
    }

    // Italic (*text*)
    const italicMatch = remaining.match(/^\*(.+?)\*/);
    if (italicMatch) {
      nodes.push({ type: 'italic', content: italicMatch[1] });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // Links [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      nodes.push({
        type: 'link',
        content: linkMatch[1],
        href: linkMatch[2],
      });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // No match — consume characters until next special marker
    const nextSpecial = remaining.slice(1).search(/[*`~_\[]/) + 1;
    const textLen = nextSpecial > 0 ? nextSpecial : remaining.length;
    nodes.push({ type: 'text', content: remaining.slice(0, textLen) });
    remaining = remaining.slice(textLen);
  }

  return nodes;
}

/**
 * Highlighted code block component — uses highlight.js for syntax coloring
 */
function HighlightedCodeBlock({ code, language }: { code: string; language?: string }) {
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      // Reset any previous highlighting
      codeRef.current.removeAttribute('data-highlighted');

      if (language && hljs.getLanguage(language)) {
        try {
          const result = hljs.highlight(code, { language });
          codeRef.current.innerHTML = result.value;
          return;
        } catch {
          // Fall through to auto-detect
        }
      }

      // Auto-detect language
      try {
        const result = hljs.highlightAuto(code);
        codeRef.current.innerHTML = result.value;
      } catch {
        // Leave as plain text
        codeRef.current.textContent = code;
      }
    }
  }, [code, language]);

  return (
    <pre className="my-2 p-3 rounded theme-bg-secondary border theme-border overflow-x-auto">
      {language && (
        <div className="text-[10px] theme-text-muted mb-1 uppercase tracking-wider">{language}</div>
      )}
      <code ref={codeRef} className="font-mono text-xs leading-relaxed hljs">{code}</code>
    </pre>
  );
}

/**
 * Render markdown nodes to React elements
 */
export function renderMarkdownNodes(nodes: MarkdownNode[]): React.ReactNode[] {
  return nodes.map((node, i) => {
    const key = `md-${i}`;

    switch (node.type) {
      case 'bold':
        return <strong key={key} className="font-semibold">{node.content}</strong>;

      case 'italic':
        return <em key={key} className="italic">{node.content}</em>;

      case 'underline':
        return <span key={key} className="underline">{node.content}</span>;

      case 'strikethrough':
        return <span key={key} className="line-through opacity-70">{node.content}</span>;

      case 'code':
        return (
          <code key={key} className="px-1 py-0.5 rounded theme-bg text-[var(--color-accent)] font-mono text-xs">
            {node.content}
          </code>
        );

      case 'code-block':
        return <HighlightedCodeBlock key={key} code={node.content} language={node.language} />;

      case 'header': {
        const headerClass = node.level === 1 ? 'text-xl font-bold mt-3 mb-2' :
                           node.level === 2 ? 'text-lg font-semibold mt-2 mb-1' :
                           'text-base font-medium mt-1';
        return (
          <div key={key} className={headerClass}>
            {node.content}
          </div>
        );
      }

      case 'link':
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] underline hover:opacity-80"
          >
            {node.content}
          </a>
        );

      case 'table':
        return (
          <div key={key} className="my-2 overflow-x-auto">
            <table className="text-xs border-collapse w-full">
              {node.tableHeader && (
                <thead>
                  <tr>
                    {node.tableHeader.map((cell, ci) => (
                      <th key={ci} className="px-2 py-1 text-left font-semibold theme-text border theme-border theme-bg-secondary">
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {node.tableData?.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-2 py-1 border theme-border theme-text">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );

      case 'text':
      default:
        // Convert newlines to <br> tags
        if (node.content.includes('\n')) {
          const parts = node.content.split('\n');
          return (
            <span key={key}>
              {parts.map((part, idx) => (
                <span key={`${key}-${idx}`}>
                  {part}
                  {idx < parts.length - 1 && <br />}
                </span>
              ))}
            </span>
          );
        }
        return node.content;
    }
  });
}
