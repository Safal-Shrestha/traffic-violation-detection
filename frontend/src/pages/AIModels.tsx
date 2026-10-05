import { useEffect, useMemo, useState } from 'react'
import {Activity,Brain,CircleCheck,Layers, /*Plus*/} from 'lucide-react'

import AIModelStatCard from '../components/ai-models/AIModelStatCard'
import AIModelFilters from '../components/ai-models/AIModelFilters'
import AIModelTable from '../components/ai-models/AIModelTable'
import EditAIModelModal from '../components/ai-models/EditAIModel'
import DeleteAIModel from '../components/ai-models/DeleteAIModel'

import { getAIModelsData } from '../services/aiModelsService'

import type {AIModel,AIModelStatus,AIModelType,AIModelsData} from '../types/aiModels'

import '../css/ai-models.css'

function AIModels() {
  const [data, setData] = useState<AIModelsData | null>(null)

  const [search, setSearch] = useState('')
  const [type, setType] =
    useState<AIModelType | 'all'>('all')
  const [status, setStatus] =
    useState<AIModelStatus | 'all'>('all')

  const [editingModel, setEditingModel] =
    useState<AIModel | null>(null)

  const [deletingModel, setDeletingModel] =
    useState<AIModel | null>(null)

  useEffect(() => {
    getAIModelsData().then(setData)
  }, [])

  const filteredModels = useMemo(() => {
    if (!data) return []

    return data.models.filter((model) => {
      const searchValue = search.toLowerCase()

      const matchesSearch =
        model.name.toLowerCase().includes(searchValue) ||
        model.typeLabel.toLowerCase().includes(searchValue) ||
        model.version.toLowerCase().includes(searchValue)

      const matchesType =
        type === 'all' || model.type === type

      const matchesStatus =
        status === 'all' || model.status === status

      return matchesSearch && matchesType && matchesStatus
    })
  }, [data, search, type, status])

  if (!data) {
    return (
      <div className="ai-models-loading">
        Loading AI models...
      </div>
    )
  }

  const totalModels = data.models.length

  const activeModels = data.models.filter(
    (model) => model.status === 'active',
  ).length

  const detectionTypes = new Set(
    data.models.map((model) => model.type),
  ).size

  const averageConfidence =
    totalModels > 0
      ? Math.round(
          data.models.reduce(
            (total, model) => total + model.confidence,
            0,
          ) / totalModels,
        )
      : 0

  const handleEditModel = (model: AIModel) => {
    setEditingModel(model)
  }

  const handleSaveModel = (updatedModel: AIModel) => {
    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        models: currentData.models.map((model) =>
          model.id === updatedModel.id
            ? updatedModel
            : model,
        ),
      }
    })

    setEditingModel(null)
  }

  const handleDeleteModel = (model: AIModel) => {
    setDeletingModel(model)
  }

  const handleConfirmDelete = () => {
    if (!deletingModel) return

    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        models: currentData.models.filter(
          (model) => model.id !== deletingModel.id,
        ),
      }
    })

    setDeletingModel(null)
  }

  return (
    <div className="ai-models-page">
      {/* <div className="ai-models-heading">
        <div>
          <h1>AI Models</h1>
        </div>

        <button
          type="button"
          className="ai-models-add-button"
        >
          <Plus size={17} />
          Add Model
        </button>
      </div> */}

      <div className="ai-models-stats">
        <AIModelStatCard
          title="Total Models"
          value={String(totalModels)}
          description="Registered models"
          icon={<Brain size={20} />}
        />

        <AIModelStatCard
          title="Active Models"
          value={String(activeModels)}
          description="Currently active"
          icon={<CircleCheck size={20} />}
        />

        <AIModelStatCard
          title="Detection Types"
          value={String(detectionTypes)}
          description="Supported violations"
          icon={<Layers size={20} />}
        />

        <AIModelStatCard
          title="Average Confidence"
          value={`${averageConfidence}%`}
          description="Across all models"
          icon={<Activity size={20} />}
        />
      </div>

      <section className="ai-models-content">
        <div className="ai-models-content-header">
          <div>
            <h2>All AI Models</h2>
            <p>
              {filteredModels.length} model
              {filteredModels.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>

        <AIModelFilters
          search={search}
          type={type}
          status={status}
          onSearchChange={setSearch}
          onTypeChange={setType}
          onStatusChange={setStatus}
        />

        <AIModelTable
          models={filteredModels}
          onEdit={handleEditModel}
          onDelete={handleDeleteModel}
        />
      </section>

      {editingModel && (
        <EditAIModelModal
          model={editingModel}
          onClose={() => setEditingModel(null)}
          onSave={handleSaveModel}
        />
      )}

      {deletingModel && (
        <DeleteAIModel
          model={deletingModel}
          onClose={() => setDeletingModel(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default AIModels