import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

export class APIStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const lambdaFunctionDefault = new lambda.Function(this, 'MyLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'default.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    const lambdaFunctionSignedURL = new lambda.Function(this, 'SignedURLLambdaFunction', {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'signedURL.handler',
      code: lambda.Code.fromAsset('lambda'),
    });

    const websocketApi = new apigatewayv2.WebSocketApi(this, 'MyWebSocketApi');

    websocketApi.addRoute('$connect', {
      integration: new WebSocketLambdaIntegration('ConnectIntegration', lambdaFunctionDefault),
    });

    websocketApi.addRoute('ping', {
      integration: new WebSocketLambdaIntegration('DisconnectIntegration', lambdaFunctionDefault),
      returnResponse: true,
    });

    websocketApi.addRoute('getSignedURL', {
      integration: new WebSocketLambdaIntegration('GetSignedURLIntegration', lambdaFunctionSignedURL),
      returnResponse: true,
    });

    const stage = new apigatewayv2.WebSocketStage(this, 'MyWebSocketStage', {
      webSocketApi: websocketApi,
      stageName: 'prod',
      autoDeploy: true,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: stage.url,
    });
  }
}