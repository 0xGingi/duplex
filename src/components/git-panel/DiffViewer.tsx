import { useGitStore } from '../../stores/useGitStore.ts'

export default function DiffViewer() {
  const selectedFile = useGitStore((s) => s.selectedFile)
  const diffContent = useGitStore((s) => s.diffContent)

  if (!selectedFile || !diffContent) {
    return (
      <div className="px-3 py-4 text-center text-sm text-text-muted">
        Select a file to view diff
      </div>
    )
  }

  const lines = diffContent.split('\n')

  return (
    <div className="overflow-auto">
      <div className="px-3 py-2 bg-bg-tertiary border-b border-border sticky top-0">
        <span className="text-xs font-mono text-text-secondary">{selectedFile.file}</span>
        <span className="ml-2 text-[10px] text-text-muted">
          {selectedFile.staged ? 'staged diff' : 'unstaged diff'}
        </span>
      </div>
      <pre className="text-xs font-mono leading-5 p-2">
        {lines.map((line, i) => {
          let color = 'text-text-secondary'
          let bg = ''

          if (line.startsWith('+') && !line.startsWith('+++')) {
            color = 'text-green'
            bg = 'bg-green/5'
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            color = 'text-red'
            bg = 'bg-red/5'
          } else if (line.startsWith('@@')) {
            color = 'text-cyan'
            bg = 'bg-cyan/5'
          } else if (line.startsWith('diff') || line.startsWith('index')) {
            color = 'text-text-muted'
          }

          return (
            <div key={i} className={`px-2 ${bg}`}>
              <span className={color}>{line}</span>
            </div>
          )
        })}
      </pre>
    </div>
  )
}
