const fs = require('fs')
const path = require('path')
const os = require('os')

/**
 * @description Extracts the [default] section of an AWS .aws/config or .aws/credentials file
 * @param {string} filecontents File contents of an .aws/credentials or .aws/config file
 * @returns {string} The string between [default] and the next [...] header, if exists.
 *  Otherwise returns empty string
 */
function getDefaultSectionString(filecontents) {
  // Collect all lines below the [default] header ...
  let defaultSection = filecontents.split(/\[default\]/)[1]

  if (typeof defaultSection !== 'string' || !defaultSection.trim()) {
    // default section is non-existent
    return ''
  }
  // ... but above the next [...] header (if any)
  defaultSection = defaultSection.split(/\[[^\]]*\]/)[0]
  return defaultSection
}

// TODO refactor
// TODO split up into better functions, for amazon, google inferrer
// TODO error handling & meaningful stdout
// TODO tests
/**
 * @description Extracts aws_access_key_id and aws_secret_access_key fields from a given .aws/credentials file
 * @param {string} filecontents File contents of .aws/credentials
 * @returns {
 * default: { 
  * aws_access_key_id?: string, 
  * aws_secret_access_key?: string, 
  * aws_default_region?: string 
 * }}
 */
function parseAwsCredentialsOrConfigFile(filecontents) {
  /* filecontents looks something like this:

    [default]
    region=us-west-2
    output=json

    [profile user1]
    region=us-east-1
    output=text

    See: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html

    */
    
  const fields = {
    default: {},
  }
  
  try {
    const defaultSectionString = getDefaultSectionString(filecontents)
    if (!defaultSectionString || !defaultSectionString.trim()) {
      return fields
    }
    
    // we found something
    const defaultSectionLines = defaultSectionString.split('\n') // TODO split by os-specific newline
  
    // Try to extract aws_access_key_id
    if (defaultSectionLines.some((l) => /aws_access_key_id/.test(l))) {
      const awsAccessKeyIdLine = defaultSectionLines.filter((l) => /aws_access_key_id/.test(l))[0]
      let awsAccessKeyId = awsAccessKeyIdLine.split('=')[1]
      if (typeof awsAccessKeyId === 'string') { // don't crash on weird invalid lines such 'aws_access_key_id=' or 'aws_access_key_id'
        awsAccessKeyId = awsAccessKeyId.trim()
        fields.default.aws_access_key_id = awsAccessKeyId
      }
    }
  
    // Try to extract aws_secret_access_key
    if (defaultSectionLines.some((l) => /aws_secret_access_key/.test(l))) {
      const awsSecretAccessKeyLine = defaultSectionLines.filter((l) => /aws_secret_access_key/.test(l))[0]
      let awsSecretAccessKey = awsSecretAccessKeyLine.split('=')[1]
      if (typeof awsSecretAccessKey === 'string') {
        awsSecretAccessKey = awsSecretAccessKey.trim() 
        fields.default.aws_secret_access_key = awsSecretAccessKey
      }
    }

    // Try to extract region
    if (defaultSectionLines.some((l) => /region/.test(l))) {
      const regionLine = defaultSectionLines.filter((l) => /region/.test(l))[0]
      let region = regionLine.split('=')[1]
      if (typeof region === 'string') {
        region = region.trim() 
        fields.default.region = region
      }
    }

    return fields
    // 
  } catch (e) {
    console.log(e)
    // non-critical, just return what we have so far
    return fields 
  }
}

// TODO shorten
/**
 * @description Tries to infer AWS credentials and config, and creates a hyperform.json in "absdir" with what it could infer. If hyperform.json already exists in "absdir" it just prints a message.
 * @param {string} absdir The directory where 'hyperform.json' should be created
 * @returns {{ 
 * amazon: { 
 *  aws_access_key_id: string?,
 *  aws_secret_access_key: string?, 
 *  aws_default_region: string? 
 * }
 * }}
 */
function init(absdir) {
  const hyperformJsonContents = {
    amazon: {
      aws_access_key_id: '',
      aws_secret_access_key: '',
      aws_default_region: '', // TODO will be made redundant when hyperform deploys multi-region
    },
  }

  const filedest = path.join(absdir, 'hyperform.json')
  if (fs.existsSync(filedest)) {
    console.log('hyperform.json exists already.')
    return
  }
  
  // try to infer AWS credentials

  // AWS CLI uses this precedence:
  // (1 - highest precedence) Environment variables AWS_ACCESS_KEY_ID, ...  
  // (2) .aws/credentials and .aws/config

  // Hence, do the same here

  // First, start with (2)

  // Check ~/.aws/credentials and ~/.aws/config
  
  const possibleCredentialsPath = path.join(os.homedir(), '.aws', 'credentials')
  
  if (fs.existsSync(possibleCredentialsPath) === true) {
    const credentialsFileContents = fs.readFileSync(possibleCredentialsPath, { encoding: 'utf-8' })
        
    // TODO offer selection to user when there are multiple profiles
    const parsedCredentials = parseAwsCredentialsOrConfigFile(credentialsFileContents)
    hyperformJsonContents.amazon.aws_access_key_id = parsedCredentials.default.aws_access_key_id
    hyperformJsonContents.amazon.aws_secret_access_key = parsedCredentials.default.aws_secret_access_key
    console.log(`Inferred AWS credentials from ${possibleCredentialsPath}`)
  } else {
    console.log(`Could not guess AWS credentials. No AWS credentials file found in ${possibleCredentialsPath}`)
  }

  /// /////////////////
  /// /////////////////

  // try to infer AWS region
  const possibleConfigPath = path.join(os.homedir(), '.aws', 'config')

  if (fs.existsSync(possibleConfigPath) === true) {
    const configFileContents = fs.readFileSync(possibleConfigPath, { encoding: 'utf-8' })

    const parsedConfig = parseAwsCredentialsOrConfigFile(configFileContents)
    hyperformJsonContents.amazon.aws_default_region = parsedConfig.default.region
    console.log(`Inferred AWS region from ${possibleConfigPath}`)
  } else {
    console.log(`Could not guess AWS region. No AWS config file found in ${possibleConfigPath}`) // TODO region will not be a single region, but smartly multiple ones (or?)
  }

  // Then, do (1), possibly overriding values
  // Check environment variables

  if (typeof process.env.AWS_ACCESS_KEY_ID === 'string' && process.env.AWS_ACCESS_KEY_ID.trim().length > 0) {
    hyperformJsonContents.amazon.aws_access_key_id = process.env.AWS_ACCESS_KEY_ID.trim()
    console.log('environment variable AWS_ACCESS_KEY_ID overriding credentials file')
  }

  if (typeof process.env.AWS_SECRET_ACCESS_KEY === 'string' && process.env.AWS_SECRET_ACCESS_KEY.trim().length > 0) {
    hyperformJsonContents.amazon.aws_secret_access_key = process.env.AWS_SECRET_ACCESS_KEY.trim()
    console.log('environment variable AWS_SECRET_ACCESS_KEY overriding credentials file')
  }

  if (typeof process.env.AWS_DEFAULT_REGION === 'string' && process.env.AWS_DEFAULT_REGION.trim().length > 0) {
    hyperformJsonContents.amazon.aws_default_region = process.env.AWS_DEFAULT_REGION.trim()
    console.log('environment variable AWS_DEFAULT_REGION overriding config file')
  }

  // write results to hyperform.json
  fs.writeFileSync(
    path.join(absdir, 'hyperform.json'),
    JSON.stringify(hyperformJsonContents, null, 2),
  )

  console.log('Created hyperform.json') // TODO ask for defaults guide through in init etc
}

module.exports = {
  init,
  _only_for_testing_getDefaultSectionString: getDefaultSectionString,
  _only_for_testing_parseAwsCredentialsOrConfigFile: parseAwsCredentialsOrConfigFile,
}
