import React from 'react'
import ReactDOM from 'react-dom'
import {
  createViewState,
  createJBrowseTheme,
  JBrowseLinearGenomeView as JBrowseReactLinearGenomeView,
  loadPlugins,
  ThemeProvider,
} from '@jbrowse/react-linear-genome-view'

export default class JBrowseLinearGenomeView {
  constructor(opts) {
    this.render(opts)
  }

  async render(opts) {
    const {
      container,
      assembly,
      tracks,
      configuration,
      plugins = [],
      location,
      defaultSession,
      onChange,
    } = opts
    const loadedPlugins = await loadPlugins(plugins)
    const state = createViewState({
      assembly,
      tracks,
      configuration,
      defaultSession,
      location,
      onChange,
      plugins: loadedPlugins,
    })
    this.state = state
    ReactDOM.render(
      <ThemeProvider theme={createJBrowseTheme()}>
        <JBrowseReactLinearGenomeView viewState={state} />
      </ThemeProvider>,
      container,
    )
  }

  get view() {
    return this.state && this.state.session.view
  }
}