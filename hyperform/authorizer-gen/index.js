const AWS = require('aws-sdk')
const { deployAmazon } = require('../deployer/amazon/index')
const { allowApiGatewayToInvokeLambda } = require('../publisher/amazon/utils')
const { zip } = require('../zipper/index')
/**
 * @description Creates or updates Authorizer lambda with name "authorizerName" 
 * that if used as Authorizer in API Gateway, will
 * greenlight requests with given expectedBearer token
 * @param {string} authorizerName For example 'myfn-authorizer'
 * @param {string} expectedBearer The 'Authorization': 'Bearer ...' token 
 * the Authorizer will greenlight
 * @param {{region: string}} options 
 * @returns {Promise<string>} ARN of the deployed authorizer lambda
 */
async function deployAuthorizerLambda(authorizerName, expectedBearer, options) {
  if (options == null || options.region == null) { 
    throw new Error('optionsregion is required') // TODO HF programmer mistake
  }
  // avoid accidentally empty bearer et cetera
  if (!expectedBearer || !expectedBearer.trim()) {
    throw new Error('deployAuthorizerLambda: expectedBearer is required')
  }
  if (expectedBearer.trim().length < 10) {
    throw new Error(`deployAuthorizerLambda: expectedBearer needs to have 10 or more digits for security: ${expectedBearer}`)
  }

  // will mess up weird user-given Tokens but that's on the user
  // will lead to false negatives (still better than false positives or injections)
  // This should not be needed, as expectedBearer is generated by our code, but to be sure
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
  // TODO do this private somehow, in RAM, so that no program can tamper with authorizer zip
  const zipPath = await zip(authorizerCode)

  const deployOptions = {
    name: authorizerName,
    timeout: 1, // 1 second is ample time
    handler: 'index.handler',
    region: options.region,  
  }

  // create or update Authorizer Lambda
  const authorizerArn = await deployAmazon(zipPath, deployOptions)

  await allowApiGatewayToInvokeLambda(authorizerName, options.region)
  
  return authorizerArn
}

/**
 * @description Gets the RouteId of a route belonging to an API on API Gateway
 * @param {string} apiId Id of the API in API Gateway
 * @param {string} routeKey For example '$default'
 * @param {string} region Region of the API in API Gateway
 * @returns {Promise<string>} RouteId of the route
 * @throws If query items did not include a Route named "routeKey"
 */
async function getRouteId(apiId, routeKey, region) {
  const apigatewayv2 = new AWS.ApiGatewayV2({
    apiVersion: '2018-11-29',
    region: region,
  })

  // TODO Amazon might return a paginated response here  (?)
  // In that case with many routes, the route we look for may not be on first page
  const params = {
    ApiId: apiId,
    MaxResults: '9999', // string according to docs and it works... uuh?
  }

  const res = await apigatewayv2.getRoutes(params).promise() 

  const matchingRoutes = res.Items.filter((item) => item.RouteKey === routeKey)
  if (matchingRoutes.length === 0) {
    throw new Error(`Could not get RouteId of apiId, routeKey ${apiId}, ${routeKey}`)
  }

  // just take first one
  // Hyperform convention is there's only one with any given name
  const routeId = matchingRoutes[0].RouteId

  return routeId
}

/**
 * @description Sets the $default path of "apiId" to be guarded by "authorizerArn" lambda.
 * @param {string} apiId Id of API in API Gateway to be guarded
 * @param {string} authorizerArn ARN of Lambda that should act as the authorizer
 * @returns {void}
 * @throws Throws if authorizerArn is not formed like a Lambda ARN. 
 * Fails silently if authorizerArn Lambda does not exist.
 */
async function setDefaultRouteAuthorizer(apiId, authorizerArn, apiRegion) {
  // TODO what happens when api (set to REGIONAL) and authorizer lambda are in different regions

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

  const apigatewayv2 = new AWS.ApiGatewayV2({
    apiVersion: '2018-11-29',
    region: apiRegion,
  })

  const createAuthorizerParams = {
    ApiId: apiId,
    Name: authorizerName,
    AuthorizerType: authorizerType,
    IdentitySource: [identitySource],
    AuthorizerUri: authorizerUri,
    AuthorizerPayloadFormatVersion: '2.0',
    EnableSimpleResponses: true,
  }

  let authorizerId

  try {
    const createRes = await apigatewayv2.createAuthorizer(createAuthorizerParams).promise()
    // authorizer does not exist
    authorizerId = createRes.AuthorizerId
  } catch (e) {
    if (e.code === 'BadRequestException') {
      // authorizer already exists
      // TODO update authorizer to make sure it points 
      // ...to authorizerArn lambda (to behave exactly as stated in @description)

      // TODO pull-up this and/or add update authorizer
      
      // obtain its id
      const getAuthorizersParams = {
        ApiId: apiId,
        MaxResults: '9999',
      }
      const getRes = await apigatewayv2.getAuthorizers(getAuthorizersParams).promise()

      const matchingRoutes = getRes.Items.filter((item) => item.Name === authorizerName)
      if (matchingRoutes.length === 0) {
        throw new Error(`Could not get AuthorizerId of apiId ${apiId}`)
      }

      // just take first one
      // Hyperform convention is there's only one with any given name
      authorizerId = matchingRoutes[0].AuthorizerId
    } else {
      // some other error
      throw e
    }
  }
  
  // attach authorizer to $default
  const routeKey = '$default'
  const routeId = await getRouteId(apiId, routeKey, apiRegion)

  const updateRouteParams = {
    ApiId: apiId,
    RouteId: routeId,
    AuthorizerId: authorizerId,
  }
  await apigatewayv2.updateRoute(updateRouteParams).promise()
  // done
}

/**
 * @description Detaches the current authorizer, if any, from the $default route of API 
 * with ID "apiId". The route is then in any case unauthorized and the underlying Lambda becomes 
 * invokable by anyone with the URL.
 * This does not delete the authorizer or the authorizer Lambda.
 * @param {string} apiId 
 * @param {string} apiRegion
 */
async function detachDefaultRouteAuthorizer(apiId, apiRegion) {
  const apigatewayv2 = new AWS.ApiGatewayV2({
    apiVersion: '2018-11-29',
    region: apiRegion,
  })

  const routeKey = '$default'
  const routeId = await getRouteId(apiId, routeKey, apiRegion)

  const updateRouteParams = {
    ApiId: apiId,
    RouteId: routeId,
    AuthorizationType: 'NONE',
  }

  await apigatewayv2.updateRoute(updateRouteParams).promise()
}
// TODO set authorizer cache ??

module.exports = {
  deployAuthorizerLambda,
  setDefaultRouteAuthorizer,
  detachDefaultRouteAuthorizer,
  _only_for_testing_getRouteId: getRouteId,
}
