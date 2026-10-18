import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { headingId } from '@pv/shared';
import remarkGfm from 'remark-gfm';

/**
 * Renders CMS Markdown on the server. Raw HTML in the source is NOT
 * rendered (react-markdown's default), which is what keeps admin-authored
 * content from ever becoming an XSS vector. Links to other sites open
 * safely in a new tab.
 */
/** The plain text of rendered children, for heading anchors. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-pv">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Anchors for the table of contents and links to a section.
          h2: ({ children: text }) => <h2 id={headingId(textOf(text))}>{text}</h2>,
          h3: ({ children: text }) => <h3 id={headingId(textOf(text))}>{text}</h3>,
          a: ({ href = '', children: text }) => {
            const external = /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
              >
                {text}
              </a>
            );
          },
          // eslint-disable-next-line @next/next/no-img-element
          img: ({ src, alt }) => (
            <img
              src={typeof src === 'string' ? src : ''}
              alt={alt ?? ''}
              loading="lazy"
              decoding="async"
            />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
