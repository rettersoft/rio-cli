export interface GlobalInput {
  profile: string;
}

export interface DeploymentGlobalInput {
  classes?: string[];
  force: boolean;
  parallel: boolean;
  "project-id": string;
}
