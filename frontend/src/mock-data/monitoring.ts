import type { MonitoringData } from '../types/monitoring'

export const monitoringData: MonitoringData = {
  cameras: [
    {
      id: 1,
      name: 'Camera 01',
      location: 'New Road Junction',
      status: 'online',
      resolution: '1920 × 1080',
      fps: 30,
    },
    {
      id: 2,
      name: 'Camera 02',
      location: 'Putalisadak',
      status: 'online',
      resolution: '1920 × 1080',
      fps: 30,
    },
    {
      id: 3,
      name: 'Camera 03',
      location: 'Koteshwor Junction',
      status: 'offline',
      resolution: '1920 × 1080',
      fps: 30,
    },
  ],

  selectedCameraId: 1,

  detectedVehicles: [
    {
      id: 1,
      plateNumber: 'BA 2 PA 4821',
      vehicleType: 'Car',
      color: 'White',
      confidence: 96,
      speed: 42,
      detectedAt: '19:52:14',
    },
    {
      id: 2,
      plateNumber: 'BA 3 CHA 7210',
      vehicleType: 'Motorcycle',
      color: 'Black',
      confidence: 93,
      speed: 31,
      detectedAt: '19:52:11',
    },
    {
      id: 3,
      plateNumber: 'BA 1 JA 9034',
      vehicleType: 'Car',
      color: 'Blue',
      confidence: 91,
      speed: 38,
      detectedAt: '19:52:08',
    },
  ],

  selectedVehicleId: 1,

  detections: [
    {
      id: 1,
      type: 'red-light',
      label: 'Red Light Violation',
      confidence: 97,
      timestamp: '19:52:14',
    },
    {
      id: 2,
      type: 'stop-line',
      label: 'Stop Line Violation',
      confidence: 94,
      timestamp: '19:52:14',
    },
    {
      id: 3,
      type: 'helmet',
      label: 'Helmet Detection',
      confidence: 98,
      timestamp: '19:52:11',
    },
  ],
}