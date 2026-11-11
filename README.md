# DRAFTJURY

DRAFTJURY is an original onchain A/B copy-testing desk for BOT Chain Mainnet. A creator opens a duel with two drafts and a locally generated prediction fingerprint. Other wallets may vote once and attach a public reason. The creator cannot vote in their own duel.

## Included

- Original responsive Vite + TypeScript interface
- EIP-6963 multi-wallet discovery with injected fallback
- MetaMask mobile handoff and BOT Chain add/switch support
- Read-only RPC browsing before wallet connection
- Transaction review before every write
- Preview data when no contract address is configured
- Self-contained Solidity 0.8.24 contract
- Compiled ABI and bytecode

## Local development

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local` after deploying the contract:

```text
VITE_DRAFTJURY_ADDRESS=0xYOUR_CONTRACT_ADDRESS
```

## Network

- BOT Chain Mainnet
- Chain ID: 677 (`0x2a5`)
- RPC: `https://rpc.botchain.ai`
- Explorer: `https://scan.botchain.ai`

See [DEPLOY-ZH.md](DEPLOY-ZH.md) for the complete Chinese deployment steps.
