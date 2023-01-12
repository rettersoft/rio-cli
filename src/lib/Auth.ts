import jwt from "jsonwebtoken";
import axios from "axios";
import {CliConfig, IRIOCliConfigProfileItemData} from "./CliConfig";
import {RetterRootClasses, RetterRootMethods, RetterSdk} from "./RetterSdk";
import {RIO_CLI_ROOT_PROJECT_ID} from "../config";


export class Auth {

    static async getRootAdminCustomToken(config: IRIOCliConfigProfileItemData) {
        const token = jwt.sign({
            projectId: RIO_CLI_ROOT_PROJECT_ID,
            secretId: config.secretId,
            expiresIn: 30
        }, config.secretKey)

        try {
            const byKeyValue = {
                key: 'secretId',
                value: config.secretId
            }
            const result = await axios({
                url: RetterSdk.prepareRootUrlByKeyValue(RetterRootClasses.User, RetterRootMethods.generateAdminCustomToken, byKeyValue, config.domain),
                method: 'post',
                data: {
                    "idToken": token
                }
            })
            if (!result || !result.data || !result.data.customToken) {
                throw new Error('Custom token error!')
            } else {
                const token = JSON.parse(Buffer.from(result.data.customToken.split('.')[1], 'base64').toString('utf-8'))
                return {
                    customToken: result.data.customToken,
                    tokenData: token
                }
            }
        } catch (e) {
            throw new Error(e.toString())
        }
    }

}
