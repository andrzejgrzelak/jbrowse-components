import React from 'react'
import {
  AnyConfigurationModel,
  readConfObject,
} from '@jbrowse/core/configuration'
import { observer } from 'mobx-react'
import { Feature } from '@jbrowse/core/util'

function Stick({
  feature,
  config,
  layoutRecord: {
    anchorLocation,
    y,
    data: { radiusPx },
  },
}: {
  feature: Feature
  config: AnyConfigurationModel
  layoutRecord: {
    anchorLocation: number
    y: number
    data: { radiusPx: number }
  }
}) {
  return (
    <line
      x1={anchorLocation}
      y1={0}
      x2={anchorLocation}
      y2={y + 2 * radiusPx}
      stroke={readConfObject(config, 'stickColor', { feature })}
      strokeWidth={readConfObject(config, 'stickWidth', { feature })}
    />
  )
}

export default observer(Stick)
