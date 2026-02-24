import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { DataLoaderModule } from './dataloader.module';
import { DataLoaderService } from './dataloader.service';
import { DateTimeScalar, DecimalScalar } from './scalars/date.scalar';
import { ComplexityPlugin } from './plugins/complexity.plugin';

// Resolvers
import { OrderModule } from '@modules/order/order.module';
import { DashboardModule } from '@modules/dashboard/dashboard.module';

@Module({
  imports: [
    DataLoaderModule,
    NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService, DataLoaderService],
      useFactory: (
        configService: ConfigService,
        dataLoaderService: DataLoaderService,
      ) => {
        const isProduction = configService.get('app.env') === 'production';

        return {
          // Code-first: auto-generate the schema from TypeScript decorators
          autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
          sortSchema: true,

          // Playground & introspection controlled by config
          playground: !isProduction,
          introspection: configService.get<boolean>('GRAPHQL_INTROSPECTION', false),

          // Path for the GraphQL endpoint (coexists with REST at /api/v1)
          path: '/graphql',

          // Context factory: runs per-request, attaches DataLoaders + auth
          context: ({ req, res, connection }: { req: any; res: any; connection: any }) => {
            // For subscriptions (WebSocket), use connection context
            if (connection) {
              return {
                req: connection.context,
                loaders: dataLoaderService.createLoaders(),
              };
            }
            return {
              req,
              res,
              loaders: dataLoaderService.createLoaders(),
            };
          },

          // Subscriptions via WebSocket
          subscriptions: {
            'graphql-ws': {
              path: '/graphql',
              onConnect: (context: any) => {
                const { connectionParams } = context;
                // Pass auth token through to the context so guards can read it
                if (connectionParams?.Authorization) {
                  return {
                    req: {
                      headers: {
                        authorization: connectionParams.Authorization,
                      },
                    },
                  };
                }
                return {};
              },
            },
          },

          // Error formatting: hide internal details in production
          formatError: (error) => {
            if (isProduction) {
              // Strip stack trace and internal extensions in production
              return {
                message: error.message,
                extensions: {
                  code: error.extensions?.code ?? 'INTERNAL_SERVER_ERROR',
                },
              };
            }
            return error;
          },
        };
      },
    }),
    OrderModule,
    DashboardModule,
  ],
  providers: [
    // Scalars
    DateTimeScalar,
    DecimalScalar,

    // Complexity limiter plugin
    ComplexityPlugin,

    // Domain resolvers
  ],
  exports: [DataLoaderModule],
})
export class GraphQLModule { }
