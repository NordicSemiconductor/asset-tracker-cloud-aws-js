import { parse } from 'url'

export const extractRepoAndOwner = (
	repositoryUrl: string,
): { repo: string; owner: string } => {
	const repoUrl = parse(repositoryUrl)
	const owner = repoUrl?.path?.split('/')[1]
	const repo = repoUrl?.path?.split('/')[2].replace(/\..+$/, '')
	if (owner === undefined || repo === undefined) {
		throw new Error(`Could not determine owner and repo from repository.url!`)
	}
	return { owner, repo }
}
