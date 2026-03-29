/**
 * Citation card component with expandable abstract for web chat.
 */

'use client';

import { useState } from 'react';
import type { Citation } from '../lib/types';

interface CitationCardProps {
  /** Citation to display. */
  citation: Citation;
  /** 1-based citation index. */
  index: number;
}

/**
 * Expandable citation card for web chat.
 *
 * Styled for the dark indigo AI Advice scene.
 * Shows title, journal, and year by default.
 * Expands to show the display summary on click.
 * Links directly to PubMed for user verification.
 */
export function CitationCard({ citation, index }: CitationCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="mt-2 rounded-lg p-3 text-sm"
      style={{ background: 'linear-gradient(135deg, rgba(3,105,161,0.2), rgba(14,165,233,0.1))', border: '1px solid rgba(56,189,248,0.18)', boxShadow: '0 2px 16px rgba(0,0,0,0.4), 0 0 0 1px rgba(56,189,248,0.06)' }}
    >
      <button
        className="flex w-full items-start justify-between text-left"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 pr-2">
          <span className="font-bold" style={{ color: '#38bdf8' }}>Source {index} · PMID {citation.pmid}</span>
          <p className="mt-0.5 font-medium leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{citation.title}</p>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {citation.journal} · {citation.year}
          </p>
        </div>
        <span className="mt-0.5 flex-shrink-0" style={{ color: '#38bdf8' }}>{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(56,189,248,0.18)' }}>
          <p className="leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>{citation.display_summary}</p>
          <a
            href={citation.pubmed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block font-medium hover:underline"
            style={{ color: '#38bdf8' }}
          >
            View on PubMed
          </a>
        </div>
      )}
    </div>
  );
}
