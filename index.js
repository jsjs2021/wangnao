const express = require("express");

const app = express();

const { execSync, spawn } = require('child_process');

const port = process.env.SERVER_PORT || process.env.PORT || 3000;

const UUID = process.env.UUID || '5d525196-8c0e-47d1-b959-9d0d22aa01dc'; //若需要改UUID，需要在config.json里改为一致

const NEZHA_SERVER = process.env.NEZHA_SERVER || 'nezha.jaxmike.nyc.mn';

const NEZHA_PORT = process.env.NEZHA_PORT || '443'; // 哪吒端口为{443,8443,2096,2087,2083,2053}其中之一开启tls

const NEZHA_KEY = process.env.NEZHA_KEY || ''; // 没用哪吒，把这个参数空着

const ARGO_DOMAIN = process.env.ARGO_DOMAIN || 'cho.lovefree.xx.kg'; // 建议使用token，argo端口8080，cf后台设置需对应,使用json需上传json和yml文件至files目录

const ARGO_AUTH = process.env.ARGO_AUTH || 
'eyJhIjoiZWRmNjk5MjgxZmIyZjlhNzM4NTg1MWE3YTYwNDU2NjAiLCJ0IjoiZmZlYzBmZTUtOTVhMC00YmIxLTgxZDctMmM1Yzg1NWE2NTgyIiwicyI6IlpESm1ORE5oWW1VdFkyTm1PQzAwTnpVeUxUZ3lZakF0TmpKak0yRXlZamcwT1dSayJ9';

const CFIP = process.env.CFIP || 'www.visa.com.tw';

const NAME = process.env.NAME || 'Choreo';

// root route
app.get("/", function(req, res) {
res.send("Hello world!");
});

let ISP = '';
try {
const metaInfo = execSync(
'curl -s https://speed.cloudflare.com/meta | awk -F\\" \'{print $26"-"$18}\' | sed -e \'s/ /_/g\'',
{ encoding: 'utf-8' }
);
ISP = metaInfo.trim();
} catch (e) {
console.log('get ISP failed, continue with empty ISP');
ISP = '';
}

// sub subscription
app.get('/sub', (req, res) => {

const VMESS = { v: '2', ps: `${NAME}-${ISP}`, add: CFIP, port: '8443', id: UUID, aid: '0', scy: 'none', net: 'ws', type: 'none', host: ARGO_DOMAIN, path: '/vmess?ed=2048', tls: 'tls', sni: ARGO_DOMAIN, alpn: '' };

const vlessURL = 
`vless://${UUID}@${CFIP}:8443?encryption=none&security=tls&sni=${ARGO_DOMAIN}&type=ws&host=${ARGO_DOMAIN}&path=%2Fvless?ed=2048#${NAME}-${ISP}`;

const vmessURL = `vmess://${Buffer.from(JSON.stringify(VMESS)).toString('base64')}`;

const trojanURL = `trojan://${UUID}@${CFIP}:8443?security=tls&sni=${ARGO_DOMAIN}&type=ws&host=${ARGO_DOMAIN}&path=%2Ftrojan?ed=2048#${NAME}-${ISP}`;

const base64Content = Buffer.from(`${vlessURL}\n\n${vmessURL}\n\n${trojanURL}`).toString('base64');

res.type('text/plain; charset=utf-8').send(base64Content);

});

// ---- fixed part: start a process with logs visible in Choreo, restart it if it dies ----
function startProcess(name, cmd, args, onReady) {
console.log(`starting ${name}: ${cmd} ${args.join(' ')}`);
const child = spawn(cmd, args, { stdio: 'inherit' });
child.on('error', (err) => {
console.error(`${name} start error: ${err}`);
});
child.on('exit', (code, signal) => {
console.error(`${name} exited code=${code} signal=${signal}, restarting in 5s`);
setTimeout(() => startProcess(name, cmd, args, null), 5000);
});
if (onReady) setTimeout(onReady, 2000);
return child;
}

// run-nezha
let NEZHA_TLS = '';
if (NEZHA_SERVER && NEZHA_PORT && NEZHA_KEY) {

const tlsPorts = ['443', '8443', '2096', '2087', '2083', '2053'];
if (tlsPorts.includes(NEZHA_PORT)) { NEZHA_TLS = '--tls'; } else { NEZHA_TLS = ''; }

const args = ['-s', `${NEZHA_SERVER}:${NEZHA_PORT}`, '-p', NEZHA_KEY];
if (NEZHA_TLS) args.push(NEZHA_TLS);
try {
startProcess('swith', './swith', args, runWeb);
console.log('swith is running');
} catch (error) {
console.error(`swith running error: ${error}`);
runWeb();
}

} else {
console.log('NEZHA variable is empty, skip running');
runWeb();
}

// run-xray
function runWeb() {
try {
startProcess('web', './web', ['-c', './config.json'], runServer);
console.log('web is running');
} catch (error) {
console.error(`web running error: ${error}`);
}
}

// run-server
function runServer() {
let args = [];
if (ARGO_AUTH.match(/^[A-Z0-9a-z=]{120,250}$/)) {
args = ['tunnel', '--edge-ip-version', 'auto', '--no-autoupdate', '--region', 'us', '--protocol', 'http2', 'run', '--token', ARGO_AUTH];
} else {
args = ['tunnel', '--edge-ip-version', 'auto', '--config', 'tunnel.yml', 'run'];
}
try {
startProcess('server', './server', args, null);
console.log('server is running');
} catch (error) {
console.error(`server running error: ${error}`);
}
}

app.listen(port, () => console.log(`App is listening on port ${port}!`));
