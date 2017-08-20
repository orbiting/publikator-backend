const GitHub = require('github-api')
const github = require('../../../lib/github')

module.exports = async (_, args, {pgdb, req}) => {
  if (!req.user) {
    throw new Error('you need to signIn first')
  }
  if (!req.user.githubAccessToken) {
    throw new Error('you need to sign in to github first')
  }

  const {
    login,
    repository,
    branch,
    path,
    content,
    parents,
    message
  } = args

  if (!parents.length > 1) {
    throw new Error('expecting > 1 parents')
  }

  const gh = new GitHub({
    token: req.user.githubAccessToken
  })

  const ghRepo = await gh
    .getRepo(login, repository)

  const parentCommit = await ghRepo
    .getCommit(parents[0])

  const blob = await ghRepo
    .createBlob(content)

  const tree = await ghRepo
    .createTree(
    [{
      path,
      mode: '100644', // blob (file)
      type: 'blob',
      sha: blob.data.sha
    }],
      parentCommit.data.tree.sha
    ).catch((e) => {
      console.log(e)
      throw new Error(e.response.data.message.toString())
    })

  const commit = await github.commit(
    req.user.githubAccessToken,
    login,
    repository,
    parents,
    tree.data.sha,
    message
  )

  const headCommit = await ghRepo
    .getBranch(branch)

  let _branch = branch
  if (parents.indexOf(headCommit.data.commit.sha) > -1) { // fast-forward
    await ghRepo
      .updateHead(
        'heads/' + _branch,
        commit.sha,
        false
      )
  } else { // auto-branching
    _branch = Math.random().toString(36).substring(7)
    await ghRepo.createRef({
      ref: 'refs/heads/' + _branch,
      sha: commit.sha
    })
  }

  return {
    sha: commit.sha,
    ref: 'refs/heads/' + _branch
  }
}