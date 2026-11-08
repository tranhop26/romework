# RomeWork port of FreelanceGuard — implementation plan

Goal: use the full original FreelanceGuard Next.js UI as the RomeWork application shell, and integrate the already specified/tested Hadrian G0 wallet/escrow flow into a native workroom. A source clone or network-label change alone does not meet this goal.

Original source commit: 1b7f8df1cc71b124e273f1e8f0a2775106eea234. Work in this isolated local clone on branch romework-hadrian-g0; keep original ZIP intact. No push, publication, paid services, mainnet or unattended signing.

## Constraints inherited from the approved G0 request
- One job/milestone per immutable deployment; canonical wUSDC, 0 < amount <= 1 test USDC.
- client MetaMask; freelancer Solana synthetic from SDK public-key bytes. Phantom legacy and Solflare v1 are separate tests.
- Accept precedes funding; approve creates entitlement; claim transfers to fixed beneficiary; sweep has explicit verified ATA.
- No fee, AI arbitration, admin withdrawal, timeout payout/refund, backend signer or bridge UI in the live payment path.
- UNKNOWN/timeout must reconcile old nonce/hash/receipt/state before another signature.
- User signs every extension prompt; never request/read keys. Live test evidence remains NOT RUN until actually performed.
- Original dashboard/jobs/chat UI remains a clearly labeled local sandbox; it never proves chain balances or supplies a financial role. G0 actual-money screen is /rome and uses verified chain state only.

## Tasks and file responsibilities
1. Sources/dependencies: lock official Rome SDK and registry commits, validate Hadrian again, add Solana/Wallet Standard browser deps; retain original Next/React/UI stack. Root owns package/lock/config.
2. UI port: preserve original layout, cards, forms, navigation and styling; RomeWork/Hadrian branding; /rome entry; remove Arc/Circle/AI/fee/finality claims. Agent owns app/page.tsx, app/layout.tsx, components/layout/{Navbar,Footer}.tsx, components/job/JobWorkroomClient.tsx, components/DemoBanner.tsx and components/wallet/WalletBalance.tsx only.
3. Payment engine: root copies the reviewed G0 contract/artifact/config and SDK adapters, makes browser-only loading SSR safe, implements native React workroom /rome, RPC proxies, balances, journal/receipt recovery and evidence export. No iframe and no demo-token fallback.
4. Retire unsafe Arc paths: root disables server signing, mock payment and AI endpoints; legacy helper calls redirect to actual /rome workroom. Demo DB actions must be labeled simulation and no API can claim an on-chain payout.
5. Verify: test-first endpoint disable/transfer safeguards and port recovery; run original sandbox tests, new integration tests, G0 EVM tests, typecheck/build, browser landing/dashboard and native Rome workroom. Independent reviewer checks money boundaries and misleading demo claims.
6. Handoff: one wallet instruction at a time once user is at /rome. No deployment/signing performed by agent. Report build/runtime evidence separately from testnet PASS.

## Current ledger
- [x] Read user clarification: original full UI/code must be applied to Rome, not remain Arc.
- [x] Original clone clean before branch; local original archive preserved.
- [x] Official docs refreshed; Hadrian read-only preflight PASS, canonical wrapper/mint/program unchanged, proxy compatible.
- [x] Dependencies locked. Escrow artifact reproduced. Local G0 tests passed (25), port engine tests passed (14), demo tests passed (6), and API tests passed (5).
- [x] Native /rome workroom with SDK signing entry points and journal recovery.
- [x] UI brand/navigation port and local sample routes.
- [x] Server Arc signing paths retired.
- [x] Production build and TypeScript passed. Browser preflight verified chain 200010 and Solana Devnet. Local HTTP smoke verified the landing and dashboard. Review feedback was applied to loopback and listener cleanup.
- [ ] User wallet connection, balance checks and sequential Hadrian run.
