import { types, Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'
import { ElementId } from '@jbrowse/core/util/types/mst'

export default function f(pluginManager: PluginManager) {
  return types.model('JobsListModel', {
    id: ElementId,
    type: types.literal('JobsListWidget'),
  })
}

export type JobsListStateModel = ReturnType<typeof f>
export type JobsListModel = Instance<JobsListStateModel>