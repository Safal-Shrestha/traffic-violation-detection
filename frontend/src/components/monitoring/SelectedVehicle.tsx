import {
  Car,
  Gauge,
  Palette,
  ShieldCheck,
} from 'lucide-react'
import type { DetectedVehicle } from '../../types/monitoring'

interface SelectedVehicleProps {
  vehicle: DetectedVehicle | null
}

function SelectedVehicle({
  vehicle,
}: SelectedVehicleProps) {
  if (!vehicle) {
    return (
      <section className="monitoring-panel">
        <div className="monitoring-empty-state">
          <Car size={30} />
          <span>No vehicle selected</span>
        </div>
      </section>
    )
  }

  return (
    <section className="monitoring-panel">
      <div className="monitoring-panel-title">
        <div>
          <h3>Selected Vehicle</h3>
          <p>Currently tracked vehicle</p>
        </div>

        <span className="monitoring-detection-badge">
          Detected
        </span>
      </div>

      <div className="monitoring-vehicle-plate">
        {vehicle.plateNumber}
      </div>

      <div className="monitoring-vehicle-details">
        <div>
          <Car size={17} />
          <span>
            <small>Type</small>
            <strong>{vehicle.vehicleType}</strong>
          </span>
        </div>

        <div>
          <Palette size={17} />
          <span>
            <small>Color</small>
            <strong>{vehicle.color}</strong>
          </span>
        </div>

        <div>
          <Gauge size={17} />
          <span>
            <small>Speed</small>
            <strong>{vehicle.speed} km/h</strong>
          </span>
        </div>

        <div>
          <ShieldCheck size={17} />
          <span>
            <small>Plate Confidence</small>
            <strong>{vehicle.confidence}%</strong>
          </span>
        </div>
      </div>

      <div className="monitoring-vehicle-time">
        Last detected at {vehicle.detectedAt}
      </div>
    </section>
  )
}

export default SelectedVehicle