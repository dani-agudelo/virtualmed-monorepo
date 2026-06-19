// src/components/MarkdownContent.tsx
import React from 'react';

interface MarkdownContentProps {
  content: string;
}

/**
 * Componente para renderizar contenido con formato markdown básico
 * Soporta: **negrita**, *cursiva*, listas, párrafos
 */
export function MarkdownContent({ content }: MarkdownContentProps) {
  const parseMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: 'ordered' | 'unordered' | null = null;

    const flushList = () => {
      if (currentList.length > 0) {
        if (listType === 'ordered') {
          elements.push(
            <ol key={`list-${elements.length}`} className="list-decimal list-inside ml-2 mb-2">
              {currentList.map((item, idx) => (
                <li key={idx} className="text-sm">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          );
        } else {
          elements.push(
            <ul key={`list-${elements.length}`} className="list-disc list-inside ml-2 mb-2">
              {currentList.map((item, idx) => (
                <li key={idx} className="text-sm">
                  {parseInlineMarkdown(item)}
                </li>
              ))}
            </ul>
          );
        }
        currentList = [];
        listType = null;
      }
    };

    lines.forEach((line, idx) => {
      // Detección de listas ordenadas (1., 2., etc.)
      if (/^\d+\.\s+/.test(line)) {
        if (listType !== 'ordered') {
          flushList();
          listType = 'ordered';
        }
        currentList.push(line.replace(/^\d+\.\s+/, ''));
      }
      // Detección de listas desordenadas (*, -, +)
      else if (/^[\*\-\+]\s+/.test(line)) {
        if (listType !== 'unordered') {
          flushList();
          listType = 'unordered';
        }
        currentList.push(line.replace(/^[\*\-\+]\s+/, ''));
      } else {
        flushList();
        if (line.trim()) {
          elements.push(
            <p key={idx} className="text-sm mb-2 leading-relaxed">
              {parseInlineMarkdown(line)}
            </p>
          );
        } else {
          elements.push(<div key={idx} className="mb-2" />);
        }
      }
    });

    flushList();
    return elements;
  };

  const parseInlineMarkdown = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // Expresión regular para encontrar **negrita** y *cursiva*
    const regex = /\*\*([^\*]+)\*\*|\*([^\*]+)\*/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Agregar texto antes del match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }

      // Agregar el elemento formateado
      if (match[1]) {
        // **negrita**
        parts.push(
          <strong key={`bold-${key++}`} className="font-semibold">
            {match[1]}
          </strong>
        );
      } else if (match[2]) {
        // *cursiva*
        parts.push(
          <em key={`italic-${key++}`} className="italic">
            {match[2]}
          </em>
        );
      }

      lastIndex = regex.lastIndex;
    }

    // Agregar el texto restante
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return <div className="space-y-2">{parseMarkdown(content)}</div>;
}
