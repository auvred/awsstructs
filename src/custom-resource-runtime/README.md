# custom-resource-runtime

## `customResourceHandler`

Alternative of [`cfn-response`](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cfn-lambda-function-code-cfnresponsemodule.html)

A safe wrapper for a custom resource handler. It wraps the main handler code in a `try {...} catch {...}` block and puts a response to the CFN bucket even if handler threw an error.

Example:

```ts
import { customResourceHandler } from '@auvred/awsstructs/custom-resource-runtime'

interface CustomProperties {
  someData: string
}

export const handler = customResourceHandler<CustomProperties>(async event => {
  await someCustomResourceStuff(event.ResourceProperties.someData)
})

async function someCustomResourceStuff(props: ResourceProperties): Promise<void> {
  // ...
}
```
