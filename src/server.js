require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Facebook Page API Docs"
  })
);

app.get("/api-docs.json", (_req, res) => {
  res.json(swaggerSpec);
});

const PORT = process.env.PORT || 3000;
const GRAPH_API_VERSION = process.env.GRAPH_API_VERSION || "v20.0";
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const DEFAULT_INSIGHTS_METRICS =
  process.env.DEFAULT_INSIGHTS_METRICS ||
  "page_impressions,page_post_engagements,page_fans";

function getAccessToken(req) {
  return (
    req.query.access_token ||
    req.headers["x-page-access-token"] ||
    process.env.PAGE_ACCESS_TOKEN
  );
}

function getTokenSource(req) {
  if (req.query.access_token) return "query";
  if (req.headers["x-page-access-token"]) return "x-page-access-token header";
  if (process.env.PAGE_ACCESS_TOKEN) return "env";
  return "missing";
}

async function callGraphApi({ method, path, params, data }) {
  const url = `${GRAPH_BASE_URL}${path}`;

  return axios({
    method,
    url,
    params,
    data,
    timeout: 15000
  });
}

function buildErrorPayload(error) {
  const graphError = error?.response?.data?.error;

  if (graphError) {
    return {
      message: graphError.message,
      type: graphError.type,
      code: graphError.code,
      fbtrace_id: graphError.fbtrace_id
    };
  }

  return {
    message: error.message || "Unexpected error"
  };
}

app.get("/", (_req, res) => {
  res.json({
    service: "Facebook Page API Backend",
    status: "ok",
    version: "1.0.0",
    graphApiVersion: GRAPH_API_VERSION
  });
});

app.get("/api/page/:pageId", async (req, res) => {
  const { pageId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token",
      hint: "Provide access_token query, x-page-access-token header, or PAGE_ACCESS_TOKEN in .env"
    });
  }

  try {
    const fields =
      req.query.fields ||
      "id,name,about,fan_count,followers_count,link,category,picture";

    const response = await callGraphApi({
      method: "get",
      path: `/${pageId}`,
      params: {
        fields,
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to get page info",
      details: buildErrorPayload(error)
    });
  }
});

app.get("/api/page/:pageId/posts", async (req, res) => {
  const { pageId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  try {
    const limit = req.query.limit || 10;
    const fields =
      req.query.fields ||
      "id,message,created_time,permalink_url,full_picture,from";

    const response = await callGraphApi({
      method: "get",
      path: `/${pageId}/posts`,
      params: {
        fields,
        limit,
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to get page posts",
      details: buildErrorPayload(error)
    });
  }
});

app.post("/api/page/:pageId/posts", async (req, res) => {
  const { pageId } = req.params;
  const accessToken = getAccessToken(req);
  const tokenSource = getTokenSource(req);
  const { message, link, published = true } = req.body;

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  if (!message && !link) {
    return res.status(400).json({
      error: "Invalid body",
      hint: "Provide at least one of: message, link"
    });
  }

  if (!/^\d{5,}$/.test(String(pageId))) {
    return res.status(400).json({
      error: "Invalid pageId format",
      hint: "Use the real numeric Facebook Page ID (usually long digits), not placeholders like 1 or page name"
    });
  }

  try {
    const payload = {
      access_token: accessToken,
      published
    };

    if (message) payload.message = message;
    if (link) payload.link = link;

    const response = await callGraphApi({
      method: "post",
      path: `/${pageId}/feed`,
      data: payload
    });

    res.status(201).json({
      message: "Post created",
      result: response.data
    });
  } catch (error) {
    const graphError = error?.response?.data?.error;
    const isUnsupportedPostRequest =
      graphError?.type === "GraphMethodException" && graphError?.code === 100;

    res.status(error?.response?.status || 500).json({
      error: "Failed to create post",
      details: buildErrorPayload(error),
      troubleshooting: isUnsupportedPostRequest
        ? [
            "Verify pageId is correct Facebook Page ID (not 1 or placeholder)",
            "Use a Page Access Token belonging to that exact page",
            "Ensure token has pages_manage_posts and pages_read_engagement",
            "If app is in development mode, your Facebook account must be admin/developer/tester of the app"
          ]
        : undefined,
      debug: {
        pageId,
        tokenSource
      }
    });
  }
});

app.delete("/api/page/post/:postId", async (req, res) => {
  const { postId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  try {
    const response = await callGraphApi({
      method: "delete",
      path: `/${postId}`,
      params: {
        access_token: accessToken
      }
    });

    res.json({
      message: "Delete request completed",
      result: response.data
    });
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to delete post",
      details: buildErrorPayload(error)
    });
  }
});

app.get("/api/page/post/:postId/comments", async (req, res) => {
  const { postId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  try {
    const limit = req.query.limit || 25;
    const fields =
      req.query.fields || "id,message,created_time,from,like_count";

    const response = await callGraphApi({
      method: "get",
      path: `/${postId}/comments`,
      params: {
        fields,
        limit,
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to get post comments",
      details: buildErrorPayload(error)
    });
  }
});

app.get("/api/page/post/:postId/likes", async (req, res) => {
  const { postId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  try {
    const limit = req.query.limit || 25;
    const fields = req.query.fields || "id,name";

    const response = await callGraphApi({
      method: "get",
      path: `/${postId}/likes`,
      params: {
        fields,
        limit,
        summary: true,
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to get post likes",
      details: buildErrorPayload(error)
    });
  }
});

app.get("/api/page/:pageId/insights", async (req, res) => {
  const { pageId } = req.params;
  const accessToken = getAccessToken(req);

  if (!accessToken) {
    return res.status(400).json({
      error: "Missing access token"
    });
  }

  try {
    const metric = req.query.metric || DEFAULT_INSIGHTS_METRICS;
    const period = req.query.period || "day";
    const metrics = String(metric)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (metrics.length === 0) {
      return res.status(400).json({
        error: "Invalid metric query",
        hint: "Provide at least one metric, e.g. metric=page_impressions"
      });
    }

    const insightsData = [];
    const invalidMetrics = [];

    for (const metricName of metrics) {
      try {
        const response = await callGraphApi({
          method: "get",
          path: `/${pageId}/insights`,
          params: {
            metric: metricName,
            period,
            access_token: accessToken
          }
        });

        if (Array.isArray(response.data?.data)) {
          insightsData.push(...response.data.data);
        }
      } catch (metricError) {
        const graphError = metricError?.response?.data?.error;
        const isInvalidMetric =
          graphError?.code === 100 &&
          String(graphError?.message || "").toLowerCase().includes("valid insights metric");

        if (isInvalidMetric) {
          invalidMetrics.push(metricName);
          continue;
        }

        throw metricError;
      }
    }

    if (insightsData.length === 0) {
      return res.status(400).json({
        error: "Failed to get page insights",
        details: {
          message: "All requested metrics are invalid or unavailable for this page/token"
        },
        invalidMetrics,
        hint: "Try metric=page_impressions or metric=page_fans, then adjust based on your page permissions"
      });
    }

    res.json({
      data: insightsData,
      invalidMetrics,
      requestedMetrics: metrics,
      period
    });
  } catch (error) {
    res.status(error?.response?.status || 500).json({
      error: "Failed to get page insights",
      details: buildErrorPayload(error)
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/api-docs`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    const nextPort = Number(PORT) + 1;
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Try: PORT=${nextPort} npm run dev`);
    return;
  }

  console.error("Server failed to start:", error.message);
});
