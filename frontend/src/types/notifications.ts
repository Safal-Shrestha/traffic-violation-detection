export type NotificationType = 'red-light'|'stop-line'| 'helmet'| 'speed'

export interface Notification {
  id: number
  violationId: number
  type: NotificationType
  title: string
  message: string
  time: string
  read: boolean
}