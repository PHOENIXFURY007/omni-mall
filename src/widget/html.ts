export const OMNI_MALL_WIDGET_URI = "ui://widget/omni-mall-products-v3.html";

export const omniMallWidgetHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f8fa;
      color: #17202a;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: #f7f8fa;
    }

    .shell {
      min-height: 100vh;
      padding: 14px;
    }

    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .title {
      min-width: 0;
    }

    h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.2;
      font-weight: 720;
      letter-spacing: 0;
    }

    .subtitle {
      margin-top: 4px;
      color: #5d6977;
      font-size: 12px;
      line-height: 1.35;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      border: 1px solid #d8dde5;
      padding: 5px 9px;
      font-size: 12px;
      color: #334155;
      background: #ffffff;
      white-space: nowrap;
    }

    .notice {
      border: 1px solid #d6e3f8;
      background: #eef5ff;
      color: #243b61;
      border-radius: 8px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.4;
      margin-bottom: 12px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
    }

    .card {
      border: 1px solid #dfe4eb;
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      display: grid;
      gap: 10px;
      min-width: 0;
      box-shadow: 0 1px 1px rgba(16, 24, 40, 0.04);
    }

    .cardHead {
      display: grid;
      gap: 5px;
      min-width: 0;
    }

    .thumb {
      width: 100%;
      aspect-ratio: 4 / 3;
      border-radius: 7px;
      background: #eef1f5;
      object-fit: cover;
      border: 1px solid #e5e9ef;
    }

    .merchant {
      font-size: 12px;
      color: #546174;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .productTitle {
      margin: 0;
      font-size: 15px;
      line-height: 1.25;
      font-weight: 680;
      overflow-wrap: anywhere;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: #5d6977;
      font-size: 12px;
    }

    .pill {
      border-radius: 999px;
      padding: 4px 7px;
      background: #f1f3f6;
      color: #344256;
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .price {
      font-size: 15px;
      font-weight: 720;
      color: #14213d;
    }

    .why {
      margin: 0;
      padding-left: 17px;
      color: #506073;
      font-size: 12px;
      line-height: 1.45;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    button {
      appearance: none;
      border: 1px solid #cfd6e0;
      border-radius: 7px;
      background: #ffffff;
      color: #1f2937;
      padding: 8px 10px;
      min-height: 34px;
      font-size: 13px;
      font-weight: 650;
      cursor: pointer;
    }

    button.primary {
      background: #14532d;
      border-color: #14532d;
      color: #ffffff;
    }

    .section {
      margin-top: 14px;
    }

    .section h2 {
      font-size: 13px;
      margin: 0 0 8px;
      color: #38465a;
      letter-spacing: 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #dfe4eb;
      border-radius: 8px;
      overflow: hidden;
      font-size: 12px;
    }

    th, td {
      border-bottom: 1px solid #edf0f4;
      padding: 8px;
      text-align: left;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    th {
      background: #f1f3f6;
      color: #38465a;
      font-weight: 700;
    }

    tr:last-child td { border-bottom: 0; }

    .empty {
      border: 1px dashed #cbd5e1;
      background: #ffffff;
      border-radius: 8px;
      padding: 18px;
      color: #5d6977;
      font-size: 13px;
      text-align: center;
    }
  </style>
</head>
<body>
  <main class="shell" id="root">
    <div class="empty">Run an OmniMall tool to render cross-merchant products here.</div>
  </main>
  <script>
    (function () {
      var root = document.getElementById("root");
      var payload = null;
      var bootstrapTimer = null;

      function notifyHeight() {
        try {
          if (window.openai && window.openai.notifyIntrinsicHeight) {
            window.openai.notifyIntrinsicHeight();
          }
        } catch (error) {
          console.warn("notifyIntrinsicHeight failed", error);
        }
      }

      function escapeHtml(value) {
        return String(value == null ? "" : value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }

      function formatKrw(value) {
        try {
          return new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(Number(value || 0));
        } catch (error) {
          return String(value || "");
        }
      }

      function productList(data) {
        if (!data) return [];
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.products)) return data.products;
        if (data.product) return [data.product];
        return [];
      }

      function isRecord(value) {
        return value && typeof value === "object";
      }

      function isRenderablePayload(value) {
        if (!isRecord(value)) return false;
        if (Array.isArray(value.items) || Array.isArray(value.products) || value.product) return true;
        if (Array.isArray(value.merchants) || Array.isArray(value.results) || Array.isArray(value.comparisonRows)) return true;
        return value.type === "checkout_link";
      }

      function resolvePayload(value, depth) {
        if (!isRecord(value) || depth > 4) return null;
        if (isRenderablePayload(value)) return value;

        var candidates = [
          value.structuredContent,
          value.toolOutput,
          value.toolResult,
          value.toolResponse,
          value.output,
          value.result,
          value.payload,
          value.data,
          value.params,
          value.globals,
        ];

        if (isRecord(value.result)) {
          candidates.push(value.result.structuredContent, value.result.toolOutput, value.result.output, value.result.payload);
        }
        if (isRecord(value.params)) {
          candidates.push(value.params.structuredContent, value.params.toolOutput, value.params.result, value.params.payload);
        }
        if (isRecord(value.globals)) {
          candidates.push(value.globals.toolOutput, value.globals.structuredContent, value.globals.toolResult, value.globals.output);
        }

        for (var index = 0; index < candidates.length; index += 1) {
          var resolved = resolvePayload(candidates[index], depth + 1);
          if (resolved) return resolved;
        }
        return null;
      }

      function hostSnapshot() {
        var host = window.openai || {};
        return {
          toolOutput: host.toolOutput || {},
          structuredContent: host.structuredContent || {},
          toolInput: host.toolInput || {},
          widgetState: host.widgetState || {},
          params: host.params || {},
        };
      }

      function hydrate(value) {
        var nextPayload = resolvePayload(value, 0);
        if (!nextPayload) {
          nextPayload = resolvePayload(hostSnapshot(), 0);
        }
        if (!nextPayload) return false;
        payload = nextPayload;
        render();
        return true;
      }

      function scheduleBootstrapHydration(attempt) {
        if (bootstrapTimer !== null) {
          window.clearTimeout(bootstrapTimer);
          bootstrapTimer = null;
        }
        if (attempt > 20) return;
        bootstrapTimer = window.setTimeout(function () {
          bootstrapTimer = null;
          if (!hydrate(hostSnapshot())) {
            scheduleBootstrapHydration(attempt + 1);
          }
        }, attempt === 0 ? 0 : 150);
      }

      function statusText(data) {
        if (!data) return "OmniMall";
        if (data.type === "product_search") return "Search";
        if (data.type === "similar_products") return "Graph";
        if (data.type === "product_comparison") return "Compare";
        if (data.type === "checkout_link") return "Checkout";
        if (data.type === "merchant_adapter_preview") return "Adapters";
        if (data.type === "merchant_mapping_validation") return "Validation";
        return "OmniMall";
      }

      function renderProducts(data) {
        var products = productList(data);
        if (!products.length) return "";
        return '<div class="grid">' + products.map(function (product) {
          var why = Array.isArray(product.why) ? product.why : [];
          var score = product.score ? '<span class="pill">score ' + escapeHtml(product.score) + '</span>' : "";
          var stock = product.stockStatus ? '<span class="pill">' + escapeHtml(String(product.stockStatus).replace(/_/g, " ")) + '</span>' : "";
          var tags = Array.isArray(product.tags) ? product.tags.slice(0, 3).map(function (tag) {
            return '<span class="pill">' + escapeHtml(tag) + '</span>';
          }).join("") : "";
          var image = product.imageUrl ? '<img class="thumb" src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.title || "Product image") + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />' : "";
          return '<article class="card">' +
            image +
            '<div class="cardHead">' +
              '<div class="merchant">' + escapeHtml(product.merchantName || product.merchantId || "") + ' / ' + escapeHtml(product.domain || "") + '</div>' +
              '<h3 class="productTitle">' + escapeHtml(product.title || "Untitled product") + '</h3>' +
            '</div>' +
            '<div class="meta"><span class="pill">' + escapeHtml(product.brand || "") + '</span>' + stock + score + tags + '</div>' +
            '<div class="price">' + formatKrw(product.price) + '</div>' +
            (why.length ? '<ul class="why">' + why.map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join("") + '</ul>' : "") +
            '<div class="actions">' +
              '<button data-action="open" data-url="' + escapeHtml(product.productUrl || "") + '">Open</button>' +
              '<button data-action="similar" data-id="' + escapeHtml(product.productId || "") + '">Similar</button>' +
              '<button class="primary" data-action="checkout" data-id="' + escapeHtml(product.productId || "") + '">Checkout</button>' +
            '</div>' +
          '</article>';
        }).join("") + '</div>';
      }

      function renderComparison(data) {
        if (!data || !Array.isArray(data.comparisonRows) || !Array.isArray(data.products)) return "";
        var header = '<tr><th>Field</th>' + data.products.map(function (product) {
          return '<th>' + escapeHtml(product.title) + '</th>';
        }).join("") + '</tr>';
        var rows = data.comparisonRows.map(function (row) {
          return '<tr><td>' + escapeHtml(row.label) + '</td>' + data.products.map(function (product) {
            return '<td>' + escapeHtml(row.values && row.values[product.productId] ? row.values[product.productId] : "-") + '</td>';
          }).join("") + '</tr>';
        }).join("");
        return '<section class="section"><h2>Comparison</h2><table>' + header + rows + '</table></section>';
      }

      function renderGraph(data) {
        if (!data || !Array.isArray(data.graph) || !data.graph.length) return "";
        return '<section class="section"><h2>Graph signals</h2><div class="grid">' + data.graph.slice(0, 6).map(function (edge) {
          return '<div class="card">' +
            '<div class="merchant">' + escapeHtml(edge.relation) + ' / weight ' + escapeHtml(edge.weight) + '</div>' +
            '<div class="productTitle">' + escapeHtml(edge.sourceProductId) + ' to ' + escapeHtml(edge.targetProductId) + '</div>' +
            '<div class="subtitle">' + escapeHtml(edge.reason) + '</div>' +
          '</div>';
        }).join("") + '</div></section>';
      }

      function renderAdapters(data) {
        if (!data || !Array.isArray(data.merchants)) return "";
        return '<div class="grid">' + data.merchants.map(function (merchant) {
          return '<article class="card">' +
            '<div class="merchant">' + escapeHtml(merchant.merchantId) + '</div>' +
            '<h3 class="productTitle">' + escapeHtml(merchant.displayName) + '</h3>' +
            '<div class="meta"><span class="pill">' + escapeHtml(merchant.status) + '</span><span class="pill">' + escapeHtml(merchant.authProfile) + '</span></div>' +
            '<div class="subtitle">' + escapeHtml((merchant.capabilities || []).join(", ")) + '</div>' +
          '</article>';
        }).join("") + '</div>';
      }

      function renderValidation(data) {
        if (!data || !Array.isArray(data.results)) return "";
        return '<div class="grid">' + data.results.map(function (result) {
          return '<article class="card">' +
            '<div class="merchant">' + escapeHtml(result.merchantId) + '</div>' +
            '<h3 class="productTitle">' + (result.ok ? "Mapping ready" : "Needs work") + '</h3>' +
            '<div class="meta"><span class="pill">score ' + escapeHtml(result.score) + '</span><span class="pill">' + escapeHtml(result.onboardingEstimate) + '</span></div>' +
            '<div class="subtitle">' + escapeHtml((result.warnings || []).join(" ")) + '</div>' +
          '</article>';
        }).join("") + '</div>';
      }

      function render() {
        var data = payload || resolvePayload(hostSnapshot(), 0);
        if (!data) {
          root.innerHTML = '<div class="empty">Run an OmniMall tool to render cross-merchant products here.</div>';
          notifyHeight();
          return;
        }
        var notice = data.zeroResult && data.zeroResult.occurred
          ? '<div class="notice">' + escapeHtml(data.zeroResult.message) + '</div>'
          : "";
        if (data.type === "checkout_link") {
          notice = '<div class="notice">' + escapeHtml(data.reason || "") + (data.checkoutUrl ? ' <button data-action="open" data-url="' + escapeHtml(data.checkoutUrl) + '">Open checkout</button>' : "") + '</div>';
        }
        root.innerHTML =
          '<div class="topbar"><div class="title"><h1>OmniMall</h1><div class="subtitle">Cross-merchant product search, graph exploration, and checkout handoff.</div></div><span class="badge">' + escapeHtml(statusText(data)) + '</span></div>' +
          notice +
          renderProducts(data) +
          renderComparison(data) +
          renderAdapters(data) +
          renderValidation(data) +
          renderGraph(data);
        notifyHeight();
      }

      async function openExternal(url) {
        if (!url) return;
        try {
          if (window.openai && window.openai.openExternal) {
            await window.openai.openExternal({ href: url, redirectUrl: true });
            return;
          }
        } catch (error) {
          console.warn("openExternal failed", error);
        }
        window.open(url, "_blank", "noopener,noreferrer");
      }

      root.addEventListener("click", async function (event) {
        var target = event.target && event.target.closest ? event.target.closest("button[data-action]") : null;
        if (!target) return;
        var action = target.getAttribute("data-action");
        if (action === "open") {
          await openExternal(target.getAttribute("data-url"));
        }
        if (action === "similar" && window.openai && window.openai.callTool) {
          await window.openai.callTool("explore_similar_products", { productId: target.getAttribute("data-id"), limit: 6 });
        }
        if (action === "checkout" && window.openai && window.openai.callTool) {
          await window.openai.callTool("create_checkout_link", { productId: target.getAttribute("data-id"), confirmed: true });
        }
      });

      window.addEventListener("message", function (event) {
        if (event.source && event.source !== window.parent) return;
        var data = event.data || {};
        if (data.type === "openai:set_globals" || data.method === "ui/notifications/tool-result" || data.method === "ui/notifications/tool-input" || data.method === "ui/notifications/tool-input-partial") {
          hydrate(data);
        }
      }, { passive: true });

      window.addEventListener("openai:set_globals", function (event) {
        var detail = event.detail || {};
        var globals = detail.globals || {};
        hydrate({ structuredContent: globals.toolOutput || globals.structuredContent || {}, globals: globals });
      }, { passive: true });

      scheduleBootstrapHydration(0);
      render();
    })();
  </script>
</body>
</html>`;
