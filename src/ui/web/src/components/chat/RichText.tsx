// SPDX-License-Identifier: Apache-2.0
import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Minimal markdown renderer for assistant replies.
 *
 * The agents emit **bold**, `code` and "- " bullet lists — nothing more. A full
 * markdown pipeline would add ~80 KB to the bundle to render three constructs,
 * so this handles exactly those and leaves everything else as plain text.
 * Before this existed, answers displayed their own asterisks and backticks,
 * which read as a bug to anyone seeing the demo for the first time.
 */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <Box component="span" key={key} sx={{ fontWeight: 650 }}>
          {part.slice(2, -2)}
        </Box>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <Box
          component="code"
          key={key}
          sx={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.875em',
            px: 0.6,
            py: 0.15,
            borderRadius: 0.75,
            backgroundColor: 'action.hover',
          }}
        >
          {part.slice(1, -1)}
        </Box>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

interface Props {
  text: string;
  color?: string;
}

const RichText: React.FC<Props> = ({ text, color }) => {
  const lines = (text || '').split('\n');
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = (key: string) => {
    if (!bullets.length) return;
    blocks.push(
      <Box component="ul" key={key} sx={{ my: 0.75, pl: 2.5, '& li': { mb: 0.4 } }}>
        {bullets.map((b, i) => (
          <li key={i}>
            <Typography variant="body1" component="span" sx={{ color }}>
              {renderInline(b, `${key}-${i}`)}
            </Typography>
          </li>
        ))}
      </Box>
    );
    bullets = [];
  };

  lines.forEach((line, idx) => {
    const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      return;
    }
    flushBullets(`ul-${idx}`);
    if (!line.trim()) return;
    blocks.push(
      <Typography key={`p-${idx}`} variant="body1" sx={{ color, mb: 0.75 }}>
        {renderInline(line, `p-${idx}`)}
      </Typography>
    );
  });
  flushBullets('ul-end');

  return <>{blocks}</>;
};

export default RichText;
