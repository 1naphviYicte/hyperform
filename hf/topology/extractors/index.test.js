const { extractRegion } = require('./index')

describe('provider/region string extractor', () => {
  describe('extracts correctly', () => {
    test('arn 1', () => {
      const input = 'arn:aws:lambda:us-east-2:735406098573:function:myinc'
      const toBeTested = () => extractRegion(input)
      const expectedOutput = 'us-east-2'
      const res = toBeTested()

      expect(res).toBe(expectedOutput)
    })

    test('arn 2', () => {
      const input = 'arn:aws:lambda:us-west-2:735406098573:function:myincinc'
      const toBeTested = () => extractRegion(input)
      const expectedOutput = 'us-west-2'
      const res = toBeTested()

      expect(res).toBe(expectedOutput)
    })
  })
})
