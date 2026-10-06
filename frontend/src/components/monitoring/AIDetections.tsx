// import {
//   AlertTriangle,
//   CheckCircle,
//   ShieldAlert,
// } from 'lucide-react'
// import type { Detection } from '../../types/monitoring'

// interface AIDetectionsProps {
//   detections: Detection[]
// }

// function AIDetections({
//   detections,
// }: AIDetectionsProps) {
//   return (
//     <section className="monitoring-panel">
//       <div className="monitoring-panel-title">
//         <div>
//           <h3>AI Detections</h3>
//           <p>Recent detection results</p>
//         </div>

//         <ShieldAlert size={19} />
//       </div>

//       <div className="monitoring-detection-list">
//         {detections.map((detection) => (
//           <div
//             className="monitoring-detection-item"
//             key={detection.id}
//           >
//             <div className="monitoring-detection-icon">
//               {detection.type === 'helmet' ? (
//                 <CheckCircle size={17} />
//               ) : (
//                 <AlertTriangle size={17} />
//               )}
//             </div>

//             <div>
//               <strong>{detection.label}</strong>
//               <span>
//                 {detection.confidence}% confidence ·{' '}
//                 {detection.timestamp}
//               </span>
//             </div>
//           </div>
//         ))}
//       </div>
//     </section>
//   )
// }

// export default AIDetections