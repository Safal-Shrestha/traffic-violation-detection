import type { DashboardData } from '../types/dashboard'

export const dashboardData: DashboardData = {
  stats: {
    totalViolations: 1248,
    todayViolations: 37,
    activeCameras: 12,
    monitoredVehicles: 86,
  },

  violationSummary: [
    { label: 'Red Light', count: 14 },
    { label: 'No Helmet', count: 9 },
    { label: 'Stop Line', count: 8 },
    { label: 'Speeding', count: 6 },
  ],

  cameras: [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Camera 01',
      district: 'Kathmandu',
      municipality: 'Kathmandu Metropolitan City',
      status: 'ACTIVE',
      workerOnline: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Camera 02',
      district: 'Kathmandu',
      municipality: 'Kathmandu Metropolitan City',
      status: 'ACTIVE',
      workerOnline: true,
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      name: 'Camera 03',
      district: 'Kathmandu',
      municipality: 'Kathmandu Metropolitan City',
      status: 'INACTIVE',
      workerOnline: false,
    },
  ],

  recentViolations: [
    {
      id: '650e8400-e29b-41d4-a716-446655440001',
      plate: 'BA 2 PA 4821',
      violationType: 'Red Light Violation',
      camera: 'Camera 01',
      occurredAt: '2026-10-06T10:25:00+05:45',
      status: 'PENDING',
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440002',
      plate: 'BA 3 CHA 7210',
      violationType: 'No Helmet',
      camera: 'Camera 02',
      occurredAt: '2026-10-06T10:19:00+05:45',
      status: 'REJECTED',
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440003',
      plate: 'BA 1 JA 9034',
      violationType: 'Stop Line Violation',
      camera: 'Camera 01',
      occurredAt: '2026-10-06T10:12:00+05:45',
      status: 'PENDING',
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440004',
      plate: 'BA 5 KHA 1832',
      violationType: 'Speeding',
      camera: 'Camera 02',
      occurredAt: '2026-10-06T10:06:00+05:45',
      status: 'CONFIRMED',
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440005',
      plate: null,
      violationType: 'Red Light Violation',
      camera: 'Camera 01',
      occurredAt: '2026-10-06T09:55:00+05:45',
      status: 'PENDING',
    },
  ],
}