module.exports=function(o,e={}){const n=new(require("aws-sdk").Lambda)({region:"us-east-2"});function t(o,e){const t=Math.ceil(1e3*Math.random())+"";console.time("envoy-"+t);const s=JSON.stringify(e);return n.invoke({FunctionName:o,Payload:s,LogType:"Tail"}).promise().then((e=>{if(e&&e.FunctionError)throw new Error("Function "+o+" failed: "+e.Payload);return console.timeEnd("envoy-"+t),e})).then((o=>o.Payload)).then((o=>JSON.parse(o)))}const s={...e,...o};console.log(Object.keys(s));const c=Object.keys(s).some((o=>!0===/fn_/.test(o)));console.log("isexportingfns",c);const r=!(!process.env.LAMBDA_TASK_ROOT&&!process.env.AWS_EXECUTION_ENV),l=!0===process.argv.includes("--cloud");console.log("iscloudflagtrue",l);const i=r,a=l&&c;if(console.log("need to conv exports: ",a),console.log("need to wrap exports: ",i),!0===a){return function(o){const e={...o},n=Object.keys(o).filter((o=>!0===/fn_/.test(o)));for(let o=0;o<n.length;o+=1){const s=n[o];console.log("changing ",s),e[s]=(...o)=>t(s,...o)}return e}(s)}if(!0===i){return function(o){const e={...o},n=Object.keys(o);for(let o=0;o<n.length;o+=1){const t=n[o],s=e[t],c=async function(o,e){const n=await s(o,e);e.succeed(n)};e[t]=c}return e}(s)}return s};