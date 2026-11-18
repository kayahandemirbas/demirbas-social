const state={followers:[],following:[],tab:"notback",ready:false};
const $=id=>document.getElementById(id);
const norm=s=>String(s||"").trim().replace(/^@/,"").toLowerCase();
function extractNames(data){
  const out=[];
  const walk=(v)=>{
    if(!v)return;
    if(Array.isArray(v)){v.forEach(walk);return}
    if(typeof v==="object"){
      if(Array.isArray(v.string_list_data)){
        for(const x of v.string_list_data){const n=x.value||x.href?.split("/").filter(Boolean).pop();if(n)out.push(n)}
      }
      if(v.username)out.push(v.username);
      if(v.value && typeof v.value==="string" && (v.href||v.timestamp))out.push(v.value);
      Object.values(v).forEach(walk);
    }
  };
  walk(data);return [...new Set(out.map(norm).filter(Boolean))];
}
function classifyFile(name,text){
  const n=name.toLowerCase();
  if(n.includes("following")||n.includes("following_accounts"))return "following";
  if(n.includes("follower")||n.includes("followers"))return "followers";
  try{
    const obj=JSON.parse(text);
    const names=extractNames(obj);
    if(n.includes("following"))return "following";
    if(n.includes("follower"))return "followers";
    return {guess:names.length? "unknown":"unknown",names};
  }catch{
    const names=[...text.matchAll(/https?:\/\/www\.instagram\.com\/([^/"'?]+)/gi)].map(m=>m[1]);
    if(names.length)return {guess:"unknown",names};
  }
  return {guess:"unknown",names:[]};
}
async function importFiles(files){
  let unknown=[];
  for(const f of files){
    const txt=await f.text();let kind=classifyFile(f.name,txt);
    if(typeof kind==="object"){if(kind.names?.length)unknown.push({file:f.name,names:kind.names});continue}
    let names=[];
    try{names=extractNames(JSON.parse(txt))}catch{names=classifyFile(f.name,txt).names||[]}
    if(kind==="followers")state.followers=[...new Set([...state.followers,...names])];
    if(kind==="following")state.following=[...new Set([...state.following,...names])];
  }
  if(unknown.length){
    const pick=prompt("Dosya adı takipçi/takip edilen türünü belirtmiyor. Bu dosyalar hangisi?\n1 = Takipçiler\n2 = Takip ettiklerin\nDosya: "+unknown.map(x=>x.file).join(", "));
    if(pick==="1")unknown.forEach(x=>state.followers=[...new Set([...state.followers,...x.names])]);
    if(pick==="2")unknown.forEach(x=>state.following=[...new Set([...state.following,...x.names])]);
  }
  render();
}
function demo(){state.followers=["ayse.foto","mehmet_34","deniz.design","studio_example","elif.k"];state.following=["ayse.foto","mehmet_34","kaya_video","studio_example","mert.fx","elif.k"];render()}
function sets(){const f=new Set(state.followers),g=new Set(state.following);return {notback:[...g].filter(x=>!f.has(x)),fans:[...f].filter(x=>!g.has(x)),mutual:[...g].filter(x=>f.has(x))}}
function render(){
  const s=sets();state.ready=true;
  $("followersCount").textContent=state.followers.length.toLocaleString("tr-TR");
  $("followingCount").textContent=state.following.length.toLocaleString("tr-TR");
  $("notFollowingBack").textContent=s.notback.length.toLocaleString("tr-TR");
  $("mutualCount").textContent=s.mutual.length.toLocaleString("tr-TR");
  $("followersHint").textContent="Yüklenen benzersiz hesap";
  $("followingHint").textContent="Yüklenen benzersiz hesap";
  $("notbackTabCount").textContent=s.notback.length;$("fansTabCount").textContent=s.fans.length;$("mutualTabCount").textContent=s.mutual.length;
  showList();
}
function showList(){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.tab));
  const s=sets(),q=norm($("searchInput").value),names=(s[state.tab]||[]).filter(n=>n.includes(q));
  $("resultList").innerHTML=names.length?names.map(n=>`<div class="user-row"><a href="https://www.instagram.com/${encodeURIComponent(n)}/" target="_blank" rel="noopener">@${escapeHtml(n)}</a><small>Instagram profili ↗</small></div>`).join(""):`<div class="empty"><span>◎</span><strong>${state.ready?"Bu listede sonuç yok":"Henüz analiz yapılmadı"}</strong><p>${state.ready?"Arama veya seçili kategori için eşleşme bulunamadı.":"Instagram veri arşivini yükleyerek başla."}</p></div>`;
}
function escapeHtml(s){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
$("fileInput").addEventListener("change",e=>importFiles(e.target.files));
$("demoBtn").addEventListener("click",demo);
document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{state.tab=b.dataset.tab;showList()}));
$("searchInput").addEventListener("input",showList);
$("exportBtn").addEventListener("click",()=>{
 const names=sets()[state.tab];const csv="username\r\n"+names.map(n=>`"${n.replace(/"/g,'""')}"`).join("\r\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download=`demirbas-social-${state.tab}.csv`;a.click();URL.revokeObjectURL(a.href);
});
