import path from "path";
import {RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER} from "../config";
import fs from "fs";


export class Tmp {
    static getUniqueTmpPath() {
        return path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER, process.geteuid().toString())
    }

    static clearUniqueTmpPath(uniquePath: string) {
        console.log('Tmp cleaning...')
        fs.rmdirSync(uniquePath, {recursive: true})
        console.log('Tmp cleaned...')
    }

}
