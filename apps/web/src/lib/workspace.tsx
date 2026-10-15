'use client';

import { createContext, useContext } from 'react';
import type { Entitlements, FeatureKey, UsageSnapshot } from '@pv/shared';

export interface WorkspaceContextValue {
  workspace: { id: string; name: string; timezone: string; suspended: boolean };
  entitlements: Entitlements;
  usage: UsageSnapshot;
  actingAsStaff: boolean;
  reload: () => Promise<void>;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/** The workspace the dashboard is showing (own, or the customer a staff member opened). */
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside the dashboard');
  return ctx;
}

export function useFeature(key: FeatureKey): boolean {
  const { entitlements } = useWorkspace();
  return entitlements.active && entitlements.features[key];
}
