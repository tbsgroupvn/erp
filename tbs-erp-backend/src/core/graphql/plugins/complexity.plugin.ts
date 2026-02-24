import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  fieldExtensionsEstimator,
  getComplexity,
  simpleEstimator,
} from 'graphql-query-complexity';
import { Logger } from '@nestjs/common';

const MAX_COMPLEXITY = 1000;
const MAX_DEPTH = 7;

@Plugin()
export class ComplexityPlugin implements ApolloServerPlugin {
  private readonly logger = new Logger(ComplexityPlugin.name);

  constructor(private gqlSchemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const { schema } = this.gqlSchemaHost;
    const logger = this.logger;

    return {
      async didResolveOperation({ request, document }) {
        // Check query depth
        const depth = getQueryDepth(document);
        if (depth > MAX_DEPTH) {
          throw new GraphQLError(
            `Query depth of ${depth} exceeds the maximum allowed depth of ${MAX_DEPTH}`,
            {
              extensions: {
                code: 'QUERY_TOO_DEEP',
                maxDepth: MAX_DEPTH,
                actualDepth: depth,
              },
            },
          );
        }

        // Check query complexity
        const complexity = getComplexity({
          schema,
          operationName: request.operationName,
          query: document,
          variables: request.variables,
          estimators: [
            fieldExtensionsEstimator(),
            simpleEstimator({ defaultComplexity: 1 }),
          ],
        });

        if (complexity > MAX_COMPLEXITY) {
          throw new GraphQLError(
            `Query complexity of ${complexity} exceeds the maximum allowed complexity of ${MAX_COMPLEXITY}`,
            {
              extensions: {
                code: 'QUERY_TOO_COMPLEX',
                maxComplexity: MAX_COMPLEXITY,
                actualComplexity: complexity,
              },
            },
          );
        }

        logger.debug(`Query complexity: ${complexity}, depth: ${depth}`);
      },
    };
  }
}

/**
 * Calculate the maximum depth of a GraphQL query document.
 */
function getQueryDepth(document: any): number {
  let maxDepth = 0;

  function traverse(node: any, currentDepth: number) {
    if (!node) return;

    if (node.kind === 'Field') {
      currentDepth++;
      if (currentDepth > maxDepth) {
        maxDepth = currentDepth;
      }
    }

    if (node.selectionSet) {
      for (const selection of node.selectionSet.selections) {
        traverse(selection, currentDepth);
      }
    }

    if (node.definitions) {
      for (const definition of node.definitions) {
        traverse(definition, 0);
      }
    }
  }

  traverse(document, 0);
  return maxDepth;
}
