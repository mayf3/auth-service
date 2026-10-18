import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const moduleUrl = pathToFileURL(process.env.MCR_COMPILED_WRAPPER ?? `${process.cwd()}/scripts/start-auth-mcp-release-v1.ts`).href;
const load = () => import(moduleUrl);

test('ACC-MCR-002 strict canonical closed frames reject aliases, duplicate keys, trailing data and oversized frames', async () => {
  const m = await load();
  const value = { a: [1, 2], b: 'hello' };
  assert.deepEqual(m.decodeFrame(m.encodeFrame(value)), value);
  for (const raw of ['{"a":1,"a":2}', '{ "a":1}', '{"a":1.0}', '{"a":-1}']) {
    const data = Buffer.from(raw); const h = Buffer.alloc(4); h.writeUInt32BE(data.length);
    assert.throws(() => m.decodeFrame(Buffer.concat([h, data])));
  }
  assert.throws(() => m.decodeFrame(Buffer.concat([m.encodeFrame(value), Buffer.from('x')])));
  assert.throws(() => m.encodeFrame({ value: 'x'.repeat(65536) }));
});

test('ACC-MCR-005 complete registry rejects hidden entry/order/field changes', async () => {
  const m = await load();
  const old = { manifest: { version: 'old' }, audienceRegistry: { audiences: [{ audience_id: 'other', notes: 'preserve' }, { audience_id: 'agent-core-mcp-conversation-v1', accepted_principal_types: ['agent'] }] } };
  const candidate = structuredClone(old); candidate.audienceRegistry.audiences[1].accepted_principal_types = ['service'];
  const delta = [{ path: '/audienceRegistry/audiences/1/accepted_principal_types', before: ['agent'], after: ['service'], authority_id: 'AUTH_SERVICE_AGENT_CORE_MCP_CONVERSATION_AUDIENCE_CCR_V1' }];
  assert.equal(m.compareRegistry(old, candidate, delta).length, 1);
  candidate.audienceRegistry.audiences[0].notes = 'hidden drift';
  assert.throws(() => m.compareRegistry(old, candidate, delta));
});

test('ACC-MCR-006 actual irreversible uid/gid/group drop rejects privilege regain', { skip: !process.env.MCR_OS_FIXTURE ? 'NOT_RUN: disposable sudo harness required' : false }, async () => {
  const custodyPath = path.join(process.env.MCR_TEST_ROOT!, 'post-drop-custody');
  const script = `import { irreversibleDrop } from ${JSON.stringify(moduleUrl)};import fs from 'node:fs';const d=${JSON.stringify(custodyPath)};fs.mkdirSync(d,{mode:0o700});const j=fs.openSync(d+'/journal.jsonl',fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_APPEND|fs.constants.O_WRONLY,0o600);fs.writeFileSync(d+'/window-end.json','{}',{mode:0o600});const w=fs.openSync(d+'/window-end.json','r');irreversibleDrop(502,20);let regained=false;try{process.setuid(0);regained=true}catch{};if(regained||process.getuid()!==502||process.geteuid()!==502||process.getgid()!==20)process.exit(7);let denied=false;try{fs.writeFileSync(d+'/serving.json','forbidden')}catch(e){denied=e.code==='EACCES'};if(!denied)process.exit(8);fs.writeSync(j,'safe-observation\\n');fs.fsyncSync(j);if(fs.readFileSync(w,'utf8')!=='{}')process.exit(9);fs.closeSync(j);fs.closeSync(w);console.log('DROP_CONFIRMED_RESTRICTED_FDS_ONLY');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
  assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /DROP_CONFIRMED/);
});

import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, openSync, writeSync, fsyncSync, closeSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID, randomBytes, generateKeyPairSync } from 'node:crypto';
import { createServer, type Socket } from 'node:net';
const isolated = !!process.env.MCR_TEST_ROOT;
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
const freshNonce = () => randomBytes(32).toString('base64url');
const ephemeralPort = () => new Promise<number>(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const p = (s.address() as {port:number}).port; s.close(() => resolve(p)); }); });

test('ACC-MCR-004 actual compiled same-process graph listens only after RESUME; EOF kills serving generation', { skip: !isolated ? 'NOT_RUN: isolated runner required' : false }, async t => {
  const m = await load(); const root = path.join(process.env.MCR_TEST_ROOT!, 'artifact');
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  for (const mode of ['v0', 'v1_shadow', 'v1']) await t.test(mode, async () => {
    const port = await ephemeralPort(); assert.notEqual(port, 4001);
    const child = spawn(process.execPath, [process.env.MCR_COMPILED_WRAPPER!, 'serve'], { cwd: root, uid: 502, gid: 20, env: { PATH: '/usr/bin:/bin', JWT_SECRET: 'synthetic-release-test', AUTH_CONTRACT_MODE: mode, AUTH_HTTP_BIND_HOST: '127.0.0.1', PORT: String(port), JWT_PRIVATE_KEY: key, JWT_KID: 'key-v1-20261018', JWT_ISSUER: 'auth-service', DATABASE_URL: process.env.MCR_TEST_DATABASE_URL! }, stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
    let stderr = ''; child.stderr!.on('data', d => stderr += String(d));
    const exit = new Promise<number|null>(resolve => child.once('exit', resolve));
    const channel = new m.PrivateChannel(child.stdio[3] as Socket, () => {});
    const urls = { env_module_url: pathToFileURL(path.join(root,'dist/src/config/env.js')).href, contract_module_url:pathToFileURL(path.join(root,'dist/src/lib/oauth/v1/contract.js')).href, server_module_url:pathToFileURL(path.join(root,'dist/src/server.js')).href };
    const challenge = { schema_version:1, type:'LOAD_CHALLENGE', parent_digest:'a'.repeat(64),child_digest:'b'.repeat(64),operation_id:randomUUID(),attempt_id:randomUUID(),process_generation:{pid:child.pid!,start_nonce:freshNonce(),start_time:execFileSync('/bin/ps',['-p',String(child.pid!),'-o','lstart='],{encoding:'utf8'}).trim(),uid:502,gid:20,executable_digest:hash(readFileSync(process.execPath))},challenge_nonce:freshNonce(),sent_at:new Date().toISOString(),payload:{release_plan_digest:'c'.repeat(64),artifact_digest:'d'.repeat(64),expected_mode:'v1',cwd:root,env_custody_digest:'e'.repeat(64),...urls,deadline:new Date(Date.now()+10000).toISOString()}};
    try {
      channel.send(challenge);
      if(mode!=='v1'){assert.notEqual(await exit,0);return;}
      const loaded = await channel.receive(Date.now()+5000); assert.equal(loaded.type,'LOADED'); assert.equal(loaded.process_generation.pid,child.pid);
      await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`, {signal:AbortSignal.timeout(500)}));
      const snapshot = JSON.parse(readFileSync(path.join(root,'generated/minimal-auth-v1/runtime-contract.json'),'utf8'));
      assert.deepEqual(loaded.payload.runtime_payload,snapshot.payload);
      const now=Date.now(); channel.send({...challenge,type:'RESUME',sent_at:new Date(now).toISOString(),payload:{release_plan_digest:'c'.repeat(64),loaded_digest:m.digest(loaded),alignment_digest:'f'.repeat(64),window_digest:'1'.repeat(64),mode:'v1',contract_module_url:urls.contract_module_url,server_module_url:urls.server_module_url,runtime_digest:snapshot.runtimeDigest,db_projection_digest:'2'.repeat(64),phase_a_receipt_digest:'3'.repeat(64),resume_nonce:freshNonce(),issued_at:new Date(now).toISOString(),expires_at:new Date(now+5000).toISOString()}});
      let health: any;
      for(let i=0;i<80;i++){try{health=await (await fetch(`http://127.0.0.1:${port}/api/health`, {signal:AbortSignal.timeout(500)})).json();break;}catch{await new Promise(r=>setTimeout(r,50));}}
      assert(health,`same process did not listen: ${stderr}`);
      const ls=execFileSync('/usr/sbin/lsof',['-nP','-a','-p',String(child.pid),'-iTCP','-sTCP:LISTEN','-Fn'],{encoding:'utf8'});assert.match(ls,new RegExp(`:${port}`));
      channel.socket.destroy(); assert.notEqual(await exit,0);
      await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`, {signal:AbortSignal.timeout(500)}));
    } finally { child.kill('SIGKILL'); await exit; }
  });
});

test('ACC-MCR-005 actual bounded PostgreSQL projection and one-field mismatch fail closed', { skip: !isolated ? 'NOT_RUN: isolated PostgreSQL required' : false }, async () => {
  const m = await load(); const {PrismaClient}=await import('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:process.env.MCR_TEST_DATABASE_URL!}},log:[]});
  try {
    const snapshot=JSON.parse(readFileSync('generated/minimal-auth-v1/runtime-contract.json','utf8'));
    const entries=snapshot.payload.audienceRegistry.audiences;
    for(const e of entries)await db.authAudience.create({data:{audienceId:e.audience_id,resourceService:e.resource_service,scopeNamespace:e.scope_namespace,acceptedPrincipalTypes:e.accepted_principal_types,registeredScopes:e.registered_scopes,humanAccessEnabled:e.human_access_enabled,machineAccessEnabled:e.machine_access_enabled,delegatedAccessEnabled:e.delegated_access_enabled,status:e.status,freezeReady:e.freeze_ready,version:e.audience_id==='agent-core-mcp-conversation-v1'?2:1}});
    const a=await db.authSecurityAudit.create({data:{eventType:'audience.registry_migrated',result:'success',requestCorrelationId:randomUUID(),details:{fixture:true}}});
    const audit={id:a.id,event_type:a.eventType,result:a.result,request_correlation_id:a.requestCorrelationId,details:a.details,timestamp:a.timestamp.toISOString()};
    const ids=entries.map((e:any)=>e.audience_id).sort();
    const result=await m.readAlignment(process.env.MCR_TEST_DATABASE_URL,snapshot.payload,ids,a.id,audit); assert.equal(result.db_projection.length,entries.length);assert(result.db_snapshot_identity);
    await db.authAudience.update({where:{audienceId:ids[0]},data:{machineAccessEnabled:false}});
    await assert.rejects(m.readAlignment(process.env.MCR_TEST_DATABASE_URL,snapshot.payload,ids,a.id,audit),/DB_REGISTRY_MISMATCH/);
    await assert.rejects(m.readAlignment(process.env.MCR_TEST_DATABASE_URL,snapshot.payload,ids.slice(1),a.id,audit),/DB_READ_SET/);
  }finally{await db.$disconnect();}
});

test('ACC-MCR-006 root-only window inode partial writes remain pending; complete handoff binds generation', { skip: !isolated ? 'NOT_RUN: isolated OS fixture required' : false }, async () => {
  const m=await load();const name=path.join(process.env.MCR_TEST_ROOT!,'window-end-fixture.json');const fd=openSync(name,'wx+',0o600);
  const w={window_id:randomUUID(),operation_id:randomUUID(),parent_digest:'a'.repeat(64),actor:{pid:process.pid,start_time:'fixture',start_nonce:freshNonce(),actor_ref:'isolated-outer'},began_at:new Date(Date.now()-1000).toISOString(),observed_at:new Date().toISOString(),excluded_writers:['fixture'],no_listener:true,drained:true,old_processes_exited:true,window_plan_digest:'b'.repeat(64)};
  try{assert.equal(m.readWindowEnd(fd,w).state,'pending');writeSync(fd,'{');fsyncSync(fd);assert.equal(m.readWindowEnd(fd,w).state,'pending');
    const end={schema_version:1,window_id:w.window_id,operation_id:w.operation_id,parent_digest:w.parent_digest,phase_b:{state:'not_started'},ended_at:new Date().toISOString(),result:'stopped',actor_ref:w.actor.actor_ref,holder_start_nonce:w.actor.start_nonce};
    writeSync(fd,m.canonical(end),0,'utf8');fsyncSync(fd);assert.equal(m.readWindowEnd(fd,w).state,'sealed');
  }finally{closeSync(fd);}
});

test('ACC-MCR-002 private FD malformed and extra frame terminate actual compiled serving child', {skip:!isolated?'NOT_RUN: isolated runner required':false},async()=>{
 const root=path.join(process.env.MCR_TEST_ROOT!,'artifact');
 for(const bytes of [Buffer.from([0,1,0,1]),Buffer.from([0,0,0,1,123,0])]){
  const child=spawn(process.execPath,[process.env.MCR_COMPILED_WRAPPER!,'serve'],{cwd:root,uid:502,gid:20,env:{PATH:'/usr/bin:/bin'},stdio:['ignore','ignore','ignore','pipe']});
  const exited=new Promise<number|null>(r=>child.once('exit',r));(child.stdio[3] as Socket).end(bytes);
  assert.notEqual(await exited,0);
 }
});

test('ACC-MCR-005 independent compiled verifier performs bounded read-only work and exits without listener', {skip:!isolated?'NOT_RUN: isolated runner required':false},async()=>{
 const m=await load();const {PrismaClient}=await import('@prisma/client');const db=new PrismaClient({datasources:{db:{url:process.env.MCR_TEST_DATABASE_URL!}},log:[]});
 try{
  const payload=JSON.parse(readFileSync('generated/minimal-auth-v1/runtime-contract.json','utf8')).payload;
  const ids=payload.audienceRegistry.audiences.map((e:any)=>e.audience_id).sort();const first=payload.audienceRegistry.audiences.find((e:any)=>e.audience_id===ids[0]);
  await db.authAudience.update({where:{audienceId:ids[0]},data:{machineAccessEnabled:first.machine_access_enabled}});
  const a=await db.authSecurityAudit.findFirstOrThrow();const audit={id:a.id,event_type:a.eventType,result:a.result,request_correlation_id:a.requestCorrelationId,details:a.details,timestamp:a.timestamp.toISOString()};
  const root=path.join(process.env.MCR_TEST_ROOT!,'artifact');
  const child=spawn(process.execPath,[process.env.MCR_COMPILED_WRAPPER!,'verify',m.canonical({registry_delta:[],audit_id:a.id,audit_projection:audit})],{cwd:root,uid:502,gid:20,env:{PATH:'/usr/bin:/bin',DATABASE_URL:process.env.MCR_TEST_DATABASE_URL!},stdio:['ignore','ignore','ignore','pipe']});
  const exited=new Promise<number|null>(r=>child.once('exit',r));const channel=new m.PrivateChannel(child.stdio[3] as Socket,()=>{});
  try{
   channel.send({schema_version:1,type:'VERIFY_CHALLENGE',parent_digest:'a'.repeat(64),child_digest:'b'.repeat(64),operation_id:randomUUID(),attempt_id:randomUUID(),process_generation:{pid:child.pid!,start_nonce:freshNonce(),start_time:execFileSync('/bin/ps',['-p',String(child.pid!),'-o','lstart='],{encoding:'utf8'}).trim(),uid:502,gid:20,executable_digest:hash(readFileSync(process.execPath))},challenge_nonce:freshNonce(),sent_at:new Date().toISOString(),payload:{release_plan_digest:'c'.repeat(64),loaded_digest:'d'.repeat(64),old_loaded_projection:payload,candidate_loaded_projection:payload,read_set:ids,phase_a_receipt_digest:'e'.repeat(64),window_digest:'f'.repeat(64),deadline:new Date(Date.now()+5000).toISOString()}});
   const result=await channel.receive(Date.now()+5000);assert.equal(result.type,'ALIGNED');assert.equal(result.payload.db_projection.length,ids.length);assert.equal(await exited,0);
  }finally{child.kill('SIGKILL');await exited;}
 }finally{await db.$disconnect();}
});

import { lchmodSync, mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, lstatSync, chownSync, chmodSync, readdirSync, existsSync } from 'node:fs';
test('ACC-MCR-006 shared supervisor core runs real serve+verify, drops before one RESUME, durable journal prevents replay', {skip:!isolated?'NOT_RUN: isolated sudo runner required':false},async()=>{
 for (const successfulHandoff of [false,true]) {
 const m=await load(), root=mkdtempSync('/private/tmp/mcr-conformance-topology');chmodSync(root,0o755);
 const artifact=path.join(root,'artifact');mkdirSync(artifact,{mode:0o755});
 const prior=path.join(process.env.MCR_TEST_ROOT!,'artifact');for(const name of ['dist','generated','package.json'])cpSync(path.join(prior,name),path.join(artifact,name),{recursive:true});
 symlinkSync(path.join(process.cwd(),'node_modules'),path.join(artifact,'node_modules'));lchmodSync(path.join(artifact,'node_modules'),0o755);
 const readable=(p:string)=>{const s=lstatSync(p);if(s.isSymbolicLink())return;chmodSync(p,s.isDirectory()?0o755:0o644);if(s.isDirectory())for(const n of readdirSync(p))readable(path.join(p,n));};readable(artifact);
 const dir=path.join(root,'operation');mkdirSync(dir,{mode:0o700});mkdirSync(path.join(dir,'preimage'),{mode:0o700});
 const port=await ephemeralPort(),delegation=randomUUID(),operation=randomUUID(),phaseId=randomUUID(),windowId=randomUUID();
 const key=generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'}).toString();
 const envPath=path.join(dir,'preimage/service.env');writeFileSync(envPath,`JWT_SECRET=synthetic-topology\nAUTH_CONTRACT_MODE=v1\nAUTH_HTTP_BIND_HOST=127.0.0.1\nPORT=${port}\nDATABASE_URL=${process.env.MCR_TEST_DATABASE_URL}\nJWT_PRIVATE_KEY=${JSON.stringify(key)}\nJWT_KID=key-v1-20261018\nJWT_ISSUER=auth-service\n`,{mode:0o600});
 const s=lstatSync(envPath);const bindings=[{custody_ref:'preimage/service.env',dev:s.dev,ino:s.ino,uid:s.uid,gid:s.gid,mode:0o600,purpose:'service-env'}];
 const snapshot=JSON.parse(readFileSync('generated/minimal-auth-v1/runtime-contract.json','utf8'));
 const identity={mode:'v1',contractVersion:snapshot.payload.contractVersion,sourceBundleDigest:snapshot.payload.sourceBundleDigest,runtimeDigest:snapshot.runtimeDigest};
 const {PrismaClient}=await import('@prisma/client');const db=new PrismaClient({datasources:{db:{url:process.env.MCR_TEST_DATABASE_URL!}},log:[]});const a=await db.authSecurityAudit.findFirstOrThrow();await db.$disconnect();
 const phase={operation_id:phaseId,plan_digest:'1'.repeat(64),audit_id:a.id,audit_projection:{id:a.id,event_type:a.eventType,result:a.result,request_correlation_id:a.requestCorrelationId,details:a.details,timestamp:a.timestamp.toISOString()}};
 const lock=spawn('/usr/bin/python3',['-c','import fcntl,sys;f=open(sys.argv[1],"w");fcntl.flock(f,fcntl.LOCK_EX);print("HELD",flush=True);sys.stdin.readline()',path.join(root,'operation.lock')],{stdio:['pipe','pipe','inherit']});await new Promise<void>(r=>lock.stdout!.once('data',()=>r()));
 const actor={pid:lock.pid!,start_time:execFileSync('/bin/ps',['-p',String(lock.pid!),'-o','lstart='],{encoding:'utf8'}).trim(),start_nonce:freshNonce(),actor_ref:'isolated-original-actor'};
 const manifest={schema_version:1,source_commit:'a'.repeat(40),source_tree:'b'.repeat(40),authority_pins:{},toolchain:{},build_inputs:{},files:[],overlay_dispositions:[],entrypoints:{node:'bin/node',wrapper:'dist/scripts/start-auth-mcp-release-v1.js',env:'dist/src/config/env.js',contract:'dist/src/lib/oauth/v1/contract.js',server:'dist/src/server.js'},generated_identity:identity,artifact_digest:'c'.repeat(64),private_config:bindings};
 const plan:any={schema_version:1,parent_digest:'d'.repeat(64),load_operation_id:operation,old_identity:{runtime_payload:snapshot.payload,runtime_payload_json:JSON.stringify(snapshot.payload),runtime_digest:snapshot.runtimeDigest,process_generation:actor,listener_observation:{fixture:true},handler_provenance:{fixture:true}},artifact_digest:manifest.artifact_digest,source_commit:manifest.source_commit,source_tree:manifest.source_tree,authority_pins:{},generated_identity:identity,env_custody_digest:m.digest(bindings),original_lane_ref:actor.actor_ref,service_descriptor:{label:'com.auth-service',uid:502,gid:20,username:'authsvc',groupname:'authsvc',KeepAlive:false,RunAtLoad:false,node_digest:hash(readFileSync(process.execPath))},read_set:snapshot.payload.audienceRegistry.audiences.map((e:any)=>e.audience_id).sort(),registry_delta:[],phase_a_operation_id:phaseId,phase_a_plan_digest:phase.plan_digest,phase_a_receipt_digest:m.digest(phase),reader_disposition_digest:'e'.repeat(64),build_receipt_digest:'f'.repeat(64),conformance_digest:'1'.repeat(64),window_plan_digest:'2'.repeat(64),deadline:new Date(Date.now()+30000).toISOString()};plan.plan_digest=m.digest(plan);
 const stop={window_id:windowId,operation_id:operation,parent_digest:plan.parent_digest,actor,began_at:new Date().toISOString(),observed_at:new Date().toISOString(),excluded_writers:['isolated-fixture-only'],no_listener:true,drained:true,old_processes_exited:true,window_plan_digest:plan.window_plan_digest};
 for(const [name,value]of Object.entries({'artifact-manifest.json':manifest,'stop.json':stop,'phase-a.json':phase}))writeFileSync(path.join(dir,name),m.canonical(value),{mode:0o600});writeFileSync(path.join(dir,'window-end.json'),'',{mode:0o600});
 const handoffFd=openSync(path.join(dir,'window-end.json'),'r+');
 const child={operation_id:operation,plan_digest:plan.plan_digest,source_commit:plan.source_commit,artifact_digest:plan.artifact_digest,expires_at:plan.deadline,environment:'production'};
 const fixtureData={root,artifactRoot:artifact,dir,parent:{delegation_id:delegation,expires_at:plan.deadline},parentDigest:plan.parent_digest,producerDigest:'3'.repeat(64),child,plan,childDigest:'4'.repeat(64),windowId};
 const script=`import {runIsolatedSupervisorFixture} from ${JSON.stringify(pathToFileURL(path.join(artifact,'dist/scripts/start-auth-mcp-release-v1.js')).href)};import {execFileSync}from'node:child_process';const f=${JSON.stringify(fixtureData)};const custody={parent:f.parent,parentDigest:f.parentDigest,producerDigest:f.producerDigest,readChild:async()=>({child:f.child,plan:f.plan,childDigest:f.childDigest,operationDirectory:f.dir})};const window={windowId:f.windowId,holderProcesses:[{pid:${lock.pid},start_time:${JSON.stringify(actor.start_time)}}],assertHeld(){process.kill(${lock.pid},0);let held=false;try{execFileSync('/usr/bin/python3',['-c','import fcntl,sys;f=open(sys.argv[1]);fcntl.flock(f,fcntl.LOCK_EX|fcntl.LOCK_NB)',f.root+'/operation.lock'],{stdio:'ignore'})}catch{held=true}if(!held)throw Error('FIXTURE_LOCK_LOST')}};await runIsolatedSupervisorFixture(${JSON.stringify(delegation)},${JSON.stringify(operation)},{root:f.root,artifactRoot:f.artifactRoot,custody,window});`;
 const start=()=>spawn(process.execPath,['--input-type=module','-e',script],{cwd:artifact,env:{PATH:'/usr/bin:/bin'},stdio:['ignore','pipe','pipe']});
 const supervisor=start();let stderr='';supervisor.stderr!.on('data',d=>stderr+=d);const exited=new Promise<number|null>(r=>supervisor.once('exit',r));
 let servePid:number|undefined;
 try{
  let healthy=false;for(let i=0;i<120;i++){try{const h=await(await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(200)})).json();if(h.ok){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
  assert(healthy,stderr);const loaded=JSON.parse(readFileSync(path.join(dir,'loaded.json'),'utf8'));servePid=loaded.process_generation.pid;
  const journal=readFileSync(path.join(dir,'journal.jsonl'),'utf8').trim().split('\n').map(JSON.parse);const stages=journal.map((j:any)=>j.stage);
  assert(stages.indexOf('PRIVILEGE_DROPPED')<stages.indexOf('RESUME_SENT'));assert.equal(stages.filter((s:string)=>s==='RESUME_SENT').length,1);
  assert.equal(execFileSync('/bin/ps',['-p',String(supervisor.pid),'-o','uid='],{encoding:'utf8'}).trim(),'502');
  const replay=start();replay.stderr!.resume();replay.stdout!.resume();assert.notEqual(await new Promise(r=>replay.once('exit',r)),0);
  if(successfulHandoff){
   writeSync(handoffFd,'{');fsyncSync(handoffFd);await new Promise(r=>setTimeout(r,200));assert((await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(500)})).ok);
   const end={schema_version:1,window_id:windowId,operation_id:operation,parent_digest:plan.parent_digest,phase_b:{state:'terminal',operation_id:randomUUID(),terminal_receipt_digest:'9'.repeat(64)},ended_at:new Date().toISOString(),result:'completed',actor_ref:actor.actor_ref,holder_start_nonce:actor.start_nonce};
   writeSync(handoffFd,m.canonical(end),0,'utf8');fsyncSync(handoffFd);closeSync(handoffFd);
   let ack=false;for(let i=0;i<40;i++){if(readFileSync(path.join(dir,'journal.jsonl'),'utf8').includes('WINDOW_END_ACK')){ack=true;break;}await new Promise(r=>setTimeout(r,50));}assert(ack);
   process.kill(lock.pid!,'SIGKILL');await new Promise(r=>setTimeout(r,250));assert((await fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(500)})).ok);process.kill(servePid!,'SIGTERM');
  }else{closeSync(handoffFd);process.kill(lock.pid!,'SIGKILL');}
  assert.equal(await exited,0);assert.equal(existsSync(path.join(dir,'serving.json')),false);assert.throws(()=>process.kill(servePid!,0));await assert.rejects(fetch(`http://127.0.0.1:${port}/api/health`,{signal:AbortSignal.timeout(300)}));
 }finally{if(servePid){try{process.kill(servePid,'SIGKILL')}catch{}}supervisor.kill('SIGKILL');await exited;lock.stdin!.end();}
 }
});

test('isolated supervisor adapter rejects nonfixture and cross-root authority paths',async()=>{
 const m=await load();await assert.rejects(m.runIsolatedSupervisorFixture(randomUUID(),randomUUID(),{root:'/private/var/db/auth-service',artifactRoot:'/private/var/db/auth-service',custody:{},window:{}}),/ISOLATED_FIXTURE_BOUNDARY/);
 if(isolated){const root=mkdtempSync('/private/tmp/mcr-conformance-reject'),artifactRoot=path.join(root,'artifact');mkdirSync(artifactRoot);const id=randomUUID();await assert.rejects(m.runIsolatedSupervisorFixture(id,randomUUID(),{root,artifactRoot,custody:{parent:{delegation_id:id},readChild:async()=>({operationDirectory:'/private/var/db/auth-service',child:{environment:'production'}})},window:{}}),/ISOLATED_FIXTURE_CUSTODY/);}
});

test('recovery window handoff rejects nonfixture custody without invoking completion authority',async()=>{
 const m=await load();let called=false;
 await assert.rejects(m.openIsolatedOuterWindowEndFixture({root:'/private/var/db/auth-service',operationDirectory:'/private/var/db/auth-service/operation',completionReader:async()=>{called=true;return{}},assertHeld(){called=true}}),/ISOLATED_FIXTURE_BOUNDARY/);
 assert.equal(called,false);
});

test('stop producer actual process exit and all TCP drain observations',{skip:!isolated},async()=>{
 const m=await load(),root=mkdtempSync('/private/tmp/mcr-conformance-stop');chmodSync(root,0o700);
 const server=createServer();await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const port=(server.address() as {port:number}).port;assert(port>=20000);
 const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});const exited=new Promise(resolve=>child.once('exit',resolve));
 try{
  assert.throws(()=>m.observeIsolatedStoppedProcesses(root,[{pid:child.pid}],port),/ORIGINAL_PROCESS_STILL_PRESENT/);
  child.kill('SIGTERM');await exited;
  assert.throws(()=>m.observeIsolatedStoppedProcesses(root,[{pid:child.pid}],port),/ORIGINAL_CONNECTIONS_NOT_DRAINED/);
  await new Promise<void>(resolve=>server.close(()=>resolve()));
  assert.deepEqual(m.observeIsolatedStoppedProcesses(root,[{pid:child.pid}],port),{old_processes_exited:true,no_listener:true,drained:true});
  assert.throws(()=>m.observeIsolatedStoppedProcesses(root,[],4001),/ISOLATED_FIXTURE_BOUNDARY/);
 }finally{child.kill('SIGKILL');server.close();}
});

test('stop producer source attribution refuses unadmitted facts and missing scope',{skip:!isolated},async()=>{
 const m=await load(),root=mkdtempSync('/private/tmp/mcr-conformance-owning');chmodSync(root,0o700);
 const measured={delegation_id:randomUUID(),load_operation_id:randomUUID()},actor_ref='01a0d846-431e-7dc0-95e2-a841cd0bff5a',actor_start_time=execFileSync('/bin/ps',['-p',String(process.pid),'-o','lstart='],{encoding:'utf8'}).trim();
 const common={judgment_kind:'original_actor_coordination',actor_ref,actor_pid:process.pid,actor_start_time,delegation_id:measured.delegation_id,load_operation_id:measured.load_operation_id,target_service:'system/com.auth-service',disposition:'ADMITTED',coordination_record:'Disposable parser fixture only; not actual release coordination.',original_transport_verified:true,native_product_disabled:true,connector_subject:'fixture-connector',registered_writers:['fixture-writer'],continuous_until_window_end:true};
 writeFileSync(path.join(root,'installed-preimage.json'),m.canonical({fixture:'preimage'}),{mode:0o600});writeFileSync(path.join(root,'old-loaded-identity.json'),m.canonical({fixture:'old-loaded'}),{mode:0o600});
 const kinds=['writer-exclusion','consumer-disposition','preimage-restorability','transport-disposition'];
 const sources=kinds.map(kind=>{const ref=path.join(root,kind+'.json'),body=JSON.stringify({...common,kind,preimage_manifest_digest:m.digest({fixture:'preimage'}),old_loaded_identity_digest:m.digest({fixture:'old-loaded'})});writeFileSync(ref,body,{mode:0o600});return {kind,ref,digest:createHash('sha256').update(body).digest('hex')}});
 const preflight={schema_version:1,judgment_kind:common.judgment_kind,delegation_id:measured.delegation_id,load_operation_id:measured.load_operation_id,actor_ref,actor_pid:process.pid,actor_start_time,original_inputs_digest:m.digest(measured),target_service:common.target_service,registered_writers:common.registered_writers,sources};
 const save=()=>writeFileSync(path.join(root,'owning-preflight.json'),m.canonical(preflight),{mode:0o600});save();assert.equal(m.readIsolatedOwningPreflight(root,measured).digest,m.digest(preflight));
 const bad=JSON.stringify({...common,kind:'consumer-disposition',disposition:'KEEP_UNADMITTED'});writeFileSync(sources[1].ref,bad);sources[1].digest=createHash('sha256').update(bad).digest('hex');save();assert.throws(()=>m.readIsolatedOwningPreflight(root,measured),/OWNING_FACT_UNADMITTED/);
 preflight.sources=sources.filter(v=>v.kind!=='writer-exclusion');save();assert.throws(()=>m.readIsolatedOwningPreflight(root,measured));
 assert.throws(()=>m.readIsolatedOwningPreflight('/private/var/db/auth-service',measured),/ISOLATED_FIXTURE_BOUNDARY/);
});

test('stop producer descriptor measurement retains legitimate original extra arguments and excludes private config',async()=>{
 const m=await load();const plist={Label:'com.auth-service',UserName:'authsvc',GroupName:'authsvc',WorkingDirectory:'/isolated/old',Program:'/usr/local/bin/node',ProgramArguments:['/usr/local/bin/node','/isolated/old/dist/server.js','/isolated/old/dist/server.js','/isolated/old/dist/server.js'],KeepAlive:true,RunAtLoad:true,EnvironmentVariables:{SECRET:'fixture-private-value'}};
 const measured=m.parseOriginalDescriptor(plist);assert.equal(measured.arguments.length,4);assert.equal(measured.KeepAlive,true);assert.equal(JSON.stringify(measured).includes('fixture-private-value'),false);
 assert.throws(()=>m.parseOriginalDescriptor({...plist,UserName:'root'}));assert.throws(()=>m.parseOriginalDescriptor({...plist,ProgramArguments:['/usr/local/bin/node','--eval']}));
});

test('stop producer original user-owned readable source is distinct from new root custody',{skip:!isolated},async()=>{
 const m=await load(),root=mkdtempSync('/private/tmp/mcr-conformance-source');chmodSync(root,0o755);chownSync(root,502,20);
 const source=path.join(root,'.env');writeFileSync(source,'DISPOSABLE_ONLY=not-a-production-secret\n',{mode:0o600});chownSync(source,502,20);
 const pin=m.measureOriginalReadableFile(source,502,20);assert.equal(pin.uid,502);assert.equal(pin.gid,20);assert.equal(pin.mode,0o600);assert.deepEqual(Object.keys(pin).sort(),['dev','gid','ino','mode','uid']);
 chmodSync(source,0);assert.throws(()=>m.measureOriginalReadableFile(source,502,20),/ORIGINAL_SERVICE_READ_ACCESS/);chmodSync(source,0o600);
 symlinkSync(source,path.join(root,'alias'));assert.throws(()=>m.measureOriginalReadableFile(path.join(root,'alias'),502,20),/ORIGINAL_SOURCE_ALIAS/);
 mkdirSync(path.join(root,'operation'),{mode:0o700});chownSync(path.join(root,'operation'),502,20);
 await assert.rejects(m.openIsolatedOuterWindowEndFixture({root,operationDirectory:path.join(root,'operation'),completionReader:async()=>({}),assertHeld(){}}),/UNPROTECTED_ANCESTOR/);
});
