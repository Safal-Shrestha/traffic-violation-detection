export type VehicleStatus = 'active' | 'inactive'
export type VehicleType = 'car' | 'bike' | 'bus' | 'truck'

export interface Vehicle {
  id: number
  plateNumber: string
  type: VehicleType
  make: string
  model: string
  color: string
  ownerName: string
  status: VehicleStatus
  lastDetected: string
  registeredDate: string
}

export interface VehiclesData {
  vehicles: Vehicle[]
}