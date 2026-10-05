import { AlertTriangle, X } from 'lucide-react'
import type { AIModel } from '../../types/aiModels'

interface DeleteAIModelModalProps {
  model: AIModel
  onClose: () => void
  onConfirm: () => void
}

function DeleteAIModel({
  model,
  onClose,
  onConfirm,
}: DeleteAIModelModalProps) {
  return (
    <div className="ai-models-modal-overlay" onClick={onClose}>
      <div
        className="ai-models-modal ai-models-delete-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ai-models-modal-header">
          <div>
            <h2>Delete AI Model</h2>
            <p>This action cannot be undone.</p>
          </div>

          <button
            type="button"
            className="ai-models-modal-close"
            onClick={onClose}
            aria-label="Close delete model dialog"
          >
            <X size={19} />
          </button>
        </div>

        <div className="ai-models-delete-body">
          <div className="ai-models-delete-icon">
            <AlertTriangle size={22} />
          </div>

          <div>
            <p>
              Are you sure you want to delete
              <strong> {model.name}</strong>?
            </p>

            <span>
              This model will be removed from the registered
              model list.
            </span>
          </div>
        </div>

        <div className="ai-models-modal-footer">
          <button
            type="button"
            className="ai-models-modal-cancel"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="ai-models-modal-delete"
            onClick={onConfirm}
          >
            Delete Model
          </button>
        </div>
      </div>
    </div>
  )
}

export default DeleteAIModel