import { Request, Response } from 'express';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';

export async function getAnalyticsSummary(req: Request, res: Response): Promise<void> {
  const [doctorCount, patientAgg, doctorWorkload] = await Promise.all([
    Doctor.countDocuments(),
    Patient.aggregate([
      {
        $facet: {
          totalPatients: [{ $count: 'count' }],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
          conditionBreakdown: [
            {
              $group: {
                _id: '$condition',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 6 },
          ],
          intakeTrends: [
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m', date: '$admission_date' },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
            { $limit: 12 },
          ],
        },
      },
    ]),
    Doctor.find()
      .select('doctor_name specialization active_patient_count')
      .sort({ active_patient_count: -1 })
      .limit(8)
      .lean(),
  ]);

  const facet = patientAgg[0] || {};
  const totalPatients = facet.totalPatients?.[0]?.count || 0;

  res.json({
    success: true,
    data: {
      totalDoctors: doctorCount,
      totalPatients,
      statusBreakdown: facet.statusBreakdown || [],
      conditionBreakdown: facet.conditionBreakdown || [],
      intakeTrends: facet.intakeTrends || [],
      doctorWorkload,
    },
  });
}
