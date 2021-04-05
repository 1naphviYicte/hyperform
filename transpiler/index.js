/**
 * @description Transpiles Javascript code so that its exported functions can run on Amazon, Google
 * @param {string} bundleCode Bundled Javascript code. 
 * Output of the 'bundle' function in bundle/index.js
 * @returns {string} The code, transpiled for providers
 */
function transpile(bundleCode) {
  // Wrapper code that abstracts the provider API at runtime
  const appendix = `

;module.exports = (() => {

  /**
    * This is the Hyperform wrapper
    * Plain-text for better readability
    */
  global.alreadyWrappedNames = [];

  function wrapExs(me, platform) {
    const newmoduleexports = { ...me };
    const expkeys = Object.keys(me);
    for (let i = 0; i < expkeys.length; i += 1) {
      const expkey = expkeys[i];
      const userfunc = newmoduleexports[expkey];
      // it should be idempotent
      // TODO fix code so this doesn't happen
      if (global.alreadyWrappedNames.includes(expkey)) {
        continue;
      }
      global.alreadyWrappedNames.push(expkey);
      let wrappedfunc;
      if (platform === 'amazon') {
        wrappedfunc = async function handler(input, context) {
          // first argument
          let event = {};
          // second argument
          let httpsubset = {};

          /// ///////////////////////////////
          // We are invoked from console, or via SDK ///////
          /// ////////////////////////////////
          if (input == null || input.routeKey === undefined || input.rawPath === undefined || input.headers === undefined) {
            event = input;
            httpsubset = {};
          }

          /// ////////////////////////////////
          // We are invoked from HTTP ///////
          /// ////////////////////////////////
          else {
            httpsubset = {
              // fields will all be undefined when invoked from console
              method: input.requestContext && input.requestContext.http && input.requestContext.http.method,
              headers: input.headers,
            };
            // check for GET query string
            if (input.queryStringParameters != null) {
              event = input.queryStringParameters;
            }
            // check for POST body
            else if (input.body != null) {
              event = (input.isBase64Encoded === true)
                ? Buffer.from(input.body, 'base64').toString('utf-8')
                : input.body;
              // try to parse as JSON first
              try {
                event = JSON.parse(event);
              } catch (e) {
                // try to parse as query string second
                event = Object.fromEntries(new URLSearchParams(event));
              }
            } else {
              console.log("Warn: No query string, or 'body' field found in input."); // visible in CloudWatch and on Google
            }
          }

          // Invoke user function
          let res;
          try {
            res = await userfunc(event, httpsubset); // TODO add context.fail?
            context.succeed(res);
          } catch (e) {
            if (e.code === 'AccessDeniedException') {
              // return details for debugging
              context.succeed({
                statusCode: 200,
                body: JSON.stringify({
                  ...e,
                  notice: 'Error details returned by Hyperform wrapper because it is an AccessDeniedException. Hyperform always returns the Error details for: [AccessDeniedException] .',
                }),
              });
            } else {
              throw e; // return non-descriptive 500
            }
          }
        };
      }
      if (platform === 'google') {
        wrappedfunc = async function handler(req, resp) {
          // allow to be called from anywhere (also localhost)

          //    resp.header('Content-Type', 'application/json');
          resp.header('Access-Control-Allow-Origin', '*');
          resp.header('Access-Control-Allow-Headers', '*');
          resp.set('Access-Control-Allow-Methods', 'GET, POST');
          resp.set('Access-Control-Max-Age', 30);

          // respond to CORS preflight requests
          if (req.method === 'OPTIONS') {
            resp.status(204).send('');
          } else {
            // Warn at common Express mistake
            // (No content-type header will lead to body-parser not parsing the body)
            // User will POST but function will receive no input
            console.log('req.headers:', JSON.stringify(req.headers));
            console.log('req.method: ', req.method);
            if (
              req.method.toLowerCase() === 'post'
               && req.headers['content-type'] !== 'application/json'
            ) {
              console.warn('Dont forget to specify the Content-Type header in case you are POSTing JSON.');
            }

            // First argument
            const event = {
              ...req.query,
              ...JSON.parse(JSON.stringify(req.body)),
            };
            // Second argument
            const httpsubset = {
              // may be undefined fields, and thus httpsubset be {}
              method: req.method,
              headers: req.headers,
            };

            // Invoke user function
            try {
              const output = await userfunc(event, httpsubset);
              resp.json(output);
            } catch (e) {
              resp.status(500).send('');
            }
          }
        };
      }
      newmoduleexports[expkey] = wrappedfunc;
    }
    return newmoduleexports;
  }
  const curr = { ...exports, ...module.exports };
  const isInAmazon = !!(process.env.LAMBDA_TASK_ROOT || process.env.AWS_EXECUTION_ENV);
  const isInGoogle = (/google/.test(process.env._) === true);
  if (isInAmazon === true) {
    return wrapExs(curr, 'amazon');
  }
  if (isInGoogle === true) {
    return wrapExs(curr, 'google');
  }
  return curr; // Export unchanged (local, fallback)

  
})();
`

  const transpiledCode = bundleCode + appendix

  return transpiledCode
}

module.exports = {
  transpile,
}
