#!/usr/bin/env bash

set -euo pipefail

VPS_HOST="${VPS_HOST:-root@82.112.255.95}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/var/www/html/isaure/sites/devisio.isaure-lohest.com}"
KEEP_RELEASES="${KEEP_RELEASES:-5}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/frontend/dist/"
TIMESTAMP="$(date +"%Y%m%d-%H%M%S")"
RELEASE_DIR="${REMOTE_BASE_DIR}/releases/${TIMESTAMP}"
REMOTE_TMP_LINK="${REMOTE_BASE_DIR}/current_tmp_${TIMESTAMP}"

if [[ ! -f "${SOURCE_DIR}/index.html" ]]; then
  echo "No frontend/dist/index.html found. Run 'npm run build --workspace frontend' first. Aborting."
  exit 1
fi

echo "Deploying Vite build from ${SOURCE_DIR}"
echo "Preparing remote release directories on ${VPS_HOST}"
ssh "${VPS_HOST}" "mkdir -p '${REMOTE_BASE_DIR}/releases' '${REMOTE_BASE_DIR}/shared' '${RELEASE_DIR}'"

echo "Uploading release ${TIMESTAMP}"
rsync -avz --delete \
  "${SOURCE_DIR}" "${VPS_HOST}:${RELEASE_DIR}/"

echo "Normalizing permissions on remote release"
ssh "${VPS_HOST}" "
  set -e
  chown -R www-data:www-data '${RELEASE_DIR}'
  find '${RELEASE_DIR}' -type d -exec chmod 755 {} +
  find '${RELEASE_DIR}' -type f -exec chmod 644 {} +
"

echo "Validating uploaded release"
ssh "${VPS_HOST}" "test -f '${RELEASE_DIR}/index.html'"

echo "Switching current symlink with rollback metadata"
ssh "${VPS_HOST}" "
  set -e
  if [ -L '${REMOTE_BASE_DIR}/current' ]; then
    PREVIOUS_TARGET=\$(readlink -f '${REMOTE_BASE_DIR}/current')
    ln -sfn \"\${PREVIOUS_TARGET}\" '${REMOTE_BASE_DIR}/previous'
  fi
  ln -sfn '${RELEASE_DIR}' '${REMOTE_TMP_LINK}'
  mv -Tf '${REMOTE_TMP_LINK}' '${REMOTE_BASE_DIR}/current'
  find '${REMOTE_BASE_DIR}/releases' -mindepth 1 -maxdepth 1 -type d | sort -r | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
"

echo "Deployment complete"
echo "Current release: ${RELEASE_DIR}"
echo "Test URL: https://devisio.isaure-lohest.com"
