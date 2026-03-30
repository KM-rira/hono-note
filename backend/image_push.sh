#!/usr/bin/env bash

set -euo pipefail

if [[ -z "${GH_USER:-}" ]]; then
  echo "Error: GH_USER is not set."
  echo "Example: export GH_USER=km-rira"
  exit 1
fi

if [[ -z "${GH_PAT:-}" ]]; then
  echo "Error: GH_PAT is not set."
  echo "Example: export GH_PAT=your_github_pat"
  exit 1
fi

if [[ "${GH_USER}" != "${GH_USER,,}" ]]; then
  echo "Error: GH_USER must be lowercase for ghcr repository names."
  echo "Current: ${GH_USER}"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker command not found."
  exit 1
fi

IMAGE_NAME="${IMAGE_NAME:-hono-note-backend}"
TAG="${TAG:-latest}"
BUILD_TARGET="${BUILD_TARGET:-runner}"
FULL_IMAGE="ghcr.io/${GH_USER}/${IMAGE_NAME}:${TAG}"

echo "=== GHCR Push Script ==="
echo "User         : ${GH_USER}"
echo "Image        : ${IMAGE_NAME}"
echo "Tag          : ${TAG}"
echo "Build target : ${BUILD_TARGET}"
echo "Full Image   : ${FULL_IMAGE}"
echo

echo "==> Logging in to ghcr.io"
echo "${GH_PAT}" | docker login ghcr.io -u "${GH_USER}" --password-stdin

echo "==> Building Docker image"
docker build --pull --target "${BUILD_TARGET}" -t "${IMAGE_NAME}" .

echo "==> Tagging image"
docker tag "${IMAGE_NAME}" "${FULL_IMAGE}"

echo "==> Pushing image"
docker push "${FULL_IMAGE}"

echo
echo "=== Done ==="
echo "Pushed: ${FULL_IMAGE}"
