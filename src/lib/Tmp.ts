import path from "path";
import {RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER} from "../config";
import fs, {existsSync} from "fs";


export class Tmp {
    static getUniqueTmpPath() {
        const _path = path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER, process.geteuid().toString())
        if (existsSync(_path)) {
            throw new Error('Temporary path already exist. Please remove .tmp folder and try again.')
        }
        fs.mkdirSync(_path, {recursive: true,})
        return _path
    }

    static clearUniqueTmpPath(uniquePath: string) {
        fs.rmdirSync(uniquePath, {recursive: true})
    }

}
