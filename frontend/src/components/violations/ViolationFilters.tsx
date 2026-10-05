import { Filter, Search } from 'lucide-react'

interface ViolationFiltersProps {
  search: string
  status: string
  type: string
  date: string
  onSearchChange: (value: string) => void
  onStatusChange: (value: string) => void
  onTypeChange: (value: string) => void
  onDateChange: (value: string) => void
  onClearFilters: () => void
}

function ViolationFilters({
  search,
  status,
  type,
  date,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onDateChange,
  onClearFilters
}: ViolationFiltersProps) {
  return (
    <div className="violations-filters">
      <div className="violations-search">
        <Search size={18} />

        <input
          type="text"
          placeholder="Search by vehicle number..."
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="violations-filter-group">
        <Filter size={17} />

        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          value={type}
          onChange={(event) => onTypeChange(event.target.value)}
          aria-label="Filter by violation type"
        >
          <option value="all">All Violations</option>
          <option value="red-light">Red Light</option>
          <option value="stop-line">Stop Line</option>
          <option value="helmet">No Helmet</option>
          <option value="speed">Speeding</option>
        </select>

        <div className="violations-date-picker">
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            aria-label="Filter by date"
          />
        </div>

        <button
          type="button"
          className="violations-clear-filters"
          onClick={onClearFilters}
        >
          Clear
        </button>
      </div>
    </div>
  )
}

export default ViolationFilters