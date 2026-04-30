import { Hono } from "hono";
import { graphql } from "ponder";
import { db } from "ponder:api";
import schema from "ponder:schema";

const app = new Hono();

app.use("/graphql", graphql({ db, schema }));

app.get("/app-status", (context) => {
  return context.json({
    ok: true,
    service: "creator-revenue-center-indexer",
    timestamp: new Date().toISOString()
  });
});

app.get("/", (context) => {
  return context.json({
    service: "creator-revenue-center-indexer",
    status: "live",
    endpoints: ["/app-status", "/graphql"]
  });
});

export default app;
