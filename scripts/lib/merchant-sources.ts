import type { RobotsSource } from "./robots.js";

export interface MerchantCollectionSource extends RobotsSource {
  collectionStatus:
    | "implemented"
    | "robots_allowed_needs_parser"
    | "blocked_for_generic_collector"
    | "needs_valid_robots"
    | "needs_source_confirmation";
  collectionNotes: string[];
}

export const MERCHANT_COLLECTION_SOURCES: MerchantCollectionSource[] = [
  {
    id: "olive-young",
    displayName: "Olive Young Global",
    baseUrl: "https://global.oliveyoung.com",
    samplePaths: ["/product/detail?prdtNo=GA210003128", "/display", "/product"],
    collectionStatus: "implemented",
    notes: ["Current implementation can use the public product sitemap/detail-data path or the existing local olive-poc dataset as fallback."],
    collectionNotes: [
      "Default target is 500 products via MERCHANT_TARGET_COUNT/OLIVE_TARGET_COUNT.",
      "OLIVE_SOURCE_MODE=auto uses public collection when the local PoC dataset has fewer than the target count.",
      "Local fallback uses C:/Users/SDS/workspace/olive-poc/data/catalog100-3.31/master_products.json.",
    ],
  },
  {
    id: "lotte-home-shopping",
    displayName: "Lotte Home Shopping",
    baseUrl: "https://www.lotteimall.com",
    samplePaths: ["/", "/recommendation/"],
    collectionStatus: "blocked_for_generic_collector",
    collectionNotes: ["robots.txt blocks User-agent * at root; do not crawl without partner permission or an allowed feed/API."],
  },
  {
    id: "lotte-wellfood",
    displayName: "Lotte Wellfood",
    baseUrl: "https://www.lottewellfood.com",
    samplePaths: ["/"],
    collectionStatus: "needs_valid_robots",
    collectionNotes: ["robots.txt was not available during audit; collect only after a valid product source and policy are confirmed."],
  },
  {
    id: "lotte-on",
    displayName: "LotteON",
    baseUrl: "https://www.lotteon.com",
    samplePaths: ["/p/product/", "/m/product/", "/csearch/"],
    collectionStatus: "blocked_for_generic_collector",
    collectionNotes: ["robots.txt allows product paths for specific named bots, but User-agent * is disallowed."],
  },
  {
    id: "lotte-himart",
    displayName: "Lotte Hi-Mart",
    baseUrl: "https://www.e-himart.co.kr",
    samplePaths: ["/", "/llms.txt", "/app/goods/goodsDetail?goodsNo=0000004539"],
    collectionStatus: "implemented",
    collectionNotes: [
      "robots.txt allows User-agent *.",
      "Uses sitemap product URLs and Schema.org Product JSON-LD from product detail pages.",
      "Default target is 500 products via MERCHANT_TARGET_COUNT/HIMART_TARGET_COUNT.",
    ],
  },
  {
    id: "yogiyo",
    displayName: "Yogiyo",
    baseUrl: "https://www.yogiyo.co.kr",
    samplePaths: ["/", "/api/"],
    collectionStatus: "needs_source_confirmation",
    collectionNotes: ["robots.txt disallows /api/ and payment/admin paths; collection needs a public, non-location-sensitive product/menu source or partner access."],
  },
  {
    id: "lotte-chilsung",
    displayName: "Lotte Chilsung Mall",
    baseUrl: "https://www.lottechilsungmall.com",
    samplePaths: ["/"],
    collectionStatus: "needs_valid_robots",
    collectionNotes: ["Candidate mall domain did not resolve during audit; confirm official product URL before collection."],
  },
  {
    id: "musinsa",
    displayName: "Musinsa",
    baseUrl: "https://www.musinsa.com",
    samplePaths: ["/products/", "/auth/"],
    collectionStatus: "blocked_for_generic_collector",
    collectionNotes: ["robots.txt blocks User-agent * and grants access only to named bots/groups; do not use the generic collector."],
  },
  {
    id: "cj-onstyle",
    displayName: "CJ OnStyle",
    baseUrl: "https://www.cjonstyle.com",
    samplePaths: ["/"],
    collectionStatus: "needs_valid_robots",
    collectionNotes: ["robots.txt request returned HTML during audit, so policy is ambiguous until a valid robots endpoint/source is confirmed."],
  },
  {
    id: "lfmall",
    displayName: "LFmall",
    baseUrl: "https://www.lfmall.co.kr",
    samplePaths: ["/"],
    collectionStatus: "blocked_for_generic_collector",
    collectionNotes: ["robots.txt blocks User-agent *; only named bots are allowed."],
  },
];
