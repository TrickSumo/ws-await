#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { APIStack } from './constructs/api-stack';

const app = new cdk.App();

new APIStack(app, "APIStack");