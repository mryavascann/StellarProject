#!/usr/bin/env bash
set -euo pipefail

# Asıl mantık TypeScript'tedir; shell dosyası Makefile ve CI için giriş noktasıdır.
pnpm exec tsx scripts/deploy.ts
