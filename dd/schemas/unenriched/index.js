const joi = require('joi')

const task = joi.object({
  forEachIn: joi.string().required(),
  do: joi.string(),
  upload: joi.string().required(),
  config: joi.object({
    amazon: joi.object({
      role: joi.string().required(),
      timeout: joi.number(),
    }),
  }).required(),

})

const unenrichedschemas = {
  task,
}

module.exports = {
  unenrichedschemas,
}
