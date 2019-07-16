import { parse } from 'url'

export const extractRepoAndOwner = (
	repositoryUrl: string,
): { repo: string; owner: string } => {
	const repoUrl = parse(repositoryUrl)
	if (!repoUrl.path) {
		throw new Error(`Could not find path in repository.url!`)
	}
	const owner = repoUrl.path.split('/')[1]
	const repo = repoUrl.path.split('/')[2].replace(/\..+$/, '')
	return { owner, repo }
}
