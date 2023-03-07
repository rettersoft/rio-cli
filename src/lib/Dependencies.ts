import {RIO_CLI_DEPENDENCIES_FOLDER} from "../config";
import * as path from "path";
import * as fs from "fs";
import AdmZip from "adm-zip"
import {FileExtra} from "./FileExtra";
import {Tmp} from "./Tmp";
import * as crypto from "crypto";
import {Project} from "./Project";
import _ from "lodash";
import { ConsoleMessage } from "./ConsoleMessage";
import chalk from "chalk";

export interface IDependencyContent extends IRemoteDependencyContent {
    zip: Buffer
}

export interface IRemoteDependencyContent {
    dependencyName: string
    hash: string
}


export class Dependencies {

    static getListedDependencies(classNames: string[]) {
        let classDependencies: string[] = []

        for (const className of classNames) {
            const template = Project.getLocalClassTemplate(className)
            if (template.dependencies && template.dependencies.length) {
                classDependencies = [...classDependencies, ...template.dependencies]
            }
        }
        return _.uniq(classDependencies)
    }

    static checkDependenciesFileTypes(): boolean {
        const dependencies = fs.readdirSync(path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER), { withFileTypes: true })

        for (const name of dependencies) {
            if (!name.isDirectory()) continue
            
            const dependencyPath = path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER, name.name)

            const files = fs.readdirSync(dependencyPath, { withFileTypes: true })

            return files.some((file) => file.name === "tsconfig.json")
        }
        return false
    }

    static getDependenciesWithContents(): IDependencyContent[] {
        return this.getAllLocalDependencyNames().map((dependencyName: string) => {
            const zip = this.zipDependency(dependencyName)
            return {
                dependencyName,
                ...zip
            }
        })
    }

    static getAllLocalDependencyNames() {
        if (!fs.existsSync(path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER))) {
            return []
        }
        return fs.readdirSync(path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER), {withFileTypes: true}).reduce<string[]>((acc, currFile) => {
            if (currFile.isDirectory()) acc.push(currFile.name)
            return acc
        }, [])
    }

    static zipDependency(dependencyName: string) {
        const zip = new AdmZip()
        const tempFolder = Tmp.getUniqueTmpPath()
        const dest = path.join(tempFolder, dependencyName, 'nodejs', 'node_modules', dependencyName)
        FileExtra.copySync(path.join(process.cwd(), RIO_CLI_DEPENDENCIES_FOLDER, dependencyName), dest)
        zip.addLocalFolder(path.join(tempFolder, dependencyName))
        Tmp.clearUniqueTmpPath(tempFolder)
        let nameHash = ''
        let dataHash = ''
        _.sortBy(zip.getEntries(), 'entryName').map(e => {
            nameHash += e.entryName
            dataHash += e.getCompressedData().toString('hex')
        })

        return {
            zip: zip.toBuffer(),
            hash: crypto.createHash('sha256').update(nameHash + dataHash).digest('hex')
        }
    }
}
