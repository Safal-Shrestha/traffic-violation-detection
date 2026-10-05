import { useState } from 'react'
import { X } from 'lucide-react'
import type {
  AIModel,
  AIModelStatus,
  AIModelType,
} from '../../types/aiModels'

interface EditAIModelModalProps {
  model: AIModel
  onClose: () => void
  onSave: (updatedModel: AIModel) => void
}

function EditAIModelModal({
  model,
  onClose,
  onSave,
}: EditAIModelModalProps) {
  const [name, setName] = useState(model.name)
  const [type, setType] = useState<AIModelType>(model.type)
  const [version, setVersion] = useState(model.version)
  const [confidence, setConfidence] = useState(
    String(model.confidence),
  )
  const [status, setStatus] =
    useState<AIModelStatus>(model.status)
  const [description, setDescription] = useState(
    model.description,
  )

  const handleSubmit = (
    event: React.SubmitEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    const typeLabels: Record<AIModelType, string> = {
      'red-light': 'Red Light',
      'stop-line': 'Stop Line',
      helmet: 'No Helmet',
      speed: 'Speeding',
    }

    onSave({
      ...model,
      name,
      type,
      typeLabel: typeLabels[type],
      version,
      confidence: Number(confidence),
      status,
      description,
    })
  }

  return (
    <div className="ai-models-modal-overlay" onClick={onClose}>
      <div
        className="ai-models-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ai-models-modal-header">
          <div>
            <h2>Edit AI Model</h2>
            <p>Update this model's configuration.</p>
          </div>

          <button
            type="button"
            className="ai-models-modal-close"
            onClick={onClose}
            aria-label="Close edit model dialog"
          >
            <X size={19} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="ai-models-modal-body">
            <div className="ai-models-form-group">
              <label htmlFor="model-name">Model Name</label>
              <input
                id="model-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="ai-models-form-row">
              <div className="ai-models-form-group">
                <label htmlFor="model-type">
                  Detection Type
                </label>

                <select
                  id="model-type"
                  value={type}
                  onChange={(event) =>
                    setType(
                      event.target.value as AIModelType,
                    )
                  }
                >
                  <option value="red-light">Red Light</option>
                  <option value="stop-line">Stop Line</option>
                  <option value="helmet">No Helmet</option>
                  <option value="speed">Speeding</option>
                </select>
              </div>

              <div className="ai-models-form-group">
                <label htmlFor="model-version">Version</label>

                <input
                  id="model-version"
                  type="text"
                  value={version}
                  onChange={(event) =>
                    setVersion(event.target.value)
                  }
                  required
                />
              </div>
            </div>

            <div className="ai-models-form-row">
              <div className="ai-models-form-group">
                <label htmlFor="model-confidence">
                  Confidence (%)
                </label>

                <input
                  id="model-confidence"
                  type="number"
                  min="0"
                  max="100"
                  value={confidence}
                  onChange={(event) =>
                    setConfidence(event.target.value)
                  }
                  required
                />
              </div>

              <div className="ai-models-form-group">
                <label htmlFor="model-status">Status</label>

                <select
                  id="model-status"
                  value={status}
                  onChange={(event) =>
                    setStatus(
                      event.target.value as AIModelStatus,
                    )
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="ai-models-form-group">
              <label htmlFor="model-description">
                Description
              </label>

              <textarea
                id="model-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={3}
                required
              />
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
              type="submit"
              className="ai-models-modal-save"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EditAIModelModal