import { Request, Response, NextFunction } from 'express';
import { appointmentsService } from './appointments.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import type { CreateAppointmentDto } from './appointments.schemas';

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await appointmentsService.createAppointment(
      req.user!.id,
      req.body as CreateAppointmentDto,
    );
    sendCreated(res, data, 'Appointment created. Please complete payment to proceed.');
  } catch (err) { next(err); }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await appointmentsService.getAppointmentById(
      req.params['id']!,
      req.user!.id,
      req.user!.role,
    );
    sendSuccess(res, data);
  } catch (err) { next(err); }
};

export const listMine = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query['page']) || 1;
    const pageSize = Number(req.query['pageSize']) || 20;
    const status = req.query['status'] as string | undefined;

    const isDoctor = req.user!.role === 'DOCTOR';
    const data = isDoctor
      ? await appointmentsService.listDoctorAppointments(req.user!.id, page, pageSize, status)
      : await appointmentsService.listPatientAppointments(req.user!.id, page, pageSize, status);

    sendSuccess(res, data);
  } catch (err) { next(err); }
};

export const cancel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await appointmentsService.cancelAppointment(req.params['id']!, req.user!.id);
    sendSuccess(res, null, 'Appointment cancelled');
  } catch (err) { next(err); }
};
