# RomeWork

Local adaptation of [FreelanceGuard](https://github.com/tranhop26/freelanceguard) at commit `1b7f8df1cc71b124e273f1e8f0a2775106eea234`. The landing page, dashboard, job forms and chat use the original Next.js app and local sample data. The Hadrian workroom uses the Rome SDK, an immutable single-milestone escrow, browser-wallet signing and on-chain readback.

From this checkout, run `npm ci`, then `npm run dev:local`. Open [RomeWork](http://127.0.0.1:3000) or the [Hadrian workroom](http://127.0.0.1:3000/rome). Use the original demo fixture locally.

- [Hadrian runbook](docs/HADRIAN-RUNBOOK.md)
- [Verified Hadrian deployment and Solana Devnet payout](docs/HADRIAN-SUBMISSION-EVIDENCE.md)
- `npm run compile:rome` checks that the local build matches the escrow artifact.
- `npm run test:engine` checks wallet adapter, accounting, evidence and recovery rules.
- `npm run test:rome` exercises the running server, including Hadrian read-only RPC.
- `npm run test:demo` starts its own server and fixture. Stop the local launcher before running it.

The old Arc contract source under `contracts/contracts` remains for reference. The active contract is `contracts/rome/RomeWorkG0.sol`. All signed testnet actions occur in the workroom. The app does not have a backend signing key.
