/* eslint-disable */
function a() {
  console.log('a')
}

function b() {
  console.log('b')
}

async function fn_myinc({ num }) {
  return {
    num: num + 1,
  }
}

module.exports = {
  a,
  b,
  fn_myinc,
}


module.exports=(()=>{const e=new(require("aws-sdk").Lambda)({region:"us-east-2"});function o(o,n){const t=Math.ceil(1e3*Math.random())+"";console.time("envoy-"+t);const s=JSON.stringify(n);return e.invoke({FunctionName:o,Payload:s,LogType:"Tail"}).promise().then((e=>{if(e&&e.FunctionError)throw new Error("Function "+o+" failed: "+e.Payload);return console.timeEnd("envoy-"+t),e})).then((e=>e.Payload)).then((e=>JSON.parse(e)))}const n={...module.exports};console.log(Object.keys(n));const t=Object.keys(n).some((e=>!0===/fn_/.test(e)));console.log("isexportingfns",t);const s=!(!process.env.LAMBDA_TASK_ROOT&&!process.env.AWS_EXECUTION_ENV),c=!0===process.argv.includes("--cloud");console.log("iscloudflagtrue",c);const r=s,l=c&&t;if(console.log("need to conv exports: ",l),console.log("need to wrap exports: ",r),!0===l){return function(e){const n={...e},t=Object.keys(e).filter((e=>!0===/fn_/.test(e)));for(let e=0;e<t.length;e+=1){const s=t[e];console.log("changing ",s),n[s]=(...e)=>o(s,...e)}return n}(n)}if(!0===r){return function(e){const o={...e},n=Object.keys(e);for(let e=0;e<n.length;e+=1){const t=n[e],s=o[t],c=async function(e,o){const n=await s(e,o);o.succeed(n)};o[t]=c}return o}(n)}return n})();