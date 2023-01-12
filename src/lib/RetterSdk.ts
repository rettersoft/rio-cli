import Retter, {RetterRegion} from "@retter/sdk";
import {RIO_CLI_PLATFORM, RIO_CLI_ROOT_DOMAIN, RIO_CLI_ROOT_PROJECT_ID, RIO_CLI_STAGE, RIO_CLI_URL} from "../config";
import {Auth} from "./Auth";
import {RetterCloudObject, RetterCloudObjectCall, RetterCloudObjectConfig} from "@retter/sdk/dist/types";
import {CliConfig} from "./CliConfig";


export enum RetterRootClasses {
    Project = 'Project',
    User = 'User',
    RetterClass = 'RetterClass',
}

export enum RetterRootMethods {
    generateAdminCustomToken = 'generateCustomTokenForRioCLI',
    getClassFiles = 'getFiles',
    upsertModel = 'upsertModel',
    upsertModels = 'upsertModels',
    createClass = 'createClass',
    saveClassFiles = 'save',
    deployClass = 'deploy',
    upsertDependency = 'upsertDependency'
}

export class RetterSdk {

    private static retterRootSdk: Retter

    static prepareRootUrlByKeyValue(classId: string, methodName: string, options: { key: string, value: string }, domain?: string) {
        let url
        
        if (domain) // GET URL FROM PROFILE
        {
            url = domain
        }
        else if (RIO_CLI_URL) { // GET URL FROM ENV
            url = RIO_CLI_URL
        } else { // GET DEFAULT URL
            url = RIO_CLI_ROOT_DOMAIN
            if (RIO_CLI_STAGE === 'PROD') {
                url = `${RIO_CLI_ROOT_PROJECT_ID}.api.${url}`
            } else {
                url = `${RIO_CLI_ROOT_PROJECT_ID}.test-api.${url}`
            }
        }
        return `https://${url}/${RIO_CLI_ROOT_PROJECT_ID}/CALL/${classId}/${methodName}/${options.key}!${options.value}`
    }

    static async getRootRetterSdkByAdminProfile(profile: string): Promise<Retter> {
        try {
            if (this.retterRootSdk) return this.retterRootSdk
            const config = CliConfig.getAdminConfig(profile)

            const sdk = Retter.getInstance({
                projectId: RIO_CLI_ROOT_PROJECT_ID,
                url: config.domain || RIO_CLI_URL,
                region: RIO_CLI_STAGE === 'PROD' ? RetterRegion.euWest1 : RetterRegion.euWest1Beta,
                platform: RIO_CLI_PLATFORM,
                logLevel: 'silent'
            })

            const customAuth = await Auth.getRootAdminCustomToken(config)
            await sdk.authenticateWithCustomToken(customAuth.customToken)

            this.retterRootSdk = sdk
            return sdk
        } catch (e: any) {
            const customMessage = e.response && e.response.data ? (typeof e.response.data === "object" ? JSON.stringify(e.response.data) : e.response.data) : ''
            throw new Error('Authentication error (' + e.toString() + ') :: ' + customMessage)
        }
    }

    static async getCloudObject(sdk: Retter, config: RetterCloudObjectConfig) {
        try {
            return await sdk.getCloudObject(config)
        } catch (e: any) {
            let err = `Getting Cloud Object \n` + e.toString()
            if (e.response && e.response.data && e.response.data.message) {
                err += '\n' + e.response.data.message
            } else {
                err += '\nUnknown error'
            }
            throw new Error(err)
        }
    }

    static async callMethod<D = any>(cloudObject: RetterCloudObject, params: RetterCloudObjectCall): Promise<D> {
        try {
            const resp = await cloudObject.call<D>(params)
            return resp.data
        } catch (e: any) {
            let err = `Calling Method \n` + e.toString()
            if (e.response && e.response.data && e.response.data.message) {
                err += '\n' + e.response.data.message
            } else {
                err += '\nUnknown error'
            }
            throw new Error(err)
        }
    }
}
