import { setColor, sc, poly, ell, circ, gt, getColors } from "./fishRenderHelpers.js";
function ln(ctx,...p){ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.stroke();}
function arc(ctx,mode,kind,x,y,r,s,e){ctx.beginPath();ctx.arc(x,y,r,s,e);if(mode==="fill"){ctx.lineTo(x,y);ctx.closePath();ctx.fill();}else ctx.stroke();}
export function drawJellyfishBell(ctx,fd,f,bw,bh,isBox,flash,c0,pulse){
 if(flash) setColor(ctx,1,1,1,0.85); else setColor(ctx,c0,0.55);
 let pts=[];let segs=24;let lobes=isBox?4:8;
 for(let i=0;i<=segs;i++){let a=Math.PI*(i/segs);let x=-Math.cos(a)*bw;let y=-Math.sin(a)*bh*1.4;if(isBox)x=x*(1-Math.abs(Math.cos(a))*0.25);pts.push(x,y);}
 for(let i=0;i<=lobes;i++){let frac=i/lobes;let x=bw*(1-2*frac);if(isBox)x=x*0.85;let scallop=Math.sin(frac*Math.PI*lobes)*0.015;let y=bh*0.15+scallop;pts.push(x,y);}
 poly(ctx,"fill",pts);
 setColor(ctx,1,1,1,0.18);ell(ctx,"fill",0,-bh*0.55,bw*0.55,bh*0.6);
 setColor(ctx,c0,0.4);ctx.lineWidth=1;arc(ctx,"line","open",0,-bh*0.1,bw*0.75,Math.PI*1.15,Math.PI*1.85);arc(ctx,"line","open",0,-bh*0.35,bw*0.55,Math.PI*1.2,Math.PI*1.8);
}
export function drawOralArms(ctx,c1,bh,s,t,phase,isBox){
 setColor(ctx,c1,0.65);
 let cnt=isBox?2:4;let lw=isBox?3:2;
 for(let i=1;i<=cnt;i++){let off=(i-(cnt+1)/2)*s*0.04;let sway=Math.sin(t*3+i*1.3+phase)*s*0.03;ctx.lineWidth=lw;ln(ctx,off,bh*0.1,off+sway*0.5,bh*0.3,off+sway,bh*0.5);}
}
export function drawTentacles(ctx,c1,bw,bh,s,t,phase,isBox){
 setColor(ctx,c1,0.45);ctx.lineWidth=1.5;let cnt=isBox?4:6;
 for(let i=1;i<=cnt;i++){let frac=(i-1)/(cnt-1);let baseX=bw*(frac*2-1)*0.85;let sw1=Math.sin(t*2.2+i*0.9+phase)*s*0.05;let sw2=Math.sin(t*2.2+i*0.9+phase+1.2)*s*0.08;let sw3=Math.sin(t*2.2+i*0.9+phase+2.1)*s*0.1;ln(ctx,baseX,bh*0.2,baseX+sw1,bh*0.5,baseX+sw2,bh*0.8,baseX+sw3,bh*1.1);}
}
export function drawSpots(ctx,c1,bw,bh,s,t,phase){
 let glowA=0.25+Math.sin(t*3+phase)*0.15;setColor(ctx,c1,glowA);
 for(let i=1;i<=6;i++){let ang=(i/6)*Math.PI*2+t*0.3;let dist=0.3+Math.sin(i*2.7+phase)*0.25;let x=Math.cos(ang)*bw*dist;let y=-Math.sin(ang)*bh*0.8*dist-bh*0.2;let sz=s*0.02+Math.sin(t*2+i+phase)*s*0.008;circ(ctx,"fill",x,y,sz);}
}
export function drawInternalGlow(ctx,c1,bw,bh,t,phase){
 let g=0.15+Math.sin(t*3+phase)*0.1;setColor(ctx,c1,g*0.3);circ(ctx,"fill",0,-bh*0.3,bw*0.35);
}
export function drawInnerGlow(ctx,c1,bw,bh,t,phase){drawInternalGlow(ctx,c1,bw,bh,t,phase);}
export function renderMantaray(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],bw=s*0.6,bh=s*0.22,flap=Math.sin(t*2.5+f.phase)*s*0.05;
 ctx.save();ctx.rotate(wag*0.2);
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 poly(ctx,"fill",[0,-bh*0.5,bw*0.12,-bh*0.85-flap*0.5,bw*0.40,-bh*1.05-flap,bw*0.75,-bh*0.95-flap*0.8,bw*0.95,-bh*0.60-flap*0.3,bw,-bh*0.05,bw*0.90,bh*0.35+flap*0.4,bw*0.65,bh*0.60+flap*0.6,bw*0.30,bh*0.78,0,bh*0.82,-bw*0.30,bh*0.78,-bw*0.65,bh*0.60+flap*0.6,-bw*0.90,bh*0.35+flap*0.4,-bw,-bh*0.05,-bw*0.95,-bh*0.60-flap*0.3,-bw*0.75,-bh*0.95-flap*0.8,-bw*0.40,-bh*1.05-flap,-bw*0.12,-bh*0.85-flap*0.5]);
 sc(ctx,c1,0.35);ell(ctx,"fill",0,bh*0.08,bw*0.32,bh*0.50);
 sc(ctx,c0,0.9);let hornFlap=Math.sin(t*3+f.phase+1.5)*s*0.012;
 for(let dir of [-1,1]) poly(ctx,"fill",[0,-bh*0.45,dir*bw*0.10,-bh*0.65+hornFlap,dir*bw*0.20,-bh*0.95+hornFlap*0.5,dir*bw*0.08,-bh*0.80]);
 let eyeR=s*0.035;
 for(let dir of [-1,1]){let ex=dir*bw*0.26,ey=-bh*0.40;setColor(ctx,1,1,1,1);circ(ctx,"fill",ex,ey,eyeR);setColor(ctx,0.06,0.06,0.12,1);circ(ctx,"fill",ex+dir*eyeR*0.2,ey+eyeR*0.15,eyeR*0.55);setColor(ctx,1,1,1,1);circ(ctx,"fill",ex+dir*eyeR*0.15,ey-eyeR*0.15,eyeR*0.22);}
 sc(ctx,c1,0.55);ctx.lineWidth=1.5;arc(ctx,"line","open",0,-bh*0.17,s*0.025,-0.5,0.5);
 sc(ctx,c1,0.15);for(let dir of [-1,1]) circ(ctx,"fill",dir*bw*0.18,-bh*0.12,s*0.03);
 sc(ctx,c1,0.18);for(let i=1;i<=5;i++){let gy=bh*0.05+(i-3)*bh*0.10,gx=bw*0.10+i*bw*0.04;ctx.lineWidth=1;ln(ctx,gx,gy,gx+bw*0.08,gy-bh*0.10);ln(ctx,-gx,gy,-gx-bw*0.08,gy-bh*0.10);}
 sc(ctx,c1,0.6);ctx.lineWidth=Math.max(1.5,s*0.025);let tailWag=Math.sin(t*3+f.phase*1.3)*s*0.02;let tx=0,ty=bh*0.82;for(let i=1;i<=5;i++){let nx=tx+tailWag*(i/5),ny=ty+s*0.035;ln(ctx,tx,ty,nx,ny);tx=nx;ty=ny;}ctx.lineWidth=1;
 sc(ctx,c1,0.10);for(let i=1;i<=5;i++){let mx=(i-3)*bw*0.12,my=-bh*0.15+Math.sin(i*2.2+f.phase)*bh*0.25;circ(ctx,"fill",mx,my,s*0.02);}
 ctx.restore();
}
export function renderOctopus(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],breathe=1+Math.sin(t*1.6+f.phase)*0.04,headW=s*0.24*breathe,headH=s*0.3*breathe;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 ell(ctx,"fill",0,-s*0.08,headW,headH);
 sc(ctx,c0,0.85);poly(ctx,"fill",[-headW*0.5,-s*0.28,headW*0.5,-s*0.28,headW*0.15,-s*0.42,-headW*0.15,-s*0.42]);
 sc(ctx,c1,0.15);for(let i=1;i<=6;i++){let mx=Math.sin(i*2.7+f.phase)*0.6*headW,my=-s*0.08+Math.cos(i*1.9+f.phase)*0.5*headH;circ(ctx,"fill",mx,my,s*0.02+(i%3)*s*0.008);}
 sc(ctx,c0,0.9);let numTent=8;
 for(let i=0;i<numTent;i++){let p=i/(numTent-1),baseX=(p-0.5)*headW*1.5,sway=Math.sin(t*2.2+f.phase+i*0.9)*s*0.07,len=s*0.32+Math.sin(t*1.6+i+f.phase)*s*0.04,midX=baseX+sway*0.5,midY=s*0.12+len*0.5,endX=baseX+sway,endY=s*0.12+len;ctx.lineWidth=2.5;ln(ctx,baseX,s*0.08,midX,midY);ctx.lineWidth=1.4;ln(ctx,midX,midY,endX,endY);sc(ctx,c1,0.2);for(let j=1;j<=3;j++){let jp=j/4,sx=baseX+(midX-baseX)*jp,sy=s*0.08+(midY-s*0.08)*jp;circ(ctx,"fill",sx,sy,s*0.013);}sc(ctx,c0,0.9);}
 ctx.lineWidth=1;let eyeY=-s*0.12,eyeXOff=headW*0.55,eyeR=s*0.075;
 sc(ctx,c0,0.6);ell(ctx,"fill",-eyeXOff,eyeY,eyeR*1.15,eyeR);ell(ctx,"fill",eyeXOff,eyeY,eyeR*1.15,eyeR);
 setColor(ctx,0.82,0.74,0.42,1);ell(ctx,"fill",-eyeXOff,eyeY,eyeR*0.85,eyeR*0.75);ell(ctx,"fill",eyeXOff,eyeY,eyeR*0.85,eyeR*0.75);
 setColor(ctx,0.05,0.05,0.08,1);ell(ctx,"fill",-eyeXOff,eyeY,eyeR*0.55,eyeR*0.16);ell(ctx,"fill",eyeXOff,eyeY,eyeR*0.55,eyeR*0.16);
 setColor(ctx,1,1,1,0.5);circ(ctx,"fill",-eyeXOff-eyeR*0.25,eyeY-eyeR*0.25,eyeR*0.15);circ(ctx,"fill",eyeXOff-eyeR*0.25,eyeY-eyeR*0.25,eyeR*0.15);
}
export function renderOctopusEar(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],headR=s*0.28,pulse=1+Math.sin(t*2.5+f.phase)*0.05;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 circ(ctx,"fill",0,-s*0.05,headR*pulse);
 let earFlap=Math.sin(t*4+f.phase)*0.25+0.5;sc(ctx,c1,0.35);ell(ctx,"fill",-headR*1.1,-s*0.15,headR*0.5,headR*0.35*earFlap);ell(ctx,"fill",headR*1.1,-s*0.15,headR*0.5,headR*0.35*earFlap);
 sc(ctx,c0,0.9);let numTent=8;
 for(let i=0;i<numTent;i++){let p=i/(numTent-1),baseX=(p-0.5)*headR*1.6,sway=Math.sin(t*2.5+f.phase+i*0.9)*s*0.06,len=s*0.3+Math.sin(t*1.8+i+f.phase)*s*0.04,midX=baseX+sway*0.5,midY=s*0.15+len*0.5,endX=baseX+sway,endY=s*0.15+len;ctx.lineWidth=2.5;ln(ctx,baseX,s*0.1,midX,midY);ctx.lineWidth=1.5;ln(ctx,midX,midY,endX,endY);sc(ctx,c1,0.2);for(let j=1;j<=3;j++){let jp=j/4,sx=baseX+(midX-baseX)*jp,sy=s*0.1+(midY-s*0.1)*jp;circ(ctx,"fill",sx,sy,s*0.015);}sc(ctx,c0,0.9);}
 ctx.lineWidth=1;setColor(ctx,1,1,1,1);circ(ctx,"fill",-headR*0.35,-s*0.1,s*0.045);circ(ctx,"fill",headR*0.35,-s*0.1,s*0.045);setColor(ctx,0.05,0.05,0.15,1);circ(ctx,"fill",-headR*0.35,-s*0.1,s*0.022);circ(ctx,"fill",headR*0.35,-s*0.1,s*0.022);
 if(fd.pat==="spots"){sc(ctx,c1,0.25);for(let i=1;i<=4;i++){let a=(i/4)*Math.PI*2+t*0.3,rd=headR*0.5;circ(ctx,"fill",Math.cos(a)*rd,-s*0.05+Math.sin(a)*rd*0.7,s*0.02);}}
}
export function renderTurtle(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],bw=s*0.35,bh=s*0.22;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 ell(ctx,"fill",0,0,bw,bh);
 setColor(ctx,c0[0]*0.8,c0[1]*0.8,c0[2]*0.8,0.5);ctx.lineWidth=1.2;ln(ctx,0,-bh*0.7,0,bh*0.7);for(let i=-2;i<=2;i++) ln(ctx,-bw*0.6,i*bh*0.22,bw*0.6,i*bh*0.22);ctx.lineWidth=1;
 setColor(ctx,1,1,1,0.08);ell(ctx,"fill",-bw*0.15,-bh*0.2,bw*0.4,bh*0.25);
 sc(ctx,c1,1);ell(ctx,"fill",bw*0.6,-bh*0.1,bw*0.2,bh*0.25);setColor(ctx,1,1,1,0.1);ell(ctx,"fill",bw*0.65,-bh*0.15,bw*0.08,bh*0.1);setColor(ctx,0.05,0.05,0.15,1);circ(ctx,"fill",bw*0.7,-bh*0.15,s*0.025);setColor(ctx,1,1,1,1);circ(ctx,"fill",bw*0.72,-bh*0.18,s*0.01);setColor(ctx,0.8,0.7,0.4,1);arc(ctx,"fill","pie",bw*0.8,-bh*0.05,s*0.02,0,Math.PI);
 let fa=Math.sin(t*2.5+f.phase)*0.3;
 for(let side of [1,-1]){let fa2=Math.sin(t*2.5+f.phase+side)*0.3;ctx.save();ctx.translate(bw*0.2,side*bh*0.3);ctx.rotate(fa);sc(ctx,c1,0.7);ell(ctx,"fill",0,0,bw*0.15,bh*0.25);ctx.restore();ctx.save();ctx.translate(-bw*0.2,side*bh*0.3);ctx.rotate(fa2);sc(ctx,c1,0.7);ell(ctx,"fill",0,0,bw*0.12,bh*0.2);ctx.restore();}
}
export function renderCrab(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],bw=s*0.34,bh=s*0.14,legSway=Math.sin(t*3+f.phase)*0.08,clawOpen=0.5+Math.sin(t*2+f.phase)*0.2;
 setColor(ctx,c0[0]*0.75,c0[1]*0.75,c0[2]*0.75,0.85);ctx.lineWidth=2;
 for(let i=1;i<=4;i++){let iOff=(i-1)/3,baseX=bw*(0.3+iOff*0.65),baseY=bh*(-0.2+iOff*1.3),legLen=s*(0.15-iOff*0.02),legWave=Math.sin(t*4+i*1.1+f.phase)*s*0.03,kneeX=baseX+legLen*0.55,kneeY=baseY+legLen*0.5+legWave,footX=kneeX+legLen*0.5,footY=kneeY+legLen*0.1+legWave*0.6;ln(ctx,baseX,baseY,kneeX,kneeY,footX,footY);ln(ctx,-baseX,baseY,-kneeX,kneeY,-footX,footY);}
 ctx.lineWidth=1;
 if(flash) setColor(ctx,1,1,1,0.85); else sc(ctx,c0);
 let shellPts=[],segs=28;for(let i=0;i<segs;i++){let a=(i/segs)*Math.PI*2,widen=1+0.22*Math.cos(a),x=Math.sin(a)*bw*widen,y=-Math.cos(a)*bh*(1.15+0.1*Math.cos(a));shellPts.push(x,y);}poly(ctx,"fill",shellPts);
 setColor(ctx,1,1,1,0.1);ell(ctx,"fill",0,-bh*0.5,bw*0.45,bh*0.5);setColor(ctx,c0[0]*0.7,c0[1]*0.7,c0[2]*0.7,0.5);ctx.lineWidth=1;ln(ctx,-bw*0.55,0,bw*0.55,0);ln(ctx,-bw*0.35,-bh*0.8,bw*0.35,-bh*0.8);
 sc(ctx,c1,1);ctx.save();ctx.translate(bw*0.85,-bh*0.15);ctx.rotate(-0.5+legSway);ell(ctx,"fill",0,0,s*0.045,s*0.038);ell(ctx,"fill",s*0.065,-s*0.008,s*0.07,s*0.048);ctx.save();ctx.translate(s*0.11,0);ctx.rotate(clawOpen*0.5);poly(ctx,"fill",[0,-s*0.018,s*0.07,-s*0.032,s*0.085,0,s*0.055,s*0.005]);ctx.restore();ctx.save();ctx.translate(s*0.11,0);ctx.rotate(-clawOpen*0.5);poly(ctx,"fill",[0,s*0.018,s*0.07,s*0.032,s*0.085,0,s*0.055,-s*0.005]);ctx.restore();ctx.restore();
 ctx.save();ctx.translate(-bw*0.8,-bh*0.1);ctx.rotate(0.5-legSway);ell(ctx,"fill",0,0,s*0.038,s*0.03);ell(ctx,"fill",-s*0.05,-s*0.007,s*0.055,s*0.038);ctx.save();ctx.translate(-s*0.085,0);ctx.rotate(clawOpen*0.5);poly(ctx,"fill",[0,-s*0.014,-s*0.05,-s*0.024,-s*0.06,0,-s*0.04,s*0.004]);ctx.restore();ctx.save();ctx.translate(-s*0.085,0);ctx.rotate(-clawOpen*0.5);poly(ctx,"fill",[0,s*0.014,-s*0.05,s*0.024,-s*0.06,0,-s*0.04,-s*0.004]);ctx.restore();ctx.restore();
 setColor(ctx,0.05,0.05,0.15,1);ctx.lineWidth=1.5;ln(ctx,bw*0.1,-bh*1.15,bw*0.14,-bh*1.55);ln(ctx,-bw*0.1,-bh*1.15,-bw*0.14,-bh*1.55);ctx.lineWidth=1;circ(ctx,"fill",bw*0.14,-bh*1.55,s*0.026);circ(ctx,"fill",-bw*0.14,-bh*1.55,s*0.026);setColor(ctx,1,1,1,1);circ(ctx,"fill",bw*0.16,-bh*1.58,s*0.008);circ(ctx,"fill",-bw*0.12,-bh*1.58,s*0.008);
}
export function renderSeastar(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],pulse=1+Math.sin(t*2+f.phase)*0.025,twist=Math.sin(t*1.5+f.phase)*0.05;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 ctx.save();ctx.rotate(twist);
 let pts=[],segs=80,arms=5,inner=s*0.10,outer=s*0.34;
 for(let i=0;i<segs;i++){let a=i/segs*Math.PI*2-Math.PI/2,armWave=Math.cos(a*arms),radius;if(armWave>0) radius=inner+(outer-inner)*Math.pow(armWave,1.7); else radius=inner+(outer-inner)*0.08;radius*=pulse;pts.push(Math.cos(a)*radius,Math.sin(a)*radius);}
 poly(ctx,"fill",pts);
 sc(ctx,c1,0.35);circ(ctx,"fill",0,0,s*0.11);
 sc(ctx,c1,0.25);for(let i=0;i<5;i++){let a=i*Math.PI*2/5-Math.PI/2;for(let j=1;j<=3;j++){let d=s*(0.13+j*0.06);circ(ctx,"fill",Math.cos(a)*d,Math.sin(a)*d,1.2);}}
 setColor(ctx,1,1,1,0.12);circ(ctx,"fill",-s*0.08,-s*0.10,s*0.07);
 ctx.restore();
}
export function renderEel(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],bodyLen=s*0.8,bodyH=s*0.085,segs=20,waveSpeed=7,waveAmp=bodyH*0.9;
 function bodyWave(p){let amp=Math.sin(p*Math.PI)*waveAmp;return Math.sin(t*waveSpeed+f.phase+p*Math.PI*2*1.8)*amp;}
 function thick(p){let t1=p<0.15?(p/0.15)*0.7:1,t2=p>0.7?1-(p-0.7)/0.3*0.6:1;return bodyH*t1*t2;}
 sc(ctx,c1,0.25);let dorsal=[];for(let i=0;i<=segs;i++){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,y=bodyWave(p)-thick(p)*1.1,finH=thick(p)*0.6*(0.5+0.5*Math.sin(t*8+f.phase+p*2));dorsal.push(x,y-finH);}for(let i=segs;i>=0;i--){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,y=bodyWave(p)-thick(p)*1.1;if(i>0&&i<segs) dorsal.push(x,y*0.9+bodyWave(p)*0.1);}poly(ctx,"fill",dorsal);
 if(flash) setColor(ctx,1,1,1,0.85); else sc(ctx,c0);
 let pts=[];for(let i=0;i<=segs;i++){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,yw=bodyWave(p),hw=thick(p);pts.push(x,yw-hw);}for(let i=segs;i>=0;i--){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,yw=bodyWave(p),hw=thick(p);pts.push(x,yw+hw);}poly(ctx,"fill",pts);
 sc(ctx,c1,0.2);let belly=[];for(let i=0;i<=segs;i++){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,yw=bodyWave(p),hw=thick(p)*0.5;belly.push(x,yw+hw*0.1);}for(let i=segs;i>=0;i--){let p=i/segs,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,yw=bodyWave(p),hw=thick(p)*0.5;belly.push(x,yw+hw);}poly(ctx,"fill",belly);
 sc(ctx,c1,0.15);ctx.lineWidth=1;for(let i=0;i<segs;i++){let p=i/segs,np=(i+1)/segs,x1=bodyLen*p-bodyLen*0.5+wag*s*0.1,y1=bodyWave(p)*0.3,x2=bodyLen*np-bodyLen*0.5+wag*s*0.1,y2=bodyWave(np)*0.3;ln(ctx,x1,y1,x2,y2);}
 if(fd.pat==="bands"){sc(ctx,c1,0.35);ctx.lineWidth=thick(0.2)*1.5;for(let i=1;i<=7;i++){let p=i*0.12+0.05,x=bodyLen*p-bodyLen*0.5+wag*s*0.1,yw=bodyWave(p);ln(ctx,x,yw-thick(p)*0.7,x,yw+thick(p)*0.7);}ctx.lineWidth=1;}
 sc(ctx,c1,0.5);let tailP=0.92,tx=bodyLen*tailP-bodyLen*0.5+wag*s*0.1,ty=bodyWave(tailP),tailAngle=Math.sin(t*waveSpeed+f.phase+tailP*Math.PI*2*1.8)*0.08+Math.PI*0.02,tailLen=s*0.18;
 ctx.save();ctx.translate(tx,ty);ctx.rotate(tailAngle);poly(ctx,"fill",[0,0,tailLen,-s*0.06,tailLen*0.6,-s*0.08,0,0]);poly(ctx,"fill",[0,0,tailLen,s*0.06,tailLen*0.6,s*0.08,0,0]);ctx.restore();
 sc(ctx,c1,0.3);let analP=0.7,ax=bodyLen*analP-bodyLen*0.5+wag*s*0.1,ay=bodyWave(analP)+thick(analP)*1.0;poly(ctx,"fill",[ax-2,ay,ax+6,ay+s*0.045,ax+2,ay]);
 let hp=0.08,hx=bodyLen*hp-bodyLen*0.5+wag*s*0.1,hy=bodyWave(hp),headAngle=wag*0.6+Math.sin(t*waveSpeed+f.phase+hp*Math.PI*2*1.8)*0.05;
 ctx.save();ctx.translate(hx,hy);ctx.rotate(headAngle);
 if(flash) setColor(ctx,1,1,1,0.85); else sc(ctx,c0);
 poly(ctx,"fill",[0,-thick(hp)*0.7,-s*0.08,-thick(hp)*1.1,-s*0.14,-thick(hp)*0.8,-s*0.12,-thick(hp)*0.2,0,0]);
 poly(ctx,"fill",[0,thick(hp)*0.35,-s*0.07,thick(hp)*0.9,-s*0.12,thick(hp)*0.6,-s*0.1,thick(hp)*0.1,0,0]);
 sc(ctx,[0.05,0.05,0.1],0.5);ctx.lineWidth=1.5;ln(ctx,-s*0.12,-thick(hp)*0.15,-s*0.08,thick(hp)*0.3);ctx.lineWidth=1;
 setColor(ctx,1,1,1,0.9);circ(ctx,"fill",-s*0.04,-thick(hp)*0.3,s*0.035);setColor(ctx,0.05,0.05,0.15,0.95);circ(ctx,"fill",-s*0.035,-thick(hp)*0.3,s*0.02);setColor(ctx,1,1,1,0.8);circ(ctx,"fill",-s*0.045,-thick(hp)*0.33,s*0.008);
 sc(ctx,c1,0.3);circ(ctx,"fill",-s*0.08,-thick(hp)*0.15,s*0.012);
 ctx.restore();
 sc(ctx,c0,0.6);let pfP=0.18,pfx=bodyLen*pfP-bodyLen*0.5+wag*s*0.1,pfy=bodyWave(pfP)+thick(pfP)*0.9,pfFlap=Math.sin(t*5+f.phase)*0.12;
 ctx.save();ctx.translate(pfx,pfy);ctx.rotate(0.3+pfFlap);poly(ctx,"fill",[0,0,s*0.08,s*0.04,s*0.04,s*0.07,0,0]);ctx.restore();
}
export function renderSquid(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],mantleW=s*0.22,mantleH=s*0.32,pulse=1+Math.sin(t*3+f.phase)*0.06;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 ell(ctx,"fill",0,-s*0.15,mantleW*pulse,mantleH*pulse);
 sc(ctx,c1,0.3);poly(ctx,"fill",[-mantleW*0.3,-s*0.4,mantleW*0.3,-s*0.4,0,-s*0.5]);
 let finFlap=Math.sin(t*4+f.phase)*0.15;sc(ctx,c1,0.35);poly(ctx,"fill",[-mantleW*0.9,-s*0.25,-mantleW*1.5,-s*0.15+finFlap*s,-mantleW*0.9,-s*0.05]);poly(ctx,"fill",[mantleW*0.9,-s*0.25,mantleW*1.5,-s*0.15-finFlap*s,mantleW*0.9,-s*0.05]);
 sc(ctx,c0,0.9);let numArms=8;for(let i=0;i<numArms;i++){let p=i/(numArms-1),baseX=(p-0.5)*mantleW*1.6,sway=Math.sin(t*3+f.phase+i*0.8)*s*0.05,len=s*0.35+Math.sin(t*2+i+f.phase)*s*0.05,endX=baseX+sway,endY=s*0.15+len;ctx.lineWidth=2;ln(ctx,baseX,s*0.05,endX,endY);}
 ctx.lineWidth=1;sc(ctx,c0,1.0);let ex1=-mantleW*0.6,ex2=mantleW*0.6,tentSway=Math.sin(t*3.5+f.phase)*s*0.08;ctx.lineWidth=2;ln(ctx,ex1,s*0.05,ex1+tentSway,s*0.45);ln(ctx,ex2,s*0.05,ex2-tentSway,s*0.45);ctx.lineWidth=1;
 setColor(ctx,1,1,1,1);circ(ctx,"fill",-mantleW*0.4,-s*0.15,s*0.04);circ(ctx,"fill",mantleW*0.4,-s*0.15,s*0.04);setColor(ctx,0.05,0.05,0.15,1);circ(ctx,"fill",-mantleW*0.4,-s*0.15,s*0.02);circ(ctx,"fill",mantleW*0.4,-s*0.15,s*0.02);
}
export function renderJelly(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,id=fd.id,c0=fd.colors[0],c1=fd.colors[1];
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0,0.7);
 let bellPulse=1+Math.sin(t*2+f.phase)*0.08,bw=s*0.3,bh=s*0.2;if(id==="fire_jelly"){bw*=0.85;bh*=0.85;}
 ell(ctx,"fill",0,-s*0.05,bw*bellPulse,bh*bellPulse);setColor(ctx,1,1,1,0.15);ell(ctx,"fill",-s*0.05,-s*0.12,s*0.15,s*0.08);
 sc(ctx,c1,0.25);let numTent=8+Math.floor(s*2);
 for(let i=0;i<numTent;i++){let a=i*Math.PI*2/numTent+Math.sin(t*0.5)*0.1,len=s*0.2+Math.sin(t*1.5+i*1.2+f.phase)*s*0.15+s*0.15,cx=Math.cos(a)*bw*bellPulse,cy=s*0.08+Math.sin(a)*bh*bellPulse,ex=Math.cos(a)*(bw+len),ey=s*0.08+Math.sin(a)*(bh+len*0.4);ctx.lineWidth=1;ln(ctx,cx,cy,ex,ey);circ(ctx,"fill",ex,ey,1.5);}
 ctx.lineWidth=1;let glow=0.3+Math.sin(t*3+f.phase)*0.15;setColor(ctx,0.8,0.9,1,glow*0.15);circ(ctx,"fill",0,-s*0.02,s*0.15);
 sc(ctx,c1,0.2);let oralCount=id==="fire_jelly"?6:4;for(let i=0;i<oralCount;i++){let droop=s*0.25+Math.sin(t*2+i+f.phase)*s*0.05,off=(i-(oralCount-1)/2)*s*0.03;ctx.lineWidth=id==="aurora_jelly"?3:2;ln(ctx,off,s*0.05,off+(i-oralCount/2)*s*0.01,s*0.05+droop);}ctx.lineWidth=1;
 if(id==="aurora_jelly"){let sh=0.2+Math.sin(t*4+f.phase)*0.1;setColor(ctx,c1[0],c1[1],c1[2],sh*0.2);circ(ctx,"fill",0,-s*0.08,bw*0.5);setColor(ctx,1,1,1,sh*0.08);for(let i=1;i<=8;i++){let a=(i/8)*Math.PI*2+t*0.5,rd=bw*0.6+Math.sin(t*2+i+f.phase)*bw*0.15;circ(ctx,"fill",Math.cos(a)*rd,-s*0.05+Math.sin(a)*rd*0.3,s*0.015);}}
 if(fd.pat==="spots"){let sh=0.15+Math.sin(t*3.5+f.phase)*0.1;setColor(ctx,1,1,1,sh);for(let i=1;i<=5;i++){let sa=(i/5)*Math.PI*2+t*0.4,sd=0.2+Math.sin(i*3.1+f.phase)*0.15,sx=Math.cos(sa)*bw*sd,sy=-s*0.05+Math.sin(sa)*bh*sd*0.8;circ(ctx,"fill",sx,sy,s*0.015);}}
}
export function renderJellyfish(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,id=fd.id,c0=fd.colors[0],c1=fd.colors[1],pulse=Math.sin(t*2+f.phase)*0.5+0.5,bw=s*0.32,bh=s*(0.2+pulse*0.06),isBox=id==="box_jelly";
 if(isBox){bw*=1.15;bh*=1.1;}
 drawJellyfishBell(ctx,fd,f,bw,bh,isBox,flash,c0,pulse);
 drawInternalGlow(ctx,c1,bw,bh,t,f.phase);
 drawOralArms(ctx,c1,bh,s,t,f.phase,isBox);
 drawTentacles(ctx,c1,bw,bh,s,t,f.phase,isBox);
 if(fd.pat==="spots") drawSpots(ctx,c1,bw,bh,s,t,f.phase);
 drawInnerGlow(ctx,c1,bw,bh,t,f.phase);
 ctx.lineWidth=1;
}
export function renderIsopod(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],segs=7,segLen=s*0.08,segH=s*0.15;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 for(let i=0;i<segs;i++){let cx=(i-segs/2)*segLen,hw=segH*(1-Math.abs(i-segs/2)/(segs/2)*0.3);ell(ctx,"fill",cx,0,segLen*0.7,hw);}
 let headX=(-segs/2)*segLen-segLen*0.3;sc(ctx,c1,1);ell(ctx,"fill",headX,0,segLen*1.2,segH*0.8);setColor(ctx,1,1,1,1);circ(ctx,"fill",headX+segLen*0.2,-segH*0.25,s*0.03);circ(ctx,"fill",headX+segLen*0.2,segH*0.25,s*0.03);setColor(ctx,0.05,0.05,0.15,1);circ(ctx,"fill",headX+segLen*0.3,-segH*0.25,s*0.015);circ(ctx,"fill",headX+segLen*0.3,segH*0.25,s*0.015);
 sc(ctx,c1,0.4);for(let dir of [-1,1]){ln(ctx,headX-segLen*0.3,0,headX-segLen*0.6,dir*segH*0.8);ln(ctx,headX-segLen*0.3,0,headX-segLen*0.4,dir*segH*1.2);}
 sc(ctx,c1,0.3);for(let i=0;i<segs-1;i++){let cx=(i-segs/2)*segLen;for(let dir of [-1,1]){ln(ctx,cx,segH*0.5,cx-segLen*0.3,segH*0.5+dir*segH*0.4);ln(ctx,cx,segH*0.5,cx+segLen*0.3,segH*0.5+dir*segH*0.4);}}
 let tailX2=(segs/2)*segLen+segLen*0.2;sc(ctx,c0,0.6);poly(ctx,"fill",[tailX2,0,tailX2+segLen*0.5,-segH*0.4,tailX2+segLen*0.8,0,tailX2+segLen*0.5,segH*0.4]);
}
export function renderWhale(ctx,f,wag,flash,t){
 let fd=f.fd,s=f.size,c0=fd.colors[0],c1=fd.colors[1],bw=s*0.48,bh=s*0.14;
 if(flash) setColor(ctx,1,1,1,0.8); else sc(ctx,c0);
 ctx.save();ctx.rotate(wag*0.12);
 poly(ctx,"fill",[-bw*0.92,0,-bw*0.65,-bh*0.75,-bw*0.25,-bh*0.92,bw*0.08,-bh*0.9,bw*0.3,-bh*0.78,bw*0.52,-bh*0.5,bw*0.5,-bh*0.2,bw*0.46,0,bw*0.5,bh*0.2,bw*0.42,bh*0.42,bw*0.1,bh*0.55,-bw*0.25,bh*0.52,-bw*0.65,bh*0.35,-bw*0.92,0]);
 sc(ctx,c1,0.3);ell(ctx,"fill",-bw*0.1,bh*0.2,bw*0.42,bh*0.2);
 sc(ctx,c0,1);let flukeWag=Math.sin(t*3+f.phase)*0.15;ctx.save();ctx.translate(-bw*0.92,0);ctx.rotate(flukeWag);poly(ctx,"fill",[0,0,-s*0.18,-s*0.1,-s*0.07,0]);poly(ctx,"fill",[0,0,-s*0.18,s*0.1,-s*0.07,0]);ctx.restore();
 poly(ctx,"fill",[-bw*0.12,-bh*0.88,-bw*0.02,-bh*0.88-s*0.09,bw*0.05,-bh*0.88]);
 sc(ctx,c0,0.8);let pecFlap=Math.sin(t*2.5+f.phase)*0.08;ctx.save();ctx.translate(bw*0.08,bh*0.25);ctx.rotate(-0.25+pecFlap);poly(ctx,"fill",[0,0,s*0.1,-s*0.02,0,s*0.07]);ctx.restore();
 setColor(ctx,1,1,1,1);circ(ctx,"fill",bw*0.3,-bh*0.45,s*0.024);setColor(ctx,0.05,0.05,0.15,1);circ(ctx,"fill",bw*0.31,-bh*0.45,s*0.011);ctx.lineWidth=1;setColor(ctx,1,1,1,1);ctx.restore();
}
export function renderGreatWhiteShark(ctx,f,wag,flash,t){
 let s=f.size,c0=f.fd.colors[0],c1=f.fd.colors[1],dark=[c0[0]*0.7,c0[1]*0.7,c0[2]*0.7];
 setColor(ctx,c0[0],c0[1],c0[2],1);ell(ctx,"fill",0,0,s*0.48,s*0.16);setColor(ctx,c1[0],c1[1],c1[2],0.3);ell(ctx,"fill",s*0.02,s*0.05,s*0.36,s*0.09);setColor(ctx,c1[0],c1[1],c1[2],0.5);ell(ctx,"fill",s*0.02,s*0.08,s*0.28,s*0.05);
 setColor(ctx,dark[0],dark[1],dark[2],1);poly(ctx,"fill",[-s*0.04,-s*0.11,s*0.16,-s*0.13,s*0.04,-s*0.29]);poly(ctx,"fill",[s*0.24,-s*0.09,s*0.32,-s*0.1,s*0.27,-s*0.17]);
 let tSway=wag*0.55;setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[s*0.42,tSway-s*0.02,s*0.62,-s*0.22+tSway,s*0.6,-s*0.02+tSway]);poly(ctx,"fill",[s*0.42,tSway,s*0.6,s*0.02+tSway,s*0.56,s*0.13+tSway]);
 setColor(ctx,dark[0],dark[1],dark[2],0.75);ctx.save();ctx.rotate(wag*0.3);poly(ctx,"fill",[-s*0.06,s*0.09,-s*0.24,s*0.24,s*0.02,s*0.1]);ctx.restore();
 setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[-s*0.44,-s*0.045,-s*0.57,0,-s*0.44,s*0.045]);
 setColor(ctx,1,1,1,0.85);for(let i=0;i<4;i++){let tx=-s*0.32+i*s*0.02;poly(ctx,"fill",[tx,s*0.005,tx+s*0.015,s*0.005,tx+s*0.007,s*0.03]);}
 setColor(ctx,1,1,1,0.9);circ(ctx,"fill",-s*0.27,-s*0.02,s*0.042);setColor(ctx,0.02,0.02,0.02,1);circ(ctx,"fill",-s*0.264,-s*0.02,s*0.024);setColor(ctx,1,1,1,0.6);circ(ctx,"fill",-s*0.276,-s*0.028,s*0.008);
 setColor(ctx,dark[0],dark[1],dark[2],0.45);ctx.lineWidth=1.2;for(let i=0;i<5;i++){let gx=-s*0.14+i*s*0.035;ln(ctx,gx,-s*0.045,gx-s*0.012,s*0.045);}ctx.lineWidth=1;setColor(ctx,1,1,1,1);
}
export function renderHammerheadShark(ctx,f,wag,flash,t){
 let s=f.size,c0=f.fd.colors[0],c1=f.fd.colors[1],headSway=Math.sin(wag+0.3)*0.15;
 setColor(ctx,c0[0],c0[1],c0[2],1);ell(ctx,"fill",-s*0.02,0,s*0.4,s*0.13);setColor(ctx,c1[0],c1[1],c1[2],0.4);ell(ctx,"fill",-s*0.02,s*0.05,s*0.3,s*0.07);
 ctx.save();ctx.translate(s*0.3,headSway*s*0.05);ctx.rotate(headSway*0.1);
 setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[-s*0.06,-s*0.22,s*0.1,-s*0.2,s*0.12,-s*0.06,s*0.02,-s*0.02]);poly(ctx,"fill",[-s*0.06,s*0.22,s*0.1,s*0.2,s*0.12,s*0.06,s*0.02,s*0.02]);
 setColor(ctx,c0[0]*0.9,c0[1]*0.9,c0[2]*0.9,1);poly(ctx,"fill",[-s*0.06,-s*0.22,-s*0.06,s*0.22,s*0.05,s*0.1,s*0.05,-s*0.1]);
 setColor(ctx,1,1,1,0.9);circ(ctx,"fill",s*0.09,-s*0.19,s*0.028);circ(ctx,"fill",s*0.09,s*0.19,s*0.028);setColor(ctx,0.02,0.02,0.02,1);circ(ctx,"fill",s*0.095,-s*0.19,s*0.015);circ(ctx,"fill",s*0.095,s*0.19,s*0.015);ctx.restore();
 setColor(ctx,c0[0]*0.85,c0[1]*0.85,c0[2]*0.85,1);poly(ctx,"fill",[-s*0.03,-s*0.09,s*0.1,-s*0.11,s*0.0,-s*0.24]);poly(ctx,"fill",[-s*0.2,-s*0.05,-s*0.12,-s*0.06,-s*0.16,-s*0.12]);
 let tSway=wag*0.5;setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[s*0.35,tSway-s*0.015,s*0.5,-s*0.17+tSway,s*0.48,s*0.15+tSway]);
 ctx.save();ctx.rotate(wag*0.25);setColor(ctx,c0[0]*0.8,c0[1]*0.8,c0[2]*0.8,0.8);poly(ctx,"fill",[-s*0.02,s*0.08,-s*0.16,s*0.2,s*0.04,s*0.09]);ctx.restore();
 setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[-s*0.38,-s*0.04,-s*0.48,0,-s*0.38,s*0.04]);setColor(ctx,1,1,1,1);ctx.lineWidth=1;
}
export function renderLanternShark(ctx,f,wag,flash,t){
 let s=f.size,c0=f.fd.colors[0],glow=f.fd.colors[1],pulse=0.5+Math.sin(t*2)*0.5;
 setColor(ctx,glow[0],glow[1],glow[2],0.08+pulse*0.05);ell(ctx,"fill",0,s*0.02,s*0.55,s*0.22);
 setColor(ctx,c0[0],c0[1],c0[2],1);ell(ctx,"fill",0,0,s*0.42,s*0.13);setColor(ctx,c0[0]*1.4,c0[1]*1.4,c0[2]*1.4,0.5);ell(ctx,"fill",0,s*0.04,s*0.3,s*0.06);
 setColor(ctx,c0[0],c0[1],c0[2],0.85);poly(ctx,"fill",[-s*0.03,-s*0.09,s*0.13,-s*0.11,s*0.04,-s*0.24]);
 let tSway=wag*0.5;setColor(ctx,c0[0],c0[1],c0[2],0.75);poly(ctx,"fill",[s*0.36,tSway-s*0.015,s*0.54,-s*0.16+tSway,s*0.52,s*0.14+tSway]);
 setColor(ctx,c0[0],c0[1],c0[2],0.7);poly(ctx,"fill",[-s*0.07,s*0.08,-s*0.18,s*0.19,s*0.01,s*0.08]);
 setColor(ctx,c0[0],c0[1],c0[2],1);poly(ctx,"fill",[-s*0.38,-s*0.035,-s*0.49,0,-s*0.38,s*0.035]);
 setColor(ctx,0.05,0.05,0.08,1);circ(ctx,"fill",-s*0.22,-s*0.015,s*0.035);setColor(ctx,glow[0],glow[1],glow[2],0.9);circ(ctx,"fill",-s*0.22,-s*0.015,s*0.015);
 let pts=[[-s*0.3,s*0.06],[-s*0.18,s*0.08],[-s*0.05,s*0.09],[s*0.08,s*0.08],[s*0.2,s*0.06],[s*0.3,s*0.03],[-s*0.15,-s*0.06],[s*0.05,-s*0.07],[s*0.22,-s*0.05]];
 for(let i=0;i<pts.length;i++){let p=pts[i],flick=0.6+Math.sin(t*3+i*1.3)*0.4;setColor(ctx,glow[0],glow[1],glow[2],0.15*flick);circ(ctx,"fill",p[0],p[1],s*0.025);setColor(ctx,0.8,0.98,1,0.9*flick);circ(ctx,"fill",p[0],p[1],s*0.008);}
 setColor(ctx,glow[0],glow[1],glow[2],0.5*pulse);ctx.lineWidth=1.5;ln(ctx,s*0.36,tSway,s*0.52,-s*0.14+tSway);ln(ctx,s*0.36,tSway,s*0.5,s*0.12+tSway);ctx.lineWidth=1;setColor(ctx,1,1,1,1);
}
