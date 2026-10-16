// Sync / Pages / export-import / chart tests. Run via ./run.sh
const device=require('./device.js'),fs=require('fs'),path=require('path');
const [file,hub,dataDir,dead,pages]=process.argv.slice(2);
let fail=0;const chk=(n,ok,d)=>{console.log((ok?'PASS ':'FAIL ')+n+(d?'  '+d:''));if(!ok)fail++;};
const serverDoc=()=>JSON.parse(fs.readFileSync(path.join(dataDir,'saves/kana/p-000002.json'),'utf8')).last;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const txt=d=>d.els.syncStatus.innerHTML.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const MINE={kana_hub_pid:'"p-000002"',kana_hub_pname:'"爸爸"',kana_hub_seen:'true'};   // your existing devices
(async()=>{
  // ---- GitHub Pages: silent, no sync traffic ----
  const log=[];const P=device(file,pages,null,log);await P.sync();
  P.answer('あ',true);P.run(`addMistake('め','me')`);await sleep(1800);await P.sync();
  chk('G1 Pages 上不显示任何同步提示', P.state()==='nohub'&&txt(P)==='', 'state='+P.state());
  chk('G2 Pages 上只探测一次 /api/health，之后没有任何同步请求', log.length===1&&/GET .*\/api\/health$/.test(log[0]), JSON.stringify(log));
  chk('G3 Pages 上照常练习、进度存本机', P.srs()['あ']&&P.mis()['め']&&true);
  // ---- hub: fresh device picks a player once ----
  const N=device(file,hub);await N.sync();
  chk('P1 新设备在小站上先请你选玩家', N.state()==='pick'&&/小明/.test(txt(N))&&/爸爸/.test(txt(N))&&/不同步/.test(txt(N)), txt(N));
  N.answer('い',true);await N.run(`Sync.choose('p-000002')`);
  chk('P2 选「爸爸」后开始同步，选之前答的题也上传', N.state()==='ok'&&/爸爸/.test(txt(N))&&!!serverDoc()['s:い'], txt(N));
  const reload=device(file,hub,{...Object.fromEntries(Object.entries(N.store))});await reload.sync();
  chk('P3 记住选择，再打开不会再问', reload.state()==='ok');
  const O=device(file,hub);await O.sync();await O.run(`Sync.choose('none')`);O.answer('う',true);await sleep(1800);
  chk('P4 选「不同步」后不上传，可以随时再选', O.state()==='off'&&!serverDoc()['s:う']&&/选择玩家/.test(txt(O)), txt(O));
  await O.run('Sync.repick()');chk('P4b 点「选择玩家」重新出现列表', O.state()==='pick');
  const Z=device(file,hub,{...MINE,kana_hub_pid:'"p-deleted"'});await Z.sync();
  chk('P5 缓存的玩家被删了 → 回到选择，不报错', Z.state()==='pick');
  const U=device(file,hub,{kana_hub_pid:'"p-000002"'});await U.sync();
  chk('P6 从 v1.7 升级的设备（只缓存了玩家 ID）也显示玩家名', U.state()==='ok'&&/已同步到家庭小站 · 爸爸/.test(txt(U)), txt(U));
  // ---- two of your devices ----
  const A=device(file,hub,MINE),B=device(file,hub,MINE);await A.sync();await B.sync();
  chk('S0 已选过玩家的设备直接同步', A.state()==='ok'&&B.state()==='ok', txt(A));
  A.answer('か',true);B.answer('さ',true);await A.sync();await B.sync();await A.sync();
  chk('S3 两台设备各练不同的字，合并后都有', !!(A.srs()['か']&&A.srs()['さ']&&B.srs()['か']&&B.srs()['さ']));
  A.answer('し',true);await sleep(5);B.answer('し',false);await A.sync();await B.sync();await A.sync();
  chk('S4 同一个字以后答的那次为准', A.srs()['し'].score===B.srs()['し'].score&&B.srs()['し'].score<0);
  A.run(`addMistake('ね','ne')`);await A.sync();await B.sync();const had=!!B.mis()['ね'];
  const C=device(file,hub,MINE);await C.sync();await sleep(5);A.run(`removeMistake('ね')`);await A.sync();await B.sync();
  const old=JSON.parse(C.store.kana_doc)['x:ね'];C.store.kana_pending=JSON.stringify({'x:ね':old});await C.sync();
  chk('S5 删的错题全设备消失，旧设备也不会让它复活', had&&!B.mis()['ね']&&!C.mis()['ね']&&serverDoc()['x:ね'][0]===null);
  await sleep(5);A.run(`saveSRS({})`);await A.sync();await B.sync();
  chk('S6 重置熟练度同步到另一台', Object.keys(B.srs()).length===0);
  // ---- outages ----
  const D=device(file,dead,MINE);await D.sync();D.answer('た',true);await D.sync();
  chk('S7 小站暂时连不上：提示离线，进度留本机', D.state()==='offline'&&!!D.pend()['s:た'], txt(D));
  D.loc.origin=hub;await D.sync();
  chk('S7b 恢复后自动补传', D.state()==='ok'&&!!serverDoc()['s:た']&&Object.keys(D.pend()).length===0);
  const Fr=device(file,dead);await Fr.sync();
  chk('S7c 从没连过小站的设备遇到不通的地址：安静地只存本机', Fr.state()==='nohub'&&txt(Fr)==='');
  const L=device(file,'');await L.sync();chk('S10 本地文件打开：不发请求', L.state()==='local'&&txt(L)==='');
  // ---- export / import ----
  const X=device(file,pages);await X.sync();
  X.run(`saveSRS({'ナ':{kana:'ナ',romaji:'na',score:7,mastered:false,reviewLevel:0,nextReview:null},'ぬ':{kana:'ぬ',romaji:'nu',score:12,mastered:true,reviewLevel:2,nextReview:${Date.now()+86400000}}});addMistake('ナ','na');`);
  const dump=X.run('JSON.stringify(buildExport())');
  const Y=device(file,pages);await Y.sync();Y.answer('ろ',true);
  Y.run(`applyImport(${JSON.stringify(dump)})`);
  const ask=Y.els.confirmMsg.textContent;Y.els.confirmOkBtn.onclick();
  chk('E1 导出 → 另一台导入，熟练度和错题一致', JSON.stringify(Y.srs())===JSON.stringify(X.srs())&&JSON.stringify(Y.mis())===JSON.stringify(X.mis()), ask);
  chk('E1b 导入是替换：导入前练的「ろ」被覆盖', !Y.srs()['ろ']);
  const before=JSON.stringify(Y.srs());
  Y.run(`applyImport('{"hello":1}')`);const bad=Y.els.confirmTitle.textContent;Y.els.confirmOkBtn.onclick();
  Y.run(`applyImport('not json')`);Y.els.confirmOkBtn.onclick();
  Y.run(`applyImport(${JSON.stringify(JSON.stringify({app:'kana-mastery-trainer',format:1,srs:{'X':{score:9},'ぬ':{score:'hack',kana:'<b>'}},mistakes:{}}))})`);Y.els.confirmOkBtn.onclick();
  chk('E2 非法文件被拒绝，现有进度不变', bad==='无法导入'&&JSON.stringify(Y.srs())===before, JSON.stringify(Y.srs()));
  Y.run(`applyImport(${JSON.stringify(dump)})`);Y.els.confirmOkBtn.onclick();
  const H=device(file,hub,MINE);await H.sync();
  H.run(`applyImport(${JSON.stringify(dump)})`);H.els.confirmOkBtn.onclick();await H.sync();
  chk('E3 在小站上导入 → 同步到服务器，旧字写成删除', serverDoc()['s:ナ'][0].score===7&&(serverDoc()['s:い']||[0])[0]===null);
  // ---- chart + i18n ----
  H.run(`chartMode='hira';renderChart();`);
  chk('V1 五十音图着色', /st-mast">ぬ</.test(H.els.kanaTable.innerHTML)&&/st-new">あ</.test(H.els.kanaTable.innerHTML));
  H.run(`setLang('en')`);
  chk('V2 英文：同步状态、图例、按钮文案', /Synced to family hub · 爸爸/.test(txt(H))&&/Mastered/.test(H.els.chartLegend.innerHTML)&&H.run(`t('btnExport')`)==='Export progress', txt(H));
  console.log(fail?fail+' FAIL':'ALL PASS');process.exit(fail?1:0);
})().catch(e=>{console.log('ERROR',e.stack);process.exit(1);});
