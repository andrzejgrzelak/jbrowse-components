import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles } from '@material-ui/core/styles'
import { MultilevelLinearComparativeViewModel } from '../model'
import { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view/src/index'
import { Typography } from '@material-ui/core'

type LCV = MultilevelLinearComparativeViewModel
type LGV = LinearGenomeViewModel

const useStyles = makeStyles(theme => {
  return {
    guide: {
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 10,
    },
  }
})

const AreaOfInterest = observer(
  ({
    model,
    view,
    polygonPoints,
  }: {
    model: LCV
    view: LGV
    polygonPoints: any
  }) => {
    const classes = useStyles()
    const { left, right } = polygonPoints

    const width = !isNaN(right) ? right - left : 0

    const height =
      view.tracks.length === 0
        ? view.hideHeader
          ? view.height + 55
          : view.height - 13
        : view.height - 70 + 30 * view.tracks.length - view.tracks.length - 1

    return (
      <>
        <div
          className={classes.guide}
          style={{
            left,
            width,
            height,
            background: 'rgba(255, 0, 0, 0.2)',
          }}
        />
        <Typography
          className={classes.guide}
          variant="caption"
          style={{ paddingLeft: '1px', left, height, width, color: 'red' }}
        >
          {model.views[0].displayName}
        </Typography>
      </>
    )
  },
)

export default AreaOfInterest