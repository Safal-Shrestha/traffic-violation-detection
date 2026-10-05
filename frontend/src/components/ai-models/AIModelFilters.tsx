import { Search } from 'lucide-react'
import type {
  AIModelStatus,
  AIModelType,
} from '../../types/aiModels'

interface AIModelFiltersProps {
  search: string
  type: AIModelType | 'all'
  status: AIModelStatus | 'all'
  onSearchChange: (value: string) => void
  onTypeChange: (value: AIModelType | 'all') => void
  onStatusChange: (value: AIModelStatus | 'all') => void
}

function AIModelFilters({
  search,
  type,
  status,
  onSearchChange,
  onTypeChange,
  onStatusChange,
}: AIModelFiltersProps) {
  return (
    <div className="ai-models-filters">
      <div className="ai-models-search">
        <Search size={17} />

        <input
          type="text"
          placeholder="Search models..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <select
        value={type}
        onChange={(event) =>
          onTypeChange(
            event.target.value as AIModelType | 'all',
          )
        }
      >
        <option value="all">All Detection Types</option>
        <option value="red-light">Red Light</option>
        <option value="stop-line">Stop Line</option>
        <option value="helmet">No Helmet</option>
        <option value="speed">Speeding</option>
      </select>

      <select
        value={status}
        onChange={(event) =>
          onStatusChange(
            event.target.value as AIModelStatus | 'all',
          )
        }
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  )
}

export default AIModelFilters