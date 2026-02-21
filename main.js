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
  difficulty:document.getElementById("difficulty"),
  cpuSpeed:document.getElementById("cpuSpeed"),
  teamB:document.getElementById("teamB"),
  teamBTitle:document.getElementById("teamBTitle")
};

let state={
  ropePos:0,
  answer:0,
  inputA:"",
  inputB:"",
  mode:"teams",
  aiTimer:null
};

function newQuestion(){
  const diff=parseInt(els.difficulty.value);
  const max=diff*30;
  const a=Math.floor(Math.random()*max)+1;
  const b=Math.floor(Math.random()*max)+1;
  state.answer=a+b;
  els.question.textContent=`${a} + ${b}`;
  state.inputA="";
  state.inputB="";
  render();
  scheduleAI();
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

function getCpuDelay(){
  const speed=els.cpuSpeed.value;
  if(speed==="very_slow") return [5000,12000];
  if(speed==="slow") return [4000,9000];
  if(speed==="normal") return [3000,7000];
  if(speed==="fast") return [2000,5000];
  return [4000,9000];
}

function scheduleAI(){
  if(state.mode!=="cpu") return;
  clearTimeout(state.aiTimer);
  const [min,max]=getCpuDelay();
  const delay=Math.floor(Math.random()*(max-min))+min;
  state.aiTimer=setTimeout(()=>{
    state.inputB=state.answer.toString();
    submit("B");
  },delay);
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
};
els.btnMode.onclick=toggleMode;
els.difficulty.onchange=newQuestion;
els.cpuSpeed.onchange=scheduleAI;

buildKeypad(els.keypadA,"A");
buildKeypad(els.keypadB,"B");

newQuestion();
render();