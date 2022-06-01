import { PluginConstructor } from '@jbrowse/core/Plugin'
import { autorun } from 'mobx'
import { SnapshotIn, onPatch, IJsonPatch } from 'mobx-state-tree'
import createModel, {
  createSessionModel,
  createConfigModel,
} from './createModel'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export default function createViewState({
  assembly,
  tracks,
  configuration,
  aggregateTextSearchAdapters,
  location,
  onChange,
  spec,
  defaultSession,
  plugins,
}: {
  assembly: Assembly
  tracks: Tracks
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  defaultSession?: SessionSnapshot
  spec?: any
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}) {
  const { model, pluginManager } = createModel(plugins || [])
  const stateTree = model.create(
    {
      config: {
        configuration,
        assembly,
        tracks,
        aggregateTextSearchAdapters,
      },
      session: defaultSession || {
        name: 'this session',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
        },
      },
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()

  const assemblyName = stateTree.assemblyManager.assemblies[0].name

  if (onChange) {
    onPatch(stateTree, onChange)
  }

  pluginManager
    .evaluateAsyncExtensionPoint('LaunchView-LinearGenomeView', {
      ...spec,
      view: stateTree.session.view,
      session: stateTree.session,
      assembly: assemblyName,
      loc: location,
    })
    .catch(e => {
      stateTree.session.notify(`${e}`, 'error')
    })

  return stateTree
}
