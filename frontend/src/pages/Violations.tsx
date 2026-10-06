import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import ViolationFilters from '../components/violations/ViolationFilters'
import ViolationTable from '../components/violations/ViolationTable'
import { getViolationsData } from '../services/violationsService'
import type { ViolationListItem } from '../types/violations'

import '../css/violations.css'

function Violations() {
  const navigate = useNavigate()

  const [violations, setViolations] = useState<ViolationListItem[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [type, setType] = useState('all')
  const [date, setDate] = useState('')

  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    getViolationsData().then((data) => {
      setViolations(data.violations)
    })
  }, [])

  const typeOptions = useMemo(() => {
    const types = new Map<string, string>()

    violations.forEach((violation) => {
      types.set(
        violation.violation_type.code,
        violation.violation_type.name,
      )
    })

    return Array.from(types.entries()).map(([code, name]) => ({
      code,
      name,
    }))
  }, [violations])

  const filteredViolations = useMemo(() => {
    return violations.filter((violation) => {
      const plate =
        violation.vehicle?.plate_number ??
        violation.detected_plate_raw ??
        ''

      const matchesSearch = plate
        .toLowerCase()
        .includes(search.toLowerCase())

      const matchesStatus =
        status === 'all' || violation.status === status

      const matchesType =
        type === 'all' ||
        violation.violation_type.code === type

      const occurredDate = new Date(
        violation.occurred_at,
      ).toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kathmandu',
      })

      const matchesDate =
        !date || occurredDate === date

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesDate
      )
    })
  }, [violations, search, status, type, date])

  const totalPages = Math.ceil(
    filteredViolations.length / rowsPerPage,
  )

  const startIndex = (currentPage - 1) * rowsPerPage
  const endIndex = startIndex + rowsPerPage

  const paginatedViolations = filteredViolations.slice(
    startIndex,
    endIndex,
  )

  const pendingCount = violations.filter(
    (violation) => violation.status === 'PENDING',
  ).length

  const confirmedCount = violations.filter(
    (violation) => violation.status === 'CONFIRMED',
  ).length

  const rejectedCount = violations.filter(
    (violation) => violation.status === 'REJECTED',
  ).length

  return (
    <div className="violations-page">
      <div className="violations-summary">
        <div className="violations-stat-card">
          <span className="violations-stat-label">
            Total Violations
          </span>
          <strong>{violations.length}</strong>
        </div>

        <div className="violations-stat-card">
          <span className="violations-stat-label">
            Pending
          </span>
          <strong>{pendingCount}</strong>
        </div>

        <div className="violations-stat-card">
          <span className="violations-stat-label">
            Confirmed
          </span>
          <strong>{confirmedCount}</strong>
        </div>

        <div className="violations-stat-card">
          <span className="violations-stat-label">
            Rejected
          </span>
          <strong>{rejectedCount}</strong>
        </div>
      </div>

      <section className="violations-card">
        <ViolationFilters
          search={search}
          status={status}
          type={type}
          date={date}
          typeOptions={typeOptions}
          onSearchChange={(value) => {
            setSearch(value)
            setCurrentPage(1)
          }}
          onStatusChange={(value) => {
            setStatus(value)
            setCurrentPage(1)
          }}
          onTypeChange={(value) => {
            setType(value)
            setCurrentPage(1)
          }}
          onDateChange={(value) => {
            setDate(value)
            setCurrentPage(1)
          }}
          onClearFilters={() => {
            setSearch('')
            setStatus('all')
            setType('all')
            setDate('')
            setCurrentPage(1)
          }}
        />

        <div className="violations-table-header">
          <div className="violations-table-header-content">
            <h2>Violation Records</h2>
            <div className="violations-rows-per-page">
              <span>Rows per page:</span>

              <select
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value))
                  setCurrentPage(1)
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>

        <ViolationTable
          violations={paginatedViolations}
          onView={(id) => navigate(`/violations/${id}`)}
        />

        <div className="violations-pagination">
          {filteredViolations.length > rowsPerPage && (
            <div className="violations-pagination-controls">
              <span>
                {startIndex + 1}–
                {Math.min(
                  endIndex,
                  filteredViolations.length,
                )}{' '}
                of {filteredViolations.length}
              </span>

              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => {
                  setCurrentPage((page) =>
                    Math.max(page - 1, 1),
                  )
                }}
              >
                ‹
              </button>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => {
                  setCurrentPage((page) =>
                    Math.min(page + 1, totalPages),
                  )
                }}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export default Violations