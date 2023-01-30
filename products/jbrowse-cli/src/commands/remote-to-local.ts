import fs from 'fs'
import path from 'path'
import { flags } from '@oclif/command'
import JBrowseCommand, {
  Config,
  Gff3Adapter,
  Gff3TabixAdapter,
  LocalPathLocation,
  Track,
  UriLocation,
  VcfAdapter,
  VcfTabixAdapter,
} from '../base'
import { createRemoteStream, getTrackConfigs, makeLocation, writeConf, } from '../types/common'
import { Presets, SingleBar } from 'cli-progress'

function readConf(confFilePath: string) {
  return JSON.parse(fs.readFileSync(confFilePath, 'utf8')) as Config
}

function findLocation(trackConfig: Track) {
  switch (trackConfig.adapter.type) {
    case 'Gff3Adapter':
      return trackConfig.adapter.gffLocation
    case 'Gff3TabixAdapter':
      return trackConfig.adapter.gffGzLocation
    case 'VcfAdapter':
      return trackConfig.adapter.vcfLocation
    case 'VcfTabixAdapter':
      return trackConfig.adapter.vcfGzLocation
  }
  return undefined;
}

function setLocation(trackConfig: Track, location: LocalPathLocation | UriLocation) {
  switch (trackConfig.adapter.type) {
    case 'Gff3Adapter':
      trackConfig.adapter.gffLocation = location;
      break;
    case 'Gff3TabixAdapter':
      trackConfig.adapter.gffGzLocation = location;
      break;
    case 'VcfAdapter':
      trackConfig.adapter.vcfLocation = location;
      break;
    case 'VcfTabixAdapter':
      trackConfig.adapter.vcfGzLocation = location;
      break;
  }
}

export default class RemoteToLocal extends JBrowseCommand {
  static description =
    'Donwloads remote files to local processing (eg. text-index) for any given track(s).'

  static examples = [
    "# downloads all tracks that it can find in the current directory's config.json",
    '$ jbrowse remote-to-local',
    '',
    "# downloads specific trackIds that it can find in the current directory's config.json",
    '$ jbrowse remote-to-local --tracks=track1,track2,track3',
    '',
    "# indexes all tracks in a directory's config.json or in a specific config file",
    '$ jbrowse remote-to-local --out /path/to/jb2/',
    '',
    '# indexes only a specific assembly, and overwrite what was previously there using force (which is needed if file is already downloaded)',
    '$ jbrowse remote-to-local -a hg19 --force',
    '',
    '# create index for some files for use in @jbrowse/react-linear-genome-view or similar',
    '$ jbrowse remote-to-local --file myfile.gff3.gz --file myfile.vcfgz --out indexes',
  ]

  static flags = {
    help: flags.help({ char: 'h' }),
    tracks: flags.string({
      description: `Specific tracks to download, formatted as comma separated trackIds. If unspecified, indexes all available tracks`,
    }),
    target: flags.string({
      description:
        'Path to config file in JB2 installation directory to read from.',
    }),
    assemblies: flags.string({
      char: 'a',
      description:
        'Specify the assembl(ies) to download. If unspecified, creates an index for each assembly in the config',
    }),
    out: flags.string({
      description: 'Synonym for target',
    }),
    authtoken: flags.string({
      description: 'String to send as "Authorization" header',
    }),
    force: flags.boolean({
      default: false,
      description: 'Overwrite previously existing files',
    }),
    quiet: flags.boolean({
      char: 'q',
      default: false,
      description: 'Hide the progress bars',
    }),
    dryrun: flags.boolean({
      description:
        'Just print out tracks that will be downloaded by the process, without doing any downloading',
    }),
  }

  async run() {
    await this.downloadFiles()

    this.log('Finished!')
  }

  async downloadFiles() {
    const { flags } = this.parse(RemoteToLocal)
    const { out, target, tracks, assemblies, quiet, force, dryrun,authtoken } = flags
    const outFlag = target || out || '.'

    const isDir = fs.lstatSync(outFlag).isDirectory()
    const confPath = isDir ? path.join(outFlag, 'config.json') : outFlag
    const outDir = path.dirname(confPath)
    const config = readConf(confPath)

    const asms =
      assemblies?.split(',') ||
      config.assemblies?.map(a => a.name) ||
      (config.assembly ? [config.assembly.name] : [])

    if (!asms?.length) {
      throw new Error('No assemblies found')
    }

    for (const asm of asms) {
      const trackConfigs = await getTrackConfigs(
        confPath,
        tracks?.split(','),
        asm,
      )
      if (!trackConfigs.length) {
        continue
      }
      this.log('Downloading tracks for assembly ' + asm + '...')

      for (const trackConfig of trackConfigs) {
        let location = findLocation(trackConfig);
        if (!location || location.locationType === 'LocalPathLocation')
          continue;
        const filename = path.basename(location.uri)
        const localFilesDir = outDir + '/local'

        if (!fs.existsSync(localFilesDir)) {
          fs.mkdirSync(localFilesDir)
        }
        const localPath = localFilesDir + '/' + filename;


        if (dryrun) {
          this.log(`${trackConfig.trackId}\t${trackConfig.adapter.type}\t${location.uri}`);
          this.saveLocalLocation(trackConfig, localPath, config);
        } else {
          const progressBar = new SingleBar(
            {
              format:
                '{bar} ' + trackConfig.trackId + ' {percentage}% | ETA: {eta}s',
              etaBuffer: 2000,
            },
            Presets.shades_classic,
          )

          let receivedBytes = 0
          const result = await createRemoteStream(
            location.uri,
            authtoken,
          )
          let totalBytes = +(result.headers.get('Content-Length') || 0)
          let stream = result.body

          if (!quiet) {
            progressBar.start(totalBytes, 0)
          }

          if (!force && fs.existsSync(localPath)) {
            this.log(
              `Note: ${trackConfig.trackId} has already been downloaded, use --force to overwrite it. Skipping for now`,
            )
            continue
          }
          const fileStream = fs.createWriteStream(localPath)

          stream.on('data', chunk => {
            receivedBytes += chunk.length
            progressBar.update(receivedBytes)
          })

          stream.on('error', this.error)

          stream.pipe(fileStream)

          await new Promise<void>(fulfill =>
            stream.on('close', () => {
              this.saveLocalLocation(trackConfig, localPath, config);
              fileStream.close()
              progressBar.stop()
              fulfill()
            }),
          )
        }
      }
    }

    // if (!dryrun) {
    writeConf(config, confPath.replace('.json', '.local.json'))
    // }
  }

  getLoc(elt: UriLocation | LocalPathLocation) {
    if (elt.locationType === 'LocalPathLocation') {
      return elt.localPath
    }
    return elt.uri
  }

  private saveLocalLocation(trackConfig: Track, localPath: string, config: Config) {
    setLocation(trackConfig, makeLocation(localPath, 'localPath'));
    const targetTrackIndex = config.tracks?.findIndex(track => track.trackId == trackConfig.trackId)
    if (targetTrackIndex === undefined || targetTrackIndex === -1 || !config.tracks) {
      throw new Error(`Cannot match processed track to track in config file.`)
    }
    config.tracks[targetTrackIndex] = trackConfig;
  }
}
