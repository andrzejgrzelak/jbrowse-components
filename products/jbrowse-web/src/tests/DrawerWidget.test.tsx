import '@testing-library/jest-dom/extend-expect'

import { LocalFile } from 'generic-filehandle'
import { clearCache } from '@jbrowse/core/util/io/RemoteFileWithRangeCache'
import { clearAdapterCache } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { fireEvent, getByRole } from '@testing-library/react'
import { createView, generateReadBuffer, hts } from './util'

const delay = { timeout: 15000 }

beforeEach(() => {
  clearCache()
  clearAdapterCache()
  // @ts-ignore
  fetch.resetMocks()
  // @ts-ignore
  fetch.mockResponse(
    generateReadBuffer(
      url => new LocalFile(require.resolve(`../../test_data/volvox/${url}`)),
    ),
  )
})

test('variant track test - opens feature detail view', async () => {
  const { view, findByTestId, findAllByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  view.tracks[0].displays[0].setFeatureIdUnderMouse('test-vcf-604452')
  const feats1 = await findAllByTestId('test-vcf-604452', {}, delay)
  fireEvent.click(feats1[0])

  // this text is to confirm a feature detail drawer opened
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
  const feats2 = await findAllByTestId('test-vcf-604452', {}, delay)
  fireEvent.contextMenu(feats2[0])
  fireEvent.click(await findByText('Open feature details'))
  expect(await findByTestId('variant-side-drawer')).toBeInTheDocument()
}, 20000)

test('widget drawer navigation', async () => {
  const { view, state, findByTestId, findByText } = createView()
  await findByText('Help')
  view.setNewView(0.05, 5000)
  // opens a config editor widget
  fireEvent.click(await findByTestId(hts('volvox_filtered_vcf'), {}, delay))
  fireEvent.click(
    await findByTestId('htsTrackEntryMenu-volvox_filtered_vcf', {}, delay),
  )
  fireEvent.click(await findByText('Settings'))
  await findByTestId('configEditor', {}, delay)
  // shows up when there active widgets
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(
    await findByTestId(
      'widget-drawer-selects-item-HierarchicalTrackSelectorWidget',
    ),
  )
  await findByTestId('hierarchical_track_selector')

  // test minimize and maximize widget drawer
  // @ts-ignore
  expect(state.session.minimized).toBeFalsy()

  await findByTestId('drawer-minimize')
  fireEvent.click(await findByTestId('drawer-minimize'))
  // @ts-ignore
  expect(state.session.minimized).toBeTruthy()

  fireEvent.click(await findByTestId('drawer-maximize'))
  // @ts-ignore
  expect(state.session.minimized).toBeFalsy()

  // test deleting widget from select dropdown using trash icon
  // @ts-ignore
  expect(state.session.activeWidgets.size).toEqual(2)
  fireEvent.mouseDown(
    getByRole(await findByTestId('widget-drawer-selects'), 'button'),
  )
  fireEvent.click(await findByTestId('ConfigurationEditorWidget-drawer-delete'))
  // @ts-ignore
  expect(state.session.activeWidgets.size).toEqual(1)
}, 20000)