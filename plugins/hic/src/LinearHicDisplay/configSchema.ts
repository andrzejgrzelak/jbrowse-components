import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { baseLinearDisplayConfigSchema } from '@jbrowse/plugin-linear-genome-view'
import { Instance } from 'mobx-state-tree'
import PluginManager from '@jbrowse/core/PluginManager'

/**
 * #config LinearHicDisplay
 */
function x() {} // eslint-disable-line @typescript-eslint/no-unused-vars

const HicTrackConfigFactory = (pluginManager: PluginManager) => {
  return ConfigurationSchema(
    'LinearHicDisplay',
    {
      /**
       * #slot
       */
      renderer: pluginManager.getRendererType('HicRenderer').configSchema,
    },
    {
      /**
       * #baseConfiguration
       */
      baseConfiguration: baseLinearDisplayConfigSchema,
      explicitlyTyped: true,
    },
  )
}

export type HicTrackConfigModel = ReturnType<typeof HicTrackConfigFactory>
export type HicTrackConfig = Instance<HicTrackConfigModel>
export default HicTrackConfigFactory
