import TimeTraveller from '@jbrowse/core/util/TimeTraveller'
import type { BaseRootModel } from '@jbrowse/product-core/src/RootModel/Base'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

/**
 * #stateModel HistoryManagementMixin
 */
export const HistoryManagement = types
  .model({
    /**
     * #property
     * used for undo/redo
     */
    history: types.optional(TimeTraveller, { targetPath: '../session' }),
  })
  .actions(self => ({
    afterCreate() {
      document.addEventListener('keydown', e => {
        if (
          self.history.canRedo &&
          // ctrl+shift+z or cmd+shift+z
          (((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'KeyZ') ||
            // ctrl+y
            (e.ctrlKey && !e.shiftKey && e.code === 'KeyY'))
        ) {
          self.history.redo()
        }
        if (
          self.history.canUndo &&
          // ctrl+z or cmd+z
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.code === 'KeyZ'
        ) {
          self.history.undo()
        }
      })
      addDisposer(
        self,
        autorun(() => {
          const { session } = self as typeof self & BaseRootModel
          if (session) {
            // we use a specific initialization routine after session is
            // created to get it to start tracking itself sort of related
            // issue here
            // https://github.com/mobxjs/mobx-state-tree/issues/1089#issuecomment-441207911
            self.history.initialize()
          }
        }),
      )
    },
  }))
