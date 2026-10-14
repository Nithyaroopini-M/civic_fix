const STEPS = ['Submitted', 'Pending Review', 'Assigned', 'In Progress', 'Resolved']

export default function StatusTimeline({ timeline = [], currentStatus }) {
  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {STEPS.map((step, i) => {
        const done = timeline.some(t => t.status === step)
        const isCurrent = currentStatus === step
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex flex-col items-center`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${done || isCurrent ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? '✓' : i + 1}
              </div>
              <span className={`text-xs mt-1 ${isCurrent ? 'text-blue-700 font-semibold' : 'text-gray-500'}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-6 mb-4 ${done ? 'bg-blue-600' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
