import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';
import { keccak256 } from 'viem';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const settings = { optimizer: { enabled: true, runs: 200 }, viaIR: true, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences', 'metadata'] } } };
export function compile() {
  const sources = Object.fromEntries(fs.readdirSync(path.join(root, 'contracts', 'rome')).filter(x => x.endsWith('.sol')).map(name => [name, { content: fs.readFileSync(path.join(root, 'contracts', 'rome', name), 'utf8') }]));
  const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings })));
  const errors = (output.errors ?? []).filter(x => x.severity === 'error');
  if (errors.length) throw new Error(errors.map(x => x.formattedMessage).join('\n'));
  const result = {};
  for (const [source, contracts] of Object.entries(output.contracts ?? {})) for (const [name, value] of Object.entries(contracts)) result[name] = {
    contractName: name, source, abi: value.abi, bytecode: `0x${value.evm.bytecode.object}`, deployedBytecode: `0x${value.evm.deployedBytecode.object}`,
    immutableReferences: value.evm.deployedBytecode.immutableReferences, metadata: JSON.parse(value.metadata), compiler: solc.version(), settings,
    creationBytecodeHash: keccak256(`0x${value.evm.bytecode.object}`), sourceHash: keccak256(new TextEncoder().encode(sources[source].content))
  };
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = compile(); const artifactPath = path.join(root, 'lib', 'rome', 'RomeWorkG0.json');
  const pinned = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const compiled = result.RomeWorkG0;
  if (compiled.sourceHash !== pinned.sourceHash || compiled.creationBytecodeHash !== pinned.creationBytecodeHash || compiled.deployedBytecode !== pinned.deployedBytecode) {
    throw new Error('Compiled G0 bytecode differs from the reviewed artifact');
  }
  console.log(JSON.stringify({ compiler: solc.version(), contracts: Object.keys(result), settings }, null, 2));
}
