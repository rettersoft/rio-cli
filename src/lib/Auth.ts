import Retter, { RetterRegion } from '@retter/sdk'
import { RIO_CLI_PLATFORM, RIO_CLI_ROOT_DOMAIN, RIO_CLI_ROOT_PROJECT_ID, RIO_CLI_STAGE, RIO_CLI_URL } from '../config'
import axios from 'axios'
import { CliConfig, IRIOCliConfigProfileItemData } from './CliConfig'
import jwt from 'jsonwebtoken'

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

export interface GenerateCustomToken {
  userId: string
  identity: string
  claims?: KeyValue
}

export interface AuthenticateCurrentSessionResponse {
  retter: Retter
  tokenData: GenerateCustomToken
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
  const token = jwt.sign(
    {
      projectId: RIO_CLI_ROOT_PROJECT_ID,
      secretId: config.secretId,
      expiresIn: 30,
    },
    config.secretKey,
  )

  try {
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
      const { userId, identity, claims } = jwt.decode(result.data.customToken) as GenerateCustomToken
      return {
        customToken: result.data.customToken,
        tokenData: { userId, identity, claims },
      }
    }
  } catch (e: any) {
    throw new Error(e.toString())
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

    return { retter: sdk, tokenData: customAuth.tokenData }
  } catch (e: any) {
    const customMessage = e.response && e.response.data ? (typeof e.response.data === 'object' ? JSON.stringify(e.response.data) : e.response.data) : ''
    throw new Error('Authentication error (' + e.toString() + ') :: ' + customMessage)
  }
}
