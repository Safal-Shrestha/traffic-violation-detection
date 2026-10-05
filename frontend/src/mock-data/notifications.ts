import type { Notification } from '../types/notifications'

export const notifications: Notification[] = [
  {
    id: 1,
    violationId: 1,
    type: 'red-light',
    title: 'Red Light Violation',
    message: 'Vehicle BA 2 PA 4567 detected.',
    time: '2 min ago',
    read: false,
  },
  {
    id: 2,
    violationId: 2,
    type: 'helmet',
    title: 'Helmet Violation',
    message: 'Vehicle BA 3 CHA 7821 detected.',
    time: '8 min ago',
    read: false,
  },
  {
    id: 3,
    violationId: 3,
    type: 'speed',
    title: 'Speed Violation',
    message: 'Vehicle BA 1 PA 3210 exceeded the limit.',
    time: '15 min ago',
    read: false,
  },
]