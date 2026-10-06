import {
  useState,
  type FormEvent,
} from 'react'

import { X } from 'lucide-react'

import type {
  CameraCreateRequest,
} from '../../types/monitoring'

interface AddCameraModalProps {
  onClose: () => void
  onAdd: (
    data: CameraCreateRequest,
  ) => Promise<void>
}

function AddCameraModal({
  onClose,
  onAdd,
}: AddCameraModalProps) {
  const [name, setName] =
    useState('')

  const [district, setDistrict] =
    useState('')

  const [municipality, setMunicipality] =
    useState('')

  const [error, setError] =
    useState('')

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')

    if (
      !name.trim() ||
      !district.trim() ||
      !municipality.trim()
    ) {
      setError(
        'Please fill in all fields.',
      )

      return
    }

    try {
      setIsSubmitting(true)

      await onAdd({
        name: name.trim(),
        district: district.trim(),
        municipality:
          municipality.trim(),
      })
    } catch (error) {
      console.error(error)

      setError(
        'Failed to add camera. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="monitoring-modal-overlay"
      onClick={onClose}
    >
      <div
        className="monitoring-modal"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="monitoring-modal-header">
          <div>
            <h2>Add Camera</h2>

            <p>
              Add a new camera to live
              monitoring.
            </p>
          </div>

          <button
            type="button"
            className="monitoring-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          className="monitoring-modal-form"
          onSubmit={handleSubmit}
        >
          <div className="monitoring-form-group">
            <label htmlFor="camera-name">
              Camera Name
            </label>

            <input
              id="camera-name"
              type="text"
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="e.g. Camera 04"
              disabled={isSubmitting}
            />
          </div>

          <div className="monitoring-form-group">
            <label htmlFor="camera-district">
              District
            </label>

            <input
              id="camera-district"
              type="text"
              value={district}
              onChange={(event) =>
                setDistrict(
                  event.target.value,
                )
              }
              placeholder="e.g. Kathmandu"
              disabled={isSubmitting}
            />
          </div>

          <div className="monitoring-form-group">
            <label htmlFor="camera-municipality">
              Municipality
            </label>

            <input
              id="camera-municipality"
              type="text"
              value={municipality}
              onChange={(event) =>
                setMunicipality(
                  event.target.value,
                )
              }
              placeholder="e.g. Kathmandu Metropolitan City"
              disabled={isSubmitting}
            />
          </div>

          {error && (
            <p className="monitoring-form-error">
              {error}
            </p>
          )}

          <div className="monitoring-modal-actions">
            <button
              type="button"
              className="monitoring-modal-cancel"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="monitoring-modal-submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Adding...'
                : 'Add Camera'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCameraModal