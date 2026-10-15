import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { resolveWorkspace } from '../../middleware/workspace';
import { credentialsRouter } from './credentials';
import { telephonyRouter } from './telephony';
import { agentsRouter } from './agents';
import { campaignsRouter } from './campaigns';
import { callsRouter } from './calls';
import { integrationsRouter } from './integrations';
import { developersRouter } from './developers';
import { supportRouter } from './support';

/**
 * The subscriber dashboard API: /api/app/*. Every route acts on one
 * workspace — the caller's own, or (for staff) the one named in the
 * X-Workspace-Id header.
 */
export const workspaceRouter = Router();

workspaceRouter.use(authenticate, resolveWorkspace);

workspaceRouter.use('/', callsRouter); // /overview, /calls, /appointments, /insights
workspaceRouter.use('/credentials', credentialsRouter);
workspaceRouter.use('/telephony', telephonyRouter);
workspaceRouter.use('/agents', agentsRouter);
workspaceRouter.use('/campaigns', campaignsRouter);
workspaceRouter.use('/integrations', integrationsRouter);
workspaceRouter.use('/developers', developersRouter);
workspaceRouter.use('/support', supportRouter);
