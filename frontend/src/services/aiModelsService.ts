import { aiModelsData } from '../mock-data/aiModels'
import type { AIModelsData } from '../types/aiModels'

const USE_MOCK_DATA = true

export async function getAIModelsData(): Promise<AIModelsData> {
  if (USE_MOCK_DATA) {
    return aiModelsData
  }

  const response = await fetch('/api/ai-models')

  if (!response.ok) {
    throw new Error('Failed to fetch AI models data')
  }

  return response.json()
}