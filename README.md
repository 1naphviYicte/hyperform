![Hyperform Banner](https://github.com/qngapparat/hyperform/blob/master/hyperform-banner.png)


<p align="center">A next-gen serverless deployer
<br>For AWS Lambda & Google Cloud Functions</p>

## Install

```sh
$ npm install -g hyperform-cli
```


## Basic Usage

```
$ hf init 
$ hf deploy [--url]
```

#### ✍️ Write normal JavaScript


```js
function greet(event) {
  return { greeting: `Hi, ${event.name}`
}

module.exports = {
  greet 
} 
```

🔍 Infer your AWS or Google Cloud credentials

```sh
$ hf init
>>> ✓ Created hyperform.json
```

#### 🚀 Deploy as cloud functions

* Every export from `index.js` is deployed as separate function
* You can import anything. Webpack is used to bundle all dependencies

```sh
$ hf deploy --url index.js

>>> 🟢 greet https://ltirihayh9.execute-api.us-east-2.amazonaws.com/greet
>>> 🟢 greet https://us-central1-myproject.cloudfunctions.net/greet
```

If you don't want to make your functions public, omit the `--url` flag.

#### 📡 Call it

```sh
curl  https://us-central1-myproject.cloudfunctions.net/greet?name=John

>>> {"message":"Hi, John!"}
```

### Advanced

#### Accessing HTTP headers

When you call your functions via HTTP, they receive HTTP details as second argument. Otherwise it is `{}`

```sh
function viaHTTP(input, http) {

  if(http.method != null) {
    console.log(`
      I was invoked via ${http.method}! 
      Headers: ${http.headers}
    `)
  }
}
```

## Tips

* The first argument always an object. It is the parsed POST body, the parsed GET query string, or the unchanged SNS, Google PubSub, Google Storage (...) event. The default is `{}`.
* The second argument, if called via HTTP is `{ method: GET|POST, headers: { ... } }`. The default is `{}`.
* You can import anything. Webpack is used to bundle all dependencies.
* You can export anywhere. Your endpoints can be spread over multiple files.
* Included per default are `aws-sdk` and `@google/`.


## Opening Issues

Feel free to open issues if you find bugs.

## Contributing

Always welcome! Please see CONTRIBUTING.md

## License

Apache 2.0
