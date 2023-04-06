import path from 'path'
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


async function generateHashForPath(path: string): Promise<string> {
  const stats = await fs.promises.stat(path);

  if (stats.isDirectory()) {
    const entries = await fs.promises.readdir(path);
    const hashes = await Promise.all(entries.map(entry => generateHashForPath(`${path}/${entry}`)));

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

function zipFolder(pathToFolder: string): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const zip = new AdmZip();
    
    // Add all files and directories inside the given folder to the archive
    zip.addLocalFolder(pathToFolder, 'nodejs/node_modules');

    // Get the zip buffer
    const zipBuffer = zip.toBuffer();

    // Return the zip buffer
    resolve(zipBuffer);
  });
}

export async function fetchLocalDependencies(directoryPath: string): Promise<Dependencies> {
  try {
    await fs.promises.access(directoryPath, fs.constants.R_OK)
  } catch (err) {
    return {}
  }

  const dependencyFolders = await fs.promises.readdir(directoryPath, { withFileTypes: true })
  const dependenciesPromises = dependencyFolders.map(async (dependencyFolder) => {
    if (!dependencyFolder.isDirectory()) {
      return null
    }

    if (dependencyFolder.name === '.DS_Store') return null


    const dependencyName = dependencyFolder.name
    const dependencyPath = join(directoryPath, dependencyName)
    const zipContent = await zipFolder(dependencyPath)
    const hash = await generateHashForPath(dependencyPath)

    return { [dependencyName]: { hash, zipContent } }
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
    //console.log('err', err.message)
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

// for now only package.json
export async function fetchLocalFiles(projectPath: string): Promise<Files> {
  const packageJSONpath = path.join(projectPath, 'package.json')
  try {
    await fs.promises.access(packageJSONpath, fs.constants.R_OK)
  } catch (err: any) {
    throw new Error('No package.json found in project')
  }
  return {
    'package.json': (await fs.promises.readFile(packageJSONpath)).toString(),
  }
}

// ****** MAIN ******
// ****** MAIN ******
// ****** MAIN ******
// ****** MAIN ******

export const fetchLocalProjectFiles = async (projectPath: string): Promise<ProjectContents> => {
  const [files, models, dependencies] = await Promise.all([
    fetchLocalFiles(projectPath),
    fetchLocalModelContents(path.join(projectPath, 'models')),
    fetchLocalDependencies(path.join(projectPath, 'dependencies'))
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