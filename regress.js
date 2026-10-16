// Practice-logic regression tests. Usage: node regress.js ../index.html
const H=require('./harness.js'),{run,els}=H;let fail=0;
const chk=(n,ok,d)=>{console.log((ok?'PASS ':'FAIL ')+n+'  '+(d||''));if(!ok)fail++;};
const fb=()=>run("document.getElementById('feedback').className.includes('correct')");
// 1 due review is asked
run(`saveSRS({}); activeGroups=new Set(['あ行']); includeMastered=false;
 const d={};const past=Date.now()-86400000;
 for(const [k,r] of KANA_DATA['あ行']) d[k]={kana:k,romaji:r,score:12,mastered:true,reviewLevel:1,nextReview:k==='あ'?past:Date.now()+9e8};
 saveSRS(d); restartGame();`);
chk('1 到期复习会出题', run('currentItem&&currentItem[0]')==='あ' && !els.scoreScreen.classList.contains('show'), 'currentItem='+run('currentItem&&currentItem[0]'));
// 1b all mastered, none due -> notice, not a 0% score
run(`const d2=loadSRS();d2['あ'].nextReview=Date.now()+9e8;saveSRS(d2);isReviewMode=false;questionQueue=[['あ','a'],['い','i']];totalRounds=2;currentRound=0;correctCount=0;wrongCount=0;document.getElementById('scoreScreen').classList.remove('show');nextQuestion();`);
chk('1b 全部未到期时显示「全部掌握」而不是 0%', els.masteredNotice.style.display==='flex' && !els.scoreScreen.classList.contains('show'));
// 2 katakana confusion
run(`currentLang='zh'; currentItem=['ソ','so']; showConfusePanel('ソ','n');`);
chk('2 ソ 选 n 显示 ソ/ン 提示', els.confuseTipText.textContent.includes('最高频'), JSON.stringify(els.confuseTipText.textContent.slice(0,20)));
const pen=run(`(()=>{saveSRS({});answered=false;currentItem=['ソ','so'];currentAnswer='so';practiceMode='choice';questionStartTime=Date.now();handleAnswerCore(false,'n');const d=loadSRS();return d['ン']?d['ン'].score:null})()`);
chk('2b ソ/ン 连带扣分生效', pen===-2, 'ン score='+pen);
run(`currentItem=['し','shi']; showConfusePanel('し','chi');`);
chk('2c 平假名提示不受影响', els.confuseTipText.textContent.includes('朝左'));
// 3 homophones
const picks=JSON.parse(run(`(()=>{let p={};for(let i=0;i<400;i++){activeGroups=new Set(['ざ行']);currentMode='romaji2kana';practiceMode='fillin';isReviewMode=false;includeMastered=true;questionQueue=[['じ','ji']];totalRounds=1;currentRound=0;nextQuestion();p[currentItem[0]]=(p[currentItem[0]]||0)+1;}return JSON.stringify(p)})()`));
chk('3 只练平假名时不出片假名同音字', !picks['ジ'] && !picks['ヂ'], JSON.stringify(picks));
run(`answered=false;currentItem=['ぢ','ji'];currentAnswer='ぢ';flickText='じ';flickCursor=1;flickSubmit();`);
chk('3b 答案ぢ时写じ算对', fb());
run(`answered=false;currentItem=['ヂ','ji'];currentAnswer='ヂ';flickText='じ';flickCursor=1;flickSubmit();`);
chk('3c 片假名题写平假名仍然判错', !fb());
run(`answered=false;currentItem=['ぢ','ji'];currentAnswer='ぢ';flickText='ず';flickCursor=1;flickSubmit();`);
chk('3d 写错字仍然判错', !fb());
// 4 romaji variants
const cases=[['し','shi','si',1],['し','shi','shi',1],['つ','tsu','tu',1],['ふ','fu','hu',1],['ち','chi','ti',1],['を','wo','o',1],['を','wo','wo',1],['ん','n','nn',1],['お','o','o',1],['お','o','wo',0],['か','ka','ga',0],['じ','ji','zi',1],['し','shi','chi',0]];
const bad=cases.filter(([k,a,v,exp])=>{run(`answered=false;practiceMode='fillin';currentDirection='kana2romaji';currentItem=['${k}','${a}'];currentAnswer='${a}';qwertyText='${v}';qwertyCursor=${v.length};qkeySubmit();`);return fb()!==!!exp;});
chk('4 拼写变体（含反例 お≠wo、か≠ga）', bad.length===0, bad.length?JSON.stringify(bad):cases.length+' 例');
run(`answered=false;practiceMode='fillin';currentDirection='kana2romaji';currentItem=['ソ','so'];currentAnswer='so';qwertyText='nn';qwertyCursor=2;qkeySubmit();`);
chk('4b 错答 nn 也能识别成 ソ/ン 混淆', els.confuseTipText.textContent.includes('最高频'));
// 5 accuracy
const r5=run(`(()=>{correctCount=3;wrongCount=1;totalRounds=20;showScore();return document.getElementById('scoreMsg').textContent.split('\\n')[0]})()`);
chk('5 正确率按已答题计算', /75%/.test(r5), JSON.stringify(r5));
// 6 distractors
const r6=run(`(()=>{let mixed=0,short=0;activeGroups=new Set(['あ行','ア行']);for(let i=0;i<300;i++){const w=getWrongOptions(['ア','a'],3);if(w.some(x=>!/[ァ-ヴ]/.test(x[0])))mixed++;if(w.length<3)short++;}
 activeGroups=new Set(['ワ行']);for(let i=0;i<300;i++){const w=getWrongOptions(['ワ','wa'],3);if(w.length<3)short++;if(w.some(x=>!/[ァ-ヴ]/.test(x[0])))mixed++;}return JSON.stringify({mixed,short})})()`);
chk('6 干扰项同字体且始终够 3 个', r6==='{"mixed":0,"short":0}', r6);
// smoke: 3 random full sessions per mode, no exceptions
let err=null;
try{run(`(()=>{for(const pm of ['choice','fillin'])for(const dir of ['kana2romaji','romaji2kana','mixed'])for(let s=0;s<3;s++){
 saveSRS({});activeGroups=new Set(Object.keys(KANA_DATA));practiceMode=pm;currentMode=dir;includeMastered=false;restartGame();
 let guard=0;while(!document.getElementById('scoreScreen').classList.contains('show')&&guard++<40){
  const right=Math.random()<.7;
  if(pm==='choice'){handleAnswerCore(right,right?currentAnswer:'xx');}
  else if(currentDirection==='kana2romaji'){qwertyText=right?currentAnswer:'zz';qwertyCursor=qwertyText.length;qkeySubmit();}
  else{flickText=right?currentAnswer:'ん';flickCursor=1;flickSubmit();}
  nextQuestion();}}
 startReview();})()`);}catch(e){err=e.stack.split('\n').slice(0,3).join(' | ');}
chk('冒烟：2 题型 × 3 方向 × 3 轮 + 错题复习，无异常', !err, err||'');
console.log(fail?`${fail} FAIL`:'ALL PASS');process.exit(fail?1:0);
