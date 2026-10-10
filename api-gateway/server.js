
const express = require("express");
const client = require("prom-client");

const app = express();
const PORT = 3000;

const PRODUCT_SERVICE_URL =
  process.env.PRODUCT_SERVICE_URL || "http://localhost:3001";

const ORDER_SERVICE_URL =
  process.env.ORDER_SERVICE_URL || "http://localhost:3002";

app.use(express.json());

const register = new client.Registry();

client.collectDefaultMetrics({
  register: register
});

const requestCounter = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"]
});

const responseTime = new client.Histogram({
  name: "http_response_time_seconds",
  help: "HTTP response time in seconds",
  labelNames: ["method", "route"],
  buckets: [0.1, 0.3, 0.5, 1, 2, 5]
});

register.registerMetric(requestCounter);
register.registerMetric(responseTime);

app.use((req, res, next) => {
  const end = responseTime.startTimer();

  res.on("finish", () => {
    const route = req.route ? req.route.path : req.path;

    requestCounter.inc({
      method: req.method,
      route: route,
      status: String(res.statusCode)
    });

    end({
      method: req.method,
      route: route
    });
  });

  next();
});

async function forwardRequest(targetUrl, req, res) {
  try {
    const options = {
      method: req.method,
      headers: {
        "Content-Type": "application/json"
      }
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, options);
    const text = await response.text();

    res.status(response.status);

    if (response.headers.get("content-type")) {
      res.set("Content-Type", response.headers.get("content-type"));
    }

    res.send(text);
  } catch (error) {
    res.status(502).json({
      error: "Service unavailable",
      message: error.message
    });
  }
}

app.get("/", (req, res) => {
  res.json({
    service: "Mini Shop API Gateway",
    status: "running"
  });
});

app.use("/products", (req, res) => {
  const targetUrl = PRODUCT_SERVICE_URL + req.originalUrl;
  forwardRequest(targetUrl, req, res);
});

app.use("/orders", (req, res) => {
  const targetUrl = ORDER_SERVICE_URL + req.originalUrl;
  forwardRequest(targetUrl, req, res);
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
