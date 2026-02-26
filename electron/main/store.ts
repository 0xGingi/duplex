import Store from 'electron-store'

const store = new Store({
  name: 'duplex-config',
  defaults: {
    lastProjectPath: undefined as string | undefined,
    tabs: [] as unknown[],
    activeTabId: undefined as string | undefined,
    windowBounds: undefined as { x: number; y: number; width: number; height: number } | undefined,
    appState: {
      sidebarWidth: 240,
      gitPanelWidth: 320,
      gitPanelOpen: true,
      bottomTerminalHeight: 208,
    },
  },
})

export default store
