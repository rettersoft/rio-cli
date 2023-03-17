export interface GlobalInput {
  profile: string;
}

export interface DeploymentGlobalInput {
  classes?: string[];
  force: boolean;
  parallel: number;
  "project-id": string;
  "rio-force": boolean;
}
