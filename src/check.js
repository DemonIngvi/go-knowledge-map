const fs=require('fs'),vm=require('vm');const dir=process.argv[2];
const ctx={KB:{topics:[],add(...t){this.topics.push(...t)}}};vm.createContext(ctx);
for(const f of ['go','tools','arch','pg','data','kafka','net','lb','infra','obs']){try{vm.runInContext(fs.readFileSync(dir+'/data/'+f+'.js','utf8'),ctx,{filename:f});}catch(e){console.log('SYNTAX',f,e.message);}}
const T=ctx.KB.topics,ids=new Set();const B='go tools test arch algo obs linux k8s pg data neteng net lb sec kafka'.split(' ');
T.forEach(t=>{if(ids.has(t.id))console.log('DUP',t.id);ids.add(t.id);if(!B.includes(t.b))console.log('BLOCK',t.id,t.b);if(!(t.s>=1&&t.s<=10))console.log('STAGE',t.id);if(![1,2,3].includes(t.l))console.log('LVL',t.id);});
let links=0;T.forEach(t=>{(t.x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{links++;const id=m.slice(2);if(!ids.has(id))console.log('BROKEN',t.id,'->',id);});
 const s=t.x.replace(/^~~~[\s\S]*?^~~~/mg,'');const o=(s.match(/\{\{/g)||[]).length,c=(s.match(/\}\}/g)||[]).length;if(o!==c)console.log('BRACES',t.id,o,c);
 const left=s.replace(/\{\{(.+?)\}\}/g,'');if(/[{}]{2}/.test(left))console.log('BRACE-LEFT',t.id,left.match(/.{0,30}[{}]{2}.{0,30}/)[0]);
 if(!t.m||!t.m.length)console.log('NOLINKS',t.id);});
console.log('topics',T.length,'links',links);
const per={};T.forEach(t=>per[t.b]=(per[t.b]||0)+1);console.log(per);const ps={};T.forEach(t=>ps[t.s]=(ps[t.s]||0)+1);console.log(ps);
const inc={};T.forEach(t=>{(t.x.match(/\[\[([a-z0-9-]+)/g)||[]).forEach(m=>{inc[m.slice(2)]=(inc[m.slice(2)]||0)+1;});});
console.log('orphans(no incoming):',T.filter(t=>!inc[t.id]).map(t=>t.id).join(', '));
const terms=`профилирование|pprof|контракт|protobuf|жёсткие|row level|advisory|SKIP LOCKED|multixact|авторизация|слоист|модул|psql|wal|pgbench|cluster|plpgsql|fpw|ulid|cgo|dns look up linux|ip6|single request|ndots|search domain|fdqn|pgrepack|toast|citus|jitter|guaranteed pods|span|tcpdump|static cpu policy|cpudist|irqbalance|cpuseret|cpuaffinity|isolcpus|dataplane|control plabne|bgp|ospf|ldp|stp|bfd|IP|mac|isis|icmp ttl|сети для самых маленьких|pandora|нагрузочн|zstd|iss arr|search balancer|sphinx node|bloom filter|dss|lru|trie|hyperloglog|go workspaces|wiki golang modules|полезные библиотеки|helm|go test|go lint|go template|cute|allure|bdd|kafka balancer|delve|starlark|data-bus|grpc streaming kafka|data bus checker|go tool pprof -heap|earden|wrr|p2c|subsettings|jaeger|open telemetry|brooklin|sitespeed|reso;ver|balancer|picker|canary picker|service discovery|tcp keep alive l4 osi|l7|rados|rgw|scylla|ребалансировка|sasl kafka auth|kerberos|acl|rbac|confluent|librdkafka|dlq|hadoop|spark|redis pub|virtual partition|adhoc|DRY|KISS|AAA|false positive|legitimate true positive|grpc streaming|tls`.split('|');
const hay=T.map(t=>(t.t+' '+(t.a||[]).join(' ')+' '+t.x).toLowerCase()).join('\n');
console.log('missing terms:',terms.filter(x=>!hay.includes(x.toLowerCase())).join(', ')||'none');
