import { URL } from 'url'

export const extractRepoAndOwner = (
	repositoryUrl: string,
): { repo: string; owner: string } => {
	const repoUrl = new URL(repositoryUrl)
	const owner = repoUrl?.pathname?.split('/')[1]
	const repo = repoUrl?.pathname?.split('/')[2]?.replace(/\..+$/, '')
	if (owner === undefined || repo === undefined) {
		throw new Error(`Could not determine owner and repo from repository.url!`)
	}
	return { owner, repo }
}
