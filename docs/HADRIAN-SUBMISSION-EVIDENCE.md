# RomeWork testnet evidence

RomeWork is a single-milestone escrow on [Rome Hadrian Testnet](https://docs.rome.builders/networks/hadrian), chain ID `200010`, settling on Solana Devnet. The client uses MetaMask EVM. The freelancer accepted through MetaMask with an explicit Solana Devnet session.

## Verified public links

| Evidence | Explorer |
| --- | --- |
| Escrow contract `0x916289654a8247d22fdda3a142649b9db1b3f515` | [Contract](https://via-hadrian.testnet.romeprotocol.xyz/address/0x916289654a8247d22fdda3a142649b9db1b3f515) |
| Deployment by the client | [Deployment transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xb424c603083e10420957da4d12cb1de256c7f4b12c995dae0c9ce3932c24f86c) |
| Freelancer acceptance through the Solana lane | [Hadrian transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x4f6fe0db73c28081f3c837abe2bd74da2fbc2745ab45b6fc6e4d4189a4e0fd9d) · [Solana Devnet settlement](https://explorer.solana.com/tx/5928RKx4v4XKmjji2SkzmDLo11gEdZ7WWuZZKAwG9tk1BubC6a3vn6jWv2TZCHKnQreMLxgYoyFkf5Uo5APSYnUf?cluster=devnet) |
| Client wrap of 0.10 test USDC | [Wrap transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe6632adfdfdf36a4297b7344794904683f458ba33dca5c247e18eaf01575df04) |
| Client wrapper permission | [Wrapper permission transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xeb85eb5885b91f0d5b31786a636603c6722d5dd96fd2ff8334e1c05c7786abb8) |
| Client grants the escrow an exact allowance of 0.10 wUSDC | [Allowance transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x197d34bb797c19e4ab0eb63c617c6eb667517f70ada333c0cfefe34a5c367f2e) |
| Client locks 0.10 wUSDC in escrow | [Funding transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xe6ab231f7cedcf7fdad1e43044bfec99f19ee74832f19ef2bb48baa890c8f291) |
| Freelancer submits the delivery through the Solana lane | [Delivery transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xc0d56ebae0e503c25d5560861387c448932a0f85b2b94fe590fc86ff1b4b45df) |
| Client approves the delivery and unlocks the freelancer's claim | [Approval transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xd5eb8a62106c6261ec31a71a7529b0dec2b5f430780cf56349d1ed0aac339642) |
| Freelancer claims 0.10 wUSDC into the Rome identity | [Claim transaction](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x9cbf7b8c0436ad3157bddad3fbd696b50c99afb2d889d4cf2d0e129312e66f3f) |
| Freelancer initializes the Rome account needed for the transfer to Solana | [Account initialization](https://via-hadrian.testnet.romeprotocol.xyz/tx/0x4964c3c412adebcf88e1b3407c0126312c0346b9aeaa84db70a17df87cbe63b4) |
| Freelancer receives 0.10 USDC in the Solana Devnet token account | [Hadrian transfer](https://via-hadrian.testnet.romeprotocol.xyz/tx/0xf36d3a8070a8a108ca4ba7373ed8c75d829430d3e3d969b2e5c8176b88d8355d) · [Solana Devnet settlement](https://explorer.solana.com/tx/2UP9WPQNHiG3TuviCjPo5H9YF1vndikkG97SEU8ku6LgaZ3wYqNaU16CTn7ZBxSMSzC8yZ4tHUJdEjiKbYm9FDVH?cluster=devnet) |
| Client EVM wallet | [Client address](https://via-hadrian.testnet.romeprotocol.xyz/address/0x21b45103dd05c43969daf3cbb4277391777e2ec7) |
| Freelancer Solana wallet and its Rome identity | [Solana Devnet address](https://explorer.solana.com/address/BWErbzV6y5kdvDwq9Jng9NTgo4p6zFoqwrgazqf2nZEj?cluster=devnet) · [Rome address](https://via-hadrian.testnet.romeprotocol.xyz/address/0x582a26833e44048be0941dfc4e9ddf4ac36c78e9) |

All eleven Hadrian receipts returned success. The Solana transactions mapped to those receipts were finalized without errors.

## Payout reconciliation

The finalized Solana transaction at slot `519868516` increased the balance of token account `7J4QtvpzP74wMf8HuJGCcz6jNeYxWGWufoTi4Eoftzoa` from 20.00 to 20.10 USDC. Its owner is the freelancer wallet `BWErbzV6y5kdvDwq9Jng9NTgo4p6zFoqwrgazqf2nZEj` and its mint is the Hadrian USDC mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`. The escrow recorded 0.10 wUSDC deposited and paid out, with zero locked or claimable. The freelancer's intermediate Rome balance returned to zero.

## Submission status

- Testnet app usage has public transaction evidence for both roles.
- The full testnet payment flow completed from funding to receipt of 0.10 USDC in the freelancer's Solana wallet.
- The Rubicon deployment or Solana mainnet program requirement remains outstanding.
- Local verification passed 27 workroom and RPC tests and 11 escrow contract tests. The local tests cover the full escrow lifecycle and role restrictions.
