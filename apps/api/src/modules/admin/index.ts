import { Router } from 'express';
import { authenticate, requireStaff, requireSuperAdmin } from '../../middleware/auth';
import { subscribersRouter } from './subscribers';
import { cmsRouter } from './cms';
import { crmRouter } from './crm';
import { superRouter } from '../super';

/**
 * /api/admin/* — staff only. Admins manage customers, content and support;
 * /api/admin/super/* additionally requires SUPER_ADMIN.
 */
export const adminRouter = Router();

adminRouter.use(authenticate, requireStaff);
adminRouter.use('/', crmRouter); // /overview, /staff, /leads, /tickets
adminRouter.use('/subscribers', subscribersRouter);
adminRouter.use('/cms', cmsRouter);
adminRouter.use('/super', requireSuperAdmin, superRouter);
