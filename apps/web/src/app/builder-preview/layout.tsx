import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page preview',
  robots: { index: false, follow: false },
};

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  return <main id="main">{children}</main>;
}
