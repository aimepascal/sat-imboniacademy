(function(){
var SAT=window.SAT,CON={},$=function(i){return document.getElementById(i)};
window.CONTENT.forEach(function(c){CON[c.id]=c});
var UNI=window.UNI||[];var UMAP={};UNI.forEach(function(u){UMAP[u.id]=u});
var SUBIDS={prop:"rr",rate:"rr",unit:"rr"};
var MET={ii:{ln:4,qs:"12 to 14 questions in the whole test (about 6 or 7 in each module)",at:"Usually questions 8 to 14 of each module"},
cs:{ln:3,qs:"13 to 15 questions in the whole test (about 7 in each module)",at:"Usually questions 1 to 7 of each module"},
ei:{ln:2,qs:"8 to 12 questions in the whole test (about 5 in each module)",at:"Usually questions 22 to 27, the last ones. Rhetorical Synthesis is usually last"},
sec:{ln:1,qs:"11 to 15 questions in the whole test (about 7 in each module)",at:"Usually questions 15 to 21 of each module"},
alg:{ln:4,qs:"13 to 15 of the 44 questions (about 6 or 7 in each module)",at:"All through the module, easier first and harder at the end"},
adv:{ln:3,qs:"13 to 15 of the 44 questions (about 6 or 7 in each module)",at:"All through the module, easier first and harder at the end"},
psda:{ln:2,qs:"5 to 7 of the 44 questions (about 2 to 4 in each module)",at:"Spread through the module, easier first and harder at the end"},
geo:{ln:1,qs:"5 to 7 of the 44 questions (about 2 to 4 in each module)",at:"Spread through the module, easier first and harder at the end"}};
var state={user:false,enrolled:{},done:{},scores:{},updated:{},syncErr:false,cur:null,secs:0,pending:null,testis:[]};
// Same Supabase project and publishable key as the Hub (served by /api/learn-config.js).
var CFG=window.LEARN_CONFIG||{},sb=(window.supabase&&CFG.url&&CFG.key)?window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
var all=[];SAT.forEach(function(p){p.domains.forEach(function(d){d.skills.forEach(function(s){all.push({id:s[0],name:s[1],def:s[2],part:p,dom:d})})})});
function byId(id){var x=all.filter(function(a){return a.id===id})[0];if(x)return x;if(SUBIDS[id]){var p=byId(SUBIDS[id]),c=CON[id];return{id:id,name:c.name,def:(c.subs&&c.subs[0]&&c.subs[0].def)||p.def,part:p.part,dom:p.dom,parent:p}}}
function E(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
function cleanSvg(s){return String(s).replace(/<script[\s\S]*?<\/script>/gi,"").replace(/\son\w+="[^"]*"/gi,"")}
function legend(el){var L=[["ii","Information and Ideas"],["cs","Craft and Structure"],["ei","Expression of Ideas"],["sec","Standard English Conventions"]],M=[["alg","Algebra"],["adv","Advanced Math"],["psda","Problem-Solving and Data Analysis"],["geo","Geometry and Trigonometry"]];
function row(a){return a.map(function(x){var n=MET[x[0]].ln,w={4:'Solid line',3:'Double line',2:'Dashed line',1:'Thin line'}[n];return'<span><i class="ln'+n+'"></i>'+w+': '+E(x[1])+'</span>'}).join('')}
el.innerHTML='<b style="width:100%;color:var(--ink)">Reading and Writing</b>'+row(L)+'<b style="width:100%;color:var(--ink);margin-top:6px">Math</b>'+row(M)}
function tag(id){return CON[id]?'<span class="rd">Lesson ready</span>':''}
function tree(){var h='<ul class="tree"><li><span class="root">SAT</span><ul class="branch">';
SAT.forEach(function(p){h+='<li><span class="n1">'+E(p.name)+'<small>'+E(p.facts)+'</small></span><ul class="branch">';
p.domains.forEach(function(d){var m=MET[d.id];h+='<li><div class="dgroup" style="margin-left:0"><span class="n2 ln'+m.ln+'" style="padding:8px 16px;font-size:16px">'+E(d.name)+'<small>'+E(d.pct)+'</small></span><div class="dommeta"><b>'+E(d.desc)+'</b><br>'+E(m.qs)+'. '+E(m.at)+'.</div>';
h+='<div class="cards3a">';d.skills.forEach(function(s){var c=CON[s[0]];h+='<button class="lcx ln'+m.ln+'" data-skill="'+s[0]+'" type="button">'+tag(s[0])+'<b>'+E(s[1])+'</b><span class="sm">'+E(s[2])+'</span>'+(c?'<span class="qs">16 practice questions · '+c.videos.length+' video'+(c.videos.length===1?'':'s')+'</span>':'')+'</button>';if(s[0]==="rr")["prop","rate","unit"].forEach(function(k){var u=CON[k];h+='<button class="lcx ln'+m.ln+'" data-skill="'+k+'" type="button">'+tag(k)+'<b>'+E(u.name)+'</b><span class="sm">'+E(u.subs[0].def)+'</span><span class="qs">Part of Ratios, rates and units</span></button>'})});
h+='</div></div></li>'});h+='</ul></li>'});h+='</ul></li></ul>';$("tree").innerHTML=h}

var HM={part:"rw",dom:"ii",sk:null,mode:"h"};
function hmap(){var el=$("tree");if(!el)return;
var tg='<div class="hmtog"><button type="button" data-hm="mode:h" class="'+(HM.mode==="h"?"on":"")+'">Horizontal map</button><button type="button" data-hm="mode:l" class="'+(HM.mode==="l"?"on":"")+'">Full list</button><span class="live"><i></i>Live: click any box</span></div>';
if(HM.mode==="l"){tree();el.insertAdjacentHTML("afterbegin",tg);return}
var P=SAT.filter(function(p){return p.id===HM.part})[0]||SAT[0],D=P.domains.filter(function(d){return d.id===HM.dom})[0]||P.domains[0];HM.dom=D.id;
var m=MET[D.id];
var sks=[];D.skills.forEach(function(s){sks.push({id:s[0],n:s[1],d:s[2],sub:0});if(s[0]==="rr")["prop","rate","unit"].forEach(function(k){if(CON[k])sks.push({id:k,n:CON[k].name,d:CON[k].subs[0].def,sub:1})})});
if(!HM.sk||!sks.some(function(x){return x.id===HM.sk}))HM.sk=sks[0].id;
var S=sks.filter(function(x){return x.id===HM.sk})[0];
function st(id){return state.done[id]?'<span class="st ok">Done</span>':state.enrolled[id]?'<span class="st">Enrolled</span>':''}
var h=tg+'<div class="hm" id="hm"><svg class="hmsv" id="hmsv"></svg>';
h+='<div class="hc"><div class="hh">Test</div><div class="hn root" id="n-root">SAT</div></div>';
h+='<div class="hc"><div class="hh">Parts</div>'+SAT.map(function(p){return'<button type="button" id="n-'+p.id+'" data-hm="part:'+p.id+'" class="hn n1b'+(p.id===HM.part?" sel":"")+'">'+E(p.name)+'<small>'+E(p.facts)+'</small></button>'}).join('')+'</div>';
h+='<div class="hc"><div class="hh">Sub-parts</div>'+P.domains.map(function(d){var mm=MET[d.id];return'<button type="button" id="n-'+d.id+'" data-hm="dom:'+d.id+'" class="hn ln'+mm.ln+(d.id===HM.dom?" sel":"")+'">'+E(d.name)+'<small>'+E(d.pct)+'</small></button>'}).join('')+'</div>';
h+='<div class="hc"><div class="hh">Skills</div>'+sks.map(function(x){return'<button type="button" id="n-'+x.id+'" data-hm="sk:'+x.id+'" class="hn sk'+(x.sub?" sub":"")+(x.id===HM.sk?" sel":"")+'">'+E(x.n)+st(x.id)+'</button>'}).join('')+'</div>';
var c=CON[S.id];
h+='<div class="hc wide"><div class="hh">Details</div><div class="hd" id="n-det"><h3>'+E(S.n)+'</h3><p>'+E(S.d)+'</p><p class="hmeta"><b>In this sub-part:</b> '+E(m.qs)+'.<br><b>Where you meet it:</b> '+E(m.at)+'.</p>'+(c?'<p class="hmeta">'+c.practice.length+' practice questions · '+c.videos.length+' video'+(c.videos.length===1?'':'s')+' · '+(c.codes?c.codes.length:0)+' cheat codes</p>':'')+'<div class="sh" style="margin:10px 0 0"><button class="btn sm" data-skill="'+S.id+'" type="button">Open the lesson</button><button class="btn sm ghost" data-skill="'+S.id+'" data-gopractice="1" type="button">Practice</button></div></div></div>';
h+='</div>';el.innerHTML=h;hmLines();var w=$("hm");if(w&&HM.sk&&HM.touched)w.scrollLeft=w.scrollWidth}
function hmLines(){var w=$("hm"),sv=$("hmsv");if(!w||!sv)return;var R=w.getBoundingClientRect();sv.setAttribute("width",w.scrollWidth);sv.setAttribute("height",w.scrollHeight);
function c(id,side){var e=$(id);if(!e)return null;var r=e.getBoundingClientRect();return{x:(side==="r"?r.right:r.left)-R.left+w.scrollLeft,y:r.top+r.height/2-R.top}}
var pairs=[["n-root","n-"+HM.part],["n-"+HM.part,"n-"+HM.dom],["n-"+HM.dom,"n-"+HM.sk],["n-"+HM.sk,"n-det"]],o="";
SAT.forEach(function(p){pairs.push(["n-root","n-"+p.id])});var P=SAT.filter(function(p){return p.id===HM.part})[0];P.domains.forEach(function(d){pairs.push(["n-"+HM.part,"n-"+d.id])});var D=P.domains.filter(function(d){return d.id===HM.dom})[0];[].forEach.call(document.querySelectorAll("#hm .hn.sk"),function(b){pairs.push(["n-"+HM.dom,b.id])});
var act={};[0,1,2,3].forEach(function(i){act[pairs[i].join(">")]=1});
pairs.forEach(function(p){var a=c(p[0],"r"),b=c(p[1],"l");if(!a||!b)return;var mx=(a.x+b.x)/2,on=act[p.join(">")];o+='<path d="M'+a.x+','+a.y+' C'+mx+','+a.y+' '+mx+','+b.y+' '+b.x+','+b.y+'" class="'+(on?"on":"")+'"/>'});
sv.innerHTML=o}
window.addEventListener("resize",function(){hmLines()});document.addEventListener("scroll",function(){},true);
document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-hm]");if(!b||!$("tree").contains(b))return;var kv=b.dataset.hm.split(":");
if(kv[0]==="mode")HM.mode=kv[1];else if(kv[0]==="part"){HM.part=kv[1];HM.dom=SAT.filter(function(p){return p.id===kv[1]})[0].domains[0].id;HM.sk=null}else if(kv[0]==="dom"){HM.dom=kv[1];HM.sk=null}else HM.sk=kv[1];HM.touched=1;hmap()});
function side(){var h='<h2>SAT map</h2>';SAT.forEach(function(p){h+='<details open><summary>'+E(p.name)+'</summary>';p.domains.forEach(function(d){h+='<details><summary>'+E(d.name)+'</summary>';d.skills.forEach(function(s){h+='<button class="sk" data-skill="'+s[0]+'" id="sk-'+s[0]+'" type="button">'+E(s[1])+'</button>'});h+='</details>'});h+='</details>'});$("side").innerHTML=h}
function secs(id){var s=byId(id);return s.part.id==="rw"?71:95}
function fmt(t){t=Math.max(0,Math.round(t));return Math.floor(t/60)+":"+("0"+t%60).slice(-2)}
function visual(v){var h='<div class="visb'+(v.type==="svg"?' svgb':'')+'"><h4>'+E(v.title||"")+'</h4>';
if(v.type==="flow")h+='<ol class="flow">'+v.steps.map(function(x){return'<li><span>'+E(x)+'</span></li>'}).join('')+'</ol>';
else if(v.type==="table")h+='<div style="overflow:auto"><table class="tbl"><thead><tr>'+v.head.map(function(x){return'<th>'+E(x)+'</th>'}).join('')+'</tr></thead><tbody>'+v.rows.map(function(r){return'<tr>'+r.map(function(x){return'<td>'+E(x)+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
else if(v.type==="compare")h+='<div class="cmp">'+[v.left,v.right].map(function(s){return'<div><h5>'+E(s.h)+'</h5><ul>'+s.items.map(function(i){return'<li>'+E(i)+'</li>'}).join('')+'</ul></div>'}).join('')+'</div>';
else if(v.type==="svg")h+=cleanSvg(v.svg)+(v.caption?'<p class="cap">'+E(v.caption)+'</p>':'');
return h+'</div>'}
function videos(c,id){var h='<div class="vid">';c.videos.forEach(function(v){h+='<div class="vcard"><button class="poster" data-play="'+v.id+'" type="button" aria-label="Play '+E(v.title)+'"><span class="pl">▶</span></button><div class="meta"><b>'+E(v.title)+'</b>'+E(v.channel)+' · <a href="https://www.youtube.com/watch?v='+v.id+'" target="_blank" rel="noopener">Open on YouTube</a></div></div>'});
h+='<div class="vslot"><div class="frame">Another video that helped you? Aime can add it here.</div><input data-vid="'+id+'" placeholder="Paste a YouTube link (Aime only)" aria-label="YouTube link"></div></div>';return h}
function ytid(u){var m=String(u).match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);return m?m[1]:null}

function scope(u){return u.applies==="all"?"Every part":(u.applies==="rw"?"Reading and Writing":"Math")}
function codesList(){var h='<p class="kicker">Universal cheat codes</p><h1 class="big">Cheat codes that work in every part</h1><div class="letter"><img src="images/aime.jpg" alt="Aime Pascal" width="90" height="90"><div><p>Each skill has its own cheat codes. These are different. They are habits that help you in <b>every</b> part of the SAT, because they come from how the test is built and how Bluebook works.</p><p>I will not promise you a score. I will teach each code, show it working on real questions, and give you a small test to run yourself. Believe your own results.</p></div></div>';
[["all","Work in every part"],["rw","Reading and Writing"],["m","Math"]].forEach(function(g){var list=UNI.filter(function(u){return u.applies===g[0]});if(!list.length)return;h+='<h2 class="sec">'+g[1]+'</h2><div class="cards3a">';list.forEach(function(u,n){h+='<button class="lcx ln4" data-code="'+u.id+'" type="button"><span class="rd">'+E(scope(u))+'</span><b>'+E(u.name)+'</b><span class="sm">'+E(u.oneline)+'</span><span class="qs">Shown on '+u.apply.length+' real questions</span></button>'});h+='</div>'});
$("v-codes").innerHTML=h}
function qHtml(sk,qn){var c=CON[sk],q=c.practice[qn-1];return'<div class="qshow"><p class="note" style="margin:0 0 6px"><b>'+E(c.name)+'</b> · question '+qn+' · '+E(q.level)+'</p>'+qBody(q)+'<ol type="A" style="margin:6px 0 10px;padding-left:24px">'+q.opts.map(function(o,k){return'<li>'+E(o)+'</li>'}).join('')+'</ol></div>'}
function codeView(id){var u=UMAP[id];if(!u)return;state.curCode=id;var i=UNI.indexOf(u),prev=UNI[i-1],next=UNI[i+1];
var h='<p class="crumb"><button data-go="codes" type="button">Cheat codes</button> / '+E(scope(u))+'</p><h1 class="big">'+E(u.name)+'</h1><div class="defbox ln4" style="margin:14px 15px 22px 4px">'+E(u.oneline)+'</div>';
h+='<h2 class="sec">How I think about it</h2><div class="story"><span class="lab">A small story from Aime</span>'+E(u.story)+'</div>';
h+='<h2 class="sec">The code in steps</h2><div class="visb"><ol class="flow">'+u.steps.map(function(x){return'<li><span>'+E(x)+'</span></li>'}).join('')+'</ol></div>';
h+='<h2 class="sec">Learn it</h2>'+u.teach.map(function(b,n){return'<div class="blk"><h3>'+(n+1)+'. '+E(b.h)+'</h3>'+(b.p||[]).map(function(t){return'<p>'+E(t)+'</p>'}).join('')+'</div>'}).join('');
h+='<h2 class="sec">Why it works</h2><p style="max-width:70ch">'+E(u.why)+'</p><div class="spot"><b>Watch out:</b> '+E(u.watch)+'</div>';
h+='<h2 class="sec">See it work on real questions</h2><p style="max-width:68ch">These are questions from our own practice. First read the question and try it your usual way. Then open the box to see the code at work.</p>';
u.apply.forEach(function(a,n){var cc=CON[a.skill],q=cc.practice[a.q-1];h+='<div class="th" style="border-left-width:4px">'+qHtml(a.skill,a.q)+'<details><summary style="cursor:pointer;font-weight:700;color:var(--blue)">Show how the code solves it</summary><div class="expl"><p style="margin:0 0 8px"><b>Without the code:</b> '+E(a.without)+'</p><p style="margin:0 0 8px"><b>With the code:</b> '+E(a.with)+'</p><p style="margin:0 0 8px"><b>Answer: '+String.fromCharCode(65+q.ans)+'.</b> '+E(q.opts[q.ans])+'</p><p style="margin:0"><b>What changed:</b> '+E(a.result)+'</p></div><button class="btn sm ghost" data-skill="'+a.skill+'" data-gopractice="1" type="button">Open this part and practise</button></details></div>'});
h+='<h2 class="sec">Do not just believe me. Test it.</h2><div class="talk"><p>'+E(u.experiment)+'</p></div>';
h+='<div class="sh" style="margin-top:30px">'+(prev?'<button class="btn ghost sm" data-code="'+prev.id+'" type="button">← '+E(prev.name)+'</button>':'')+(next?'<button class="btn sm" data-code="'+next.id+'" type="button">Next: '+E(next.name)+' →</button>':'')+'</div>';
$("v-code").innerHTML=h}
function uniFor(id,s){var rel=UNI.filter(function(u){return u.applies==="all"||u.applies===s.part.id});if(!rel.length)return'';
var h='<h2 class="sec">Universal cheat codes that help in this part</h2><p style="max-width:66ch;margin:0 0 6px">These work everywhere, not only here. The ones marked with a question number are shown on a question from this very part.</p><div class="cards3a">';
rel.forEach(function(u){var ex=u.apply.filter(function(a){return a.skill===id}).map(function(a){return a.q});h+='<button class="lcx ln4" data-code="'+u.id+'" type="button"><b>'+E(u.name)+'</b><span class="sm">'+E(u.oneline)+'</span>'+(ex.length?'<span class="qs"><b style="color:#1e7a45">Shown on question '+ex.join(', ')+' below</b></span>':'')+'</button>'});return h+'</div>'}

function skillView(id){var s=byId(id),c=CON[id];if(!s)return;state.cur=id;var m=MET[s.dom.id];var i=all.indexOf(s),prev=i>0?all[i-1]:null,next=i>-1&&i<all.length-1?all[i+1]:null;var en=!!state.enrolled[id],dn=!!state.done[id];
var h='<p class="crumb"><button data-go="home" type="button">Learn</button> / '+E(s.part.name)+' / '+E(s.dom.name)+(s.parent?' / <button data-skill="'+s.parent.id+'" type="button">'+E(s.parent.name)+'</button>':'')+'</p><h1 class="big">'+E(c?c.name:s.name)+'</h1>';
h+='<div class="defbox ln'+m.ln+'" style="margin:14px 15px 22px 4px">'+E(s.def)+'</div>';
h+='<div class="sh"><button class="btn'+(en?' done':'')+'" data-enroll-skill="'+id+'" type="button">'+(en?'Enrolled in this part':'Enroll in this part')+'</button><button class="btn ghost" data-done="'+id+'" type="button">'+(dn?'Marked as done':'Mark as done')+'</button></div>';
h+='<div class="dommeta"><b>Where you meet it on the test:</b> '+E(c.range)+'</div>';
h+='<h2 class="sec">How I approached it</h2><div class="story"><span class="lab">A small story from Aime</span>'+E(c.story)+'</div><p class="hope">'+E(c.hope)+'</p>';
if(id==="rr"){h+='<h2 class="sec">Parts of this skill</h2><div class="subs">'+["prop","rate","unit"].map(function(k){var u=CON[k];return'<div class="sub"><h3>'+E(u.name)+'</h3><p>'+E(u.subs[0].def)+'</p><p style="margin-top:10px"><button class="btn sm" data-skill="'+k+'" type="button">Open lesson</button></p></div>'}).join('')+'</div>'}
h+='<h2 class="sec">What is inside this part</h2><div class="subs">'+c.subs.map(function(x){return'<div class="sub"><h3>'+E(x.name)+'</h3><p>'+E(x.def)+'</p>'+(x.covers&&x.covers.length?'<p class="note" style="margin-top:8px">'+x.covers.map(E).join(' · ')+'</p>':'')+'</div>'}).join('')+'</div>';
h+='<h2 class="sec">How to know a question is from this part</h2><div class="spot"><p style="margin:0">'+E(c.spot.t)+'</p><ul>'+c.spot.s.map(function(q){return'<li>'+E(q)+'</li>'}).join('')+'</ul></div>';
h+='<h2 class="sec">The lesson</h2><p class="note" style="margin:0 0 12px">Learn the idea first. The cheat codes come after.</p>';
c.lesson.forEach(function(b,n){h+='<div class="blk"><h3>'+(n+1)+'. '+E(b.h)+'</h3>'+(b.p||[]).map(function(t){return'<p>'+E(t)+'</p>'}).join('');if(b.ex){h+='<div class="ex"><p class="q">'+E(b.ex.q)+'</p><details><summary style="cursor:pointer;font-weight:700;color:var(--blue)">Show the steps</summary><ol>'+(b.ex.steps||[]).map(function(x){return'<li>'+E(x)+'</li>'}).join('')+'</ol><p class="a">'+E(b.ex.ans)+'</p></details></div>'}h+='</div>'});
h+='<h2 class="sec">See it</h2>'+c.visual.map(visual).join('');
h+='<h2 class="sec">Videos that can help</h2>'+(c.videos.length?'':'<p>Videos are coming.</p>')+videos(c,id);
h+='<h2 class="sec">Cheat codes: where to start and where to stop</h2><p style="max-width:66ch;margin:0 0 6px">I worked these out by studying the practice questions below. Each code says where to start reading, where to stop, what you can skip, and why it is safe.</p>';
c.codes.forEach(function(k,n){h+='<div class="code"><h3>'+(n+1)+'. '+E(k.t)+'</h3><dl><div class="row s"><dt>Start</dt><dd>'+E(k.start)+'</dd></div><div class="row e"><dt>Stop</dt><dd>'+E(k.stop)+'</dd></div><div class="row k"><dt>Do not read</dt><dd>'+E(k.skip)+'</dd></div><div class="row w"><dt>Why</dt><dd>'+E(k.why)+'</dd></div></dl>'+(k.from&&k.from.length?'<p class="note" style="margin:8px 0 0">Seen in practice question'+(k.from.length>1?'s ':' ')+k.from.join(', ')+'</p>':'')+'</div>'});
h+=uniFor(id,s);h+='<h2 class="sec">Practice</h2><div id="pbox">'+intro(id)+'</div>';
h+='<h2 class="sec">Need help?</h2><div class="th"><b>Ask a tutor or mentor about this part</b><br><span class="note">Questions go to the forum. Approved tutors answer.</span><div class="sh" style="margin:10px 0 0"><button class="btn sm" id="askBtn2" type="button">Ask a question</button><button class="btn sm ghost" data-go="tutors" type="button">Become a tutor</button></div></div>';
h+='<div class="sh" style="margin-top:30px">'+(prev&&!s.parent?'<button class="btn ghost sm" data-skill="'+prev.id+'" type="button">← '+E(prev.name)+'</button>':'')+(next&&!s.parent?'<button class="btn sm" data-skill="'+next.id+'" type="button">Next: '+E(next.name)+' →</button>':'')+'</div>';
$("v-skill").innerHTML=h}
/* ---- practice ---- */
var P={round:0,id:null,i:0,timed:true,iv:null,res:[],locked:false,allow:0,left:0,bank:0,t0:0,start0:0};

function qBody(q){var h='';if(q.context)h+='<div class="stmt">'+E(q.context)+'</div>';
if(q.table){var t=q.table;h+='<div class="qtab">'+(t.title?'<div class="tt">'+E(t.title)+'</div>':'')+'<div style="overflow:auto"><table class="tbl"><thead><tr>'+t.head.map(function(x){return'<th>'+E(x)+'</th>'}).join('')+'</tr></thead><tbody>'+t.rows.map(function(r){return'<tr>'+r.map(function(x,i){return(i===0&&t.head[0]===""?'<th>':'<td>')+E(x)+(i===0&&t.head[0]===""?'</th>':'</td>')}).join('')+'</tr>'}).join('')+'</tbody></table></div>'+(t.note?'<div class="note" style="margin-top:6px">'+E(t.note)+'</div>':'')+'</div>'}
if(q.svg)h+='<div class="qfig">'+cleanSvg(q.svg)+'</div>';
h+='<p class="stem">'+E(q.q)+'</p>';return h}
function setOf(id){var all16=CON[id].practice;return P.round?all16.slice(8,16):all16.slice(0,8)}
function intro(id){var s=byId(id),t=secs(id),mt=s.part.id==="rw"?"Reading and Writing":"Math";
return'<div class="prac"><div class="talk"><p><b>Before you start, from me:</b></p><p>On the real SAT every '+mt+' question has its own time. It is about <b>'+fmt(t)+'</b> for each question ('+(s.part.id==="rw"?"64 minutes for 54 questions":"70 minutes for 44 questions")+'). The clock here counts down from that time.</p><p>If you finish early, or if you get one wrong and move on, the seconds you did not use are added to the next question. Do not waste them, and do not rush either. Speed comes after you understand.</p><p>The 8 questions go from easy to very hard. If you do not understand one, do not panic: read the explanation, open the lesson again, or ask in the forum. Prefer no clock? Choose <b>Free</b> and take all the time you want. You can switch the clock off at any moment.</p></div>'
+'<div class="ptop"><div><b>16 questions in two rounds of 8</b><div class="note">Each round goes easy, medium, hard, very hard (two of each)</div><div class="mode" style="margin-top:8px" id="rmode"><button class="'+(P.round?'':'on')+'" data-round-pick="0" type="button">Round 1</button><button class="'+(P.round?'on':'')+'" data-round-pick="1" type="button">Round 2</button></div></div><div class="mode" id="mode"><button class="'+(P.timed?'on':'')+'" data-mode="timed" type="button">Timed (countdown)</button><button class="'+(P.timed?'':'on')+'" data-mode="free" type="button">Free (no clock)</button></div></div><button class="btn" data-pstart="'+id+'" type="button">Start practice</button></div>'+official(id)}
function official(id){var s=byId(id),c=CON[id];return'<div class="th" style="margin-top:16px"><b>Want real test questions too?</b><p style="margin:6px 0">These questions are my own, written in the style of the Digital SAT with real-length statements, tables and figures. For questions written by College Board themselves, use the official bank. It is free:</p><ul style="margin:0 0 8px;padding-left:20px"><li><a href="https://satsuitequestionbank.collegeboard.org" target="_blank" rel="noopener">College Board Question Bank</a>: choose <b>'+(s.part.id==="rw"?"Reading and Writing":"Math")+'</b>, then <b>'+E(s.dom.name)+'</b>, then <b>'+E(c.name.split(":")[0])+'</b>.</li><li><a href="https://bluebook.collegeboard.org" target="_blank" rel="noopener">Bluebook full-length practice tests</a> in the real test app.</li><li><a href="https://www.khanacademy.org/test-prep/sat" target="_blank" rel="noopener">Official Digital SAT Prep on Khan Academy</a>.</li></ul><p class="note" style="margin:0">I cannot copy College Board questions into this site, but you can open them in one tap.</p></div>'}
function stopClock(){if(P.iv){clearInterval(P.iv);P.iv=null}}
function dclass(l){return l==="very hard"?"vh":l}
function qView(){var id=P.id,q=setOf(id)[P.i],box=$("pbox");if(!box)return;
if(P.i===0&&!P.res.length)P.bank=0;
P.allow=secs(id)+P.bank;P.left=P.allow;
var h='<div class="prac"><div class="ptop"><div class="rowb"><b>Round '+(P.round+1)+' · Question '+(P.i+1)+' of 8</b><span class="diff '+dclass(q.level)+'">'+E(q.level)+'</span></div><div class="mode"><button class="'+(P.timed?'on':'')+'" data-pm="timed" type="button">Timed</button><button class="'+(P.timed?'':'on')+'" data-pm="free" type="button">Free</button></div></div>'
+'<div id="tbox" '+(P.timed?'':'hidden')+'><div class="rowb"><span class="cd" id="cd">'+fmt(P.left)+'</span><span class="bank" id="bk">'+(P.bank>0?'includes <b>+'+fmt(P.bank)+'</b> saved from earlier':'')+'</span></div><div class="tbar"><i id="tb"></i></div></div>'
+qBody(q)+'<div class="opts" id="po">'+q.opts.map(function(o,k){return'<button type="button" data-ans="'+k+'">'+String.fromCharCode(65+k)+'. '+E(o)+'</button>'}).join('')+'</div><div id="pfb"></div></div>';
box.innerHTML=h;P.locked=false;P.t0=Date.now();run()}
function run(){stopClock();if(!P.timed)return;var end=Date.now()+P.left*1000;P.iv=setInterval(function(){var l=Math.max(0,(end-Date.now())/1000);P.left=l;var cd=$("cd"),tb=$("tb");if(!cd){stopClock();return}cd.textContent=fmt(l);cd.classList.toggle("low",l<=15);if(tb)tb.style.width=(100*l/P.allow)+"%";if(l<=0){stopClock();timeUp()}},250)}
function lockOpts(k){var q=setOf(P.id)[P.i];[].forEach.call($("po").children,function(b,n){b.disabled=true;if(n===q.ans)b.className="ok";else if(n===k)b.className="no"})}
function hint(){var m=UNI.filter(function(u){return u.apply.some(function(a){return a.skill===P.id&&a.q===P.i+1+P.round*8})});return m.length?'<br><span class="note">A code that helps on this question: '+m.map(function(u){return'<button class="linkb" data-code="'+u.id+'" type="button" style="background:none;border:0;color:var(--blue);font:inherit;text-decoration:underline;cursor:pointer;padding:0">'+E(u.name)+'</button>'}).join(", ")+'</span>':''}
function finish(ok,usedMsg,timeup){var q=setOf(P.id)[P.i],last=P.i===7;
$("pfb").innerHTML='<div class="expl"><b>'+(timeup?"Time is up for this question. ":(ok?"Correct! 🎉 ":"Not quite. "))+'</b>The answer is <b>'+String.fromCharCode(65+q.ans)+'</b>. '+E(q.why)+(usedMsg?'<br><span class="note">'+usedMsg+'</span>':'')+hint()+'</div><div class="rowb"><button class="btn sm" id="pnext" type="button">'+(last?'See my result':'Next question')+'</button></div>'}
function answer(k){if(P.locked)return;P.locked=true;stopClock();var q=setOf(P.id)[P.i],ok=(k===q.ans),used=(Date.now()-P.t0)/1000;lockOpts(k);
var msg="";if(P.timed){var left=Math.max(0,P.allow-used);P.bank=Math.round(left);msg=ok?'You used '+fmt(used)+'. <b>'+fmt(left)+'</b> saved will be added to the next question.':'The '+fmt(left)+' you did not use moves to the next question.'}
P.res.push({ok:ok,level:q.level,used:P.timed?used:null});if(ok)celebrate(1);finish(ok,msg,false)}
function timeUp(){if(P.locked)return;P.locked=true;var q=setOf(P.id)[P.i];lockOpts(-1);P.bank=0;P.res.push({ok:false,level:q.level,used:P.allow});finish(false,"The next question starts with its own full time.",true)}
function celebrate(n){var set=["🎉","⭐","👏","🔥","🙌","✨","💪","🥳"];for(var i=0;i<n*8;i++){(function(i){setTimeout(function(){var e=document.createElement("div");e.className="pop";e.textContent=set[Math.floor(Math.random()*set.length)];e.style.left=(5+Math.random()*88)+"vw";e.style.bottom=(4+Math.random()*20)+"vh";document.body.appendChild(e);setTimeout(function(){e.remove()},1900)},i*60)})(i)}}
function result(){var r=P.res,c=r.filter(function(x){return x.ok}).length,perfect=c===r.length,id=P.id;state.scores[id]=[c,r.length];save(id);
var h='<div class="prac">'+(perfect?'<div class="big-cong">🎉🥳🏆👏🎉</div><h3 style="text-align:center">Congratulations! Perfect score!</h3>':(c>=5?'<div class="big-cong">👏🔥⭐</div><h3 style="text-align:center">Well done!</h3>':'<div class="big-cong">💪</div><h3 style="text-align:center">Good work. Keep going.</h3>'))+'<p style="font-size:19px;margin:8px 0;text-align:center">You got <b>'+c+' of '+r.length+'</b> correct.</p>';
var lv={};r.forEach(function(x){lv[x.level]=lv[x.level]||[0,0];lv[x.level][1]++;if(x.ok)lv[x.level][0]++});
h+='<div class="chips" style="justify-content:center">'+["easy","medium","hard","very hard"].map(function(l){return'<span>'+l+': '+(lv[l]?lv[l][0]+'/'+lv[l][1]:'0/0')+'</span>'}).join('')+'</div>';
if(P.timed){var tt=r.reduce(function(a,x){return a+(x.used||0)},0);h+='<p style="text-align:center">Total time: '+fmt(tt)+'. Average '+fmt(tt/r.length)+' per question.</p>'}
h+='<p class="note" style="text-align:center">'+(perfect?"Mark this part as done and open the next one.":"Read the explanations again, look at the cheat codes, and try once more. Going correct first, then fast, is the right order.")+'</p><div class="rowb" style="justify-content:center"><button class="btn sm" data-pstart="'+id+'" type="button">Try this round again</button>'+(P.round===0?'<button class="btn sm" data-pstart="'+id+'" data-round="1" type="button">Start Round 2 (8 new questions)</button>':'<button class="btn sm" data-pstart="'+id+'" data-round="0" type="button">Back to Round 1</button>')+'<button class="btn sm ghost" data-done="'+id+'" type="button">Mark as done</button></div></div>';
$("pbox").innerHTML=h;if(perfect)celebrate(4);else if(c>=5)celebrate(2)}
function plist(){var h="";SAT.forEach(function(p){h+='<h2 class="sec">'+E(p.name)+'</h2>';p.domains.forEach(function(d){var m=MET[d.id];h+='<h3 style="margin:18px 0 8px;font-size:18px">'+E(d.name)+'</h3><div class="cards3a">';d.skills.forEach(function(s){var sc=state.scores[s[0]];h+='<button class="lcx ln'+m.ln+'" data-skill="'+s[0]+'" data-gopractice="1" type="button"><b>'+E(s[1])+'</b><span class="sm">16 questions · two rounds, easy to very hard</span>'+(sc?'<span class="qs">Your last score: '+sc[0]+'/'+sc[1]+'</span>':'')+'</button>';if(s[0]==="rr")["prop","rate","unit"].forEach(function(k){h+='<button class="lcx ln'+m.ln+'" data-skill="'+k+'" data-gopractice="1" type="button"><b>'+E(CON[k].name)+'</b><span class="sm">16 questions · part of Ratios, rates and units</span></button>'})});h+='</div>'})});$("plist").innerHTML=h}
function lib(){var f=lib.f||"all",q=($("q").value||"").toLowerCase(),h="";
SAT.forEach(function(p){if(f!=="all"&&p.id!==f)return;p.domains.forEach(function(d){var m=MET[d.id],list=d.skills.filter(function(s){return!q||(s[1]+" "+s[2]+" "+d.name).toLowerCase().indexOf(q)>-1});if(!list.length)return;
h+='<div class="dgroup"><div class="dhead2 ln'+m.ln+'"><h2>'+E(d.name)+'</h2><p>'+E(d.desc)+'</p><p class="note">'+E(m.qs)+'. '+E(m.at)+'.</p></div><div class="cards3a">';
list.forEach(function(s){var c=CON[s[0]];h+='<button class="lcx ln'+m.ln+'" data-skill="'+s[0]+'" type="button">'+tag(s[0])+'<b>'+E(s[1])+'</b><span class="sm">'+E(s[2])+'</span><span class="qs">'+(c?c.practice.length+' practice questions · '+c.videos.length+' videos':'')+'</span></button>';if(s[0]==="rr")["prop","rate","unit"].forEach(function(k){var u=CON[k];h+='<button class="lcx ln'+m.ln+'" data-skill="'+k+'" type="button">'+tag(k)+'<b>'+E(u.name)+'</b><span class="sm">'+E(u.subs[0].def)+'</span><span class="qs">Part of Ratios, rates and units · 16 practice questions · '+u.videos.length+' videos</span></button>'})});h+='</div></div>'})});
$("lib").innerHTML=h||'<p>No skills match.</p>'}
function flt(){var h="";[["all","All"],["rw","Reading and Writing"],["m","Math"]].forEach(function(a){h+='<button type="button" data-f="'+a[0]+'" class="'+((lib.f||"all")===a[0]?'on':'')+'">'+a[1]+'</button>'});$("fl").innerHTML=h}
var BOOKS=[["Bluebook: the official Digital SAT app and practice tests","Free from College Board. Full-length official practice tests in the same app used on test day.","https://bluebook.collegeboard.org","Free"],["Official Digital SAT Prep on Khan Academy","Free lessons and practice made with College Board.","https://www.khanacademy.org/test-prep/sat","Free"],["College Board SAT Suite Question Bank","Thousands of official questions. Filter by skill and difficulty. Good for the practice that follows each lesson.","https://satsuitequestionbank.collegeboard.org","Free"],["Project Gutenberg: free classic books","Read old novels, essays and speeches for free. They help your Reading speed because SAT passages often use this kind of writing.","https://www.gutenberg.org","Free, public domain"]];
function books(){$("booklist").innerHTML=BOOKS.map(function(b){return'<div class="book"><div><b>'+E(b[0])+'</b><p class="note">'+E(b[1])+' · '+E(b[3])+'</p></div><a class="btn sm" href="'+b[2]+'" target="_blank" rel="noopener">Open</a></div>'}).join('')+'<p class="note" style="margin-top:12px">I only list free and legal sources. Aime can add more books here as he finds them.</p>'}
function cname(k){var n=byId(k);return n?n.name:(k==="rw"?"Reading and Writing course":k==="m"?"Math course":k)}
function recent(obj){return Object.keys(obj).sort(function(a,b){return (state.updated[b]||0)-(state.updated[a]||0)})}
function dash(){var rwL=all.filter(function(x){return x.part.id==="rw"}),mL=all.filter(function(x){return x.part.id==="m"});
var rd=rwL.filter(function(x){return state.done[x.id]}).length,md=mL.filter(function(x){return state.done[x.id]}).length;
var sc=recent(state.scores).filter(function(k){return byId(k)}),last=recent(state.updated).filter(function(k){return byId(k)})[0];
var weak=sc.filter(function(k){return state.scores[k][0]/state.scores[k][1]<0.75}).sort(function(a,b){return state.scores[a][0]/state.scores[a][1]-state.scores[b][0]/state.scores[b][1]})[0];
var en=Object.keys(state.enrolled).filter(function(k){return state.enrolled[k]});
var h='<h2 style="font-size:24px;margin:0 0 12px">Welcome back, '+E(userName())+'. 👋</h2>';
if(state.syncErr)h+='<p class="note" style="color:#8a1c1c">We could not reach your saved progress right now. What you do here is kept on this page until you reload.</p>';
h+='<div class="talk"><p><b>A note from Aime</b></p><p>One part at a time. Finish a lesson, try the questions, then rest. You are doing better than you think.</p></div>';
h+='<div class="dash"><div class="dc"><h3>Continue where you stopped</h3>'+(last?'<p style="margin:0 0 10px">'+E(byId(last).name)+'</p><button class="btn sm" data-skill="'+last+'" type="button">Continue</button>':'<p style="margin:0 0 10px">Pick any skill on the SAT map to start.</p><button class="btn sm" data-go="home" type="button">Open the map</button>')+'</div>'
+'<div class="dc"><h3>Reading and Writing</h3><div class="pbar"><i style="width:'+Math.round(100*rd/rwL.length)+'%"></i></div><p class="note" style="margin:0">'+rd+' of '+rwL.length+' skills done</p></div>'
+'<div class="dc"><h3>Math</h3><div class="pbar"><i style="width:'+Math.round(100*md/mL.length)+'%"></i></div><p class="note" style="margin:0">'+md+' of '+mL.length+' skills done</p></div></div>';
h+='<div class="dash"><div class="dc"><h3>My enrolled courses</h3>'+(en.length?en.map(function(k){return'<p style="margin:4px 0">'+E(cname(k))+'</p>'}).join(''):'<p style="margin:0">Nothing yet. Open a skill and press Enroll.</p>')+'</div>'
+'<div class="dc"><h3>Recent practice</h3>'+(sc.length?'<table class="tbl"><tbody>'+sc.slice(0,6).map(function(k){var s=state.scores[k];return'<tr><td>'+E(byId(k).name)+'</td><td>'+s[0]+'/'+s[1]+(s[0]===s[1]?' 🏆':'')+'</td></tr>'}).join('')+'</tbody></table>':'<p style="margin:0">No practice yet. Every skill has 16 questions.</p>')+'</div>'
+'<div class="dc"><h3>Worth another look</h3>'+(weak?'<p style="margin:0 0 8px">'+E(byId(weak).name)+' scored '+state.scores[weak][0]+'/'+state.scores[weak][1]+'. Read the lesson and its cheat codes again.</p><button class="btn sm ghost" data-skill="'+weak+'" type="button">Open '+E(byId(weak).name)+'</button>':'<p style="margin:0">Nothing to repeat yet. Skills that score under 6 of 8 show up here.</p>')+'</div></div>';
h+='<div class="dash"><div class="dc"><h3>Forum</h3><p style="margin:0">Ask a question or help another student.</p><a class="btn sm ghost" style="margin-top:8px" href="/forum">Open the forum</a></div><div class="dc"><h3>Tutors and mentors</h3><p style="margin:0">See how tutors and mentors help on the Hub.</p><button class="btn sm ghost" style="margin-top:8px" data-go="tutors" type="button">See tutors</button></div><div class="dc"><h3>The Hub</h3><p style="margin:0">Your daily plan, the Vault and the AI tutor are on the Hub, with the same account.</p><a class="btn sm ghost" style="margin-top:8px" href="/today">Open Today</a></div></div>';return h}
function mine(){if(!state.user){$("mine").innerHTML='<div class="soon"><b>My learning is for students with an account.</b><p style="margin:6px 0 12px">Create a free account to see your courses, finished parts and next step.</p><button class="btn" data-open-join type="button">Create free account</button></div>';return}$("mine").innerHTML=dash()}
function testis(){}
function forumList(){var el=$("fthreads");if(!el)return;if(!sb){el.innerHTML='<p class="note">Open the forum to see the latest questions.</p>';return}sb.from("forum_posts").select("id,title,topic,created_at").order("created_at",{ascending:false}).limit(5).then(function(r){if(r.error||!r.data||!r.data.length){el.innerHTML='<p class="note">No questions yet. Be the first to ask.</p>';return}el.innerHTML=r.data.map(function(p){return'<a class="th" style="display:block;color:inherit;text-decoration:none" href="/forum/'+encodeURIComponent(p.id)+'"><b>'+E(p.title)+'</b><br><span class="note">'+E(p.topic||"General")+'</span></a>'}).join('')})}
var VIEWS=["home","skill","codes","code","library","practice","forum","tutors","impact","mine"];
function go(v){stopClock();if(v==="home"&&$("tree"))hmap();VIEWS.forEach(function(x){$("v-"+x).hidden=(x!==v)});[].forEach.call(document.querySelectorAll("nav.main .nv"),function(b){b.classList.toggle("on",b.dataset.go===v||(v==="skill"&&b.dataset.go==="home"))});
$("side").classList.toggle("closed",window.innerWidth<=900);
if(v==="codes")codesList();if(v==="library"){flt();lib();books()}if(v==="mine")mine();if(v==="practice")plist();if(v==="impact")testis();window.scrollTo(0,0)}
function openSkill(id,goP){skillView(id);go("skill");var pid=byId(id).parent?byId(id).parent.id:id;[].forEach.call(document.querySelectorAll("#side .sk"),function(b){b.classList.toggle("on",b.dataset.skill===pid)});var b=$("sk-"+pid);if(b){var d=b.closest("details");while(d){d.open=true;d=d.parentElement.closest("details")}}
if(goP){var pb=$("pbox");if(pb)pb.scrollIntoView()}}
function userName(){var u=state.user;if(!u)return"";var m=u.user_metadata||{};return m.display_name||m.full_name||m.name||String(u.email||"").split("@")[0]||"student"}
function who(){$("who").textContent=state.user?"Signed in as "+userName():"Browsing as a guest";$("joinBtn").style.display=state.user?"none":"";$("outBtn").hidden=!state.user;$("navMine").hidden=!state.user}
function join(){$("jMsg").textContent="";$("m-join").hidden=false}
// Progress lives in Supabase (table learn_progress), one row per skill or course.
function row4(k){return{user_id:state.user.id,skill_id:k,enrolled:!!state.enrolled[k],done:!!state.done[k],last_score:state.scores[k]?state.scores[k][0]:null,last_total:state.scores[k]?state.scores[k][1]:null,updated_at:new Date().toISOString()}}
function save(k){state.updated[k]=Date.now();if(!state.user||!sb)return;sb.from("learn_progress").upsert(row4(k),{onConflict:"user_id,skill_id"}).then(function(r){if(r.error){state.syncErr=true;console.warn("[learn] save failed",r.error.message)}})}
function load(){if(!state.user||!sb)return Promise.resolve();var local={};["enrolled","done","scores"].forEach(function(f){Object.keys(state[f]).forEach(function(k){local[k]=1})});
return sb.from("learn_progress").select("skill_id,enrolled,done,last_score,last_total,updated_at").then(function(r){if(r.error){state.syncErr=true;console.warn("[learn] load failed",r.error.message);return}state.syncErr=false;
var seen={};r.data.forEach(function(x){var k=x.skill_id;seen[k]=1;if(x.enrolled)state.enrolled[k]=true;if(x.done)state.done[k]=true;if(x.last_total&&!state.scores[k])state.scores[k]=[x.last_score,x.last_total];state.updated[k]=Math.max(state.updated[k]||0,Date.parse(x.updated_at)||0)});
// Anything done as a guest before signing in is kept and saved now.
Object.keys(local).forEach(function(k){save(k)})})}
function refresh(){who();if(!$("v-mine").hidden)mine();if(state.cur&&!$("v-skill").hidden)skillView(state.cur)}
function setUser(u){var was=state.user&&state.user.id,now=u&&u.id;state.user=u||false;if(!now&&was){state.enrolled={};state.done={};state.scores={};state.updated={}}
if(now&&now!==was){var p=null;try{p=sessionStorage.getItem("learnPending");sessionStorage.removeItem("learnPending")}catch(e){}if(p&&!state.pending)state.pending=p;
if(state.pending){state.enrolled[state.pending]=true;state.updated[state.pending]=Date.now();state.pending=null}$("m-join").hidden=true;$("m-nudge").hidden=true;load().then(refresh)}
refresh()}
document.addEventListener("click",function(e){var t=e.target;
var g=t.closest("[data-go]");if(g){e.preventDefault();go(g.dataset.go);return}
var cd=t.closest("[data-code]");if(cd){codeView(cd.dataset.code);go("code");return}
var pl=t.closest("[data-play]");if(pl){var f=document.createElement("iframe");f.src="https://www.youtube-nocookie.com/embed/"+pl.dataset.play+"?autoplay=1";f.setAttribute("allow","autoplay; encrypted-media; picture-in-picture");f.setAttribute("allowfullscreen","");f.title="YouTube video";pl.replaceWith(f);return}
var s=t.closest("[data-skill]");if(s){openSkill(s.dataset.skill,!!s.dataset.gopractice);return}
var en=t.closest("[data-enroll]");if(en){var k=en.dataset.enroll;if(!state.user){state.pending=k;join()}else{state.enrolled[k]=true;save(k);go("mine")}return}
var es=t.closest("[data-enroll-skill]");if(es){var k2=es.dataset.enrollSkill;if(!state.user){state.pending=k2;join()}else{state.enrolled[k2]=true;save(k2);skillView(k2)}return}
var dn=t.closest("[data-done]");if(dn){var k3=dn.dataset.done;if(!state.user){state.pending=null;join()}else{state.done[k3]=!state.done[k3];save(k3);skillView(k3)}return}
var f2=t.closest("[data-f]");if(f2){lib.f=f2.dataset.f;flt();lib();return}
var rp=t.closest("[data-round-pick]");if(rp){P.round=+rp.dataset.roundPick;[].forEach.call($("rmode").children,function(b){b.classList.toggle("on",b===rp)});return}
var md=t.closest("[data-mode]");if(md){P.timed=md.dataset.mode==="timed";[].forEach.call($("mode").children,function(b){b.classList.toggle("on",b===md)});return}
var ps=t.closest("[data-pstart]");if(ps){P.id=ps.dataset.pstart;if(ps.dataset.round!==undefined)P.round=+ps.dataset.round;P.i=0;P.res=[];P.bank=0;qView();$("pbox").scrollIntoView();return}
var pm=t.closest("[data-pm]");if(pm){var wasT=P.timed;P.timed=pm.dataset.pm==="timed";[].forEach.call(pm.parentElement.children,function(b){b.classList.toggle("on",b===pm)});var tb=$("tbox");if(tb)tb.hidden=!P.timed;if(!P.timed)stopClock();else if(!wasT&&!P.locked){P.t0=Date.now();P.left=P.allow;run()}return}
var an=t.closest("[data-ans]");if(an){answer(+an.dataset.ans);return}
if(t.id==="pnext"){if(P.i===7)result();else{P.i++;qView()}return}
if(t.id==="askBtn"||t.id==="askBtn2"){location.href="/forum";return}
if(t.closest("[data-open-join]")){join();return}});
document.addEventListener("change",function(e){var t=e.target;if(t.dataset&&t.dataset.vid){var id=ytid(t.value);if(id){CON[t.dataset.vid].videos.push({id:id,title:"Added by Aime",channel:"YouTube"});skillView(t.dataset.vid)}}});
$("joinBtn").onclick=join;$("mapBtn").onclick=function(){$("side").classList.toggle("closed")};
$("gBtn").onclick=function(){if(!sb){$("jMsg").textContent="Sign-in is not available right now. Please try again later.";return}try{if(state.pending)sessionStorage.setItem("learnPending",state.pending)}catch(e){}
sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/learn"}}).then(function(r){if(r.error)$("jMsg").textContent=r.error.message})};
$("notNow").onclick=function(){$("m-join").hidden=true;state.pending=null};
function jmode(m){join.mode=m;$("jHave").classList.toggle("on",m==="in");$("jNew").classList.toggle("on",m==="up");$("nmBox").hidden=m==="in";$("doJoin").textContent=m==="in"?"Sign in":"Create account"}
$("jNew").onclick=function(){jmode("up")};$("jHave").onclick=function(){jmode("in")};jmode("up");
$("doJoin").onclick=function(){var msg=$("jMsg"),em=$("em").value.trim(),pw=$("pw").value;if(!sb){msg.textContent="Sign-in is not available right now. Please try again later.";return}
if(!em||!pw){msg.textContent="Please add your email and a password.";return}if(pw.length<6){msg.textContent="Your password needs at least 6 characters.";return}
var b=$("doJoin");b.disabled=true;msg.textContent="One moment…";
var p=join.mode==="in"?sb.auth.signInWithPassword({email:em,password:pw}):sb.auth.signUp({email:em,password:pw,options:{data:{display_name:$("nm").value.trim()||undefined},emailRedirectTo:location.origin+"/learn"}});
p.then(function(r){b.disabled=false;if(r.error){msg.textContent=r.error.message;return}if(!r.data.session){try{if(state.pending)sessionStorage.setItem("learnPending",state.pending)}catch(e){}msg.textContent="Almost done: we sent you an email. Open the link in it to finish creating your account.";return}msg.textContent="";setUser(r.data.session.user)})};
$("outBtn").onclick=function(){if(sb)sb.auth.signOut();setUser(null);go("home")};
function nudge(){if(!state.user)$("m-nudge").hidden=false}
$("nKeep").onclick=function(){$("m-nudge").hidden=true;state.secs=0};
$("nCreate").onclick=function(){$("m-nudge").hidden=true;join()};
setInterval(function(){if(state.user||document.hidden)return;state.secs++;if(state.secs>=300){state.secs=0;nudge()}},1000);
$("q").addEventListener("input",lib);
if(sb){sb.auth.getSession().then(function(r){setUser(r.data.session?r.data.session.user:null)});sb.auth.onAuthStateChange(function(_e,s){var u=s?s.user:null;if((u&&u.id)!==(state.user&&state.user.id))setTimeout(function(){setUser(u)},0)})}
forumList();
var qn=0;window.CONTENT.forEach(function(c){qn+=c.practice.length});$("stq").textContent=qn;
legend($("legend1"));legend($("legend2"));legend($("legend3"));hmap();side();who();(function(){var h=(location.hash||"").slice(1);go(["library","codes","practice","impact","tutors","mine"].indexOf(h)>=0?h:"home")})();
/* Visit counting for the Control Center: same rules as src/lib/track.ts (no names, no emails) */
var lastTrack="";function track(path){if(!sb||path===lastTrack||/localhost|127\.0\.0\.1/.test(location.hostname))return;lastTrack=path;try{var k="imboni_visit_id",id=localStorage.getItem(k);if(!id){id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));localStorage.setItem(k,id)}var w=innerWidth,dev=w<700?"phone":(w<1100&&navigator.maxTouchPoints>0?"tablet":"computer"),ref=null;try{if(document.referrer){var h=new URL(document.referrer).hostname.replace(/^www\./,"");if(h!==location.hostname)ref=h.slice(0,200)}}catch(e){}sb.from("page_views").insert({path:path.slice(0,200),referrer:ref,device:dev,language:(document.documentElement.lang||"en").slice(0,10),session_id:id,user_id:state.user?state.user.id:null}).then(function(){},function(){})}catch(e){}}
var _go=go;go=function(v){_go(v);track("/learn"+(v&&v!=="home"&&v!=="skill"&&v!=="code"?"#"+v:""))};track("/learn"+(location.hash&&location.hash!=="#home"?location.hash:""));
(function(){var n=$("pnote");if(!n)return;var ok;try{ok=localStorage.getItem("imboni_privacy_ok")==="1"}catch(e){ok=true}n.hidden=ok;$("pnoteOk").onclick=function(){try{localStorage.setItem("imboni_privacy_ok","1")}catch(e){}n.hidden=true}})();
/* Compact header: phone menu and SAT map drawer */
function setMenu(open){var n=$("mainnav"),h=$("hamb");n.classList.toggle("open",open);h.setAttribute("aria-expanded",open?"true":"false");h.setAttribute("aria-label",open?"Close the menu":"Open the menu")}
$("hamb").onclick=function(){setMenu(!$("mainnav").classList.contains("open"))};
document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("[data-go],[data-skill],#mapBtn");if(!t)return;if(t.id!=="mapBtn")$("side").classList.add("closed");setMenu(false)},true);
document.addEventListener("keydown",function(e){if(e.key==="Escape"){setMenu(false);$("side").classList.add("closed")}});
})();
