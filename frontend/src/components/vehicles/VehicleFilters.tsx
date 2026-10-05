import { Search } from 'lucide-react'
import type { VehicleStatus, VehicleType } from '../../types/vehicles'

interface VehicleFiltersProps {
  search: string
  type: VehicleType | 'all'
  status: VehicleStatus | 'all'
  onSearchChange: (value: string) => void
  onTypeChange: (value: VehicleType | 'all') => void
  onStatusChange: (value: VehicleStatus | 'all') => void
}

function VehicleFilters({
  search,
  type,
  status,
  onSearchChange,
  onTypeChange,
  onStatusChange,
}: VehicleFiltersProps) {
  return (
    <div className="vehicles-filters">
      <div className="vehicles-search">
        <Search size={17} />
        <input
          type="text"
          placeholder="Search vehicles..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <select
        value={type}
        onChange={(event) =>
          onTypeChange(event.target.value as VehicleType | 'all')
        }
      >
        <option value="all">All Types</option>
        <option value="car">Car</option>
        <option value="bike">Bike</option>
        <option value="bus">Bus</option>
        <option value="truck">Truck</option>
      </select>

      <select
        value={status}
        onChange={(event) =>
          onStatusChange(event.target.value as VehicleStatus | 'all')
        }
      >
        <option value="all">All Status</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>
    </div>
  )
}

export default VehicleFilters