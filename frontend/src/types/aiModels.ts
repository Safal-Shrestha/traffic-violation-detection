export type AIModelStatus = 'active' | 'inactive'

export type AIModelType =
  | 'red-light'
  | 'stop-line'
  | 'helmet'
  | 'speed'

export interface AIModel {
  id: number
  name: string
  type: AIModelType
  typeLabel: string
  version: string
  confidence: number
  status: AIModelStatus
  lastUpdated: string
  description: string
}

export interface AIModelsData {
  models: AIModel[]
}