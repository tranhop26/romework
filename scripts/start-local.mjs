// Local launcher for the RomeWork port and its original demo database fixture.
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { createDemoDatabase } from '../tests/support/demo-database.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const fixture=createDemoDatabase();fixture.mode='healthy';
fixture.server.listen(0,'127.0.0.1');await once(fixture.server,'listening');
// Reuse the repository's own local test database boundary, not hosted Supabase.
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!/(?:KEY|TOKEN|SECRET|PASSWORD|SUPABASE|CIRCLE|DEPLOYER|OPENAI)/i.test(key)));
Object.assign(env,{
  NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',
  NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${fixture.server.address().port}`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY:'local-demo-anon-placeholder',
  SUPABASE_SERVICE_ROLE_KEY:'local-demo-service-placeholder',
  SESSION_SECRET:randomBytes(32).toString('hex'),
});
console.log('RomeWork — FreelanceGuard port for Hadrian testnet');
console.log('Open http://127.0.0.1:3000/rome in Chrome for the extension workroom.');
console.log('Try Demo on the home page uses the original ephemeral local fixture.');
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port','3000'],{cwd:repo,env,stdio:'inherit'});
child.once('error',error=>{console.error(error.message);fixture.server.close();process.exitCode=1;});
child.once('exit',code=>{fixture.server.close();process.exitCode=code??0;});
process.once('SIGINT',()=>{child.kill('SIGINT');fixture.server.close();});
