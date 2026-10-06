import { Search } from 'lucide-react'
import type { CameraStatus } from '../../types/cameras'

interface CameraFiltersProps {
  search: string
  status: CameraStatus | 'all'
  onSearchChange: (value: string) => void
  onStatusChange: (value: CameraStatus | 'all') => void
}

function CameraFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
}: CameraFiltersProps) {
  return (
    <div className="cameras-filters">
      <div className="cameras-search">
        <Search size={17} />

        <input
          type="text"
          placeholder="Search cameras..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <select
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as CameraStatus | 'all')
        }
      >
        <option value="all">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </select>
    </div>
  )
}

export default CameraFilters