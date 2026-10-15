import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders CMS Markdown on the server. Raw HTML in the source is NOT
 * rendered (react-markdown's default), which is what keeps admin-authored
 * content from ever becoming an XSS vector. Links to other sites open
 * safely in a new tab.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-pv">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
