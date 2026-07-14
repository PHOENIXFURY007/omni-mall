import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { OMNI_MALL_WIDGET_URI, omniMallWidgetHtml } from "../widget/html.js";

export function registerWidgetResources(server: McpServer, appOrigin: string): void {
  const resourceDomains = [
    appOrigin,
    "https://images-kr.amoremall.com",
    "https://cdn-image.oliveyoung.com",
    "https://static1.e-himart.co.kr",
    "https://static2.e-himart.co.kr",
    "https://product-image.kurly.com",
    "https://3p-image.kurly.com",
    "https://img-cf.kurly.com",
    "https://res.kurly.com",
    "https://d2c3d01lcpw2ui.cloudfront.net",
    "https://cdn.shopify.com",
    "https://placehold.co",
  ];
  const redirectDomains = [
    "https://example.com",
    "https://www.amoremall.com",
    "https://global.oliveyoung.com",
    "https://www.e-himart.co.kr",
    "https://www.kurly.com",
    "https://www.stylekorean.com",
    "https://us.sulwhasoo.com",
    "https://www.innisfree.jp",
  ];

  registerAppResource(
    server,
    "omni-mall-products-widget",
    OMNI_MALL_WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: OMNI_MALL_WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: omniMallWidgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [appOrigin],
                resourceDomains,
                redirectDomains,
              },
            },
            "openai/widgetDescription": "Render cross-merchant OmniMall product search, graph recommendations, comparison, adapter validation, and checkout handoff.",
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
              connect_domains: [appOrigin],
              resource_domains: resourceDomains,
              redirect_domains: redirectDomains,
            },
          },
        },
      ],
    }),
  );
}
