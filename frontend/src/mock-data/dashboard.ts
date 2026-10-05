import type { DashboardData } from '../types/dashboard'

export const dashboardData: DashboardData = {
  stats: {
    totalViolations: 1248,
    todayViolations: 37,
    activeCameras: 12,
    monitoredVehicles: 86,
  },

  violationSummary: [
    {
      label: 'Red Light',
      count: 14,
    },
    {
      label: 'No Helmet',
      count: 9,
    },
    {
      label: 'Stop Line',
      count: 8,
    },
    {
      label: 'Speeding',
      count: 6,
    },
  ],

  cameras: [
    {
      id: 1,
      name: 'Camera 01',
      location: 'New Road Junction',
      status: 'online',
      vehiclesDetected: 18,
      image: '/camera-placeholder-1.jpg',
    },
    {
      id: 2,
      name: 'Camera 02',
      location: 'Putalisadak',
      status: 'online',
      vehiclesDetected: 24,
      image: '/camera-placeholder-2.jpg',
    },
    {
      id: 3,
      name: 'Camera 03',
      location: 'Koteshwor Junction',
      status: 'offline',
      vehiclesDetected: 0,
      image: '/camera-placeholder-3.jpg',
    },
  ],

  recentViolations: [
    {
      id: 1,
      vehicleNumber: 'BA 2 PA 4821',
      violation: 'Red Light Violation',
      camera: 'Camera 01',
      time: '2 min ago',
      status: 'pending',
    },
    {
      id: 2,
      vehicleNumber: 'BA 3 CHA 7210',
      violation: 'No Helmet',
      camera: 'Camera 02',
      time: '8 min ago',
      status: 'rejected',
    },
    {
      id: 3,
      vehicleNumber: 'BA 1 JA 9034',
      violation: 'Stop Line Violation',
      camera: 'Camera 01',
      time: '15 min ago',
      status: 'pending',
    },
    {
      id: 4,
      vehicleNumber: 'BA 5 KHA 1832',
      violation: 'Speeding',
      camera: 'Camera 02',
      time: '21 min ago',
      status: 'confirmed',
    },
    {
      id: 5,
      vehicleNumber: 'BA 4 CHA 5521',
      violation: 'Red Light Violation',
      camera: 'Camera 01',
      time: '32 min ago',
      status: 'pending',
    },
  ],
}