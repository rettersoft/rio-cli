import jwt from "jsonwebtoken";
import axios from "axios";
import {CliConfig} from "./CliConfig";
import {RetterRootClasses, RetterRootMethods, RetterSdk} from "./RetterSdk";
import {RIO_CLI_ROOT_PROJECT_ID} from "../config";
import {ConsoleMessage} from "./ConsoleMessage";


export class Auth {

    static async getRootAdminCustomToken(profile: string) {
        const config = CliConfig.getAdminConfig(profile)
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
                url: RetterSdk.prepareRootUrlByKeyValue(RetterRootClasses.User, RetterRootMethods.generateAdminCustomToken, byKeyValue),
                method: 'post',
                data: {
                    "idToken": token
                }
            })
            if (!result || !result.data || !result.data.customToken) {
                console.error('Custom token error!')
            } else {
                ConsoleMessage.message('Auth Info:')
                console.table(
                    JSON.parse(Buffer.from(result.data.customToken.split('.')[1], 'base64').toString('utf-8'))
                )
                return result.data.customToken
            }
        } catch (e) {
            console.error(e.toString())
            if (e.response) {
                console.log(e.response.data)
            }
        }
        process.exit(0)
    }

}
