import {RIO_CLI_DEPENDENCIES_FOLDER} from "../config";
import * as path from "path";
import * as fs from "fs";
import AdmZip from "adm-zip"
import {FileExtra} from "./FileExtra";
import {Tmp} from "./Tmp";
import * as crypto from "crypto";
import {Project} from "./Project";
import _ from "lodash";

export interface IDependencyContent extends IRemoteDependencyContent {
    zip: Buffer
}

export interface IRemoteDependencyContent {
    dependencyName: string
    hash: string
}


export class Dependencies {

    static hashDependencyContent(content: string | Buffer) {
        if (typeof content === 'string') {
            return crypto.createHash('sha256').update(Buffer.from(content, 'base64')).digest('hex')
        } else {
            return crypto.createHash('sha256').update(content).digest('hex')
        }

    }

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

    static getDependenciesWithContents(): IDependencyContent[] {
        return this.getAllLocalDependencyNames().map(dependencyName => {
            const zip = this.zipDependency(dependencyName)
            return {
                dependencyName,
                zip,
                hash: this.hashDependencyContent(zip)
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
        return zip.toBuffer()
    }
}
