import https from 'node:https'
import { setTimeout as sleep } from 'node:timers/promises'
import { URL } from 'node:url'

import type {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceHandler,
  CloudFormationCustomResourceResponse,
  Context,
} from 'aws-lambda'

const logger = {
  prefix: '[Custom Resource Wrapper]',
  info(...args: Parameters<(typeof console)['info']>): void {
    console.log(this.prefix, ...args)
  },
  error(...args: Parameters<(typeof console)['error']>): void {
    console.error(this, this.prefix, ...args)
  },
}

type MaybePromise<T> = Promise<T> | T
export type CustomResourceStatus = 'SUCCESS' | 'FAILED'

type PatchCustomResourceEvent<T> = Omit<
  CloudFormationCustomResourceEvent,
  'ResourceProperties'
> & {
  ResourceProperties: {
    ServiceToken: string
  } & T
}

export function customResourceHandler<
  // See https://github.com/microsoft/TypeScript/issues/15300
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T extends Record<string, any> = Record<string, never>,
>(
  handler: (
    event: PatchCustomResourceEvent<T>,
    context: Context,
  ) => MaybePromise<CustomResourceStatus | unknown>,
): CloudFormationCustomResourceHandler {
  return async function (event, context) {
    logger.info('Starting execution')
    try {
      const response = await handler(
        event as PatchCustomResourceEvent<T>,
        context,
      )
      if (response === 'SUCCESS' || response === 'FAILED') {
        logger.info('Handler responded with', response)
      }
      if (response === 'FAILED') {
        throw new Error('Handler returned status "FAILED"')
      }

      await submitResponse({ status: 'SUCCESS', event })
    } catch (e) {
      logger.error(e)

      // Source: https://github.com/sst/sst/blob/366ffedaaa06aab93a032274a34bc87a24ce94c9/packages/sst/support/custom-resources/cfn-response.ts#L115-L128
      const reason = [
        typeof e === 'object' && e && 'message' in e ? e.message : e,
        `Logs: https://${
          process.env.AWS_REGION
        }.console.aws.amazon.com/cloudwatch/home?region=${
          process.env.AWS_REGION
        }#logsV2:log-groups/log-group/${encodeURIComponent(
          process.env.AWS_LAMBDA_LOG_GROUP_NAME!,
        )}/log-events/${encodeURIComponent(
          process.env.AWS_LAMBDA_LOG_STREAM_NAME!,
        )}`,
      ].join('\n')

      await submitResponse({ status: 'FAILED', event, reason })
    }
  }
}

export async function submitResponse({
  event,
  status,
  reason,
}: {
  event: CloudFormationCustomResourceEvent
  status: CustomResourceStatus
  reason?: string
}): Promise<void> {
  const responseBody = JSON.stringify({
    LogicalResourceId: event.LogicalResourceId,
    PhysicalResourceId:
      event.RequestType === 'Create'
        ? 'custom-resource-' + new Date().getTime()
        : event.PhysicalResourceId,
    RequestId: event.RequestId,
    StackId: event.StackId,
    Status: status,
    Reason: reason ?? 'good luck...',
  } satisfies CloudFormationCustomResourceResponse)

  logger.info('Submitting response:', responseBody)

  const parsedUrl = new URL(event.ResponseURL)
  await withRetries(() =>
    httpRequest(
      parsedUrl,
      {
        method: 'PUT',
        headers: {
          'content-type': '',
          'content-length': Buffer.byteLength(responseBody, 'utf-8'),
        },
      },
      responseBody,
    ),
  )
}

async function httpRequest(
  url: URL,
  options: https.RequestOptions,
  responseBody: string,
): Promise<void> {
  return await new Promise((resolve, reject) => {
    const req = https.request(url, options)
    req.on('error', reject)
    req.write(responseBody)
    req.end(resolve)
  })
}

async function withRetries(fn: () => Promise<unknown>): Promise<void> {
  const retriesCount = 5
  let ms = 2000
  for (let i = 0; i < retriesCount; i++) {
    try {
      await fn()
      return
    } catch (e) {
      logger.error('retry', i, 'errored:', e)
      await sleep(Math.floor(Math.random() * ms))
      ms *= 2
    }
  }

  throw new Error(`Can't send request after ${retriesCount} retries`)
}
