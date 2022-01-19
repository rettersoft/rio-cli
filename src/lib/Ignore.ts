import fs from "fs";
import path from "path";
import {RIO_CLI_IGNORE_FILE} from "../config";
import ignore from "ignore";


export class Ignore {

    static isIgnored(filePath: string) {
        const fileDir = path.parse(filePath).dir
        let ignoreFile = '';

        try {
            ignoreFile = fs.readFileSync(path.join(fileDir, RIO_CLI_IGNORE_FILE)).toString('utf-8')
        } catch (e) {
            try {
                ignoreFile = fs.readFileSync(path.join(process.cwd(), RIO_CLI_IGNORE_FILE)).toString('utf-8')
            } catch (err) {
            }
        }

        const ign = ignore().add(ignoreFile)
        return ign.ignores(filePath)
    }

}
