import path from 'path'
import os from 'os'
import fse from 'fs-extra'
import fs, { stat } from 'fs'
import { Files, ProjectContents, ProjectState } from './types'
import { join } from 'path'
import crypto, { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import { Dependencies } from './types';
import { gunzipSync } from 'zlib'
import { listFilesRecursively, readFilesParallelly } from './utils'

// ***** DEPENDENCIES *****
// ***** DEPENDENCIES *****
// ***** DEPENDENCIES *****


type EntryPredicate = (entryPath: string) => boolean

// bun/pnpm link node_modules/<name> to the sibling dependency <name>, which the runtime already resolves through NODE_PATH; zipping that link ships a second copy of the module.
function createSiblingDependencyLinkCheck(siblingDependencyPaths: Map<string, string>): EntryPredicate {
  return (entryPath) => {
    const siblingPath = siblingDependencyPaths.get(path.basename(entryPath))
    if (!siblingPath || path.basename(path.dirname(entryPath)) !== 'node_modules') return false
    return fs.lstatSync(entryPath).isSymbolicLink() && fs.realpathSync(entryPath) === siblingPath
  }
}

// Matches what classes drop (__tests__ in rio-cli, *.test.ts / *.test.js in the deployer); npm packages under node_modules ship as installed.
function isOwnTestEntry(dependencyPath: string, entryPath: string): boolean {
  const segments = path.relative(dependencyPath, entryPath).split(/[\\/]/)
  if (segments.includes('node_modules')) return false

  const name = segments[segments.length - 1]
  return name === '__tests__' || name.endsWith('.test.ts') || name.endsWith('.test.js')
}

// A link: dependency installs as a symlink to the sibling itself, not as a separate package, so it does not shadow the NODE_PATH copy.
function parseShadowingDependencyNames(packageJson: string): Set<string> {
  const dependencies: Record<string, string> = JSON.parse(packageJson).dependencies ?? {}
  return new Set(Object.keys(dependencies).filter((name) => !dependencies[name].startsWith('link:')))
}

async function generateHashForPath(path: string, isExcludedEntry: EntryPredicate): Promise<string> {
  const stats = await fs.promises.stat(path);

  if (stats.isDirectory()) {
    const entries = (await fs.promises.readdir(path)).filter(entry => !isExcludedEntry(`${path}/${entry}`));
    const hashes = await Promise.all(entries.map(entry => generateHashForPath(`${path}/${entry}`, isExcludedEntry)));

    const hash = crypto.createHash('sha256');
    hashes.forEach(subhash => hash.update(subhash));
    return hash.digest('hex');
  } else {
    const data = await fs.promises.readFile(path);
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }
}

// adm-zip >= 0.6 skips symlinks that leave the zipped folder, so bun/pnpm-linked node_modules are resolved into a temp copy first.
function zipFolder(dependencyPath: string, dependencyName: string, isExcludedEntry: EntryPredicate): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const dereferencedPath = fs.mkdtempSync(join(os.tmpdir(), 'rio-dependency-'));
    try {
      fse.copySync(dependencyPath, dereferencedPath, { dereference: true, filter: (src) => !isExcludedEntry(src) });

      const zip = new AdmZip();
      zip.addLocalFolder(dereferencedPath, `nodejs/node_modules/${dependencyName}`);
      resolve(zip.toBuffer());
    } catch (err) {
      reject(err);
    } finally {
      fse.removeSync(dereferencedPath);
    }
  });
}

// The image installs root package.json dependencies into node_modules, which Node searches before NODE_PATH, so a sibling sharing such a name keeps its link.
// A self link (<dep>/node_modules/<dep>) is skipped regardless: copying it recurses until ELOOP.
export async function fetchLocalDependencies(directoryPath: string, shadowingDependencyNames: Set<string>): Promise<Dependencies> {
  try {
    await fs.promises.access(directoryPath, fs.constants.R_OK)
  } catch (err) {
    return {}
  }

  const dependencyFolders = await fs.promises.readdir(directoryPath, { withFileTypes: true })
  const dependencyNames = await Promise.all(dependencyFolders.map(async (dependencyFolder) => {
    if (!dependencyFolder.isDirectory()) {
      return null
    }

    if (dependencyFolder.name === '.DS_Store') return null

    const shouldIgnore = await fs.promises
      .access(join(directoryPath, dependencyFolder.name, '.ignore'), fs.constants.R_OK)
      .then(() => true)
      .catch(() => false)

    return shouldIgnore ? null : dependencyFolder.name
  }))
  const uploadedDependencyNames = dependencyNames.filter((name): name is string => name !== null)

  const uploadedDependencyPaths = new Map<string, string>(
    uploadedDependencyNames.map((name) => [name, fs.realpathSync(join(directoryPath, name))])
  )

  const dependenciesPromises = uploadedDependencyNames.map(async (dependencyName) => {
    const dependencyPath = join(directoryPath, dependencyName)

    const isTS = await fs.promises
      .access(join(dependencyPath, 'tsconfig.json'), fs.constants.R_OK)
      .then(() => true)
      .catch(() => false)

    const isSiblingDependencyLink = createSiblingDependencyLinkCheck(
      new Map([...uploadedDependencyPaths].filter(([name]) => name === dependencyName || !shadowingDependencyNames.has(name)))
    )
    const isExcludedEntry = (entryPath: string) => isSiblingDependencyLink(entryPath) || isOwnTestEntry(dependencyPath, entryPath)
    const zipContent = await zipFolder(dependencyPath, dependencyName, isExcludedEntry)
    const hash = await generateHashForPath(dependencyPath, isExcludedEntry)

    return { [dependencyName]: { hash, zipContent, isTS } }
  })

  const dependencies = await Promise.all(dependenciesPromises)
  return Object.assign({}, ...dependencies)
}

// ****** MODELS ******
// ****** MODELS ******
// ****** MODELS ******

export const fetchLocalModelContents = async (directoryPath: string): Promise<Files> => { 
  try {
    await fs.promises.access(directoryPath, fs.constants.R_OK)
  } catch (err: any) {
    return {}
  }

  const { files } = listFilesRecursively(directoryPath, directoryPath)

  const filesWithContent = await readFilesParallelly(files)
  
  return filesWithContent
}

// ****** FILES ******
// ****** FILES ******
// ****** FILES ******
// ****** FILES ******

const PROJECT_FILES = ['package.json', 'pnpm-workspace.yaml']

export async function fetchLocalFiles(projectPath: string): Promise<Files> {
  const files: Files = {}

  for (const fileName of PROJECT_FILES) {
    const filePath = path.join(projectPath, fileName)
    try {
      await fs.promises.access(filePath, fs.constants.R_OK)
      files[fileName] = (await fs.promises.readFile(filePath)).toString()
    } catch (err: any) {
      if (fileName === 'package.json') {
        throw new Error('No package.json found in project')
      }
    }
  }

  return files
}

// ****** MAIN ******
// ****** MAIN ******
// ****** MAIN ******
// ****** MAIN ******

export const fetchLocalProjectFiles = async (projectPath: string): Promise<ProjectContents> => {
  const files = await fetchLocalFiles(projectPath)
  const [models, dependencies] = await Promise.all([
    fetchLocalModelContents(path.join(projectPath, 'models')),
    fetchLocalDependencies(path.join(projectPath, 'dependencies'), parseShadowingDependencyNames(files['package.json']))
  ])
  
  return { files, models, dependencies }
}


export const fetchRemoteProjectFiles = (state: ProjectState): ProjectContents => {

  const files = {} as Files
  const models = {} as Files
  const dependencies = {} as Dependencies

  for (const [fileName, file] of Object.entries(state.private.files || {})) {
    files[fileName] = gunzipSync(Buffer.from(file.content, 'base64')).toString('utf-8')
  }

  for (const [fileName, file] of Object.entries(state.private.models || {})) {
    models[fileName] = gunzipSync(Buffer.from(file.content, 'base64')).toString('utf-8')
  }

  for (const [fileName, file] of Object.entries(state.public.layers || {})) {
    dependencies[fileName] = {
      hash: file.hash,
    }
  }

  return {
    models,
    files,
    dependencies
  }
}