import { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import { NoAssemblyRegion } from '@jbrowse/core/util/types'
import { openLocation } from '@jbrowse/core/util/io'
import { readConfObject } from '@jbrowse/core/configuration'
import { unzip } from '@gmod/bgzf-filehandle'
import PAFAdapter from '../PAFAdapter/PAFAdapter'

interface PafRecord {
  records: NoAssemblyRegion[]
  extra: {
    blockLen: number
    mappingQual: number
    numMatches: number
    strand: number
  }
}

function isGzip(buf: Buffer) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

/* adapted from chain2paf by Andrea Guarracino, license reproduced below
 *
 * MIT License
 *
 * Copyright (c) 2021 Andrea Guarracino
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

function generate_record(
  q_name: string,
  q_start: number,
  q_end: number,
  q_strand: string,
  t_name: string,
  t_start: number,
  t_end: number,
  cigar: string,
  num_matches: number,
) {
  return {
    records: [
      { refName: q_name, start: q_start, end: q_end },
      { refName: t_name, start: t_start, end: t_end },
    ],
    extra: {
      numMatches: num_matches,
      blockLen: Math.max(q_end - q_start, t_end - t_start),
      strand: q_strand === '-' ? -1 : 1,
      mappingQual: 0,
      cg: cigar,
    },
  } as PafRecord
}

function paf_chain2paf(lines: string[]) {
  let t_name = ''
  let t_start = 0
  let t_end = 0
  let q_name = ''
  let q_size = ''
  let q_strand = ''
  let q_start = 0
  let q_end = 0
  let num_matches = 0
  let cigar = ''
  const records = []
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    const l_tab = l.replace(/ /g, '\t') // There are CHAIN files with space-separated fields
    const l_vec = l_tab.split('\t')

    if (l_vec[0] === 'chain') {
      // Emit previous PAF row, if available
      if (cigar) {
        records.push(
          generate_record(
            q_name,
            q_start,
            q_end,
            q_strand,
            t_name,
            t_start,
            t_end,
            cigar,
            num_matches,
          ),
        )
      }

      // Save query/target information
      // score -- chain score
      // tName -- chromosome (reference sequence)
      // tSize -- chromosome size (reference sequence)
      // tStrand -- strand (reference sequence)
      // tStart -- alignment start position (reference sequence)
      // tEnd -- alignment end position (reference sequence)
      // qName -- chromosome (query sequence)
      // qSize -- chromosome size (query sequence)
      // qStrand -- strand (query sequence)
      // qStart -- alignment start position (query sequence)
      // qEnd -- alignment end position (query sequence)
      // id -- chain ID
      t_name = l_vec[2]
      t_start = +l_vec[5]
      t_end = +l_vec[6]
      q_name = l_vec[7]
      q_size = l_vec[8]
      q_strand = l_vec[9]
      q_start = +l_vec[10]
      q_end = +l_vec[11]
      if (q_strand === '-') {
        const tmp = q_start
        q_start = +q_size - q_end
        q_end = +q_size - tmp
      }

      // Initialize PAF fields
      num_matches = 0
      cigar = ''
    } else {
      // size -- the size of the ungapped alignment
      //
      // dt -- the difference between the end of this block and the beginning
      //    of the next block (reference sequence)
      //
      // dq -- the difference between the end of this block and the beginning
      //    of the next block (query sequence)
      const size_ungapped_alignment = +l_vec[0] || 0
      const diff_in_target = l_vec.length > 1 ? +l_vec[1] : 0
      const diff_in_query = l_vec.length > 2 ? +l_vec[2] : 0

      if (size_ungapped_alignment !== 0) {
        num_matches += +size_ungapped_alignment
        cigar += size_ungapped_alignment + 'M'
      }
      if (diff_in_query !== 0) {
        cigar += diff_in_query + 'I'
      }
      if (diff_in_target !== 0) {
        cigar += diff_in_target + 'D'
      }
    }
  }

  // Emit last PAF row, if available
  if (cigar) {
    generate_record(
      q_name,
      q_start,
      q_end,
      q_strand,
      t_name,
      t_start,
      t_end,
      cigar,
      num_matches,
    )
  }
  return records
}

export default class ChainAdapter extends PAFAdapter {
  async setupPre(opts?: BaseOptions) {
    const chainLocation = openLocation(
      readConfObject(this.config, 'chainLocation'),
      this.pluginManager,
    )
    const buffer = (await chainLocation.readFile(opts)) as Buffer
    const buf = isGzip(buffer) ? await unzip(buffer) : buffer
    // 512MB  max chrome string length is 512MB
    if (buf.length > 536_870_888) {
      throw new Error('Data exceeds maximum string length (512MB)')
    }
    const text = new TextDecoder('utf8', { fatal: true }).decode(buf)
    return paf_chain2paf(text.split('\n').filter(line => !!line))
  }
}