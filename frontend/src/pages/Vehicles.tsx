import { useEffect, useMemo, useState } from 'react'
import {
  Bike,
  CarFront,
  CircleCheck,
 /* Plus,*/
} from 'lucide-react'

import VehicleStatCard from '../components/vehicles/VehicleStatCard'
import VehicleFilters from '../components/vehicles/VehicleFilters'
import VehicleTable from '../components/vehicles/VehicleTable'
import EditVehicleModal from '../components/vehicles/EditVehicleModal'
import DeleteVehicleModal from '../components/vehicles/DeleteVehicleModal'

import { getVehiclesData } from '../services/vehiclesService'

import type {
  Vehicle,
  VehicleStatus,
  VehicleType,
  VehiclesData,
} from '../types/vehicles'

import '../css/vehicles.css'

function Vehicles() {
  const [data, setData] = useState<VehiclesData | null>(null)

  const [search, setSearch] = useState('')
  const [type, setType] = useState<VehicleType | 'all'>('all')
  const [status, setStatus] = useState<VehicleStatus | 'all'>('all')

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null)

  useEffect(() => {
    getVehiclesData().then(setData)
  }, [])

  const filteredVehicles = useMemo(() => {
    if (!data) return []

    return data.vehicles.filter((vehicle) => {
      const searchValue = search.toLowerCase()

      const matchesSearch =
        vehicle.plateNumber.toLowerCase().includes(searchValue) ||
        vehicle.ownerName.toLowerCase().includes(searchValue) ||
        vehicle.make.toLowerCase().includes(searchValue) ||
        vehicle.model.toLowerCase().includes(searchValue)

      const matchesType =
        type === 'all' || vehicle.type === type

      const matchesStatus =
        status === 'all' || vehicle.status === status

      return matchesSearch && matchesType && matchesStatus
    })
  }, [data, search, type, status])

  if (!data) {
    return (
      <div className="vehicles-loading">
        Loading vehicles...
      </div>
    )
  }

  const totalVehicles = data.vehicles.length

  const activeVehicles = data.vehicles.filter(
    (vehicle) => vehicle.status === 'active',
  ).length

  const cars = data.vehicles.filter(
    (vehicle) => vehicle.type === 'car',
  ).length

  const bikes = data.vehicles.filter(
    (vehicle) => vehicle.type === 'bike',
  ).length

  // const handleEditVehicle = (vehicle: Vehicle) => {
  //   setEditingVehicle(vehicle)
  // }

  const handleSaveVehicle = (updatedVehicle: Vehicle) => {
    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        vehicles: currentData.vehicles.map((vehicle) =>
          vehicle.id === updatedVehicle.id
            ? updatedVehicle
            : vehicle,
        ),
      }
    })

    setEditingVehicle(null)
  }

  // const handleDeleteVehicle = (vehicle: Vehicle) => {
  //   setDeletingVehicle(vehicle)
  // }

  const handleConfirmDelete = () => {
    if (!deletingVehicle) return

    setData((currentData) => {
      if (!currentData) return currentData

      return {
        ...currentData,
        vehicles: currentData.vehicles.filter(
          (vehicle) => vehicle.id !== deletingVehicle.id,
        ),
      }
    })

    setDeletingVehicle(null)
  }

  return (
    <div className="vehicles-page">
      {/* <div className="vehicles-heading">
        <div>
          <h1>Vehicles</h1>
        </div>

        <button
          type="button"
          className="vehicles-add-button"
        >
          <Plus size={17} />
          Add Vehicle
        </button>
      </div> */}

      <div className="vehicles-stats">
        <VehicleStatCard
          title="Total Vehicles"
          value={String(totalVehicles)}
          description="Registered vehicles"
          icon={<CarFront size={20} />}
        />

        <VehicleStatCard
          title="Active Vehicles"
          value={String(activeVehicles)}
          description="Currently active"
          icon={<CircleCheck size={20} />}
        />

        <VehicleStatCard
          title="Cars"
          value={String(cars)}
          description="Registered cars"
          icon={<CarFront size={20} />}
        />

        <VehicleStatCard
          title="Bikes"
          value={String(bikes)}
          description="Registered bikes"
          icon={<Bike size={20} />}
        />
      </div>

      <section className="vehicles-content">
        <div className="vehicles-content-header">
          <div>
            <h2>All Vehicles</h2>
            <p>
              {filteredVehicles.length} vehicle
              {filteredVehicles.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>

        <VehicleFilters
          search={search}
          type={type}
          status={status}
          onSearchChange={setSearch}
          onTypeChange={setType}
          onStatusChange={setStatus}
        />

        <VehicleTable
          vehicles={filteredVehicles}
          // onEdit={handleEditVehicle}
          // onDelete={handleDeleteVehicle}
        />
      </section>

      {editingVehicle && (
        <EditVehicleModal
          vehicle={editingVehicle}
          onClose={() => setEditingVehicle(null)}
          onSave={handleSaveVehicle}
        />
      )}

      {deletingVehicle && (
        <DeleteVehicleModal
          vehicle={deletingVehicle}
          onClose={() => setDeletingVehicle(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}

export default Vehicles