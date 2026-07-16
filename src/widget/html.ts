export const OMNI_MALL_WIDGET_URI = "ui://widget/omni-mall-products-graph-ui-v2.html";

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

    .graphNetwork {
      position: relative;
      min-height: 420px;
      border: 1px solid #dfe4eb;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.55);
    }

    .graphCanvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .graphLine {
      stroke: #94a3b8;
      stroke-width: 2.2;
      opacity: 0.9;
      vector-effect: non-scaling-stroke;
    }

    .graphLine.similar { stroke: #15803d; }
    .graphLine.substitute { stroke: #2563eb; }
    .graphLine.complement { stroke: #b45309; }

    .graphText {
      fill: #334155;
      font-size: 3.1px;
      font-weight: 720;
      paint-order: stroke;
      stroke: #ffffff;
      stroke-width: 0.85px;
      stroke-linejoin: round;
    }

    .graphNode {
      position: absolute;
      width: 118px;
      min-height: 126px;
      transform: translate(-50%, -50%);
      border: 1px solid #d8dee8;
      background: rgba(255, 255, 255, 0.96);
      border-radius: 8px;
      padding: 7px;
      display: grid;
      gap: 6px;
      justify-items: center;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.1);
      z-index: 2;
    }

    .graphNode.seed {
      width: 136px;
      min-height: 146px;
      border-color: #14532d;
      box-shadow: 0 12px 28px rgba(20, 83, 45, 0.18);
    }

    .graphNodeImage {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
      background: #eef1f5;
      border: 1px solid #e5e9ef;
    }

    .graphNode.seed .graphNodeImage {
      width: 78px;
      height: 78px;
    }

    .graphNodeTitle {
      width: 100%;
      color: #17202a;
      font-size: 11px;
      line-height: 1.22;
      font-weight: 720;
      text-align: center;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }

    .graphNodeMeta {
      width: 100%;
      color: #64748b;
      font-size: 10px;
      line-height: 1.2;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .graphLegend {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 8px;
      font-size: 12px;
    }

    .graphLegend .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    .legendDot {
      width: 9px;
      height: 9px;
      border-radius: 999px;
      display: inline-block;
      background: #94a3b8;
    }

    .legendDot.similar { background: #15803d; }
    .legendDot.substitute { background: #2563eb; }
    .legendDot.complement { background: #b45309; }

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

    button:disabled {
      cursor: wait;
      opacity: 0.68;
    }

    .thumbButton {
      appearance: none;
      width: 100%;
      display: block;
      padding: 0;
      border: 0;
      min-height: 0;
      border-radius: 7px;
      background: transparent;
      cursor: pointer;
    }

    .thumbButton .thumb {
      display: block;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .thumbButton:hover .thumb,
    .thumbButton:focus-visible .thumb {
      border-color: #14532d;
      box-shadow: 0 8px 20px rgba(20, 83, 45, 0.13);
      transform: translateY(-1px);
    }

    button.graphNode {
      padding: 7px;
      color: #17202a;
      text-align: center;
      cursor: pointer;
      transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
    }

    button.graphNode:hover,
    button.graphNode:focus-visible {
      border-color: #14532d;
      box-shadow: 0 14px 30px rgba(20, 83, 45, 0.18);
      transform: translate(-50%, -50%) scale(1.02);
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

    .detailPanel {
      border: 1px solid #d4dde9;
      background: #ffffff;
      border-radius: 8px;
      padding: 12px;
      margin: 0 0 12px;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
    }

    .detailHeader {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 10px;
    }

    .detailHeader h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.25;
      overflow-wrap: anywhere;
    }

    .detailBody {
      display: grid;
      grid-template-columns: 136px minmax(0, 1fr);
      gap: 12px;
      align-items: start;
    }

    .detailImage {
      width: 136px;
      aspect-ratio: 1;
      object-fit: cover;
      border: 1px solid #e5e9ef;
      border-radius: 8px;
      background: #eef1f5;
    }

    .detailFacts {
      display: grid;
      gap: 8px;
      min-width: 0;
      font-size: 12px;
      color: #344256;
    }

    .factGrid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 7px;
    }

    .fact {
      border: 1px solid #edf0f4;
      border-radius: 7px;
      padding: 7px;
      background: #f8fafc;
      min-width: 0;
    }

    .factLabel {
      color: #64748b;
      font-size: 10px;
      line-height: 1.2;
      margin-bottom: 2px;
    }

    .factValue {
      color: #17202a;
      font-weight: 680;
      overflow-wrap: anywhere;
    }

    .attributeList {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    @media (max-width: 560px) {
      .detailBody {
        grid-template-columns: 1fr;
      }

      .detailImage {
        width: 100%;
        max-height: 220px;
      }

      .graphNetwork {
        min-height: 500px;
      }

      .graphNode {
        width: 96px;
        min-height: 112px;
        padding: 6px;
      }

      .graphNode.seed {
        width: 112px;
        min-height: 128px;
      }

      .graphNodeImage {
        width: 54px;
        height: 54px;
      }

      .graphNode.seed .graphNodeImage {
        width: 64px;
        height: 64px;
      }
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
      var selectedProductId = null;

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

      function displayValue(value) {
        if (Array.isArray(value)) return value.join(", ");
        if (value && typeof value === "object") return JSON.stringify(value);
        if (typeof value === "boolean") return value ? "yes" : "no";
        return value == null || value === "" ? "-" : String(value);
      }

      function merchantMix(data) {
        var names = [];
        var seen = {};
        productList(data).concat(Array.isArray(data && data.graphProducts) ? data.graphProducts : []).forEach(function (product) {
          var name = product && (product.merchantName || product.merchantId);
          if (name && !seen[name]) {
            seen[name] = true;
            names.push(name);
          }
        });
        return names;
      }

      function productList(data) {
        if (!data) return [];
        if (Array.isArray(data.items)) return data.items;
        if (Array.isArray(data.products)) return data.products;
        if (data.product) return [data.product];
        return [];
      }

      function productIndex(data) {
        var index = {};
        var collections = [
          productList(data),
          Array.isArray(data && data.graphProducts) ? data.graphProducts : [],
          data && data.seed ? [data.seed] : [],
          data && data.product ? [data.product] : [],
        ];
        collections.forEach(function (products) {
          products.forEach(function (product) {
            if (product && product.productId) index[product.productId] = product;
          });
        });
        return index;
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

      function renderMerchantMix(data) {
        var names = merchantMix(data);
        if (names.length < 2) return "";
        return '<div class="meta" style="margin-bottom:12px"><span class="pill">Sites shown</span>' +
          names.slice(0, 8).map(function (name) {
            return '<span class="pill">' + escapeHtml(name) + '</span>';
          }).join("") +
          (names.length > 8 ? '<span class="pill">+' + escapeHtml(names.length - 8) + ' more</span>' : "") +
        '</div>';
      }

      function renderProductDetails(data) {
        if (!selectedProductId) return "";
        var product = productIndex(data)[selectedProductId];
        if (!product) {
          selectedProductId = null;
          return "";
        }

        var category = Array.isArray(product.categoryPath) ? product.categoryPath.join(" > ") : "";
        var tags = Array.isArray(product.tags) ? product.tags.slice(0, 8).map(function (tag) {
          return '<span class="pill">' + escapeHtml(tag) + '</span>';
        }).join("") : "";
        var attributes = product.attributes && typeof product.attributes === "object"
          ? Object.keys(product.attributes).slice(0, 10).map(function (key) {
            return '<span class="pill">' + escapeHtml(key) + ': ' + escapeHtml(displayValue(product.attributes[key])) + '</span>';
          }).join("")
          : "";
        var image = product.imageUrl
          ? '<button class="thumbButton" data-action="open" data-url="' + escapeHtml(product.productUrl || "") + '" aria-label="Open ' + escapeHtml(product.title || "product") + '">' +
              '<img class="detailImage" src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.title || "Product image") + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />' +
            '</button>'
          : '<div class="detailImage" aria-hidden="true"></div>';

        return '<section class="detailPanel" aria-live="polite">' +
          '<div class="detailHeader">' +
            '<div><div class="merchant">' + escapeHtml(product.merchantName || product.merchantId || "") + ' / ' + escapeHtml(product.domain || "") + '</div>' +
            '<h2>' + escapeHtml(product.title || "Untitled product") + '</h2></div>' +
            '<button data-action="close-details" aria-label="Close product details">Close</button>' +
          '</div>' +
          '<div class="detailBody">' +
            image +
            '<div class="detailFacts">' +
              '<div class="factGrid">' +
                '<div class="fact"><div class="factLabel">Brand</div><div class="factValue">' + escapeHtml(product.brand || "-") + '</div></div>' +
                '<div class="fact"><div class="factLabel">Price</div><div class="factValue">' + formatKrw(product.price) + '</div></div>' +
                '<div class="fact"><div class="factLabel">Stock</div><div class="factValue">' + escapeHtml(String(product.stockStatus || "-").replace(/_/g, " ")) + '</div></div>' +
                '<div class="fact"><div class="factLabel">Rating</div><div class="factValue">' + escapeHtml(product.rating || "-") + ' (' + escapeHtml(product.reviewCount || 0) + ' reviews)</div></div>' +
                '<div class="fact"><div class="factLabel">Category</div><div class="factValue">' + escapeHtml(category || "-") + '</div></div>' +
                '<div class="fact"><div class="factLabel">Metadata</div><div class="factValue">' + escapeHtml(product.metadataQuality || "-") + '</div></div>' +
              '</div>' +
              (tags ? '<div class="attributeList">' + tags + '</div>' : "") +
              (attributes ? '<div class="attributeList">' + attributes + '</div>' : "") +
              '<div class="actions">' +
                '<button data-action="open" data-url="' + escapeHtml(product.productUrl || "") + '">Open merchant page</button>' +
                '<button data-action="similar" data-id="' + escapeHtml(product.productId || "") + '">Show graph</button>' +
                '<button class="primary" data-action="checkout" data-id="' + escapeHtml(product.productId || "") + '">Checkout</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>';
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
          var image = product.imageUrl
            ? '<button class="thumbButton" data-action="details" data-id="' + escapeHtml(product.productId || "") + '" aria-label="Show details for ' + escapeHtml(product.title || "product") + '">' +
                '<img class="thumb" src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(product.title || "Product image") + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />' +
              '</button>'
            : "";
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
        var productsById = productIndex(data);
        var seed = data.seed || productList(data)[0] || productsById[data.graph[0].sourceProductId];
        var seedId = seed && seed.productId ? seed.productId : data.graph[0].sourceProductId;
        var relatedEdges = data.graph.filter(function (edge) {
          return edge.sourceProductId === seedId || edge.targetProductId === seedId;
        });
        if (!relatedEdges.length) relatedEdges = data.graph.slice(0, 8);
        relatedEdges = relatedEdges.slice(0, 8);

        function clamp(value, min, max) {
          return Math.max(min, Math.min(max, value));
        }

        function relationClass(value) {
          var relation = String(value || "similar").toLowerCase();
          return relation === "substitute" || relation === "complement" ? relation : "similar";
        }

        var nodes = [{
          id: seedId,
          product: seed || productsById[seedId],
          x: 50,
          y: 50,
          seed: true,
        }];
        var seenNodeIds = {};
        seenNodeIds[seedId] = true;

        relatedEdges.forEach(function (edge, index) {
          var sourceConnected = edge.sourceProductId === seedId;
          var neighborId = sourceConnected ? edge.targetProductId : edge.sourceProductId;
          if (!neighborId || seenNodeIds[neighborId]) return;

          var angle = (-90 + ((360 / Math.max(relatedEdges.length, 1)) * index)) * Math.PI / 180;
          var radiusX = relatedEdges.length <= 4 ? 30 : 36;
          var radiusY = relatedEdges.length <= 4 ? 29 : 34;
          nodes.push({
            id: neighborId,
            product: productsById[neighborId],
            x: clamp(50 + Math.cos(angle) * radiusX, 14, 86),
            y: clamp(50 + Math.sin(angle) * radiusY, 18, 82),
            seed: false,
          });
          seenNodeIds[neighborId] = true;
        });

        var nodesById = {};
        nodes.forEach(function (node) {
          nodesById[node.id] = node;
        });

        function graphNode(node) {
          var product = node.product || {};
          var title = product.title || node.id;
          var merchant = product.merchantName || product.merchantId || "Graph node";
          var image = product.imageUrl
            ? '<img class="graphNodeImage" src="' + escapeHtml(product.imageUrl) + '" alt="' + escapeHtml(title) + '" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" />'
            : '<div class="graphNodeImage" aria-hidden="true"></div>';
          return '<button class="graphNode' + (node.seed ? " seed" : "") + '" data-action="details" data-id="' + escapeHtml(product.productId || node.id || "") + '" style="left:' + escapeHtml(node.x) + '%;top:' + escapeHtml(node.y) + '%" aria-label="Show details for ' + escapeHtml(title) + '">' +
            image +
            '<div class="graphNodeTitle">' + escapeHtml(title) + '</div>' +
            '<div class="graphNodeMeta">' + escapeHtml(merchant) + '</div>' +
          '</button>';
        }

        var edgeLines = relatedEdges.map(function (edge) {
          var sourceNode = nodesById[edge.sourceProductId] || nodesById[seedId];
          var targetNode = nodesById[edge.targetProductId];
          if (!targetNode && edge.targetProductId === seedId) targetNode = nodesById[edge.sourceProductId];
          if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) return "";
          var midX = (sourceNode.x + targetNode.x) / 2;
          var midY = (sourceNode.y + targetNode.y) / 2;
          var label = String(edge.relation || "similar") + " " + String(edge.weight || "");
          return '<line class="graphLine ' + relationClass(edge.relation) + '" x1="' + escapeHtml(sourceNode.x) + '" y1="' + escapeHtml(sourceNode.y) + '" x2="' + escapeHtml(targetNode.x) + '" y2="' + escapeHtml(targetNode.y) + '"><title>' + escapeHtml(edge.reason || label) + '</title></line>' +
            '<text class="graphText" x="' + escapeHtml(midX) + '" y="' + escapeHtml(midY) + '" text-anchor="middle">' + escapeHtml(label) + '</text>';
        }).join("");

        var graphNodes = nodes.map(graphNode).join("");
        var legend = '<div class="graphLegend">' +
          '<span class="pill"><span class="legendDot similar"></span>similar</span>' +
          '<span class="pill"><span class="legendDot substitute"></span>substitute</span>' +
          '<span class="pill"><span class="legendDot complement"></span>complement</span>' +
          '</div>';
        return '<section class="section"><h2>Graph UI v1</h2><div class="graphNetwork">' +
          '<svg class="graphCanvas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + edgeLines + '</svg>' +
          graphNodes +
          '</div>' + legend + '</section>';
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
          renderMerchantMix(data) +
          renderProductDetails(data) +
          renderProducts(data) +
          renderComparison(data) +
          renderAdapters(data) +
          renderValidation(data) +
          renderGraph(data);
        notifyHeight();
      }

      function showInlineNotice(message) {
        var current = root.innerHTML;
        root.innerHTML = '<div class="notice">' + escapeHtml(message) + '</div>' + current;
        notifyHeight();
      }

      function setButtonBusy(button, busy, label) {
        if (!button) return;
        if (busy) {
          button.setAttribute("data-label", button.textContent || "");
          button.textContent = label || "Loading";
          button.disabled = true;
          return;
        }
        button.disabled = false;
        if (button.getAttribute("data-label")) {
          button.textContent = button.getAttribute("data-label");
          button.removeAttribute("data-label");
        }
      }

      async function callToolAndRender(toolName, args, button, label) {
        if (!window.openai || !window.openai.callTool) {
          showInlineNotice("ChatGPT widget bridge is not ready. Run the tool from chat once, then try this button again.");
          return;
        }

        setButtonBusy(button, true, label);
        try {
          var result = await window.openai.callTool(toolName, args);
          if (!hydrate(result)) {
            scheduleBootstrapHydration(0);
          }
        } catch (error) {
          console.warn(toolName + " failed", error);
          showInlineNotice("Tool call failed: " + (error && error.message ? error.message : String(error || "unknown error")));
        } finally {
          setButtonBusy(button, false);
        }
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
        event.preventDefault();
        var action = target.getAttribute("data-action");
        if (action === "details") {
          selectedProductId = target.getAttribute("data-id");
          render();
          return;
        }
        if (action === "close-details") {
          selectedProductId = null;
          render();
          return;
        }
        if (action === "open") {
          await openExternal(target.getAttribute("data-url"));
        }
        if (action === "similar") {
          await callToolAndRender("explore_similar_products", { productId: target.getAttribute("data-id"), limit: 6 }, target, "Graph");
        }
        if (action === "checkout") {
          await callToolAndRender("create_checkout_link", { productId: target.getAttribute("data-id"), confirmed: true }, target, "Checkout");
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
