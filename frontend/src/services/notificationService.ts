import { notifications } from '../mock-data/notifications'
import type { Notification } from '../types/notifications'

const USE_MOCK_DATA = true

export async function getNotifications(): Promise<Notification[]> {
  if (USE_MOCK_DATA) {
    return notifications
  }

  // Backend API will be added here later.
  return []
}