import {Project} from "../src/lib/Project";
import path from "path";

describe('CloudObjects Tests', function () {
    test('test', async () => {
        process.chdir(path.join('tests','assets','TestProject'))
        const modelNames = Project.listModelNames()

        const contents = modelNames.map(name=>{
            return JSON.parse(Project.readModelFile(name))
        })
        expect(Array.isArray(contents)).toEqual(true)
        expect(contents[0].type).toEqual('object')
        expect(contents[1].type).toEqual('object')
        expect(contents[2].type).toEqual('object')
        expect(contents[3].type).toEqual('object')
    })
})
