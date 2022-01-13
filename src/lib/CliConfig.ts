import fs from "fs";
import path from "path";
import {RIO_CLI_CONFIG_FILE_NAME, RIO_CLI_CONFIG_PATH, RIO_CLI_TEMP_FOLDER} from "../config";

export interface IRIOCliConfigProfileItemData {
    secretId: string;
    secretKey: string;
}

export interface IRIOCliConfig {
    profiles: { [profileName: string]: IRIOCliConfigProfileItemData }
}

export class CliConfig {

    static getCliConfig(): IRIOCliConfig {
        const context = fs.readFileSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_CONFIG_FILE_NAME))
        if (!context) throw new Error('Cli config file not found')
        try {
            return JSON.parse(context.toString('utf-8'))
        } catch (e) {
            throw new Error('Invalid cli config file')
        }

    }

    static listAdminProfiles() {
        let cliConfigFileContent;
        try {
            cliConfigFileContent = fs.readFileSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_CONFIG_FILE_NAME)).toString('utf-8')
        } catch (e) {
            throw new Error('rio config not found')
        }
        const config = JSON.parse(cliConfigFileContent)
        return Object.keys(config.profiles).map(key => {
            return {
                name: key,
                secretId: config.profiles[key].secretId,
            }
        })
    }

    static upsertAdminProfile(props: { profileName: string, secretId: string, secretKey: string }) {
        const {
            profileName,
            secretId,
            secretKey,
        } = props
        if (!profileName || !secretId || !secretKey)
            throw new Error('profile name, secret id and secret key are required')
        let cliConfig: IRIOCliConfig = CliConfig.getCliConfig();

        if (cliConfig) {
            cliConfig.profiles[profileName] = {
                secretId,
                secretKey
            }
        } else {
            cliConfig = {
                profiles: {
                    [profileName]: {
                        secretKey,
                        secretId
                    }
                }
            }
        }

        fs.writeFileSync(path.join(RIO_CLI_CONFIG_PATH, RIO_CLI_CONFIG_FILE_NAME), JSON.stringify(cliConfig))
    }

    static getAdminConfig(profileName: string): IRIOCliConfigProfileItemData {
        const profile = this.getCliConfig().profiles[profileName]
        if (!profile) throw new Error(`Admin profile not found [${profileName}]`)
        return profile
    }


}
