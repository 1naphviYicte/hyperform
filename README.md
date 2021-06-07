

![Hyperform Banner](https://github.com/qngapparat/hyperform/blob/master/hyperform-banner.png)


> 🧪 Lightweight serverless framework for NodeJS

* **Simple** to deploy
* **Lightweight**
* **Works with** provider's conventions

## Install

```sh
$ npm install -g hyperform-cli
```

## AWS Lambda Example 

Everything works like a normal NodeJS app. 

```js
// AWS Lambda example
// somefile.js

/* 
.
├── node_modules
├── package-lock.json
├── package.json
├── some
│   └── pic.png
└── somefile.js
*/ 

// Use npm packages as normal
const package = require('lodash')

// Use external files as normal 
const externalfile = fs.readFileSync('./some/pic.png')

// Export each function using 'exports'
exports.foo = (event, context, callback) => {
  context.succeed({
    message: "I'm Foo on AWS Lambda!"
  })
}

exports.bar = (event, context, callback) => {
  context.succeed({
    message: "I'm Bar on AWS Lambda!"
  })
}
```

### Create a `hyperform.json` 

```json
{
  "amazon": {
    "aws_access_key_id": "...",
    "aws_secret_access_key": "...",
    "aws_region": "..."
  }
}
```

### Deploy to AWS Lambda

```
$ hyperform deploy ./somefile.js --amazon       # Deploy
$ hyperform deploy ./somefile.js --amazon --url # Deploy & get URL via API Gateway
```

⚠️ Note that the entire folder containing `hyperform.json` will be deployed, minus `.git`, `.gitignore`, `hyperform.json`.

The flag `--url` creates an public, **unprotected** API Gateway route to your function, that you can `GET` and `POST` to.

## Google Cloud Functions Example 

Everything works like a normal NodeJS app. 

Google passes Express objects to your functions (`req`, `res`). 
Otherwise, it is identical to the AWS example above.

```js
// Google Cloud Functions Example
// somefile.js

/* 
.
├── node_modules
├── package-lock.json
├── package.json
├── some
│   └── pic.png
└── somefile.js
*/ 


// Use npm packages as normal
const package = require('lodash')

// Use external files as normal 
const externalfile = fs.readFileSync('./some/pic.png')

exports.foo = (req, res) => {
  let message = req.query.message || req.body.message || "I'm a Google Cloud Function, Foo";
  res.status(200).send(message);
};

exports.bar = (req, res) => {
  let message = req.query.message || req.body.message || "I'm a Google Cloud Function, Bar";
  res.status(200).send(message);
};
```



### Create a `hyperform.json` 

```json
{
  "google": {
    "gc_project": "...",
    "gc_region": "...",
  }
}
```

### Deploy to Google Cloud Functions

```
$ hyperform deploy ./somefile.js --google       # Deploy
$ hyperform deploy ./somefile.js --google --url # Deploy & get URL via removing IAM
```

⚠️ Note that the entire folder containing `hyperform.json` will be deployed, minus `.git`, `.gitignore`, `node_modules`, and `hyperform.json`.

On Google Cloud, the `--url` flag adds `allUsers` to "Cloud Function Invokers" of the function, so that anyone with the URL can `GET` or `POST` to it.



## Hints & Caveats

* New functions are deployed with 256MB RAM, 60s timeouts 
* The flag `--url` gives you **unprotected** URLs. Anyone with that URL can invoke your functions
* The entire folder containing `hyperform.json` will be deployed with each function

## Opening Issues

Feel free to open issues if you find bugs.

## Contributing

Always welcome! Please see CONTRIBUTING.md

## License

Apache 2.0
