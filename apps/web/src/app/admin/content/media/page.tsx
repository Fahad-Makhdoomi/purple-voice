'use client';

import { PageHeader, Section } from '@/components/ui';
import { MediaLibrary } from '@/components/admin/MediaLibrary';

export default function MediaPage() {
  return (
    <>
      <PageHeader
        title="Media library"
        description="One folder per page or post (pages/home, blog/<slug>, brand). Every image is stored once, as WebP, at full resolution."
      />
      <Section>
        <MediaLibrary />
      </Section>
    </>
  );
}
