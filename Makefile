# Kasa — Makefile
#
# Her hedef, package.json'daki ayni isimli script'i cagirir (karar K-006).
# Sebep: gelistirme makinesi Windows ve `make` kurulu olmayabilir. Iki yol da AYNI
# komutu calistirdigi icin ikilik (drift) olusmaz.
#
# Windows'ta `make` yoksa dogrudan pnpm kullan:  pnpm test / pnpm dev / pnpm sim ...
#
# NOT: GNU Make bir KURAL SATIRINDA hedef adinin icinde iki nokta ustuste kabul etmez
# (`test:live:` satiri "test" hedefi + "live:" bagimliligi olarak ayrisir ve bozulur).
# Bu yuzden `make test:live` ve `make test:ts` gibi iki noktali hedefler dosyanin
# sonundaki yakalayici `%` kuraliyla dogrudan pnpm script'ine yonlendirilir.
# Acik hedefler yakalayici kuraldan once gelir, yani asagidaki tanimlar her zaman kazanir.

.PHONY: help install test typecheck dev sim build deploy accounts seed clean

help:
	@echo "Kasa komutlari:"
	@echo "  make install        bagimliliklari kurar"
	@echo "  make test           TUM testler (kontrat + TypeScript)"
	@echo "  make test:ts        yalnizca TypeScript testleri"
	@echo "  make test:contract  yalnizca Soroban kontrat testleri"
	@echo "  make test:e2e       uctan uca: testnet + mock anchor + mock DeFindex (~3 dk)"
	@echo "  make test:live      canli modda entegrasyon testleri (etkinlik gunu)"
	@echo "  make typecheck      tip kontrolu"
	@echo "  make dev            tum uygulamalari gelistirme modunda baslatir"
	@echo "  make sim            yalnizca mock anchor'i baslatir"
	@echo "  make build          kontrati wasm32v1-none hedefine derler"
	@echo "  make accounts       test hesaplarini uretir ve friendbot ile fonlar"
	@echo "  make deploy         kontrati testnet'e deploy eder ve init cagirir"
	@echo "  make seed           demo verisini yukler"

install:
	pnpm install

test:
	pnpm run test

typecheck:
	pnpm run typecheck

dev:
	pnpm run dev

sim:
	pnpm run sim

build:
	pnpm run build:contract

accounts:
	pnpm run gen:accounts

deploy:
	pnpm run deploy

seed:
	pnpm run seed

clean:
	rm -rf node_modules **/node_modules contracts/shared-vault/target apps/web/.next

# Yakalayici: yukarida tanimlanmayan her hedef ayni isimli pnpm script'ine gider.
# `make test:live`, `make test:ts`, `make test:contract`, `make build:contract` boyle calisir.
%:
	@pnpm run $@
