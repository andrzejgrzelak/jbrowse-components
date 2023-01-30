import fs from 'fs'
import path from 'path'

// locals
import { Track, LocalPathLocation, UriLocation, Config } from '../base'
import fetch from '../fetchWithProxy'
import { HeadersInit } from 'node-fetch'

export async function createRemoteStream(
  urlIn: string,
  authToken: string | null = null,
) {
  let headers: HeadersInit = {}
  if (authToken) {
    headers['Authorization'] = authToken
  }
  const response = await fetch(urlIn, { headers })
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${urlIn} status ${
        response.status
      } ${await response.text()}`,
    )
  }
  return response
}

export function isURL(FileName: string) {
  let url

  try {
    url = new URL(FileName)
  } catch (_) {
    return false
  }

  return url.protocol === 'http:' || url.protocol === 'https:'
}

export function makeLocation(location: string, protocol: string) {
  if (protocol === 'uri') {
    return {
      uri: location,
      locationType: 'UriLocation',
    } as UriLocation
  }
  if (protocol === 'localPath') {
    return {
      localPath: path.resolve(location),
      locationType: 'LocalPathLocation',
    } as LocalPathLocation
  }
  throw new Error(`invalid protocol ${protocol}`)
}

export function guessAdapterFromFileName(filePath: string): Track {
  // const uri = isURL(filePath) ? filePath : path.resolve(filePath)
  const protocol = isURL(filePath) ? 'uri' : 'localPath'
  const name = path.basename(filePath)
  if (/\.vcf\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name: name,
      assemblyNames: [],
      adapter: {
        type: 'VcfTabixAdapter',
        vcfGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?\.b?gz$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gtf?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'GtfAdapter',
        gtfLocation: { uri: filePath, locationType: 'UriLocation' },
      },
    }
  } else if (/\.vcf$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'VcfAdapter',
        vcfLocation: makeLocation(filePath, protocol),
      },
    }
  } else if (/\.gff3?$/i.test(filePath)) {
    return {
      trackId: name,
      name,
      assemblyNames: [],
      adapter: {
        type: 'Gff3Adapter',
        gffLocation: makeLocation(filePath, protocol),
      },
    }
  } else {
    throw new Error(`Unsupported file type ${filePath}`)
  }
}

export function readConf(path: string) {
  return JSON.parse(fs.readFileSync(path, 'utf8')) as Config
}

export function writeConf(obj: Config, path: string) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2))
}

export async function getTrackConfigs(
  configPath: string,
  trackIds?: string[],
  assemblyName?: string,
) {
  const { tracks } = readConf(configPath)
  if (!tracks) {
    return []
  }
  const trackIdsToIndex = trackIds || tracks?.map(track => track.trackId)
  return trackIdsToIndex
    .map(trackId => {
      const currentTrack = tracks.find(t => trackId === t.trackId)
      if (!currentTrack) {
        throw new Error(
          `Track not found in config.json for trackId ${trackId}, please add track configuration before indexing.`,
        )
      }
      return currentTrack
    })
    .filter(track => supported(track.adapter?.type))
    .filter(track =>
      assemblyName ? track.assemblyNames.includes(assemblyName) : true,
    )
}

export function supported(type: string) {
  return [
    'Gff3TabixAdapter',
    'VcfTabixAdapter',
    'Gff3Adapter',
    'VcfAdapter',
  ].includes(type)
}

export async function generateMeta({
  trackConfigs,
  attributes,
  outLocation,
  name,
  typesToExclude,
  assemblyNames,
}: {
  trackConfigs: Track[]
  attributes: string[]
  outLocation: string
  name: string
  typesToExclude: string[]
  assemblyNames: string[]
}) {
  const tracks = trackConfigs.map(({ adapter, textSearching, trackId }) => ({
    trackId,
    attributesIndexed: textSearching?.indexingAttributes || attributes,
    excludedTypes:
      textSearching?.indexingFeatureTypesToExclude || typesToExclude,
    adapterConf: adapter,
  }))

  fs.writeFileSync(
    path.join(outLocation, 'trix', `${name}_meta.json`),
    JSON.stringify(
      {
        dateCreated: new Date().toISOString(),
        tracks,
        assemblyNames,
      },
      null,
      2,
    ),
  )
}
