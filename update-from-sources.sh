#!/usr/bin/env bash
set -euo pipefail

INSTALLER_REMOTE="${INSTALLER_REMOTE:-${INSTALL_REMOTE:-installer}}"
INSTALLER_BRANCH="${INSTALLER_BRANCH:-${INSTALL_BRANCH:-main}}"
DEPLOY_REMOTE="${DEPLOY_REMOTE:-deploy}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-docs/critical-refinements}"
DEPLOY_SPLIT_BRANCH="${DEPLOY_SPLIT_BRANCH:-import/deploy-split}"
INSTALLER_SYNC_REF="${INSTALLER_SYNC_REF:-${INSTALL_SYNC_REF:-refs/source-sync/installer}}"
LEGACY_INSTALL_SYNC_REF="${LEGACY_INSTALL_SYNC_REF:-refs/source-sync/install}"
DEPLOY_SYNC_REF="${DEPLOY_SYNC_REF:-refs/source-sync/deploy}"

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

target_branch="$(git branch --show-current)"
if [[ -z "$target_branch" ]]; then
	echo "error: this script must be run from a checked-out branch, not detached HEAD" >&2
	exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
	echo "error: working tree is not clean; commit, stash, or discard local changes first" >&2
	exit 1
fi

subtree_help="$(git subtree 2>&1 || true)"
if ! grep -q "usage: git subtree" <<<"$subtree_help"; then
	echo "error: git subtree is not available in this Git installation" >&2
	exit 1
fi

last_subtree_split() {
	local prefix="$1"
	git log --grep="git-subtree-dir: $prefix" --format='%B' -n 1 |
		sed -n 's/^git-subtree-split: //p' |
		head -n 1
}

echo "Fetching installer source from $INSTALLER_REMOTE/$INSTALLER_BRANCH..."
installer_ref="refs/remotes/$INSTALLER_REMOTE/$INSTALLER_BRANCH"
git fetch "$INSTALLER_REMOTE" "refs/heads/$INSTALLER_BRANCH:$installer_ref"
installer_commit="$(git rev-parse --verify "$installer_ref")"
last_installer_commit=""
if git rev-parse --verify --quiet "$INSTALLER_SYNC_REF" >/dev/null; then
	last_installer_commit="$(git rev-parse --verify "$INSTALLER_SYNC_REF")"
elif git rev-parse --verify --quiet "$LEGACY_INSTALL_SYNC_REF" >/dev/null; then
	last_installer_commit="$(git rev-parse --verify "$LEGACY_INSTALL_SYNC_REF")"
else
	last_installer_commit="$(last_subtree_split installer)"
	if [[ -z "$last_installer_commit" ]]; then
		last_installer_commit="$(last_subtree_split install)"
	fi
fi

if [[ "$last_installer_commit" == "$installer_commit" ]]; then
	echo "No installer changes since last successful sync; skipping installer/."
	git update-ref "$INSTALLER_SYNC_REF" "$installer_commit"
else
	echo "Updating installer/ from $INSTALLER_REMOTE/$INSTALLER_BRANCH..."
	git subtree pull \
		--prefix=installer \
		"$INSTALLER_REMOTE" "$INSTALLER_BRANCH" \
		-m "chore: update installer from source"
	git update-ref "$INSTALLER_SYNC_REF" "$installer_commit"
fi

echo
echo "Fetching deploy source from $DEPLOY_REMOTE/$DEPLOY_BRANCH..."
deploy_ref="refs/remotes/$DEPLOY_REMOTE/$DEPLOY_BRANCH"
git fetch "$DEPLOY_REMOTE" "refs/heads/$DEPLOY_BRANCH:$deploy_ref"
deploy_commit="$(git rev-parse --verify "$deploy_ref")"
last_deploy_commit=""
if git rev-parse --verify --quiet "$DEPLOY_SYNC_REF" >/dev/null; then
	last_deploy_commit="$(git rev-parse --verify "$DEPLOY_SYNC_REF")"
elif git show-ref --verify --quiet "refs/heads/source/release-pipeline-deploy"; then
	last_deploy_commit="$(git rev-parse --verify refs/heads/source/release-pipeline-deploy)"
fi

if [[ "$last_deploy_commit" == "$deploy_commit" ]]; then
	echo "No deploy changes since last successful sync; skipping deploy/."
	git update-ref "$DEPLOY_SYNC_REF" "$deploy_commit"
elif [[ -n "$last_deploy_commit" ]] && git diff --quiet "$last_deploy_commit" "$deploy_commit" -- deploy; then
	echo "Deploy source changed, but deploy/ did not; skipping deploy/."
	git update-ref "$DEPLOY_SYNC_REF" "$deploy_commit"
else
	echo
	echo "Regenerating deploy split branch $DEPLOY_SPLIT_BRANCH..."
	if git show-ref --verify --quiet "refs/heads/$DEPLOY_SPLIT_BRANCH"; then
		git branch -D "$DEPLOY_SPLIT_BRANCH"
	fi
	git subtree split --quiet --prefix=deploy "$DEPLOY_REMOTE/$DEPLOY_BRANCH" -b "$DEPLOY_SPLIT_BRANCH"

	echo
	echo "Merging latest deploy split into $target_branch:deploy/..."
	git subtree merge \
		--prefix=deploy \
		"$DEPLOY_SPLIT_BRANCH" \
		-m "chore: update deploy from release pipeline"
	git update-ref "$DEPLOY_SYNC_REF" "$deploy_commit"
fi

echo
echo "Done. Current status:"
git status --short --branch
