import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { notificationService } from './notifications.service';
import { sendSuccess } from '../../utils/response';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1;
    const pageSize = Number(req.query['pageSize']) || 20;
    const data = await notificationService.getForUser(req.user!.id, page, pageSize);
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

notificationsRouter.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    sendSuccess(res, { count });
  } catch (err) { next(err); }
});

notificationsRouter.patch('/mark-all-read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    sendSuccess(res, null, 'All notifications marked as read');
  } catch (err) { next(err); }
});

notificationsRouter.patch('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationService.markAsRead(req.params['id']!, req.user!.id);
    sendSuccess(res, null, 'Notification marked as read');
  } catch (err) { next(err); }
});

