import fse from "fs-extra";
import * as path from "path";
import {PROJECT_CLASSES_FOLDER} from "../config";
import fs from "fs";

export class FileExtra {

    static getFileContextOrFail(path: string): Buffer {
        const result = fse.readFileSync(path)
        if (!result) throw new Error(`File not found! [${path}]`)
        return result
    }

    static async writeFile(path: string, content: string) {
        await fse.writeFile(path, content)
    }

    static copySync(src: string, dest: string) {
        fse.copySync(src, dest)
    }

    static isClassFile(className: string, fileKey: string) {
        return fse.lstatSync(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, fileKey)).isFile()
    }

    static isClassFolder(className: string, folderKey: string) {
        return fse.lstatSync(path.join(process.cwd(), PROJECT_CLASSES_FOLDER, className, folderKey)).isDirectory()
    }

    static getAllFiles(dirPath: string, fileKeys: string[] = []) {
        const files = fs.readdirSync(dirPath, {withFileTypes: true})

        for (const file of files) {
            if (file.isDirectory() && !["models", "node_modules", "__tests__"].includes(file.name)) {
                this.getAllFiles(path.join(dirPath, file.name), fileKeys)
            } else if (file.isFile()) {
                fileKeys.push(path.join(dirPath, file.name).toString())
            }
        }

        return fileKeys
    }

}
