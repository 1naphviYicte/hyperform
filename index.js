/* eslint-disable max-len */

const chalk = require('chalk')
const clipboardy = require('clipboardy')
const { bundleAmazon } = require('./bundler/amazon/index')
const { bundleGoogle } = require('./bundler/google/index')
const { getInfos } = require('./discoverer/index')
const { deployAmazon } = require('./deployer/amazon/index')
const { publishAmazon } = require('./publisher/amazon/index')
const { generateRandomBearerToken } = require('./authorizer-gen/utils')
const { spinnies, log, logdev } = require('./printers/index')
const { zip } = require('./zipper/index')
const { deployGoogle } = require('./deployer/google/index')
const { transpile } = require('./transpiler/index')
const { isInTesting } = require('./meta/index')
const schema = require('./schemas/index').hyperformJsonSchema

/**
 * 
 * @param {string} dir 
 * @param {Regex} fnregex 
 * @param {*} parsedHyperformJson
 * @param {boolean} needAuth
 * @returns {{ urls: string[], expectedBearer?: string }} urls: Mixed, nested Array of endpoint URLs. 
 * expectedBearer: if needAuth was true, the Bearer token needed to invoke the Fn.
 * @throws
 */
async function main(dir, fnregex, parsedHyperformJson, needAuth) {
  const infos = await getInfos(dir, fnregex)
  /*
    [
      {
        p: '/home/qng/dir/somefile.js',
        exps: [ 'endpoint_hello' ]
      }
    ]
  */

  // verify parsedHyperformJson (again)
  const { error, value } = schema.validate(parsedHyperformJson)
  if (error) {
    throw new Error(`${error} ${value}`)
  }

  if (infos.length === 0) {
    log(`No exports found matching ${fnregex}`)
    return [] // no endpoint URLs created
  }

  // options passed to (transpile (for google)) and publishAmazon (for amazon)
  const publishOptions = {
    needAuth: needAuth,
  }
  if (needAuth === true) {
    publishOptions.expectedBearer = generateRandomBearerToken()
    // Print bearer token in console
    // and copy to clipboard if not in testing
    let bearerStdout = `Authorization: Bearer ${chalk.bold(publishOptions.expectedBearer)}`
    if (isInTesting() === false) {
      try {
        await clipboardy.write(publishOptions.expectedBearer)
        bearerStdout += ` ${chalk.rgb(175, 175, 175)('(Copied)')}`
      } catch (e) {
        /* Not the end of the world */
      }
    }
    log(bearerStdout)
  }

  // For each file 
  //   bundle
  //   transpile 
  //   Amazon
  //     zip
  //     deployAmazon 
  //     publishAmazon  

  const endpoints = await Promise.all(
    // For each file
    infos.map(async (info) => {
      /// /////////
      // Amazon //
      /// /////////
      let amazonZipPath
      {
        // Bundle 
        let amazonBundledCode
        try {
          amazonBundledCode = await bundleAmazon(info.p)
        } catch (e) {
          log(`Errored bundling ${info.p} for Amazon: ${e}`)
          return // just skip that file 
        }
        
        // Transpile 
        const amazonTranspiledCode = transpile(amazonBundledCode, publishOptions)
        
        // Zip
        try {
          amazonZipPath = await zip(amazonTranspiledCode)
        } catch (e) {
          // probably underlying issue with the zipping library or OS
          // should not happen
          log(`Errored zipping ${info.p} for Amazon: ${e}`)
          return // skip that file 
        }
      }
      
      /// /////////
      // Google //
      /// /////////
      let googleZipPath
      {
        // Bundle 
        let googleBundledCode
        try {
          googleBundledCode = await bundleGoogle(info.p)
        } catch (e) {
          log(`Errored bundling ${info.p} for Google: ${e}`)
          return // just skip that file 
        }

        // Transpile 
        const googleTranspiledCode = transpile(googleBundledCode, publishOptions)

        // Zip
        try {
          googleZipPath = await zip(googleTranspiledCode)
        } catch (e) {
          // probably underlying issue with the zipping library or OS
          // should not happen
          log(`Errored zipping ${info.p}: ${e}`)
          return // skip that file 
        }
      }

      // NOTE for new functions add allUsers as invoker
      // Keep that for now so don't forget the CLI setInvoker thing may screw up --need-authentication

      // For each matching export
      const endpts = await Promise.all(
        info.exps.map(async (exp) => {
          /// //////////////////////////////////////////////////////////
          /// Deploy to Amazon
          /// //////////////////////////////////////////////////////////
          let amazonUrl
          {
            const amazonSpinnieName = `amazon-main-${exp}`
            try {
              spinnies.add(amazonSpinnieName, { text: `${chalk.rgb(255, 255, 255).bgWhite(' AWS Lambda ')} Deploying ${exp}` })

              // Deploy it
              const amazonDeployOptions = {
                name: exp,
                region: parsedHyperformJson.amazon.aws_default_region,
              }
              const amazonArn = await deployAmazon(amazonZipPath, amazonDeployOptions)
              // Publish it
              const amazonPublishOptions = {
                ...publishOptions, // needAuth and expectedBearer
                region: parsedHyperformJson.amazon.aws_default_region,
              }
              amazonUrl = await publishAmazon(amazonArn, amazonPublishOptions) // TODO

              spinnies.succeed(amazonSpinnieName, { text: `${chalk.rgb(255, 255, 255).bgWhite(' AWS Lambda ')} 🟢 ${exp} ${chalk.rgb(255, 255, 255).bgWhite(amazonUrl)}` })
            } catch (e) {
              spinnies.fail(amazonSpinnieName, {
                text: `${chalk.rgb(255, 255, 255).bgWhite(' AWS Lambda ')} Error deploying ${exp}: ${e.stack}`,
              })
              logdev(e, e.stack)
            }
          }

          // TODO
          /// //////////////////////////////////////////////////////////
          /// Deploy to Google
          /// //////////////////////////////////////////////////////////
          let googleUrl
          {
            const googleSpinnieName = `google-main-${exp}`
            try {
              spinnies.add(googleSpinnieName, { text: `${chalk.rgb(255, 255, 255).bgWhite(' Google ')} ${exp}` })
              const googleOptions = {
                name: exp,
                project: 'firstnodefunc', // process.env.GC_PROJECT,
                region: 'us-central1', // TODO get from parsedhyperfromjson
                runtime: 'nodejs12',
              }
              googleUrl = await deployGoogle(googleZipPath, googleOptions)
              spinnies.succeed(googleSpinnieName, { text: `${chalk.rgb(255, 255, 255).bgWhite(' Google ')} ${exp} ${chalk.rgb(255, 255, 255).bgWhite(googleUrl)}` })
            } catch (e) {
              spinnies.fail(googleSpinnieName, {
                text: `${chalk.rgb(255, 255, 255).bgWhite(' Google ')} ${exp}: ${e.stack}`,
              })
              logdev(e, e.stack)
            }
          }

          return [amazonUrl] // for tests etc
        }),
      )

      console.log('Google takes another 1 - 2m for changes to take effect')

      return [].concat(...endpts)
    }),
  )
  return { urls: endpoints, expectedBearer: publishOptions.expectedBearer }
}

module.exports = {
  main,
}
