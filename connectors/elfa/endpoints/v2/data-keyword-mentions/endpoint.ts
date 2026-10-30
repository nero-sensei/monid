import { defineEndpoint, UsageModelKind } from "@shared/core";
import { zV2DataKeywordMentionsQueryParams } from "./schema/inputs.ts";

export default defineEndpoint({
    meta: {
        displayName: "Keyword Mentions Search (v2)",
        summary: "Search crypto X posts by up to five keywords or by account.",
        description: "Search crypto X posts by up to five comma-separated " +
            "keywords, by account username, or both, within a time window " +
            "(default 7d). Cursor-paginated: pass `metadata.cursor` back " +
            "as `cursor` and stop when `data` is empty. `metadata.total` " +
            "is the whole matching set, capped at 10,000. Post text is " +
            "not returned; each post carries its `link`, engagement " +
            "counts, `repostBreakdown` and a minimal `account` " +
            "(`username`, `isVerified`). `mentionedAt` is an ISO 8601 " +
            "string.",
        docsUrl: "https://docs.elfa.ai/api/v2/endpoints/keyword-mentions",
        categories: ["twitter", "crypto-signals"],
        notes: [
            "1 credit per request.",
            "Pass `keywords`, `accountName`, or both. `from` and `to` " +
            "must be between 1 and 30 days apart.",
        ],
    },
    request: { method: "GET", path: "/v2/data/keyword-mentions" },
    input: {
        schema: {
            queryParams: zV2DataKeywordMentionsQueryParams.extend({
                timeWindow: zV2DataKeywordMentionsQueryParams.shape.timeWindow
                    .unwrap().default("7d"),
                limit: zV2DataKeywordMentionsQueryParams.shape.limit.unwrap()
                    .default(20),
            }),
        },
    },
    usage: {
        model: {
            kind: UsageModelKind.PER_CALL,
            label: "call",
            consumes: { credit: "default", amount: 1 },
        },
    },
});
