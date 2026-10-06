// import { Car, ChevronRight } from 'lucide-react'
// import type { DetectedVehicle } from '../../types/monitoring'

// interface DetectedVehiclesProps {
//   vehicles: DetectedVehicle[]
//   selectedVehicleId: number | null
//   onSelect: (vehicleId: number) => void
// }

// function DetectedVehicles({
//   vehicles,
//   selectedVehicleId,
//   onSelect,
// }: DetectedVehiclesProps) {
//   return (
//     <section className="monitoring-panel">
//       <div className="monitoring-panel-title">
//         <div>
//           <h3>Detected Vehicles</h3>
//           <p>Vehicles currently in frame</p>
//         </div>

//         <span className="monitoring-count">
//           {vehicles.length}
//         </span>
//       </div>

//       <div className="monitoring-vehicle-list">
//         {vehicles.map((vehicle) => (
//           <button
//             key={vehicle.id}
//             className={`monitoring-vehicle-item ${
//               selectedVehicleId === vehicle.id
//                 ? 'active'
//                 : ''
//             }`}
//             onClick={() => onSelect(vehicle.id)}
//           >
//             <div className="monitoring-vehicle-icon">
//               <Car size={17} />
//             </div>

//             <div>
//               <strong>{vehicle.plateNumber}</strong>
//               <span>
//                 {vehicle.vehicleType} · {vehicle.speed} km/h
//               </span>
//             </div>

//             <ChevronRight size={16} />
//           </button>
//         ))}
//       </div>
//     </section>
//   )
// }

// export default DetectedVehicles