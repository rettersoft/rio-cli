import fs from "fs";
import {RIO_CLI_CONFIG_FILE_NAME, RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER} from "./config";
import path from "path";
import {IRIOCliConfig} from "./lib/CliConfig";

function install() {
    /**
     * Create config folder if not exits
     */
    if (!fs.existsSync(RIO_CLI_CONFIG_PATH)) {
        fs.mkdirSync(RIO_CLI_CONFIG_PATH)
        const configFile: IRIOCliConfig = {
            profiles: {}
        }
        fs.writeFileSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_CONFIG_FILE_NAME), JSON.stringify(configFile))
    }
    if (!fs.existsSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER))) {
        fs.mkdirSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER), {recursive: true})
    }
}

function cleaner() {
    /**
     * Remove config folder
     */
    if (fs.existsSync(RIO_CLI_CONFIG_PATH)) {
        fs.rmdirSync(RIO_CLI_CONFIG_PATH, {recursive: true})
    }
}


export function bootstrap(): void {
    switch (process.argv.slice(2)[0]) {
        case 'postinstall':
            console.log('requirements installing')
            install()
            break
        case 'preuninstall':
            console.log('requirements uninstalling')
            cleaner()
            break
        default:
            break
    }
}

bootstrap();
