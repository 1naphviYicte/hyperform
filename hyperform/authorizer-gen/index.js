const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { deployAmazon } = require('../deployer/amazon')
const { zip } = require('../zipper/index')

/**
 * 
 * @param {string} authorizerName For example 'myfn-authorizer'
 * @param {string} expectedBearer 'Authorization': 'Bearer {expectedBearer}' 
 * @param {string} region Desired region of the authorizer lambda
 * @returns {string} ARN of the deployed authorizer lambda
 */
async function deployAuthorizer(authorizerName, expectedBearer, region) {
  // avoid accidentally empty bearer
  // Any request with 'Bearer' would be let through
  if (!expectedBearer || !expectedBearer.trim()) {
    throw new Error('deployAuthorizer: expectedBearer is required')
  }
  if (expectedBearer.trim().length < 10) {
    throw new Error(`deployAuthorizer: expectedBearer needs to have 10 or more digits for security: ${expectedBearer}`)
  }
  // will mess up weird user-given Tokens but that's on the user
  // will lead to false negatives (still better than false positives or injections)
  const sanitizedExpectedBearer = encodeURI(expectedBearer)

  const authorizerCode = `
  exports.handler = async(event) => {
    const expected = \`Bearer ${sanitizedExpectedBearer}\`
    const isAuthorized = (event.headers.authorization === expected)
    return {
      isAuthorized
    }
  };
  `
  // TODO do this private somehow that no program can tamper with authorizer zip
  const zipPath = await zip(authorizerCode)

  const deployOptions = {
    name: authorizerName,
    role: 'arn:aws:iam::735406098573:role/lambdaexecute',
    timeout: 1, // 1 second is ample time
    handler: 'index.handler',
    region: region, // if not defined, it will use default TODO throw on not defined
  }
  const authorizerArn = await deployAmazon(zipPath, deployOptions)

  // Allow apigateway to access authorizer
  const cmd2 = `aws lambda add-permission --function-name ${authorizerName} --action lambda:InvokeFunction --statement-id hyperform-statement-${authorizerName} --principal apigateway.amazonaws.com`

  try {
    await exec(cmd2)
    //   console.log(`allowed Lambda ${authorizerName} to be accessed by API gateway`)
  //  console.log(`Authorized Gateway to access ${lambdaName}`)
  } catch (e) {
    // means statement exists already - means API gateway is already auth to access that lambda
    // console.log(`Probably already authorized to access ${lambdaName}`)
    // surpress throw e
    //   console.log(`Lambda ${authorizerName} probably can already be accessed by API gateway`)
  }
  return authorizerArn
}

/**
 * @param {string} apiId 
 * @param {string} routeKey For example '$default'
 * @returns {string} RouteId of the route
 */
async function getRouteId(apiId, routeKey) {
  const cmd = `aws apigatewayv2 get-routes --api-id ${apiId} --query 'Items[?RouteKey==\`${routeKey}\`]'`

  const { stdout } = await exec(cmd, { encoding: 'utf-8' })
  const parsedStdout = JSON.parse(stdout)

  if (parsedStdout.length !== 1) {
    throw new Error(`Could not get RouteId of apiId, routeKey ${apiId}, ${routeKey}: ${parsedStdout}`)
  }
  const routeId = parsedStdout[0].RouteId
  return routeId
}

/**
 * Sets the $default path of <apiId> to be guarded by authorizerArn.
 * @param {string} apiId 
 * @param {string} authorizerArn ARN of Lambda that should be the authorizer
 * @returns {void}
 * @throws If authorizerArn is not formed like a Lambda ARN. Fails silently if authorizerArn Lambda does not exist
 */
async function setAuthorizer(apiId, authorizerArn) {
  // ARN format: https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html
  // region is the fourth field
  const authorizerRegion = authorizerArn.split(':')[3] 
  // name is the last field
  const authorizerName = authorizerArn.split(':').slice(-1)[0]

  const authorizerType = 'REQUEST'
  const identitySource = '$request.header.Authorization'

  const authorizerUri = `arn:aws:apigateway:${authorizerRegion}:lambda:path/2015-03-31/functions/${authorizerArn}/invocations`

  // Try to create authorizer for that API
  // succeeds => Authorizer with that name did not exist yet. Use that authorizerId going forward
  // Fails => Authorizer already existed with that name. 
  // Get that one's authorizerId (Follow Hyperform conv: same name - assume identical)

  const cmd = `aws apigatewayv2 create-authorizer --api-id ${apiId} --name ${authorizerName} --authorizer-type ${authorizerType} --identity-source '${identitySource}' --authorizer-uri ${authorizerUri} --authorizer-payload-format-version 2.0 --enable-simple-responses`
  let authorizerId 

  try {
    // Try to create authorizer
    const { stdout } = await exec(cmd, { encoding: 'utf-8' })
    //   console.log(`Newly created Authorizer from Lambda ${authorizerName}`)
    //  console.log(stdout)
    const parsedStdout = JSON.parse(stdout)
    authorizerId = parsedStdout.AuthorizerId
  } catch (e) {
    // authorizer already exists
    // obtain its id
    //   console.log(`Reusing existing authorizer ${authorizerName}`)
    const cmd2 = `aws apigatewayv2 get-authorizers --api-id ${apiId} --query 'Items[?Name==\`${authorizerName}\`]'`
    const { stdout } = await exec(cmd2, { encoding: 'utf-8' })
    const parsedStdout = JSON.parse(stdout)
    // Could not create, and could not get
    // Means bad input
    if (!parsedStdout.length || parsedStdout[0].AuthorizerId == null) {
      throw new Error(`Could not create or get Authorizer ${authorizerName}. Check these inputs to setAuthorizer: ${apiId} , ${authorizerArn}`) // TODO HF Programmer mistake
    }

    authorizerId = parsedStdout[0].AuthorizerId
  }

  const routeKey = '$default'
  // attach authorizer (may be already attached if entered catch but alas)
  const routeId = await getRouteId(apiId, routeKey)
  const cmd3 = `aws apigatewayv2 update-route --api-id ${apiId} --route-id ${routeId} --authorization-type CUSTOM --authorizer-id ${authorizerId} `
  const { stdout } = await exec(cmd3, { encoding: 'utf-8' })
  // attached authorizer Lambda to routeId
}

// TODO set authorizer cache ??

module.exports = {
  deployAuthorizer,
  setAuthorizer,
  _only_for_testing_getRouteId: getRouteId,
}
