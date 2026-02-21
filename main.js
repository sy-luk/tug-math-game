const els={
  question:document.getElementById("question"),
  rope:document.getElementById("rope"),
  displayA:document.getElementById("displayA"),
  displayB:document.getElementById("displayB"),
  keypadA:document.getElementById("keypadA"),
  keypadB:document.getElementById("keypadB"),
  btnReset:document.getElementById("btnReset"),
  btnFullscreen:document.getElementById("btnFullscreen"),
  btnMode:document.getElementById("btnMode"),
  teamB:document.getElementById("teamB"),
  teamBTitle:document.getElementById("teamBTitle")
};

let state={
  ropePos:0,
  answer:0,
  inputA:"",
  inputB:"",
  mode:"teams"
};

function setViewportVars(){
  const vv=window.visualViewport;
  const h=vv?vv.height:window.innerHeight;
  document.documentElement.style.setProperty("--vh",h*0.01+"px");

  const tb=document.querySelector(".topbar");
  document.documentElement.style.setProperty("--topbar-h",
    tb.getBoundingClientRect().height+"px");
}

function newQuestion(){
  const a=Math.floor(Math.random()*50)+1;
  const b=Math.floor(Math.random()*50)+1;
  state.answer=a+b;
  els.question.textContent=`${a} + ${b}`;
  state.inputA="";
  state.inputB="";
  render();
}

function render(){
  els.displayA.textContent=state.inputA||"—";
  els.displayB.textContent=state.mode==="cpu"?"🤖":(state.inputB||"—");
  const offset=(state.ropePos/100)*40;
  els.rope.style.left=`calc(50% + ${offset}%)`;
}

function move(team){
  if(team==="A") state.ropePos-=10;
  else state.ropePos+=10;
  state.ropePos=Math.max(-100,Math.min(100,state.ropePos));
  render();
}

function submit(team){
  const value=Number(team==="A"?state.inputA:state.inputB);
  if(value===state.answer) move(team);
  newQuestion();
}

function buildKeypad(container,team){
  const keys=["1","2","3","4","5","6","7","8","9","⌫","0","OK"];
  keys.forEach(k=>{
    const btn=document.createElement("button");
    btn.className="key";
    btn.textContent=k;
    btn.onclick=()=>{
      if(state.mode==="cpu"&&team==="B") return;
      if(k==="⌫"){
        if(team==="A") state.inputA=state.inputA.slice(0,-1);
        else state.inputB=state.inputB.slice(0,-1);
      }else if(k==="OK"){
        submit(team);
      }else{
        if(team==="A") state.inputA+=k;
        else state.inputB+=k;
      }
      render();
    };
    container.appendChild(btn);
  });
}

function toggleMode(){
  state.mode=state.mode==="teams"?"cpu":"teams";

  if(state.mode==="cpu"){
    els.btnMode.textContent="Tryb: vs CPU";
    els.teamB.classList.add("disabled");
    els.teamBTitle.textContent="Komputer 🤖";
  }else{
    els.btnMode.textContent="Tryb: 2 drużyny";
    els.teamB.classList.remove("disabled");
    els.teamBTitle.textContent="Drużyna B";
  }
  newQuestion();
}

els.btnReset.onclick=()=>{state.ropePos=0;newQuestion();};
els.btnFullscreen.onclick=()=>{
  if(!document.fullscreenElement)
    document.documentElement.requestFullscreen();
  else document.exitFullscreen();
  setTimeout(setViewportVars,50);
};
els.btnMode.onclick=toggleMode;

buildKeypad(els.keypadA,"A");
buildKeypad(els.keypadB,"B");

window.addEventListener("resize",setViewportVars);
if(window.visualViewport){
  window.visualViewport.addEventListener("resize",setViewportVars);
}

setViewportVars();
newQuestion();
render();