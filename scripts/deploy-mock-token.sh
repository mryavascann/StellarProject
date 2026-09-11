#!/usr/bin/env bash
set -euo pipefail

# Asıl mantık TypeScript'tedir; bu dosya Makefile/README için taşınabilir giriş noktasıdır.
pnpm exec tsx scripts/deploy-mock-token.ts
