import Retter, { RetterRegion } from '@retter/sdk'
import { RIO_CLI_PLATFORM, RIO_CLI_ROOT_DOMAIN, RIO_CLI_ROOT_PROJECT_ID, RIO_CLI_STAGE, RIO_CLI_URL } from '../config'
import axios from 'axios'
import { IRIOCliConfigProfileItemData } from './CliConfig'
import jwt from 'jsonwebtoken'
import { Api } from './Api'
import chalk from 'chalk'

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
  upsertDependency = 'upsertDependency',
}

export interface KeyValue {
  [key: string]: any
}
export interface AuthenticateCurrentSessionResponse {
  retter: Retter
  root_version: string
}

function prepareRootUrlByKeyValue(classId: string, methodName: string, options: { key: string; value: string }, endpoint?: string) {
  let url
  if (RIO_CLI_URL) {
    url = RIO_CLI_URL
  } else if (endpoint) {
    url = endpoint
  } else {
    url = RIO_CLI_ROOT_DOMAIN
    if (RIO_CLI_STAGE === 'PROD') {
      url = `${RIO_CLI_ROOT_PROJECT_ID}.api.${url}`
    } else {
      url = `${RIO_CLI_ROOT_PROJECT_ID}.test-api.${url}`
    }
  }
  return `https://${url}/${RIO_CLI_ROOT_PROJECT_ID}/CALL/${classId}/${methodName}/${options.key}!${options.value}`
}

async function getRootAdminCustomToken(config: IRIOCliConfigProfileItemData) {
  try {
    const token = jwt.sign(
      {
        projectId: RIO_CLI_ROOT_PROJECT_ID,
        secretId: config.secretId,
        expiresIn: 30,
      },
      config.secretKey,
    )

    const byKeyValue = {
      key: 'secretId',
      value: config.secretId,
    }
    const result = await axios({
      url: prepareRootUrlByKeyValue(RetterRootClasses.User, RetterRootMethods.generateAdminCustomToken, byKeyValue, config.endpoint),
      method: 'post',
      data: {
        idToken: token,
      },
    })
    if (!result || !result.data || !result.data.customToken) {
      throw new Error('Custom token error!')
    } else {
      return {
        customToken: result.data.customToken,
        root_version: result.data.version || '',
      }
    }
  } catch (error: any) {
    throw error
  }
}

export async function authenticateCurrentSession(profile_config: IRIOCliConfigProfileItemData): Promise<AuthenticateCurrentSessionResponse> {
  try {
    const sdk = Retter.getInstance({
      projectId: RIO_CLI_ROOT_PROJECT_ID,
      url: profile_config.endpoint || RIO_CLI_URL,
      region: RIO_CLI_STAGE === 'PROD' ? RetterRegion.euWest1 : RetterRegion.euWest1Beta,
      platform: RIO_CLI_PLATFORM,
      logLevel: 'silent',
    })

    const customAuth = await getRootAdminCustomToken(profile_config)
    await sdk.authenticateWithCustomToken(customAuth.customToken)

    return { retter: sdk, root_version: customAuth.root_version }
  } catch (error: any) {
    Api.handleError(error, chalk.redBright(`There has been a problem with your credentials ❌`))
    throw error
  }
}
