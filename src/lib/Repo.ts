import axios from "axios";
import chalk from "chalk";
import {PROJECT_RIO_CONFIG, RIO_CLI_COS_TEMPLATES_REPO_NAME} from "../config";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import {FileExtra} from "./v1/FileExtra";
import {Tmp} from "./v1/Tmp";
import {Project} from "./v1/Project";
import { getProjectConfig } from "./v2/utils";


export class Repo {
    static async downloadAndExtractGitRepo(projectId: string, templateName: string) {
        const response = await axios({
            method: 'get',
            url: `https://github.com/rettersoft/${RIO_CLI_COS_TEMPLATES_REPO_NAME}/archive/refs/heads/main.zip`,
            responseType: 'arraybuffer'
        })

        const dest = Tmp.getUniqueTmpPath()
        const zippedRepoName = RIO_CLI_COS_TEMPLATES_REPO_NAME.concat('-main')
        const zip = new AdmZip(response.data)
        zip.extractAllTo(dest)
        FileExtra.copySync(path.join(dest, zippedRepoName, templateName, '/'), dest)
        fs.rmdirSync(path.join(dest, zippedRepoName), {recursive: true})


        FileExtra.copySync(dest, process.cwd())

        Tmp.clearUniqueTmpPath(dest)


        const projectRioConfig = Project.getProjectRioConfig()
        fs.writeFileSync(path.join(process.cwd(), PROJECT_RIO_CONFIG),
            JSON.stringify(projectRioConfig, null, 2).replace('{{projectId}}', projectId))
    }

    static async downloadAndExtractGitRepoV2(profile: string, alias: string, projectId: string) {
        const response = await axios({
            method: 'get',
            url: `https://github.com/rettersoft/rio-cos-templates/archive/refs/heads/v2.zip`,
            responseType: 'arraybuffer'
        })

        const zip = new AdmZip(response.data)
        // extract all
        zip.extractAllTo(process.cwd())

        // copy project to pwd
        FileExtra.copySync(path.join(process.cwd(), 'rio-cos-templates-2'), process.cwd())

        // remove zip & folder
        fs.rmdirSync(path.join(process.cwd(), 'rio-cos-templates-2'), {recursive: true})
        fs.rmdirSync(path.join(process.cwd(), 'rio-cos-templates-2.zip'), {recursive: true})
        
        const config = {
            projectId,
            loggingAdapters: [],
            stateStreamTargets: [],
        }

        // create config file
        const configPath = path.join(process.cwd(), 'rio.json')
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

        console.log(`[${chalk.greenBright.bold(alias)}] rio.json created`)

        // create deploy script
        const packageJsonPath = path.join(process.cwd(), 'package.json')
        const deployScript = `rio d --p ${profile} --pid ${projectId} --i`
        const currentPackageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString())
        currentPackageJson.scripts = {
            ...currentPackageJson.scripts,
            deploy: deployScript
        }
        fs.writeFileSync(packageJsonPath, JSON.stringify(currentPackageJson, null, 2))


        console.log(`[${chalk.greenBright.bold(alias)}] package.json updated (deploy script added)`)
    }
}
