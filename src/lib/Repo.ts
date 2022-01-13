import axios from "axios";
import {PROJECT_RIO_CONFIG, RIO_CLI_COS_TEMPLATES_REPO_NAME} from "../config";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import {FileExtra} from "./FileExtra";
import {Tmp} from "./Tmp";
import {ConsoleMessage} from "./ConsoleMessage";
import {Project} from "./Project";


export class Repo {
    static async downloadAndExtractGitRepo(projectId: string, templateName: string) {
        ConsoleMessage.message('Templates downloading...')
        const response = await axios({
            method: 'get',
            url: `https://github.com/rettersoft/${RIO_CLI_COS_TEMPLATES_REPO_NAME}/archive/refs/heads/main.zip`,
            responseType: 'arraybuffer'
        })

        ConsoleMessage.message('Templates extracting...')
        const dest = Tmp.getUniqueTmpPath()
        const zippedRepoName = RIO_CLI_COS_TEMPLATES_REPO_NAME.concat('-main')
        const zip = new AdmZip(response.data)
        zip.extractAllTo(dest)
        FileExtra.copySync(path.join(dest, zippedRepoName, templateName, '/'), dest)
        fs.rmdirSync(path.join(dest, zippedRepoName), {recursive: true})
        ConsoleMessage.message('Templates ready')

        ConsoleMessage.message('Template cloning into project...')
        FileExtra.copySync(dest, process.cwd())
        ConsoleMessage.message('Template cloned')
        Tmp.clearUniqueTmpPath(dest)

        ConsoleMessage.message('Rio config updating...')
        const projectRioConfig = Project.getProjectRioConfig()
        fs.writeFileSync(path.join(process.cwd(), PROJECT_RIO_CONFIG),
            JSON.stringify(projectRioConfig, null, 2).replace('{{projectId}}', projectId))
        ConsoleMessage.message('Rio config ready')

    }
}
