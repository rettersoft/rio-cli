interface IProjectTemplateMethod {
    inputModel?: string
    outputModel?: string
    errorModel?: string
    queryStringModel?: string
}

export interface IProjectTemplate {
    methods?: IProjectTemplateMethod[]
    init: IProjectTemplateMethod
    get: IProjectTemplateMethod
    dependencies?: string[]
}
