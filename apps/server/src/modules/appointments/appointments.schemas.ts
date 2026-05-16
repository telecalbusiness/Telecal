import { z } from 'zod';
import { ConsultationType, DisciplineCategory, TriagePriority } from '@mediconnect/shared';

export const createAppointmentSchema = z.object({
  consultationType: z.nativeEnum(ConsultationType),
  discipline: z.nativeEnum(DisciplineCategory).optional(),
  priority: z.nativeEnum(TriagePriority).default(TriagePriority.NORMAL),
  notes: z.string().max(500).optional(),
}).refine(
  (data) =>
    data.consultationType !== ConsultationType.SPECIALIST || !!data.discipline,
  { message: 'Discipline is required for specialist consultations', path: ['discipline'] },
);

export const appointmentParamsSchema = z.object({
  id: z.string().uuid('Invalid appointment ID'),
});

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
