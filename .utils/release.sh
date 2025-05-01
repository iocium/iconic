#!/bin/bash

set -eu

git add package*
git commit -m "RELEASE $(cat package.json | jq -r .version)"
git tag "$(cat package.json | jq -r .version)"
git push && git push --tags