#!/usr/bin/env bash

set -euo pipefail

VPS_HOST="${VPS_HOST:-root@82.112.255.95}"
REMOTE_BASE_DIR="${REMOTE_BASE_DIR:-/var/www/html/isaure/sites/devisio.isaure-lohest.com}"

echo "Rolling back devisio.isaure-lohest.com on ${VPS_HOST}"
ssh "${VPS_HOST}" "
  set -e
  if [ ! -L '${REMOTE_BASE_DIR}/previous' ]; then
    echo 'No previous release symlink found. Aborting.'
    exit 1
  fi

  PREVIOUS_TARGET=\$(readlink -f '${REMOTE_BASE_DIR}/previous')
  CURRENT_TARGET=''
  if [ -L '${REMOTE_BASE_DIR}/current' ]; then
    CURRENT_TARGET=\$(readlink -f '${REMOTE_BASE_DIR}/current')
  fi

  ln -sfn \"\${PREVIOUS_TARGET}\" '${REMOTE_BASE_DIR}/current'

  if [ -n \"\${CURRENT_TARGET}\" ]; then
    ln -sfn \"\${CURRENT_TARGET}\" '${REMOTE_BASE_DIR}/previous'
  fi
"

echo "Rollback complete"
echo "Test URL: https://devisio.isaure-lohest.com"
