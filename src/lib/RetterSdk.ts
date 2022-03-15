import Retter, {RetterRegion} from "@retter/sdk";
import {RIO_CLI_PLATFORM, RIO_CLI_ROOT_DOMAIN, RIO_CLI_ROOT_PROJECT_ID, RIO_CLI_STAGE} from "../config";
import {Auth} from "./Auth";
import {RetterCloudObject, RetterCloudObjectCall, RetterCloudObjectConfig} from "@retter/sdk/dist/types";


export enum RetterRootClasses {
    Project = 'Project',
    User = 'User',
    RetterClass = 'RetterClass',
}

export enum RetterRootMethods {
    generateAdminCustomToken = 'generateCustomTokenForRioCLI',
    getClassFiles = 'getFiles',
    upsertModel = 'upsertModel',
    createClass = 'createClass',
    saveClassFiles = 'save',
    deployClass = 'deploy',
    upsertDependency = 'upsertDependency'
}

export class RetterSdk {

    private static retterRootSdk: Retter

    static prepareRootUrlByKeyValue(classId: string, methodName: string, options: { key: string, value: string }) {
        let url = RIO_CLI_ROOT_DOMAIN
        if (RIO_CLI_STAGE === 'PROD') {
            url = `${RIO_CLI_ROOT_PROJECT_ID}.api.${url}`
        } else {
            url = `${RIO_CLI_ROOT_PROJECT_ID}.test-api.${url}`
        }
        return `https://${url}/CALL/${classId}/${methodName}/${options.key}!${options.value}`
    }

    static async getRootRetterSdkByAdminProfile(profile: string): Promise<Retter> {
        try {
            if (this.retterRootSdk) return this.retterRootSdk
            const sdk = Retter.getInstance({
                projectId: RIO_CLI_ROOT_PROJECT_ID,
                region: RIO_CLI_STAGE === 'PROD' ? RetterRegion.euWest1 : RetterRegion.euWest1Beta,
                platform: RIO_CLI_PLATFORM,
                logLevel: 'silent'
            })

            const customAuth = await Auth.getRootAdminCustomToken(profile)
            await sdk.authenticateWithCustomToken(customAuth.customToken)

            this.retterRootSdk = sdk
            return sdk
        } catch (e) {
            throw new Error('Authentication error')
        }
    }

    static async getCloudObject(sdk: Retter, config: RetterCloudObjectConfig) {
        try {
            return await sdk.getCloudObject(config)
        } catch (e) {
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
        } catch (e) {
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
