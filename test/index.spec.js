/**
 * Created by msills on 4/12/17.
 */

import AWS from 'aws-sdk-mock'
import assert from 'assert'
import { expect } from 'chai'
import Serverless from 'serverless'
import ServerlessAWSResolvers from '../src'

describe('ServerlessAWSResolvers', () => {
  const DEFAULT_VALUE = 'MY_VARIABLE_NAME'

  const CONFIGS = {
    KINESIS: { scope: 'kinesis', service: 'Kinesis', method: 'describeStream', topLevel: 'StreamDescription' },
    ESS: { scope: 'ess', service: 'ES', method: 'describeElasticsearchDomain', topLevel: 'DomainStatus' },
    RDS: {
      scope: 'rds',
      service: 'RDS',
      method: 'describeDBInstances',
      topLevel: 'DBInstances',
      testKey: 'testKey',
      testValue: 'test-value',
      serviceValue: [{ testKey: 'test-value' }]
    }
  }

  afterEach(() => {
    AWS.restore()
  })

  function createFakeServerless() {
    const sls = new Serverless()
    // Attach the plugin
    sls.pluginManager.addPlugin(ServerlessAWSResolvers)
    sls.init()
    return sls
  }

  async function testResolve({ scope, service, method, topLevel, testKey, testValue, serviceValue }) {
    testKey = testKey || 'TEST_KEY'
    testValue = testValue || 'TEST_VALUE'
    if (!serviceValue) {
      serviceValue = {}
      serviceValue[testKey] = testValue
    }

    const serverless = createFakeServerless()

    AWS.mock(service, method, (params, callback) => {
      const result = {}
      result[topLevel] = serviceValue
      callback(null, result)
    })

    serverless.service.custom.myVariable = `\${aws:${scope}:test-name:${testKey}}`
    await serverless.variables.populateService()
    assert.equal(serverless.service.custom.myVariable, testValue)
  }

  function testNotFound({ scope, service, method }) {
    const serverless = createFakeServerless()

    AWS.mock(service, method, (params, callback) => {
      callback(new Error('Not found'))
    })

    serverless.service.custom.myVariable = `\${aws:${scope}:test-name:TEST_KEY}`
    expect(serverless.variables.populateService).to.throw(Error)
  }

  it('should pass through non-AWS variables', async () => {
    const serverless = createFakeServerless()
    serverless.service.custom.myVar = DEFAULT_VALUE
    await serverless.variables.populateService()
    assert.equal(serverless.service.custom.myVar, DEFAULT_VALUE)
  })

  for (const service of Object.keys(CONFIGS)) {
    it(`should resolve ${service}`, () => { testResolve(CONFIGS[service]) })
    it(`should throw for ${service} not found`, () => { testNotFound(CONFIGS[service]) })
  }

  it('should throw for keys that are not present', () => {
    const serverless = createFakeServerless()

    AWS.mock('Kinesis', 'describeStream', (params, callback) => {
      callback(null, { StreamDescription: { StreamARN: DEFAULT_VALUE } })
    })

    serverless.service.custom.foo = '${aws:kinesis:test-stream:BAD_KEY}' // eslint-disable-line
    expect(serverless.variables.populateService).to.throw(Error)
  })
})
