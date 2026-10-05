import { Brain } from 'lucide-react'
import type { AIModel } from '../../types/aiModels'
import AIModelStatusBadge from './AIModelStatusBadge'

interface AIModelTableProps {
  models: AIModel[]
  onEdit: (model: AIModel) => void
  onDelete: (model: AIModel) => void
}

function AIModelTable({
  models,
  onEdit,
  onDelete,
}: AIModelTableProps) {
  if (models.length === 0) {
    return (
      <div className="ai-models-empty">
        <p>No AI models found.</p>
        <span>Try changing your search or filters.</span>
      </div>
    )
  }

  return (
    <div className="ai-models-table-wrapper">
      <table className="ai-models-table">
        <thead>
          <tr>
            <th>Model</th>
            <th>Detection Type</th>
            <th>Version</th>
            <th>Confidence</th>
            <th>Last Updated</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {models.map((model) => (
            <tr key={model.id}>
              <td>
                <div className="ai-models-main-cell">
                  <div className="ai-models-avatar">
                    <Brain size={17} />
                  </div>

                  <div>
                    <strong>{model.name}</strong>
                    <span>{model.description}</span>
                  </div>
                </div>
              </td>

              <td>
                <span className="ai-models-type">
                  {model.typeLabel}
                </span>
              </td>

              <td>{model.version}</td>

              <td>
                <span className="ai-models-confidence">
                  {model.confidence}%
                </span>
              </td>

              <td>{model.lastUpdated}</td>

              <td>
                <AIModelStatusBadge status={model.status} />
              </td>

              <td>
                <div className="ai-models-actions">
                  <button
                    type="button"
                    className="ai-models-edit-button"
                    onClick={() => onEdit(model)}
                    aria-label={`Edit ${model.name}`}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="ai-models-delete-button"
                    onClick={() => onDelete(model)}
                    aria-label={`Delete ${model.name}`}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default AIModelTable