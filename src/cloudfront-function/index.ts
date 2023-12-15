import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'

import type { Construct } from 'constructs'

/** Properties for creating a CloudFrontFunction */
export interface CloudFrontFunctionProps {
  /**
   * A name to identify the function.
   *
   * @default - generated from the `id`
   */
  readonly functionName?: string
  /**
   * A comment to describe the function.
   *
   * @default - same as `functionName`
   */
  readonly comment?: string
}

export interface ReplaceInUriCloudFrontFunctionProps {
  /** What to replace */
  pattern: RegExp | string

  /** What to place */
  replacement: string
}

export class CloudFrontFunction extends cloudfront.Function {
  static forSpa(scope: Construct, id: string, props?: CloudFrontFunctionProps) {
    return new CloudFrontFunction(scope, id, {
      ...props,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  if (!request.uri.includes('.')) {
    request.uri = '/index.html';
  }
  return request;
}
`),
    })
  }

  /**
   * Replace some part of request uri
   *
   * @example
   *
   * ```ts
   * // Replaces `/api/some-route` to `/some-route`
   * CloudFrontFunction.replaceInUri(scope, id, {
   *   pattern: /^\/api/,
   *   replacement: '',
   * })
   * ```
   *
   * @example
   *
   * ```ts
   * // Replaces `/api/aaa/some-route` to `/api/some-route`
   * CloudFrontFunction.replaceInUri(scope, id, {
   *   pattern: '^/api/aaa,
   *   replacement: '/api',
   * })
   * ```
   */
  static replaceInUri(
    scope: Construct,
    id: string,
    props: ReplaceInUriCloudFrontFunctionProps,
  ) {
    const escapedPattern = (
      typeof props.pattern === 'string'
        ? new RegExp(props.pattern)
        : props.pattern
    ).toString()

    return new CloudFrontFunction(scope, id, {
      ...props,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(${escapedPattern}, ${JSON.stringify(
    props.replacement,
  )});
  return request;
}
`),
    })
  }
}
