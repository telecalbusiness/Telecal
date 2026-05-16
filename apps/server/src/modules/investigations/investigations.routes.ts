import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requirePatient, requireDoctor } from '../../middleware/auth';
import { sendSuccess, sendCreated } from '../../utils/response';
import { investigationsService } from './investigations.service';
import { z } from 'zod';
import { validateBody } from '../../middleware/validate';
import { uploadRateLimit } from '../../middleware/rateLimiter';
import { uploadInvestigationFiles, handleMulterError } from '../../middleware/upload';
import { storageService } from '../../lib/storage';

export const investigationsRouter = Router();
investigationsRouter.use(requireAuth);

// Patient: create investigation request
investigationsRouter.post(
  '/',
  requirePatient,
  validateBody(z.object({ appointmentId: z.string().uuid().optional() })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await investigationsService.createInvestigation(
        req.user!.id,
        req.body.appointmentId,
      );
      sendCreated(res, data, 'Investigation request created. Please complete payment.');
    } catch (err) { next(err); }
  },
);

// Patient/Doctor/Admin: get investigation
investigationsRouter.get(
  '/:id',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await investigationsService.getInvestigationById(
        req.params['id']!,
        req.user!.id,
        req.user!.role,
      );
      sendSuccess(res, data);
    } catch (err) { next(err); }
  },
);

// Doctor: list assigned investigations
investigationsRouter.get(
  '/',
  requireDoctor,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query['page']) || 1;
      const pageSize = Number(req.query['pageSize']) || 20;
      const data = await investigationsService.getDoctorInvestigations(
        req.user!.id, page, pageSize,
      );
      sendSuccess(res, data);
    } catch (err) { next(err); }
  },
);

// Doctor: submit review notes
investigationsRouter.patch(
  '/:id/review',
  requireDoctor,
  validateBody(z.object({ notes: z.string().min(1).max(2000) })),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await investigationsService.submitReview(
        req.params['id']!,
        req.user!.id,
        req.body.notes,
      );
      sendSuccess(res, null, 'Review submitted');
    } catch (err) { next(err); }
  },
);

// Patient: upload report files (POST /investigations/:id/files)
investigationsRouter.post(
  '/:id/files',
  requirePatient,
  uploadRateLimit,
  uploadInvestigationFiles.array('files', 5),
  handleMulterError,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          error: { code: 'NO_FILES', message: 'No files provided' },
        });
        return;
      }

      const uploadedFiles = [];
      for (const file of files) {
        const stored = await storageService.save(
          file.buffer,
          file.originalname,
          file.mimetype,
          'investigations',
        );
        const record = await investigationsService.addReportFile(
          req.params['id']!,
          req.user!.id,
          stored,
        );
        uploadedFiles.push(record);
      }

      sendSuccess(res, { files: uploadedFiles }, `${files.length} file(s) uploaded`);
    } catch (err) { next(err); }
  },
);
