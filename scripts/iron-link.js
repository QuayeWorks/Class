/* IRON LINK 01: an unclassified, self-attested Packet Tracer lab. */
(() => {
  "use strict";

  const KEY = "qw:iron-link-01:progress:v1";
  const steps = [
    {
      title: "Cable and label the topology",
      tasks: ["Place 2 ISR 4331 routers, 1 3560 multilayer switch, 2 2960 switches, 2 servers, and 8 PCs.", "Use the port map in the briefing; label every device and link.", "Save the Packet Tracer project as IRON-LINK-01.pkt."],
      proof: "Record the device and port inventory. Explain which links are routed, trunks, and access ports.",
      verify: "Inspect the topology and show ip interface brief on every infrastructure device."
    },
    {
      title: "Base setup and VLANs",
      tasks: ["Set hostnames, enable secrets, local admin accounts, SSH, console and VTY protection; disable Telnet.", "Create VLANs 10, 20, 30, 40, 50, 99, and 999. Assign client and server access ports per the briefing.", "Trunk the core to each access switch and give SW2 and SW3 management SVIs 10.20.99.2 and .3."],
      proof: "Record show vlan brief and show interfaces trunk output, plus a successful NETOPS SSH login.",
      verify: "Show VLAN membership, trunk state, SSH success and Telnet refusal. R1 and R2 use routed addresses for management, not VLAN 99 SVIs."
    },
    {
      title: "Layer 3 core and routed uplinks",
      tasks: ["Enable ip routing and create core SVIs .1 for VLANs 10, 20, 30, 40, 50, and 99.", "Make CORE Gi0/1 a routed port 10.255.0.6/30, connected to R2 Gi0/0/1 at 10.255.0.5/30.", "Configure R1 Gi0/0/0 at 10.255.0.1/30 and R2 Gi0/0/0 at 10.255.0.2/30."],
      proof: "Record the SVI and routed port status, plus successful direct neighbor pings.",
      verify: "show ip interface brief; ping 10.255.0.5 from CORE and 10.255.0.1 from R2."
    },
    {
      title: "OSPF and upstream path",
      tasks: ["Use area 0 on both /30 transit links. Advertise all six user/management VLAN networks from CORE.", "Keep client SVIs passive while preserving OSPF adjacency over the routed transit links.", "Add R1 Loopback0 at 10.255.1.1/32 and advertise it to provide a reachable HQ test destination."],
      proof: "Record neighbor IDs and the learned routes on R1, R2, and CORE.",
      verify: "show ip ospf neighbor; show ip route ospf. R1 should learn six 10.20.x.0/24 networks, and a client should reach 10.255.1.1."
    },
    {
      title: "DHCP, DNS, and services",
      tasks: ["Configure DHCP pools for VLANs 10, 20, 30, and 40 with matching gateways; exclude reserved addresses.", "Set SRV1-C2 to 10.20.50.10/24 and SRV2-LOG to 10.20.50.20/24; both use 10.20.50.1 gateway.", "Enable HTTP (and HTTPS if supported) on SRV1. Configure DNS service on SRV1 or document another lab DNS address and use it in DHCP."],
      proof: "Record a fresh OPS DHCP lease including IP, mask, gateway and DNS, then open the C2 web page.",
      verify: "ipconfig on a DHCP client; show ip dhcp binding on CORE; browser to http://10.20.50.10."
    },
    {
      title: "Harden the access layer",
      tasks: ["Put all unused access ports in VLAN 999 and shut them down.", "Enable PortFast and BPDU Guard only on endpoint-facing access ports.", "Apply basic port security to client ports and verify a simulated violation safely."],
      proof: "Record one sample active client port, one shut unused port and the port security status.",
      verify: "show interfaces status; show spanning-tree; show port-security interface <port>."
    },
    {
      title: "Restrict equipment management",
      tasks: ["Permit SSH to device VTY lines only from 10.20.10.0/24 NETOPS sources.", "Confirm OPS and C2 users still reach SRV1-C2 and DHCP still works.", "Verify NETOPS SSH works on R1, R2, CORE, SW2 and SW3, while an OPS SSH attempt is denied."],
      proof: "Record allowed and denied SSH tests and service reachability after applying the policy.",
      verify: "show access-lists; show running-config | section line vty; test from both NETOPS and OPS PCs."
    },
    {
      title: "Time, logging, and persistence",
      tasks: ["Set consistent clocks, logging timestamps, and logging host 10.20.50.20 where Packet Tracer supports it.", "Generate a safe test event and check the log server if supported.", "Save every running configuration to startup configuration, reload selected devices and retest."],
      proof: "Record clock readings, log result or simulator limitation, and post-reload reachability.",
      verify: "show clock; show logging; show startup-config; retest OSPF and a client after reload."
    },
    {
      title: "End-to-end acceptance",
      tasks: ["Test each client VLAN to its gateway, SRV1 and R1 Loopback0; trace the upstream path.", "Collect the required show outputs across switching, routing, spanning tree, MAC learning and ACLs.", "Document any failures and their fixes before declaring the lab operational."],
      proof: "Paste a concise acceptance record showing at least one pass and one command result per network layer.",
      verify: "ping, tracert/traceroute, SSH, show ip route, show ip ospf neighbor, show interfaces trunk, show vlan brief, show spanning-tree, show mac address-table, show ip interface brief, show access-lists."
    }
  ];

  const questions = [
    {q:"Why use a /30 on the point-to-point routed links?", a:["It provides two usable host addresses for the two endpoints.","It assigns 30 usable addresses.","It creates a trunk automatically.","OSPF requires /30 on every link."], good:0, why:"A /30 provides exactly two usable IPv4 addresses; OSPF itself does not require that mask."},
    {q:"What makes the CORE-to-SW2 link a trunk?", a:["It carries tagged traffic for multiple VLANs.","It is connected to a router.","It can only carry VLAN 99.","It uses a /30 address."], good:0, why:"802.1Q tagging lets several VLANs cross one Layer 2 link."},
    {q:"Where does a VLAN 20 PC send a packet for SRV1 in VLAN 50?", a:["To its default gateway at 10.20.20.1.","Directly to SRV1's MAC address.","To SW2's management SVI.","To the DHCP server."], good:0, why:"The host ARPs for the gateway MAC because the destination is outside its subnet."},
    {q:"Which CORE interface forms an OSPF neighbor with R2?", a:["The routed transit port at 10.255.0.6.","The VLAN 20 SVI.","The VLAN 999 interface.","The SW2 trunk."], good:0, why:"The routed /30 links CORE and R2; client SVIs can be advertised passively."},
    {q:"Why might a 2960 still switch client traffic when its management IP cannot be pinged?", a:["Layer 2 forwarding can work independently of the management SVI.","Its management IP automatically routes traffic.","STP disables its IP stack.","DHCP fixes the management route."], good:0, why:"Management reachability and Layer 2 data forwarding are separate paths."},
    {q:"An OPS PC leases 10.20.30.55 instead of 10.20.20.x. Check first?", a:["Its access VLAN and the upstream allowed VLANs.","The R1 loopback mask.","The SRV1 HTTP service.","The syslog clock."], good:0, why:"The client is likely in the wrong broadcast domain; verify the access port VLAN first."},
    {q:"Which control best limits SSH to infrastructure without blocking OPS web traffic?", a:["VTY access-class allowing NETOPS sources on every device.","Deny all traffic entering VLAN 20.","Shut VLAN 99 everywhere.","Turn off inter-VLAN routing."], good:0, why:"A VTY source ACL affects logins while leaving routed web and DHCP traffic intact."},
    {q:"What is the result of an unmatched packet at the end of a Cisco ACL?", a:["It is denied by the implicit deny.","It is forwarded to the default route.","It is permitted if OSPF is up.","It becomes a broadcast."], good:0, why:"Plan explicit permits when filtering transit traffic; ACLs end with an implicit deny."},
    {q:"Why save the configuration before a reload?", a:["Unsaved running configuration is lost on reload.","OSPF requires a saved configuration to converge.","A saved config clears the MAC table.","It synchronizes clocks."], good:0, why:"copy running-config startup-config preserves changes through a reboot."},
    {q:"A ping to SRV1 succeeds, but its web page fails. What should you check next?", a:["HTTP service and any TCP/port filtering.","Only the PC's subnet mask.","Only STP root priority.","Only OSPF neighbors."], good:0, why:"ICMP reachability does not prove the application service or TCP path works."}
  ];
  const faults = [
    {symptom:"An OPS PC gets a 10.20.30.x lease, while other OPS PCs work.", choices:["Its access port is in VLAN 30.","R1 is missing an OSPF route.","The log server clock drifted."], good:0, inspect:"Check the PC lease, then show vlan brief and the switchport mode/VLAN on that specific access port."},
    {symptom:"All SUSTAINMENT PCs can ping 10.20.30.1 but cannot reach SRV1; OPS works.", choices:["Check CORE routing and ACL counters for VLAN 30 traffic.","Replace every SUSTAINMENT NIC.","Disable all trunks."], good:0, inspect:"The gateway responds, so start at the CORE SVI, route and any inbound ACL, then trace toward 10.20.50.10."},
    {symptom:"R1 can ping R2, but show ip route ospf on R1 contains none of the 10.20.x networks.", choices:["Inspect R2–CORE OSPF adjacency and CORE advertisements.","Change server DNS first.","Turn on PortFast on the routed link."], good:0, inspect:"Check show ip ospf neighbor on R2 and CORE, then area/network/passive settings and show ip route on R2."},
    {symptom:"SW3 clients lose connectivity after a trunk change; SW2 clients still work.", choices:["Check SW3 trunk state and allowed VLAN list on both ends.","Readdress R1 Loopback0.","Reset the log server."], good:0, inspect:"Use show interfaces trunk and show spanning-tree to separate pruning, native VLAN and blocked-path problems."},
    {symptom:"An OPS user can open SRV1 HTTP but cannot SSH to CORE; NETOPS can SSH.", choices:["This is the intended management policy.","The web service is down.","OSPF is necessarily broken."], good:0, inspect:"Compare VTY ACL and source addresses; an application test from OPS verifies user traffic separately."},
    {symptom:"After a reload, one access switch has no client VLANs, but the uplink LED is green.", choices:["Compare running and startup configs and verify VLAN/trunk state.","Assume the green LED proves the network is good.","Change SRV1's HTTP port."], good:0, inspect:"Use show startup-config, show vlan brief and show interfaces trunk; configuration may not have been saved."}
  ];

  let state = fresh();
  let tab = "brief";
  function fresh(){ return {checks:steps.map(s=>s.tasks.map(()=>false)), evidence:steps.map(()=>""), complete:steps.map(()=>false), quiz:{answers:{},submitted:false}, faults:{answers:{},submitted:false}}; }
  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY));
      if(raw && Array.isArray(raw.checks) && Array.isArray(raw.evidence) && Array.isArray(raw.complete)){
        const base=fresh();
        state.checks=base.checks.map((row,i)=>row.map((_,j)=>raw.checks[i]?.[j] === true));
        state.evidence=base.evidence.map((_,i)=>typeof raw.evidence[i] === "string" ? raw.evidence[i].slice(0,10000) : "");
        state.complete=base.complete.map((_,i)=>raw.complete[i] === true && state.checks[i].every(Boolean) && !!state.evidence[i].trim());
        for(const part of ["quiz","faults"]){
          const src=raw[part] || {};
          const count=part === "quiz" ? questions.length : faults.length;
          state[part].answers=Object.fromEntries(Object.entries(src.answers || {}).filter(([k,v])=>/^\d+$/.test(k) && Number(k)<count && Number.isInteger(v) && v>=0 && v<(part === "quiz" ? questions[k].a.length : faults[k].choices.length)));
          state[part].submitted=src.submitted === true;
        }
      }
    }catch(e){ console.warn("IRON LINK progress could not be loaded",e); }
  }
  function save(){ try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){ console.warn("IRON LINK progress could not be saved",e); alert("Progress could not be saved in this browser. Export a backup from the Record tab.");} }
  const app=()=>document.getElementById("ironLinkApp");
  function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function button(label,fn,cls="btn"){const b=node("button",cls,label);b.type="button";b.addEventListener("click",fn);return b;}
  function addText(parent,tag,text,cls){const x=node(tag,cls,text);parent.append(x);return x;}
  function table(parent,headers,rows){const t=node("table","labTable");const head=t.createTHead().insertRow();headers.forEach(h=>addText(head,"th",h));const body=t.createTBody();rows.forEach(row=>{const tr=body.insertRow();row.forEach(c=>addText(tr,"td",c));});parent.append(t);}
  function render(){
    const root=app(); if(!root)return; root.replaceChildren();
    const done=state.complete.filter(Boolean).length;
    const head=node("div","labSummary");
    addText(head,"p",`Build: ${done}/${steps.length} milestones verified · Knowledge: ${scoreLabel("quiz",questions)} · Faults: ${scoreLabel("faults",faults)}`);
    const bar=node("div","progressOuter labProgress");const fill=node("div","progressInner");fill.style.width=`${done/steps.length*100}%`;bar.append(fill);head.append(bar);
    addText(head,"p","Self verified: complete each checklist and record Packet Tracer evidence. This site does not connect to Packet Tracer.","small");root.append(head);
    const nav=node("nav","labTabs");nav.setAttribute("aria-label","Lab sections");
    [["brief","Briefing"],["build","Build tracker"],["quiz","Knowledge check"],["faults","Fault drills"],["record","Record"]].forEach(([id,label])=>{const b=button(label,()=>{tab=id;render();},`btn ${tab===id?"primary":""}`);b.setAttribute("aria-current",tab===id?"page":"false");nav.append(b);});root.append(nav);
    const content=node("div","labContent");root.append(content);
    if(tab==="brief") briefing(content);
    if(tab==="build") build(content);
    if(tab==="quiz") assessment(content,"quiz",questions);
    if(tab==="faults") assessment(content,"faults",faults);
    if(tab==="record") record(content);
  }
  function scoreLabel(part,items){if(!state[part].submitted)return "not graded";const n=items.reduce((sum,x,i)=>sum+(state[part].answers[i]===x.good?1:0),0);return `${n}/${items.length}`;}
  function briefing(c){
    addText(c,"h2","Mission briefing");
    addText(c,"p","Build a generic, unclassified battalion training LAN from blank devices. This is a Cisco fundamentals exercise, not an operational C2NOW baseline. Packet Tracer is the simulator; use this page to follow requirements and record proof.");
    addText(c,"h3","Equipment and cable map");
    table(c,["Device A / port","Device B / port","Link"],[
      ["R1-HQ Gi0/0/0","R2-BN Gi0/0/0","Routed · 10.255.0.0/30"],
      ["R2-BN Gi0/0/1","SW1-BN-CORE Gi0/1","Routed · 10.255.0.4/30"],
      ["SW1-BN-CORE Gi0/2","SW2-OPS Gi0/1","802.1Q trunk"],
      ["SW1-BN-CORE Fa0/24","SW3-SUSTAINMENT Gi0/1","802.1Q trunk"],
      ["SW1-BN-CORE Fa0/1, Fa0/2","SRV1-C2, SRV2-LOG","VLAN 50 access"],
      ["SW2-OPS Fa0/1–4","PC1–PC4","VLANs 10, 20, 20, 40"],
      ["SW3-SUSTAINMENT Fa0/1–4","PC5–PC8","VLANs 30, 30, 40, 10"]
    ]);
    addText(c,"p","Interface names can differ by Packet Tracer device image. Preserve the logical connections and record your actual ports.","small");
    addText(c,"h3","Address plan");
    table(c,["Segment","Network / gateway","Assignment"],[
      ["NETOPS · VLAN 10","10.20.10.0/24 · .1","PC1, PC8 · DHCP"],
      ["OPS · VLAN 20","10.20.20.0/24 · .1","PC2, PC3 · DHCP"],
      ["SUSTAINMENT · VLAN 30","10.20.30.0/24 · .1","PC5, PC6 · DHCP"],
      ["C2-USERS · VLAN 40","10.20.40.0/24 · .1","PC4, PC7 · DHCP"],
      ["SERVERS · VLAN 50","10.20.50.0/24 · .1","SRV1 .10, SRV2 .20 · static"],
      ["MANAGEMENT · VLAN 99","10.20.99.0/24 · .1","SW2 .2, SW3 .3 · static"],
      ["UNUSED · VLAN 999","No SVI","Shut unused access ports"],
      ["HQ–BN transit","10.255.0.0/30","R1 .1, R2 .2"],
      ["BN–CORE transit","10.255.0.4/30","R2 .5, CORE .6"],
      ["HQ loopback","10.255.1.1/32","R1 Loopback0 · test destination"]
    ]);
    addText(c,"p","Set 2960 default gateways to 10.20.99.1. Router management uses its routed IP. Reserve infrastructure and server addresses; provide DHCP only for user VLANs. There is no Internet connection in this topology, so the HQ loopback is the upstream reachability target.");
    c.append(button("Start build tracker →",()=>{tab="build";render();},"btn primary"));
  }
  function build(c){
    addText(c,"h2","Build milestones");
    addText(c,"p","Work in Packet Tracer. Check a task only after testing it; paste a brief command result or observation before marking the milestone verified. You can revise any milestone later.");
    steps.forEach((s,i)=>{
      const section=node("section","labStep");
      const h=addText(section,"h3",`${i+1}. ${s.title} ${state.complete[i]?"✓":""}`);
      h.id=`lab-step-${i+1}`;
      s.tasks.forEach((task,j)=>{
        const label=node("label","labCheck");const input=node("input");input.type="checkbox";input.checked=state.checks[i][j];input.addEventListener("change",()=>{state.checks[i][j]=input.checked;if(!input.checked)state.complete[i]=false;save();render();});label.append(input,node("span",null,task));section.append(label);
      });
      addText(section,"p",`Proof: ${s.proof}`,"small");
      addText(section,"p",`Verify: ${s.verify}`,"small");
      const evidence=node("textarea","input labEvidence");evidence.rows=3;evidence.maxLength=10000;evidence.placeholder="Paste a short command output or describe the observed result (no credentials or sensitive network details).";evidence.value=state.evidence[i];evidence.setAttribute("aria-label",`Evidence for ${s.title}`);
      evidence.addEventListener("input",()=>{state.evidence[i]=evidence.value;if(!evidence.value.trim())state.complete[i]=false;save();action.disabled=!ready(i);});section.append(evidence);
      const action=button(state.complete[i]?"Verified · reopen":"Mark self verified",()=>{state.complete[i]=!state.complete[i] && ready(i);save();render();},"btn primary");action.disabled=!ready(i) && !state.complete[i];section.append(action);c.append(section);
    });
  }
  function ready(i){return state.checks[i].every(Boolean)&&!!state.evidence[i].trim();}
  function assessment(c,part,items){
    const isQuiz=part==="quiz";
    addText(c,"h2",isQuiz?"Knowledge check":"Troubleshooting drills");
    addText(c,"p",isQuiz?"Answer all ten questions, then grade. Retake any time.":"Read each symptom and choose the first useful diagnosis or action. The reveal explains what to inspect. These faults are hypothetical; your Packet Tracer file is not changed.");
    items.forEach((item,i)=>{
      const sec=node("fieldset","labStep");addText(sec,"legend",`${i+1}. ${isQuiz?item.q:item.symptom}`);
      const choices=isQuiz?item.a:item.choices;
      const offset=(i+1)%choices.length;
      Array.from({length:choices.length},(_,j)=>(j+offset)%choices.length).forEach((sourceIndex)=>{
        const label=node("label","labCheck");const input=node("input");input.type="radio";input.name=`${part}-${i}`;input.checked=state[part].answers[i]===sourceIndex;input.disabled=state[part].submitted;
        input.addEventListener("change",()=>{state[part].answers[i]=sourceIndex;save();});label.append(input,node("span",null,choices[sourceIndex]));sec.append(label);
      });
      if(state[part].submitted){const result=state[part].answers[i]===item.good?"Correct. ":"Check again. ";addText(sec,"p",result+(isQuiz?item.why:item.inspect),"labFeedback");}
      c.append(sec);
    });
    if(state[part].submitted){addText(c,"p",`Score: ${scoreLabel(part,items)}. Unanswered items count as incorrect.`,"labScore");c.append(button("Retake",()=>{state[part]={answers:{},submitted:false};save();render();}));}
    else c.append(button("Grade answers",()=>{state[part].submitted=true;save();render();},"btn primary"));
  }
  function record(c){
    addText(c,"h2","Progress record");
    addText(c,"p",`${state.complete.filter(Boolean).length}/${steps.length} build milestones self verified. Knowledge: ${scoreLabel("quiz",questions)}. Fault drills: ${scoreLabel("faults",faults)}.`);
    addText(c,"p","Progress stays in this browser for this site, including evidence notes. Export a backup before changing browsers or clearing site data. Do not paste passwords, keys, or operational network details.","small");
    const row=node("div","labActions");
    row.append(button("Export progress JSON",()=>{
      const blob=new Blob([JSON.stringify({format:"iron-link-01-v1",progress:state},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const a=node("a");a.href=url;a.download="iron-link-01-progress.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },"btn primary"));
    const importLabel=node("label","btn labImport","Import progress JSON");const file=node("input");file.type="file";file.accept=".json,application/json";file.addEventListener("change",async()=>{if(!file.files?.[0])return;try{const data=JSON.parse(await file.files[0].text());if(data.format!=="iron-link-01-v1"||!data.progress||!Array.isArray(data.progress.checks)||!Array.isArray(data.progress.evidence)||data.progress.checks.length!==steps.length||data.progress.evidence.length!==steps.length)throw Error("Invalid IRON LINK 01 backup");localStorage.setItem(KEY,JSON.stringify(data.progress));state=fresh();load();render();}catch(e){alert("Import failed: "+e.message);}});importLabel.append(file);row.append(importLabel);
    row.append(button("Reset this lab",()=>{if(confirm("Clear only IRON LINK 01 progress in this browser?")){localStorage.removeItem(KEY);state=fresh();render();}},"btn danger"));c.append(row);
    addText(c,"h3","Readiness standard");
    addText(c,"p","Complete all nine build milestones, answer the knowledge check, and diagnose all six faults. Scores reflect your answers; milestones reflect your own verification. Your saved Packet Tracer project and command outputs provide the actual proof.");
  }
  load();
  window.ironLink={render};
})();
