import type { AIModelStatus } from '../../types/aiModels'

interface AIModelStatusBadgeProps {
  status: AIModelStatus
}

function AIModelStatusBadge({
  status,
}: AIModelStatusBadgeProps) {
  return (
    <span className={`ai-models-status-badge ${status}`}>
      <span className="ai-models-status-dot" />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  )
}

export default AIModelStatusBadge