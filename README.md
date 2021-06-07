

![Hyperform Banner](https://github.com/qngapparat/hyperform/blob/master/hyperform-banner.png)


> 🧪 Lightweight serverless framework for NodeJS

* **Unopinionated** (any NodeJS code works)
* **1-click deploy** (1 command)
* **Lightweight** (no wrapping)
* **Multi-Cloud** (for AWS & Google Cloud)
* **Maintains** (provider's conventions)

## Install

```sh
$ npm install -g hyperform-cli
```

Hyperform works for AWS Lambda & Google Cloud Functions.

## Basic Example (AWS Lambda)


```js
// somefile.js

exports.foo = (event, context, callback) => {
  context.succeed({
    message: "I'm Foo on AWS Lambda!"
  })
}
```

Create a `hyperform.json` with these fields:

```json 
// hyperform.json

{
  "amazon": {
    "aws_access_key_id": "...",
    "aws_secret_access_key": "...",
    "aws_region": "us-east-2"
  }
}
```

In the Terminal:

``` 
$ hyperform deploy somefile.js --amazon --url
```

Deployed functions: 

``` 
                     # GET and POST-able
$ 🟢 foo on AWS Lambda https://w3g434h.execute-api.us-east-2.amazonaws.com/foo
```




## Basic Example (Google Cloud Functions)


```js
// somefile.js

exports.foo = (req, res) => {
  let message = req.query.message || req.body.message || "I'm a Google Cloud Function, Foo";
  res.status(200).send(message);
};
```

Create a `hyperform.json` with these fields:

```json 
// hyperform.json

{
  "google": {
    "gc_project": "...",
    "gc_region": "...",
  }
}
```

In the Terminal:

``` 
$ hyperform deploy somefile.js --google --url
```

Deployed functions: 

``` 
                                   # GET and POST-able
$ 🟢 foo on Google Cloud Functions https://us-central1-someproject-153dg2.cloudfunctions.net/foo 
```

## Hints & Caveats

* New functions are deployed with 256MB RAM, 60s timeouts 
* The flag `--url` creates **unprotected** URLs to the functions. Anyone with these URLs can invoke your functions
* The entire folder containing `hyperform.json` will be deployed with each function



## Full AWS Lambda Example

Everything works like a normal NodeJS app. 

The entire folder containing `hyperform.json` is uploaded, so you can use NPM packages, use external files, (...) just like normal.



```js
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


## Full Google Cloud Functions Example 

Everything works like a normal NodeJS app. 

The entire folder containing `hyperform.json` is uploaded, so you can use NPM packages, use external files, (...) just like normal.

Google Cloud passes Express objects to your functions (`req`, `res`). 



```js
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



### FAQ

**Where does deployment happen?**

It's a client-side tool, so on your computer. It uses the credentials it finds in `hyperform.json`


**What is deployed, except the code file?**

The entire folder where `hyperform.json` is is uploaded, excluding `.git`, `.gitignore`, `hyperform.json`, and for Google Cloud `node_modules` (Google Cloud installs NPM dependencies freshly from `package.json`).


**How does `--url` create URLs?**

On AWS, it creates an API Gateway API (called `hf`), and a `GET` and `POST` route to your function. 

On Google Cloud, it removes IAM checking from the function by adding `allUsers` to the group "Cloud Functions Invoker" of that function.

Note that in both cases, **anyone with the URL can invoke your function. Make sure to add Authentication logic inside your function**, if needed. 



## Opening Issues

Feel free to open issues if you find bugs.

## Contributing

Always welcome ❤️ Please see CONTRIBUTING.md

## License

Apache 2.0
