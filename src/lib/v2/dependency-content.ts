import fs from 'fs'
import path from 'path';
import { join } from 'path'
import { promisify } from 'util'
import crypto, { createHash } from 'crypto'
import AdmZip from 'adm-zip'
import { DeploymentDependencies } from './types';

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

export async function readLocalDependencies(dependenciesFolderPath: string): Promise<DeploymentDependencies> {
  try {
    await fs.promises.access(dependenciesFolderPath, fs.constants.R_OK)
  } catch (err) {
    return {}
  }

  const dependencyFolders = await fs.promises.readdir(dependenciesFolderPath, { withFileTypes: true })
  const dependenciesPromises = dependencyFolders.map(async (dependencyFolder) => {
    if (!dependencyFolder.isDirectory()) {
      return null
    }

    if (dependencyFolder.name === '.DS_Store') return null


    const dependencyName = dependencyFolder.name
    const dependencyPath = join(dependenciesFolderPath, dependencyName)
    const zipContent = await zipFolder(dependencyPath)
    const hash = await generateHashForPath(dependencyPath)

    return { [dependencyName]: { hash, zipContent } }
  })

  const dependencies = await Promise.all(dependenciesPromises)
  return Object.assign({}, ...dependencies)
}

