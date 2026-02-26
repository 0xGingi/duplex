import { useTabStore } from '../../stores/useTabStore.ts'
import ProjectSelector from './ProjectSelector.tsx'
import TabItem from './TabItem.tsx'
import NewTabButton from './NewTabButton.tsx'

export default function LeftSidebar() {
  const tabs = useTabStore((s) => s.tabs)

  return (
    <div className="flex flex-col h-full">
      {/* Project selector */}
      <div className="p-2 border-b border-border">
        <ProjectSelector />
      </div>

      {/* Tab list */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} />
        ))}
      </div>

      {/* New branch button */}
      <div className="p-2 border-t border-border">
        <NewTabButton />
      </div>
    </div>
  )
}
