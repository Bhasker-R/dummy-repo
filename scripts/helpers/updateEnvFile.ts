import fs from 'fs'
import dotenv from 'dotenv'
import path from 'path'

export default function updateEnvFile(values: { [key: string]: any }) {
  const envFilePath = path.resolve('.env')
  const outputKeyPrefix = ''

  const data = fs.readFileSync(envFilePath)
  const valuesToAdd = { ...values }

  const result = data
    .toString()
    .split('\n')
    .map((str) => {
      if (str) {
        let [key] = str.split('=')

        if (outputKeyPrefix) {
          key = key.replace(outputKeyPrefix, '')
        }

        if (key in values) {
          delete valuesToAdd[key]
          return `${outputKeyPrefix}${key}=${values[key]}`
        }
      }

      return str
    })

  Object.keys(valuesToAdd).forEach((key) => {
    const value = valuesToAdd[key]

    result.push(`${outputKeyPrefix}${key}=${value}`)
  })

  fs.writeFileSync(envFilePath, result.join('\n'), 'utf8')

  // override process.env
  const envConfig = dotenv.parse(fs.readFileSync(envFilePath))

  for (const k in envConfig) {
    process.env[k] = envConfig[k]
  }
}
