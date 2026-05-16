import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../middleware/auth';
import { sendSuccess } from '../../utils/response';
import { sessionsService } from './sessions.service';

export const sessionsRouter = Router();

sessionsRouter.use(requireAuth);

// Get session join info (ICE servers, duration)
sessionsRouter.get(
  '/:id/join',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await sessionsService.joinSession(req.params['id']!, req.user!.id);
      sendSuccess(res, data);
    } catch (err) { next(err); }
  },
);

// Doctor: signal session has started (both parties connected)
sessionsRouter.post(
  '/:id/start',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // io is attached to app by the server entry point
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const io = (req.app as any).get('io');
      await sessionsService.startSession(req.params['id']!, io);
      sendSuccess(res, null, 'Session started');
    } catch (err) { next(err); }
  },
);

// Either party: end session early
sessionsRouter.post(
  '/:id/end',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const io = (req.app as any).get('io');
      await sessionsService.endSession(req.params['id']!, io, true);
      sendSuccess(res, null, 'Session ended');
    } catch (err) { next(err); }
  },
);

