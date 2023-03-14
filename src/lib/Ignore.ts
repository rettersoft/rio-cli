import fs from "fs";
import path from "path";
import {RIO_CLI_IGNORE_FILE} from "../config";
import ignore, { Ignore as OriginalIgnore} from "ignore";
export class Ignore {

    static ign: OriginalIgnore

    // TODO - write this better
    static isIgnored(filePath: string) {
        
        if (!Ignore.ign) {
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
    
            Ignore.ign = ignore().add(ignoreFile)
        }
       
        return Ignore.ign.ignores(filePath)
    }

}
